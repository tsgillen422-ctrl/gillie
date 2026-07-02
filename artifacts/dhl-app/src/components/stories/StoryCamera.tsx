import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Zap, ZapOff, Timer, Grid3x3, SwitchCamera, Loader2 } from "lucide-react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { STORY_FILTERS } from "@/lib/storyFilters";
import { FACE_LENSES, getFaceLandmarker, drawLensFrame } from "@/lib/faceFilters";

// Snapchat-style story camera: edge-to-edge 9:16 preview with every control
// overlaid on the live view. Live color filters (swipe the preview or tap a
// chip — carried into the editor as CSS metadata) plus live AR face lenses
// (MediaPipe face tracking, baked into the captured JPEG). Flash (torch or
// screen), zoom, 3s/10s timer, and rule-of-thirds grid. Captures a JPEG File
// cropped to the on-screen aspect so photos fill the screen in the editor.

const TIMERS = [0, 3, 10] as const;
const MAX_VIDEO_SECONDS = 30;

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export function StoryCamera({
  onCapture,
  onClose,
}: {
  onCapture: (file: File, filterIdx: number) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [timerIdx, setTimerIdx] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [grid, setGrid] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [filterIdx, setFilterIdx] = useState(0);
  const [filterFlash, setFilterFlash] = useState(false);
  const filterIdxRef = useRef(0);
  filterIdxRef.current = filterIdx;
  const [lensIdx, setLensIdx] = useState(0);
  const [lensStatus, setLensStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recDeliverRef = useRef(false);
  const recAudioRef = useRef<MediaStream | null>(null);
  const recTickRef = useRef<number | null>(null);
  const recAutoStopRef = useRef<number | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastFacesRef = useRef<ReturnType<FaceLandmarker["detectForVideo"]>["faceLandmarks"] | undefined>(undefined);
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const lensStripRef = useRef<HTMLDivElement>(null);

  const changeFilter = useCallback((next: number) => {
    setFilterIdx(next);
    setFilterFlash(true);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFilterFlash(false), 900);
    filterStripRef.current
      ?.querySelector<HTMLElement>(`[data-filter-idx="${next}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);
  useEffect(() => () => { if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current); }, []);

  const selectLens = useCallback((i: number) => {
    setLensIdx(i);
    lensStripRef.current
      ?.querySelector<HTMLElement>(`[data-lens-idx="${i}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    if (i > 0 && !landmarkerRef.current) {
      setLensStatus((s) => (s === "loading" || s === "ready" ? s : "loading"));
      getFaceLandmarker()
        .then((lm) => {
          landmarkerRef.current = lm;
          setLensStatus("ready");
        })
        .catch(() => {
          setLensStatus("error");
          setLensIdx(0); // revert to "no lens" so the user isn't stuck on a dead chip
        });
    }
  }, []);

  // Each stream request gets a token; a late getUserMedia resolution whose
  // token no longer matches (unmount or camera flip) is stopped immediately
  // instead of leaking a live camera track.
  const streamTokenRef = useRef(0);

  const stopStream = useCallback(() => {
    streamTokenRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async (facingMode: "environment" | "user") => {
    setReady(false);
    setError(null);
    stopStream();
    const token = streamTokenRef.current;
    try {
      // IMPORTANT: camera modes are landscape-order (1920x1080, 1280x720…).
      // Requesting portrait-order dimensions (1080x1920) makes iOS fall back
      // to a small center-cropped mode — the "zoomed in at 1x" bug. Ask in
      // landscape order and WebKit auto-rotates the frames for portrait.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (token !== streamTokenRef.current) {
        // Superseded (unmounted or flipped) while waiting — release the stream.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as Record<string, any>;
      setTorchSupported(!!caps.torch);
      if (caps.zoom && typeof caps.zoom.min === "number") {
        setZoomRange({ min: Math.max(1, caps.zoom.min), max: Math.min(8, caps.zoom.max || 8) });
      } else {
        setZoomRange(null);
      }
      setZoom(1);
      setFlashOn(false);
      setReady(true);
    } catch {
      if (token !== streamTokenRef.current) return;
      setError("Couldn't open the camera. Check permission in your device settings, or choose a photo instead.");
    }
  }, [stopStream]);

  useEffect(() => {
    startStream(facing);
    return stopStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // Clear any pending countdown/flash timers when the camera goes away.
  const timerIdsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      timerIdsRef.current.forEach((id) => {
        window.clearInterval(id);
        window.clearTimeout(id);
      });
      timerIdsRef.current = [];
    };
  }, []);

  // Torch + hardware zoom via track constraints (best-effort).
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const advanced: Record<string, unknown> = {};
    if (torchSupported) advanced.torch = flashOn;
    if (zoomRange) advanced.zoom = zoom;
    if (Object.keys(advanced).length) {
      track.applyConstraints({ advanced: [advanced] } as MediaTrackConstraints).catch(() => {});
    }
  }, [flashOn, zoom, torchSupported, zoomRange]);

  const cssZoom = zoomRange ? 1 : zoom; // fall back to CSS zoom when hardware zoom is unavailable

  // Live AR lens loop: detect landmarks per video frame and draw the lens on
  // the overlay canvas. The overlay lives inside the same transform wrapper as
  // the video, so mirroring and CSS zoom apply to both identically.
  // Lenses only apply to photos (they're baked at capture); force them off in
  // video mode so the preview never shows an effect the recording won't have.
  const activeLens = mode === "video" ? "none" : (FACE_LENSES[lensIdx]?.name ?? "none");
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (activeLens === "none" || lensStatus !== "ready" || !ready) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let raf = 0;
    let lastVideoTime = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      const stage = stageRef.current;
      const lm = landmarkerRef.current;
      if (!video || !stage || !lm || !video.videoWidth) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = stage.clientWidth;
      const ch = stage.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }
      const now = performance.now();
      let faces = lastFacesRef.current;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          faces = lm.detectForVideo(video, now).faceLandmarks;
          lastFacesRef.current = faces;
        } catch {
          faces = undefined;
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      drawLensFrame(ctx, activeLens, faces?.[0], { vw: video.videoWidth, vh: video.videoHeight, cw, ch }, now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [activeLens, lensStatus, ready]);

  const clearRecTimers = useCallback(() => {
    if (recTickRef.current) window.clearInterval(recTickRef.current);
    if (recAutoStopRef.current) window.clearTimeout(recAutoStopRef.current);
    recTickRef.current = null;
    recAutoStopRef.current = null;
  }, []);

  const stopRecording = useCallback((deliver: boolean) => {
    const rec = recorderRef.current;
    if (!rec) return;
    recDeliverRef.current = deliver;
    clearRecTimers();
    if (rec.state !== "inactive") {
      try { rec.stop(); } catch { /* already stopped */ }
    }
  }, [clearRecTimers]);

  const recStartingRef = useRef(false);
  const startRecording = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || recorderRef.current || recStartingRef.current) return;
    recStartingRef.current = true;
    const token = streamTokenRef.current;
    // Ask for the mic just-in-time so photo-only sessions never prompt for it.
    let audio: MediaStream | null = null;
    try {
      audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      audio = null; // mic denied — record silent video rather than failing
    }
    recStartingRef.current = false;
    // The camera may have been closed or flipped while the mic prompt was up —
    // recording from the stale (stopped) stream would produce an empty file.
    if (token !== streamTokenRef.current || streamRef.current !== stream || recorderRef.current) {
      audio?.getTracks().forEach((t) => t.stop());
      return;
    }
    recAudioRef.current = audio;
    const combined = new MediaStream([
      ...stream.getVideoTracks(),
      ...(audio?.getAudioTracks() ?? []),
    ]);
    const mime = pickRecorderMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(combined, mime ? { mimeType: mime } : undefined);
    } catch {
      audio?.getTracks().forEach((t) => t.stop());
      recAudioRef.current = null;
      setError("Video recording isn't supported on this device.");
      return;
    }
    recChunksRef.current = [];
    recDeliverRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      recorderRef.current = null;
      recAudioRef.current?.getTracks().forEach((t) => t.stop());
      recAudioRef.current = null;
      setRecording(false);
      setRecElapsed(0);
      if (!recDeliverRef.current) return;
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(recChunksRef.current, { type });
      recChunksRef.current = [];
      if (blob.size === 0) return;
      const ext = type.includes("mp4") ? "mp4" : "webm";
      stopStream();
      // Use the ref so a filter swipe during recording still carries through.
      onCapture(new File([blob], `story-${Date.now()}.${ext}`, { type }), filterIdxRef.current);
    };
    recorderRef.current = rec;
    rec.start(1000); // gather chunks every second
    setRecording(true);
    setRecElapsed(0);
    recTickRef.current = window.setInterval(() => setRecElapsed((s) => s + 1), 1000);
    recAutoStopRef.current = window.setTimeout(() => stopRecording(true), MAX_VIDEO_SECONDS * 1000);
  }, [onCapture, stopRecording, stopStream]);

  // Abort any in-flight recording when the camera unmounts.
  useEffect(() => {
    return () => {
      stopRecording(false);
      recAudioRef.current?.getTracks().forEach((t) => t.stop());
      recAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !video.videoWidth || !stage) return;
    // Crop the sensor frame to exactly what's on screen: the object-cover
    // region for the stage's aspect ratio, further center-cropped by CSS zoom.
    const stageAspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    let srcW = Math.min(video.videoWidth, video.videoHeight * stageAspect);
    let srcH = Math.min(video.videoHeight, video.videoWidth / stageAspect);
    srcW /= cssZoom;
    srcH /= cssZoom;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(srcW);
    canvas.height = Math.round(srcH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      // Mirror the selfie so the photo matches what the user saw.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      video,
      (video.videoWidth - srcW) / 2,
      (video.videoHeight - srcH) / 2,
      srcW,
      srcH,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    // Bake the AR lens overlay into the photo. The visible overlay region is
    // the center 1/cssZoom of the overlay canvas (the wrapper scales both).
    const overlay = overlayRef.current;
    if (overlay && overlay.width > 0 && activeLens !== "none" && lensStatus === "ready") {
      const ow = overlay.width / cssZoom;
      const oh = overlay.height / cssZoom;
      ctx.drawImage(
        overlay,
        (overlay.width - ow) / 2,
        (overlay.height - oh) / 2,
        ow,
        oh,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        onCapture(new File([blob], `story-${Date.now()}.jpg`, { type: "image/jpeg" }), filterIdx);
      },
      "image/jpeg",
      0.9,
    );
  }, [cssZoom, facing, filterIdx, activeLens, lensStatus, onCapture, stopStream]);

  const handleShutter = () => {
    if (countdown != null) return;
    if (mode === "video") {
      if (recording) stopRecording(true);
      else startRecording();
      return;
    }
    const delay = TIMERS[timerIdx];
    const fire = () => {
      if (flashOn && !torchSupported) {
        // Screen flash for front camera / devices without torch.
        setScreenFlash(true);
        const t1 = window.setTimeout(() => {
          doCapture();
          const t2 = window.setTimeout(() => setScreenFlash(false), 150);
          timerIdsRef.current.push(t2);
        }, 180);
        timerIdsRef.current.push(t1);
      } else {
        doCapture();
      }
    };
    if (delay === 0) return fire();
    let left = delay;
    setCountdown(left);
    const id = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(id);
        setCountdown(null);
        fire();
      } else {
        setCountdown(left);
      }
    }, 1000);
    timerIdsRef.current.push(id);
  };

  const liveFilter = STORY_FILTERS[filterIdx] ?? STORY_FILTERS[0];

  const onPreviewPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button,input")) return;
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPreviewPointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const dir = dx < 0 ? 1 : -1;
      changeFilter((filterIdx + dir + STORY_FILTERS.length) % STORY_FILTERS.length);
    }
  };

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[110] overflow-hidden bg-black" data-testid="story-camera">
      {/* edge-to-edge stage */}
      <div
        ref={stageRef}
        className="absolute inset-0"
        onPointerDown={onPreviewPointerDown}
        onPointerUp={onPreviewPointerUp}
      >
        {/* video + AR overlay share one transform so mirror/zoom stay aligned */}
        <div
          className="absolute inset-0"
          style={{
            transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${cssZoom})`,
            transformOrigin: "center",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
            style={{ filter: liveFilter.css || undefined }}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>

        {grid && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
            <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
          </div>
        )}
        {screenFlash && <div className="absolute inset-0 bg-white" />}
        {countdown != null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl font-bold text-white drop-shadow-lg">{countdown}</span>
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/80" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <p className="text-center text-sm text-white/90">{error}</p>
          </div>
        )}
        {recording && (
          <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+64px)] flex justify-center">
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              0:{String(recElapsed).padStart(2, "0")} / 0:{MAX_VIDEO_SECONDS}
            </span>
          </div>
        )}
        {filterFlash && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
            <span className="animate-in fade-in zoom-in-95 rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              {liveFilter.label}
            </span>
          </div>
        )}

        {/* top controls */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent pb-8">
          <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
            <button
              type="button"
              onClick={() => { stopStream(); onClose(); }}
              className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm"
              aria-label="Close camera"
              data-testid="button-camera-close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFlashOn((f) => !f)}
                className={`rounded-full p-2.5 backdrop-blur-sm ${flashOn ? "bg-amber-400 text-black" : "bg-black/40 text-white"}`}
                aria-label="Flash"
                data-testid="button-camera-flash"
              >
                {flashOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setTimerIdx((i) => (i + 1) % TIMERS.length)}
                className={`relative rounded-full p-2.5 backdrop-blur-sm ${TIMERS[timerIdx] ? "bg-white text-black" : "bg-black/40 text-white"}`}
                aria-label="Timer"
                data-testid="button-camera-timer"
              >
                <Timer className="h-5 w-5" />
                {TIMERS[timerIdx] > 0 && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {TIMERS[timerIdx]}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setGrid((g) => !g)}
                className={`rounded-full p-2.5 backdrop-blur-sm ${grid ? "bg-white text-black" : "bg-black/40 text-white"}`}
                aria-label="Grid"
                data-testid="button-camera-grid"
              >
                <Grid3x3 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                disabled={recording}
                className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm disabled:opacity-40"
                aria-label="Flip camera"
                data-testid="button-camera-flip"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* bottom overlay: zoom, filters, lenses, shutter */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent pt-10">
          <div className="flex items-center justify-center gap-3 px-10 pb-1.5">
            <span className="text-[11px] font-semibold text-white/70">1x</span>
            <input
              type="range"
              min={zoomRange?.min ?? 1}
              max={zoomRange?.max ?? 3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1 w-full max-w-44 accent-white"
              aria-label="Zoom"
              data-testid="slider-camera-zoom"
            />
            <span className="text-[11px] font-semibold text-white/70">{(zoomRange?.max ?? 3).toFixed(0)}x</span>
          </div>

          {/* color filter chips */}
          <div ref={filterStripRef} className="flex gap-1.5 overflow-x-auto px-3 pb-2" data-testid="camera-filter-strip">
            {STORY_FILTERS.map((f, i) => (
              <button
                key={f.name}
                type="button"
                data-filter-idx={i}
                onClick={() => changeFilter(i)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm transition ${
                  filterIdx === i ? "bg-white text-black" : "bg-white/15 text-white/85"
                }`}
                data-testid={`button-camera-filter-${f.name}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* AR lens carousel (photo only — lenses are baked at capture) */}
          <div
            ref={lensStripRef}
            className={`flex items-center gap-2 overflow-x-auto px-3 pb-2.5 ${mode === "video" ? "hidden" : ""}`}
            data-testid="camera-lens-strip"
          >
            {FACE_LENSES.map((l, i) => (
              <button
                key={l.name}
                type="button"
                data-lens-idx={i}
                onClick={() => selectLens(i)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl backdrop-blur-sm transition ${
                  lensIdx === i ? "scale-110 bg-white/90 ring-2 ring-white" : "bg-white/15"
                }`}
                aria-label={l.label}
                data-testid={`button-camera-lens-${l.name}`}
              >
                {lensStatus === "loading" && lensIdx === i && i > 0 ? (
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                ) : (
                  l.icon
                )}
              </button>
            ))}
            {lensStatus === "error" && (
              <span className="shrink-0 text-[11px] text-white/70">Face effects unavailable on this device</span>
            )}
          </div>

          {/* shutter + photo/video toggle */}
          <div className="flex flex-col items-center gap-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)]">
            <button
              type="button"
              onClick={handleShutter}
              disabled={!ready || countdown != null}
              className={`flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-50 ${
                mode === "video" ? (recording ? "bg-red-500/30" : "bg-white/25") : "bg-white/25"
              }`}
              aria-label={mode === "video" ? (recording ? "Stop recording" : "Record video") : "Take photo"}
              data-testid="button-camera-shutter"
            >
              {mode === "video" &&
                (recording ? (
                  <span className="h-7 w-7 rounded-md bg-red-500" />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-red-500" />
                ))}
            </button>
            <div className="flex items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
              {(["photo", "video"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { if (!recording) setMode(m); }}
                  className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    mode === m ? "bg-white text-black" : "text-white/80"
                  }`}
                  data-testid={`button-camera-mode-${m}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
