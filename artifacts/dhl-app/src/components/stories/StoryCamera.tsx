import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Zap, ZapOff, Timer, Grid3x3, SwitchCamera, Loader2 } from "lucide-react";

// In-app photo camera for stories: flash (torch on supported devices, screen
// flash otherwise), pinch-free zoom slider, 3s/10s timer, and rule-of-thirds
// grid. Captures a JPEG File and hands it back to the composer.

const TIMERS = [0, 3, 10] as const;

export function StoryCamera({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1440 }, height: { ideal: 2560 } },
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

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    // When zoom is CSS-only, crop the center region so the capture matches the preview.
    const cropW = video.videoWidth / cssZoom;
    const cropH = video.videoHeight / cssZoom;
    canvas.width = Math.round(cropW);
    canvas.height = Math.round(cropH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      // Mirror the selfie so the photo matches what the user saw.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      video,
      (video.videoWidth - cropW) / 2,
      (video.videoHeight - cropH) / 2,
      cropW,
      cropH,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        onCapture(new File([blob], `story-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }, [cssZoom, facing, onCapture, stopStream]);

  const handleShutter = () => {
    if (countdown != null) return;
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

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-black" data-testid="story-camera">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          style={{
            transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${cssZoom})`,
            transformOrigin: "center",
          }}
        />
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

        {/* top controls */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
          <button
            type="button"
            onClick={() => { stopStream(); onClose(); }}
            className="rounded-full bg-black/40 p-2.5 text-white"
            aria-label="Close camera"
            data-testid="button-camera-close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFlashOn((f) => !f)}
              className={`rounded-full p-2.5 ${flashOn ? "bg-amber-400 text-black" : "bg-black/40 text-white"}`}
              aria-label="Flash"
              data-testid="button-camera-flash"
            >
              {flashOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => setTimerIdx((i) => (i + 1) % TIMERS.length)}
              className={`relative rounded-full p-2.5 ${TIMERS[timerIdx] ? "bg-white text-black" : "bg-black/40 text-white"}`}
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
              className={`rounded-full p-2.5 ${grid ? "bg-white text-black" : "bg-black/40 text-white"}`}
              aria-label="Grid"
              data-testid="button-camera-grid"
            >
              <Grid3x3 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* zoom slider */}
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 px-10">
          <span className="text-xs font-semibold text-white/80">1x</span>
          <input
            type="range"
            min={zoomRange?.min ?? 1}
            max={zoomRange?.max ?? 3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-full max-w-52 accent-white"
            aria-label="Zoom"
            data-testid="slider-camera-zoom"
          />
          <span className="text-xs font-semibold text-white/80">{(zoomRange?.max ?? 3).toFixed(0)}x</span>
        </div>
      </div>

      {/* bottom bar */}
      <div className="flex items-center justify-between bg-black px-10 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-4">
        <div className="w-11" />
        <button
          type="button"
          onClick={handleShutter}
          disabled={!ready || countdown != null}
          className="h-[72px] w-[72px] rounded-full border-4 border-white bg-white/25 disabled:opacity-50"
          aria-label="Take photo"
          data-testid="button-camera-shutter"
        />
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="rounded-full bg-white/15 p-3 text-white"
          aria-label="Flip camera"
          data-testid="button-camera-flip"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
