import React from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import {
  X,
  Check,
  Crop as CropIcon,
  Sparkles,
  SlidersHorizontal,
  Type,
  Sticker as StickerIcon,
  PenLine,
  RotateCw,
  Undo2,
  Redo2,
  Trash2,
  Loader2,
  Search,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchGifs, getSearchGifsQueryKey, type StorySticker } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { FILTER_CATEGORIES, STORY_FILTERS } from "@/lib/storyFilters";
import {
  DEFAULT_ADJUSTMENTS,
  adjustmentsAreDefault,
  applyPixelEdits,
  canvasToJpegFile,
  loadImage,
  renderCroppedCanvas,
  type Adjustments,
  type CropAreaPixels,
} from "@/lib/imageEdit";
import { bakeStickers } from "@/lib/bakeStickers";
import { StickerLayer } from "@/components/stories/StickerLayer";
import { DrawCanvas, type DrawCanvasHandle, type DrawTool } from "@/components/stories/DrawCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

// Full-screen Instagram-style media editor for the post composer. All edits
// are non-destructive while editing; tapping Save flattens image edits into a
// brand-new upload (the original file is never touched). Videos support
// trimming only — trim points are stored as metadata, no re-encoding.

export type ComposerMediaItem = {
  type: "image" | "video";
  url: string;
  trimStart?: number;
  trimEnd?: number;
};

const MAX_STICKERS = 12;

const TEXT_FONT_OPTIONS = [
  { id: "classic", label: "Classic" },
  { id: "heavy", label: "Bold" },
  { id: "serif", label: "Serif" },
  { id: "script", label: "Script" },
  { id: "mono", label: "Typewriter" },
];

const TEXT_STYLE_OPTIONS = [
  { id: "plain", label: "Plain" },
  { id: "shadow", label: "Shadow" },
  { id: "outline", label: "Outline" },
  { id: "bubble", label: "Bubble" },
  { id: "gradient", label: "Gradient" },
  { id: "neon", label: "Neon" },
];

const TEXT_COLORS = ["#ffffff", "#0f172a", "#facc15", "#fb7185", "#4ade80", "#38bdf8", "#a78bfa", "#fb923c"];

const EMOJIS = [
  "🌊", "🚤", "⛵", "🎣", "🐟", "🔥", "☀️", "😎", "🍉", "🍹", "🏖️", "⚓",
  "❤️", "👏", "😂", "🤙", "💯", "🙌", "👀", "🥳", "💪", "⭐", "🌅", "🦆",
];

const DRAW_TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "marker", label: "Marker" },
  { id: "neon", label: "Neon" },
  { id: "highlighter", label: "Highlight" },
  { id: "eraser", label: "Eraser" },
];

const DRAW_COLORS = ["#ffffff", "#0f172a", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];

const ASPECTS: { id: string; label: string; value: number | null }[] = [
  { id: "original", label: "Original", value: null },
  { id: "square", label: "1:1", value: 1 },
  { id: "portrait", label: "4:5", value: 4 / 5 },
  { id: "wide", label: "16:9", value: 16 / 9 },
];

const ADJUSTMENT_SLIDERS: { key: keyof Adjustments; label: string }[] = [
  { key: "brightness", label: "Brightness" },
  { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" },
  { key: "highlights", label: "Highlights" },
  { key: "shadows", label: "Shadows" },
];

type Tab = "crop" | "filters" | "adjust" | "text" | "stickers" | "draw";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}

export function MediaEditor({
  item,
  onClose,
  onSave,
}: {
  item: ComposerMediaItem;
  onClose: () => void;
  onSave: (next: ComposerMediaItem) => void;
}) {
  const isVideo = item.type === "video";
  const [saving, setSaving] = React.useState(false);
  const { uploadFile } = useUpload();

  // ------------------------------------------------------------------ image
  const [tab, setTab] = React.useState<Tab>(isVideo ? "crop" : "filters");
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [straighten, setStraighten] = React.useState(0); // -45..45
  const [rotBase, setRotBase] = React.useState(0); // 0/90/180/270
  const rotation = rotBase + straighten;
  const [aspectId, setAspectId] = React.useState("original");
  const [naturalAspect, setNaturalAspect] = React.useState(4 / 3);
  const [cropAreaPixels, setCropAreaPixels] = React.useState<CropAreaPixels | null>(null);
  const [cropDirty, setCropDirty] = React.useState(false);

  const [filterIdx, setFilterIdx] = React.useState(0);
  const [adjustments, setAdjustments] = React.useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [stickers, setStickers] = React.useState<StorySticker[]>([]);

  // Text tool drafts
  const [draftText, setDraftText] = React.useState("");
  const [draftFont, setDraftFont] = React.useState("classic");
  const [draftStyle, setDraftStyle] = React.useState("shadow");
  const [draftColor, setDraftColor] = React.useState("#ffffff");

  // Sticker sheet
  const [gifQuery, setGifQuery] = React.useState("");
  const [gifDebounced, setGifDebounced] = React.useState("");
  React.useEffect(() => {
    const t = window.setTimeout(() => setGifDebounced(gifQuery.trim()), 350);
    return () => window.clearTimeout(t);
  }, [gifQuery]);
  const gifParams = { q: gifDebounced || undefined, kind: "stickers" as const };
  const { data: gifResults, isLoading: gifsLoading } = useSearchGifs(gifParams, {
    query: { enabled: !isVideo && tab === "stickers" && !!gifDebounced, queryKey: getSearchGifsQueryKey(gifParams) },
  });

  // Draw
  const [drawTool, setDrawTool] = React.useState<DrawTool>("pen");
  const [drawColor, setDrawColor] = React.useState("#ffffff");
  const [drawSize, setDrawSize] = React.useState(10);
  const [strokeCount, setStrokeCount] = React.useState(0);
  const drawRef = React.useRef<DrawCanvasHandle>(null);

  const stageRef = React.useRef<HTMLDivElement>(null);

  const filter = STORY_FILTERS[filterIdx] ?? STORY_FILTERS[0];

  // Stage preview: cropped image (+ baked highlights/shadows, which CSS can't
  // express) regenerated debounced; preset filter + basic adjustments preview
  // live via CSS so sliders feel instant. The CSS math matches the pixel math.
  const [stageSrc, setStageSrc] = React.useState<string>(item.url);
  const [stageAspect, setStageAspect] = React.useState(4 / 3);
  React.useEffect(() => {
    if (isVideo) return;
    loadImage(item.url)
      .then((img) => {
        const a = img.naturalWidth / Math.max(1, img.naturalHeight);
        setNaturalAspect(a);
        setStageAspect(a);
      })
      .catch(() => {});
  }, [item.url, isVideo]);

  const hlSh = adjustments.highlights !== 0 || adjustments.shadows !== 0;
  React.useEffect(() => {
    if (isVideo) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        if (!cropDirty && !hlSh) {
          setStageSrc(item.url);
          setStageAspect(naturalAspect);
          return;
        }
        const canvas = await renderCroppedCanvas(item.url, cropDirty ? cropAreaPixels : null, cropDirty ? rotation : 0);
        // Downscale for a fast preview.
        const maxEdge = 900;
        const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
        let preview = canvas;
        if (scale < 1) {
          preview = document.createElement("canvas");
          preview.width = Math.max(1, Math.round(canvas.width * scale));
          preview.height = Math.max(1, Math.round(canvas.height * scale));
          preview.getContext("2d")?.drawImage(canvas, 0, 0, preview.width, preview.height);
        }
        if (hlSh) {
          applyPixelEdits(preview, "", {
            ...DEFAULT_ADJUSTMENTS,
            highlights: adjustments.highlights,
            shadows: adjustments.shadows,
          });
        }
        if (!cancelled) {
          setStageSrc(preview.toDataURL("image/jpeg", 0.9));
          setStageAspect(preview.width / Math.max(1, preview.height));
        }
      } catch {
        // keep previous preview
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [isVideo, item.url, cropDirty, cropAreaPixels, rotation, hlSh, adjustments.highlights, adjustments.shadows, naturalAspect]);

  const cssPreviewFilter = React.useMemo(() => {
    const parts: string[] = [];
    if (filter.css) parts.push(filter.css);
    if (adjustments.brightness !== 0) parts.push(`brightness(${1 + adjustments.brightness / 200})`);
    if (adjustments.contrast !== 0) parts.push(`contrast(${1 + adjustments.contrast / 200})`);
    if (adjustments.saturation !== 0) parts.push(`saturate(${1 + adjustments.saturation / 100})`);
    return parts.join(" ");
  }, [filter.css, adjustments.brightness, adjustments.contrast, adjustments.saturation]);

  const addSticker = (sticker: Omit<StorySticker, "x" | "y">) => {
    if (stickers.length >= MAX_STICKERS) return void toast.error("That's the sticker limit for one photo.");
    const n = stickers.length;
    setStickers((s) => [...s, { ...sticker, x: 0.5, y: Math.min(0.75, 0.35 + n * 0.07) } as StorySticker]);
  };

  const addTextSticker = () => {
    const value = draftText.trim();
    if (!value) return;
    addSticker({ type: "text", data: { text: value.slice(0, 200), font: draftFont, style: draftStyle, color: draftColor } });
    setDraftText("");
    setTab("stickers");
  };

  // ------------------------------------------------------------------ video
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = React.useState(0);
  const [trimStart, setTrimStart] = React.useState(item.trimStart ?? 0);
  const [trimEnd, setTrimEnd] = React.useState<number>(item.trimEnd ?? 0);
  const [playing, setPlaying] = React.useState(false);

  const onLoadedMeta = () => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    setDuration(v.duration);
    setTrimEnd((prev) => (prev > 0 && prev <= v.duration ? prev : v.duration));
    if (item.trimStart) v.currentTime = item.trimStart;
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const end = trimEnd || duration;
    if (v.currentTime >= end - 0.05 || v.currentTime < trimStart - 0.25) {
      v.currentTime = trimStart;
      if (v.paused) setPlaying(false);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= (trimEnd || duration)) v.currentTime = trimStart;
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const seekPreview = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = t;
  };

  // ------------------------------------------------------------------- save
  const hasImageEdits =
    cropDirty || filterIdx !== 0 || !adjustmentsAreDefault(adjustments) || stickers.length > 0 || strokeCount > 0;

  const handleSave = async () => {
    if (saving) return;
    if (isVideo) {
      const end = trimEnd && duration && trimEnd < duration - 0.05 ? trimEnd : undefined;
      const start = trimStart > 0.05 ? trimStart : undefined;
      onSave({ ...item, trimStart: start, trimEnd: end });
      return;
    }
    if (!hasImageEdits) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const canvas = await renderCroppedCanvas(item.url, cropDirty ? cropAreaPixels : null, cropDirty ? rotation : 0);
      // Cap output size so flattened files stay reasonable.
      const maxEdge = 2048;
      let out = canvas;
      const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
      if (scale < 1) {
        out = document.createElement("canvas");
        out.width = Math.max(1, Math.round(canvas.width * scale));
        out.height = Math.max(1, Math.round(canvas.height * scale));
        out.getContext("2d")?.drawImage(canvas, 0, 0, out.width, out.height);
      }
      applyPixelEdits(out, filter.css, adjustments);
      const stageW = stageRef.current?.getBoundingClientRect().width ?? out.width;
      await bakeStickers(out, stickers, stageW);
      if (drawRef.current?.hasStrokes()) {
        const overlay = drawRef.current.renderTo(out.width, out.height);
        out.getContext("2d")?.drawImage(overlay, 0, 0);
      }
      const file = await canvasToJpegFile(out, `post-edit-${Date.now()}.jpg`);
      const res = await uploadFile(file);
      if (!res?.objectPath) throw new Error("upload failed");
      onSave({ type: "image", url: `/api/storage${res.objectPath}` });
    } catch {
      toast.error("Couldn't save your edits.");
    } finally {
      setSaving(false);
    }
  };

  const imageTabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "crop", label: "Crop", icon: CropIcon },
    { id: "filters", label: "Filters", icon: Sparkles },
    { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
    { id: "text", label: "Text", icon: Type },
    { id: "stickers", label: "Stickers", icon: StickerIcon },
    { id: "draw", label: "Draw", icon: PenLine },
  ];

  const aspect = ASPECTS.find((a) => a.id === aspectId)?.value ?? null;

  return createPortal(
    // pointer-events-auto is REQUIRED: the composer Radix Dialog is open under
    // this portal and sets pointer-events:none on <body>, which we'd inherit —
    // making every tab/filter/slider in here dead on touch devices.
    <div className="pointer-events-auto fixed inset-0 z-[120] flex flex-col bg-black" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <Button type="button" variant="ghost" size="icon" className="text-white" onClick={onClose} disabled={saving} data-testid="button-editor-close">
          <X className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold text-white">{isVideo ? "Trim video" : "Edit photo"}</span>
        <Button type="button" variant="ghost" size="icon" className="text-white" onClick={handleSave} disabled={saving} data-testid="button-editor-save">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        </Button>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        {isVideo ? (
          <div className="relative flex h-full w-full items-center justify-center">
            <video
              ref={videoRef}
              src={item.url}
              playsInline
              preload="metadata"
              className="max-h-full max-w-full"
              onLoadedMetadata={onLoadedMeta}
              onTimeUpdate={onTimeUpdate}
              onEnded={() => setPlaying(false)}
              data-testid="video-editor-preview"
            />
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center"
              data-testid="button-editor-playpause"
            >
              {!playing && (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                  <Play className="ml-1 h-8 w-8 text-white" />
                </span>
              )}
            </button>
          </div>
        ) : tab === "crop" ? (
          <div className="relative h-full w-full">
            <Cropper
              image={item.url}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect ?? naturalAspect}
              showGrid
              minZoom={1}
              maxZoom={4}
              zoomSpeed={0.2}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_a, px) => {
                setCropAreaPixels(px);
                setCropDirty(true);
              }}
            />
          </div>
        ) : (
          <div
            ref={stageRef}
            className="relative m-auto max-h-full max-w-full overflow-hidden"
            style={{ aspectRatio: `${stageAspect}` }}
          >
            <img
              src={stageSrc}
              alt="Editing"
              className="h-full w-full select-none object-contain"
              style={{ filter: cssPreviewFilter || undefined }}
              draggable={false}
            />
            <StickerLayer stickers={stickers} editable={tab !== "draw"} onChange={setStickers} />
            <DrawCanvas
              ref={drawRef}
              active={tab === "draw"}
              tool={drawTool}
              color={drawColor}
              size={drawSize}
              onStrokesChange={setStrokeCount}
            />
          </div>
        )}
      </div>

      {/* Tool panel */}
      <div className="shrink-0 space-y-2 px-3 pb-2 pt-2">
        {isVideo ? (
          <div className="space-y-3 rounded-xl bg-white/5 p-3">
            <div className="flex items-center justify-between text-xs text-white/80">
              <span>Start {fmtTime(trimStart)}</span>
              <button type="button" onClick={togglePlay} className="rounded-full bg-white/10 p-2 text-white" data-testid="button-editor-play-small">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <span>End {fmtTime(trimEnd || duration)}</span>
            </div>
            <div className="space-y-2">
              <Slider
                value={[trimStart]}
                min={0}
                max={Math.max(0.1, (trimEnd || duration) - 0.5)}
                step={0.1}
                disabled={!duration}
                onValueChange={(v) => {
                  setTrimStart(v[0]);
                  seekPreview(v[0]);
                }}
                aria-label="Trim start"
                data-testid="slider-trim-start"
              />
              <Slider
                value={[trimEnd || duration]}
                min={Math.min(duration, trimStart + 0.5)}
                max={Math.max(0.1, duration)}
                step={0.1}
                disabled={!duration}
                onValueChange={(v) => {
                  setTrimEnd(v[0]);
                  seekPreview(v[0]);
                }}
                aria-label="Trim end"
                data-testid="slider-trim-end"
              />
            </div>
            <p className="text-center text-[11px] text-white/60">
              {duration ? `Clip length ${fmtTime(Math.max(0, (trimEnd || duration) - trimStart))}` : "Loading video…"}
            </p>
          </div>
        ) : (
          <>
            {tab === "crop" && (
              <div className="space-y-2 rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {ASPECTS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAspectId(a.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${aspectId === a.id ? "bg-white text-black" : "bg-white/10 text-white"}`}
                        data-testid={`button-aspect-${a.id}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRotBase((r) => (r + 90) % 360)}
                    className="rounded-full bg-white/10 p-2 text-white"
                    aria-label="Rotate 90 degrees"
                    data-testid="button-rotate-90"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-white/70">Straighten</span>
                  <Slider
                    value={[straighten]}
                    min={-45}
                    max={45}
                    step={1}
                    onValueChange={(v) => setStraighten(v[0])}
                    aria-label="Straighten"
                    data-testid="slider-straighten"
                  />
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-white/70">{straighten}°</span>
                </div>
              </div>
            )}

            {tab === "filters" && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTER_CATEGORIES.flatMap((c) => c.filters).map((f) => {
                  const idx = STORY_FILTERS.findIndex((x) => x.name === f.name);
                  return (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setFilterIdx(idx)}
                      className="shrink-0 text-center"
                      data-testid={`button-filter-${f.name}`}
                    >
                      <span className="block h-14 w-14 overflow-hidden rounded-lg border-2 border-transparent bg-white/5" style={{ borderColor: filterIdx === idx ? "#fff" : "transparent" }}>
                        <img src={stageSrc} alt={f.label} className="h-full w-full object-cover" style={{ filter: f.css || undefined }} />
                      </span>
                      <span className={`mt-0.5 block max-w-14 truncate text-[10px] ${filterIdx === idx ? "text-white" : "text-white/60"}`}>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === "adjust" && (
              <div className="space-y-2.5 rounded-xl bg-white/5 p-3">
                {ADJUSTMENT_SLIDERS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-white/70">{label}</span>
                    <Slider
                      value={[adjustments[key]]}
                      min={-100}
                      max={100}
                      step={1}
                      onValueChange={(v) => setAdjustments((a) => ({ ...a, [key]: v[0] }))}
                      aria-label={label}
                      data-testid={`slider-adjust-${key}`}
                    />
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-white/70">{adjustments[key]}</span>
                  </div>
                ))}
                <button
                  type="button"
                  className="w-full text-center text-xs text-white/60 underline-offset-2 hover:underline"
                  onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
                  data-testid="button-adjust-reset"
                >
                  Reset adjustments
                </button>
              </div>
            )}

            {tab === "text" && (
              <div className="space-y-2 rounded-xl bg-white/5 p-3">
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Type something…"
                  rows={2}
                  maxLength={200}
                  className="border-white/20 bg-black/40 text-white placeholder:text-white/40"
                  data-testid="input-text-sticker"
                />
                <div className="flex gap-1.5 overflow-x-auto">
                  {TEXT_FONT_OPTIONS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setDraftFont(f.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${draftFont === f.id ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 overflow-x-auto">
                  {TEXT_STYLE_OPTIONS.map((s) => (
                    <button key={s.id} type="button" onClick={() => setDraftStyle(s.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${draftStyle === s.id ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {TEXT_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setDraftColor(c)} className="h-6 w-6 rounded-full border-2" style={{ backgroundColor: c, borderColor: draftColor === c ? "#fff" : "transparent" }} aria-label={`Color ${c}`} />
                    ))}
                  </div>
                  <Button type="button" size="sm" onClick={addTextSticker} disabled={!draftText.trim()} data-testid="button-add-text">
                    Add
                  </Button>
                </div>
              </div>
            )}

            {tab === "stickers" && (
              <div className="space-y-2 rounded-xl bg-white/5 p-3">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => addSticker({ type: "emoji", data: { emoji: em } })} className="rounded-lg p-1.5 text-xl hover:bg-white/10" data-testid={`button-emoji-${em}`}>
                      {em}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    placeholder="Search GIF stickers…"
                    className="border-white/20 bg-black/40 pl-8 text-white placeholder:text-white/40"
                    data-testid="input-gif-search"
                  />
                </div>
                {gifDebounced && (
                  <div className="flex max-h-24 gap-2 overflow-x-auto">
                    {gifsLoading ? (
                      <Loader2 className="m-auto h-5 w-5 animate-spin text-white/60" />
                    ) : (
                      ((gifResults as any)?.gifs ?? []).slice(0, 12).map((g: any, i: number) => (
                        <button key={i} type="button" onClick={() => addSticker({ type: "giphy", data: { url: g.url } })} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5">
                          <img src={g.previewUrl ?? g.url} alt="" className="h-full w-full object-contain" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "draw" && (
              <div className="space-y-2 rounded-xl bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5 overflow-x-auto">
                    {DRAW_TOOLS.map((t) => (
                      <button key={t.id} type="button" onClick={() => setDrawTool(t.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${drawTool === t.id ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => drawRef.current?.undo()} className="rounded-full bg-white/10 p-1.5 text-white" aria-label="Undo" data-testid="button-draw-undo">
                      <Undo2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => drawRef.current?.redo()} className="rounded-full bg-white/10 p-1.5 text-white" aria-label="Redo" data-testid="button-draw-redo">
                      <Redo2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => drawRef.current?.clear()} className="rounded-full bg-white/10 p-1.5 text-white" aria-label="Clear" data-testid="button-draw-clear">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {DRAW_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setDrawColor(c)} className="h-6 w-6 rounded-full border-2" style={{ backgroundColor: c, borderColor: drawColor === c ? "#fff" : "transparent" }} aria-label={`Draw color ${c}`} />
                    ))}
                  </div>
                  <Slider value={[drawSize]} min={4} max={28} step={1} onValueChange={(v) => setDrawSize(v[0])} aria-label="Brush size" className="flex-1" />
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex items-center justify-around border-t border-white/10 pt-2">
              {imageTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 ${tab === id ? "text-white" : "text-white/50"}`}
                  data-testid={`tab-editor-${id}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
