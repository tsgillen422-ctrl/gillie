import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  Sticker as StickerIcon,
  Type,
  PenLine,
  MoreHorizontal,
  MapPin,
  Ship,
  BarChart3,
  Plus,
  Undo2,
  Redo2,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCreateStory,
  useGetMe,
  useGetConditions,
  useSearchGifs,
  getSearchGifsQueryKey,
  getGetStoriesQueryKey,
  getGetStoryPlacesQueryKey,
  type StorySticker,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { LAKE_PLACES, placeEmoji } from "@/lib/lakePlaces";
import { FILTER_CATEGORIES, STORY_FILTERS } from "@/lib/storyFilters";
import { StickerLayer } from "./StickerLayer";
import { DrawCanvas, type DrawCanvasHandle, type DrawTool } from "./DrawCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Full-screen Snapchat-style story editor. Fills the viewport (safe areas
// respected), swipe left/right to change filters, bottom toolbar opens
// tool sheets: Filters, Stickers, Text, Draw, More (location/boat/poll/audience).

const MAX_STICKERS = 12;

export const TEXT_BGS = [
  "linear-gradient(160deg, #0d9488, #0369a1)",
  "linear-gradient(160deg, #f97316, #db2777)",
  "linear-gradient(160deg, #7c3aed, #2563eb)",
  "linear-gradient(160deg, #16a34a, #115e59)",
  "linear-gradient(160deg, #0f172a, #334155)",
  "linear-gradient(160deg, #e11d48, #7c2d12)",
];

const EMOJI_CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  { id: "lake", label: "Lake", emojis: ["🌊", "🏞️", "🛟", "🏝️", "🌅", "🌄", "💦", "🐬", "🦆", "🪸", "🐢", "🌴"] },
  { id: "boats", label: "Boats", emojis: ["🚤", "⛵", "🛥️", "🛶", "🚣", "⚓", "🪝", "🧭", "🌬️", "🏁", "🛳️", "🦺"] },
  { id: "fishing", label: "Fishing", emojis: ["🎣", "🐟", "🐠", "🦈", "🪱", "🪰", "🐊", "🦞", "🦀", "🏆", "📏", "😤"] },
  { id: "campfire", label: "Campfire", emojis: ["🔥", "🏕️", "🌲", "🪵", "🌌", "🦟", "🌭", "🍢", "☕", "🎸", "🌙", "⭐"] },
  { id: "fireworks", label: "Fireworks", emojis: ["🎆", "🎇", "✨", "🧨", "🎉", "🎊", "🇺🇸", "🗽", "❤️", "💙", "🤍", "💥"] },
  { id: "summer", label: "Summer", emojis: ["☀️", "😎", "🩳", "🩱", "🧴", "🍉", "🍦", "🍹", "🍻", "🥤", "🏖️", "🕶️"] },
  { id: "reactions", label: "Reactions", emojis: ["❤️", "🔥", "👏", "😍", "🤙", "💯", "🙌", "👀", "😱", "🥳", "💪", "🫡"] },
  { id: "funny", label: "Funny", emojis: ["😂", "🤣", "😅", "🫠", "🤪", "😜", "🥴", "💀", "🙃", "🐸", "🦅", "🤠"] },
];

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

const DRAW_TOOLS: { id: DrawTool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "marker", label: "Marker" },
  { id: "neon", label: "Neon" },
  { id: "highlighter", label: "Highlight" },
  { id: "eraser", label: "Eraser" },
];

const DRAW_COLORS = ["#ffffff", "#0f172a", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];

function weatherEmoji(label: string, isDay: boolean | undefined): string {
  const l = label.toLowerCase();
  if (l.includes("thunder")) return "⛈️";
  if (l.includes("rain") || l.includes("drizzle") || l.includes("shower")) return "🌧️";
  if (l.includes("snow")) return "🌨️";
  if (l.includes("fog") || l.includes("mist")) return "🌫️";
  if (l.includes("cloud") || l.includes("overcast")) return "☁️";
  if (l.includes("partly")) return "⛅";
  return isDay === false ? "🌙" : "☀️";
}

type SheetName = "filters" | "stickers" | "text" | "draw" | "more" | null;

export function StoryEditor({
  kind,
  mediaPreview,
  mediaUrl,
  onCancel,
  onPosted,
}: {
  kind: "photo" | "video" | "text";
  mediaPreview: string | null;
  mediaUrl: string | null;
  onCancel: () => void;
  onPosted: () => void;
}) {
  const [sheet, setSheet] = useState<SheetName>(null);
  const [filterIdx, setFilterIdx] = useState(0);
  const [filterFlash, setFilterFlash] = useState(false);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [caption, setCaption] = useState("");
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(TEXT_BGS[0]);
  const [placeName, setPlaceName] = useState("");
  const [boatId, setBoatId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<"friends" | "community">("friends");
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [posting, setPosting] = useState(false);

  // sticker sheet state
  const [stickerTab, setStickerTab] = useState<string>("live");
  const [gifQuery, setGifQuery] = useState("");
  const [gifDebounced, setGifDebounced] = useState("");

  // text tool state
  const [draftText, setDraftText] = useState("");
  const [draftFont, setDraftFont] = useState("classic");
  const [draftStyle, setDraftStyle] = useState("shadow");
  const [draftColor, setDraftColor] = useState("#ffffff");

  // draw state
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("pen");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawSize, setDrawSize] = useState(10);
  const [strokeCount, setStrokeCount] = useState(0);
  const drawRef = useRef<DrawCanvasHandle>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);

  const { uploadFile } = useUpload();
  const createStory = useCreateStory();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: conditions } = useGetConditions();
  const fleet: any[] = (me as any)?.fleet ?? [];

  const filter = STORY_FILTERS[filterIdx] ?? STORY_FILTERS[0];
  const filterCss = kind === "text" ? "" : filter.css;

  useEffect(() => {
    const t = window.setTimeout(() => setGifDebounced(gifQuery.trim()), 350);
    return () => window.clearTimeout(t);
  }, [gifQuery]);

  const gifParams = { q: gifDebounced || undefined, kind: "stickers" as const };
  const { data: gifResults, isLoading: gifsLoading } = useSearchGifs(gifParams, {
    query: { enabled: sheet === "stickers" && stickerTab === "gifs", queryKey: getSearchGifsQueryKey(gifParams) },
  });

  // Flash the filter name briefly whenever it changes via swipe.
  const flashTimer = useRef<number | null>(null);
  const changeFilter = (dir: 1 | -1) => {
    setFilterIdx((i) => (i + dir + STORY_FILTERS.length) % STORY_FILTERS.length);
    setFilterFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFilterFlash(false), 900);
  };
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (drawMode || kind === "text") return;
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onStagePointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      changeFilter(dx < 0 ? 1 : -1);
    }
  };

  const addSticker = (sticker: Omit<StorySticker, "x" | "y">) => {
    if (stickers.length >= MAX_STICKERS) return void toast.error("That's the sticker limit for one story.");
    const n = stickers.length;
    setStickers((s) => [...s, { ...sticker, x: 0.5, y: Math.min(0.75, 0.35 + n * 0.07) } as StorySticker]);
  };

  const addLocationSticker = () => {
    const place = LAKE_PLACES.find((p) => p.name === placeName);
    addSticker({
      type: "location",
      data: place ? { name: place.name, emoji: placeEmoji(place.category) } : { name: "Dale Hollow Lake", emoji: "📍" },
    });
  };

  const addWeatherSticker = () => {
    if (!conditions) return void toast.error("Weather isn't loaded yet — try again in a second.");
    addSticker({
      type: "weather",
      data: {
        temp: Math.round(conditions.temperature),
        label: conditions.weatherLabel,
        icon: weatherEmoji(conditions.weatherLabel, conditions.isDay),
      },
    });
  };

  const addBoatSticker = () => {
    const boat = fleet.find((b) => b.id === boatId) ?? fleet.find((b) => b.isPrimary) ?? fleet[0];
    if (!boat) return void toast.error("Add a boat to your fleet first (Settings → My Vessel).");
    addSticker({ type: "boat", data: { name: boat.name } });
  };

  const addTextSticker = () => {
    const value = draftText.trim();
    if (!value) return;
    addSticker({ type: "text", data: { text: value.slice(0, 200), font: draftFont, style: draftStyle, color: draftColor } });
    setDraftText("");
    setSheet(null);
  };

  // Merge freehand drawing into the photo before upload so it is permanent.
  const flattenDrawing = async (): Promise<string | null> => {
    const drawHandle = drawRef.current;
    const stage = stageRef.current;
    if (!drawHandle?.hasStrokes() || !stage || !mediaPreview) return mediaUrl;
    const img = new Image();
    img.src = mediaPreview;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
    });
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const box = stage.getBoundingClientRect();
    // The photo is object-contain inside the stage: find its on-screen rect.
    const scale = Math.min(box.width / nw, box.height / nh);
    const rw = nw * scale;
    const rh = nh * scale;
    const rx = (box.width - rw) / 2;
    const ry = (box.height - rh) / 2;
    const factor = nw / rw; // stage px -> natural px
    const overlay = drawHandle.renderTo(Math.round(box.width * factor), Math.round(box.height * factor));
    const out = document.createElement("canvas");
    out.width = nw;
    out.height = nh;
    const ctx = out.getContext("2d");
    if (!ctx) return mediaUrl;
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(overlay, rx * factor, ry * factor, rw * factor, rh * factor, 0, 0, nw, nh);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return mediaUrl;
    const res = await uploadFile(new File([blob], `story-${Date.now()}.jpg`, { type: "image/jpeg" }));
    return res?.objectPath ? `/api/storage${res.objectPath}` : mediaUrl;
  };

  const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid = !pollOpen || (pollQuestion.trim().length > 0 && validPollOptions.length >= 2);
  const canPost = !posting && pollValid && (kind === "text" ? text.trim().length > 0 : !!mediaUrl);

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);
    const place = LAKE_PLACES.find((p) => p.name === placeName);
    try {
      const finalMediaUrl = kind === "photo" ? await flattenDrawing() : mediaUrl;
      await createStory.mutateAsync({
        data: {
          mediaType: kind,
          mediaUrl: kind === "text" ? null : finalMediaUrl,
          text: kind === "text" ? text.trim() : null,
          bgColor: kind === "text" ? bgColor : null,
          caption: caption.trim() || null,
          lat: place?.lat ?? null,
          lng: place?.lng ?? null,
          placeName: place?.name ?? null,
          visibility,
          boatId: boatId ?? null,
          filterName: filterCss ? filter.name : null,
          filterCss: filterCss || null,
          stickers: stickers.length ? stickers : null,
          pollQuestion: pollOpen && pollValid && pollQuestion.trim() ? pollQuestion.trim() : null,
          pollOptions: pollOpen && pollValid && validPollOptions.length >= 2 ? validPollOptions.slice(0, 4) : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStoryPlacesQueryKey() });
      toast.success("Your story is live for 24 hours 🌊");
      onPosted();
    } catch {
      toast.error("Couldn't post your story. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const toolbarButton = (name: Exclude<SheetName, null>, Icon: typeof Sparkles, label: string, show = true) =>
    show ? (
      <button
        type="button"
        onClick={() => {
          setDrawMode(false);
          setSheet((s) => (s === name ? null : name));
          if (name === "draw") {
            setDrawMode(true);
          }
        }}
        className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition ${
          sheet === name ? "bg-white/25 text-white" : "text-white/85"
        }`}
        data-testid={`button-editor-${name}`}
      >
        <Icon className="h-5 w-5" />
        {label}
      </button>
    ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[105] flex flex-col bg-black" data-testid="story-editor">
      {/* stage */}
      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden"
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        style={{ touchAction: drawMode ? "none" : "pan-y" }}
      >
        {kind === "text" ? (
          <div className="flex h-full w-full items-center justify-center px-6" style={{ background: bgColor }}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="What's happening on the lake?"
              className="min-h-32 resize-none border-0 bg-transparent text-center text-2xl font-bold text-white placeholder:text-white/60 focus-visible:ring-0"
              data-testid="input-story-text"
            />
          </div>
        ) : kind === "photo" ? (
          <img
            src={mediaPreview ?? ""}
            alt=""
            className="h-full w-full object-contain"
            style={filterCss ? { filter: filterCss } : undefined}
            draggable={false}
          />
        ) : (
          <video
            src={mediaPreview ?? ""}
            className="h-full w-full object-contain"
            style={filterCss ? { filter: filterCss } : undefined}
            autoPlay
            loop
            muted
            playsInline
          />
        )}

        {kind === "photo" && (
          <DrawCanvas
            ref={drawRef}
            active={drawMode}
            tool={drawTool}
            color={drawColor}
            size={drawSize}
            onStrokesChange={setStrokeCount}
          />
        )}

        {!drawMode && <StickerLayer stickers={stickers} editable onChange={setStickers} />}

        {filterFlash && kind !== "text" && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
            <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              {filter.label}
            </span>
          </div>
        )}

        {/* header */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-black/40 p-2.5 text-white"
            aria-label="Cancel"
            data-testid="button-editor-cancel"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-white drop-shadow">Today on the Lake</span>
          <Button
            size="sm"
            onClick={handlePost}
            disabled={!canPost}
            className="rounded-full px-4 font-semibold"
            data-testid="button-post-story"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </Button>
        </div>

        {/* draw mode top controls */}
        {drawMode && (
          <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+56px)] flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => drawRef.current?.undo()}
              className="rounded-full bg-black/50 p-2 text-white disabled:opacity-40"
              disabled={strokeCount === 0}
              aria-label="Undo"
              data-testid="button-draw-undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => drawRef.current?.redo()}
              className="rounded-full bg-black/50 p-2 text-white"
              aria-label="Redo"
              data-testid="button-draw-redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => drawRef.current?.clear()}
              className="rounded-full bg-black/50 p-2 text-white disabled:opacity-40"
              disabled={strokeCount === 0}
              aria-label="Clear drawing"
              data-testid="button-draw-clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* caption + text bg row */}
      <div className="bg-black px-3 pt-2">
        {kind === "text" && (
          <div className="mb-2 flex justify-center gap-2">
            {TEXT_BGS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setBgColor(bg)}
                className={`h-7 w-7 rounded-full border-2 ${bgColor === bg ? "border-white" : "border-transparent"}`}
                style={{ background: bg }}
                aria-label="Background color"
              />
            ))}
          </div>
        )}
        {kind !== "text" && sheet === null && !drawMode && (
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder="Add a caption…"
            className="border-white/15 bg-white/10 text-white placeholder:text-white/50"
            data-testid="input-story-caption"
          />
        )}
      </div>

      {/* sheets */}
      {sheet === "filters" && kind !== "text" && (
        <div className="max-h-[45vh] overflow-y-auto bg-black px-3 pt-2" data-testid="sheet-filters">
          {FILTER_CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">{cat.label}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {cat.filters.map((f) => {
                  const idx = STORY_FILTERS.indexOf(f);
                  return (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setFilterIdx(idx)}
                      className="flex shrink-0 flex-col items-center gap-1"
                      data-testid={`button-story-filter-${f.name}`}
                    >
                      <span className={`block h-14 w-14 overflow-hidden rounded-lg border-2 ${filterIdx === idx ? "border-primary" : "border-white/15"}`}>
                        {kind === "photo" && mediaPreview ? (
                          <img src={mediaPreview} alt="" className="h-full w-full object-cover" style={f.css ? { filter: f.css } : undefined} />
                        ) : (
                          <span className="block h-full w-full bg-gradient-to-br from-teal-500 to-sky-700" style={f.css ? { filter: f.css } : undefined} />
                        )}
                      </span>
                      <span className={`text-[10px] font-medium ${filterIdx === idx ? "text-primary" : "text-white/60"}`}>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="pb-1 text-center text-[11px] text-white/40">Tip: swipe the photo to flip through filters</p>
        </div>
      )}

      {sheet === "stickers" && (
        <div className="flex max-h-[45vh] flex-col bg-black px-3 pt-2" data-testid="sheet-stickers">
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {[{ id: "live", label: "Live" }, ...EMOJI_CATEGORIES.map((c) => ({ id: c.id, label: c.label })), { id: "gifs", label: "Animated" }].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStickerTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${stickerTab === t.id ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
                data-testid={`tab-stickers-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {stickerTab === "live" && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addLocationSticker} className="rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium text-white" data-testid="button-sticker-location">
                  📍 Location
                </button>
                <button type="button" onClick={addWeatherSticker} className="rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium text-white" data-testid="button-sticker-weather">
                  🌤️ Live weather
                </button>
                <button type="button" onClick={addBoatSticker} className="rounded-full bg-white/10 px-3.5 py-2 text-sm font-medium text-white" data-testid="button-sticker-boat">
                  🚤 My boat
                </button>
              </div>
            )}
            {EMOJI_CATEGORIES.map(
              (cat) =>
                stickerTab === cat.id && (
                  <div key={cat.id} className="grid grid-cols-6 gap-1">
                    {cat.emojis.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => addSticker({ type: "emoji", data: { emoji: em } })}
                        className="rounded-lg p-1.5 text-2xl"
                        data-testid={`button-emoji-${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                ),
            )}
            {stickerTab === "gifs" && (
              <div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <Input
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    placeholder="Search animated stickers…"
                    className="border-white/15 bg-white/10 pl-8 text-white placeholder:text-white/50"
                    data-testid="input-gif-search"
                  />
                </div>
                {gifsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {(gifResults ?? []).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => addSticker({ type: "giphy", data: { url: g.url } })}
                        className="overflow-hidden rounded-lg bg-white/5"
                        data-testid={`button-gif-${g.id}`}
                      >
                        <img src={g.previewUrl} alt="" loading="lazy" className="h-20 w-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {sheet === "text" && (
        <div className="max-h-[50vh] space-y-2.5 overflow-y-auto bg-black px-3 pt-2" data-testid="sheet-text">
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value.slice(0, 200))}
            placeholder="Type something…"
            className="min-h-16 resize-none border-white/15 bg-white/10 text-white placeholder:text-white/50"
            data-testid="input-text-sticker"
          />
          <div className="flex gap-1.5 overflow-x-auto">
            {TEXT_FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDraftFont(f.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${draftFont === f.id ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
                data-testid={`button-font-${f.id}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {TEXT_STYLE_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDraftStyle(s.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${draftStyle === s.id ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
                data-testid={`button-textstyle-${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraftColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${draftColor === c ? "border-primary" : "border-white/20"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                data-testid={`button-textcolor-${c}`}
              />
            ))}
          </div>
          <Button onClick={addTextSticker} disabled={!draftText.trim()} className="w-full" data-testid="button-add-text-sticker">
            Add text
          </Button>
        </div>
      )}

      {sheet === "draw" && kind === "photo" && (
        <div className="space-y-2.5 bg-black px-3 pt-2" data-testid="sheet-draw">
          <div className="flex gap-1.5 overflow-x-auto">
            {DRAW_TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDrawTool(t.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${drawTool === t.id ? "bg-white text-black" : "bg-white/10 text-white/80"}`}
                data-testid={`button-drawtool-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDrawColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${drawColor === c ? "border-primary" : "border-white/20"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                data-testid={`button-drawcolor-${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">Size</span>
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={drawSize}
              onChange={(e) => setDrawSize(Number(e.target.value))}
              className="h-1 w-full accent-white"
              aria-label="Brush size"
              data-testid="slider-brush-size"
            />
          </div>
        </div>
      )}

      {sheet === "more" && (
        <div className="max-h-[55vh] space-y-2.5 overflow-y-auto bg-black px-3 pt-2" data-testid="sheet-more">
          <Select value={placeName || "none"} onValueChange={(v) => setPlaceName(v === "none" ? "" : v)}>
            <SelectTrigger className="border-white/15 bg-white/10 text-white" data-testid="select-story-place">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-white/60" />
                <SelectValue placeholder="Tag a spot (optional)" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No location</SelectItem>
              {LAKE_PLACES.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {placeEmoji(p.category)} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {fleet.length > 0 && (
            <Select value={boatId != null ? String(boatId) : "none"} onValueChange={(v) => setBoatId(v === "none" ? null : Number(v))}>
              <SelectTrigger className="border-white/15 bg-white/10 text-white" data-testid="select-story-boat">
                <div className="flex items-center gap-1.5">
                  <Ship className="h-4 w-4 text-white/60" />
                  <SelectValue placeholder="Tag your boat (optional)" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No boat</SelectItem>
                {fleet.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    🚤 {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="rounded-xl border border-white/15 p-3">
            <button
              type="button"
              onClick={() => setPollOpen((o) => !o)}
              className="flex w-full items-center justify-between text-sm font-medium text-white"
              data-testid="button-story-poll-toggle"
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary" /> Add a poll
              </span>
              <span className="text-xs text-white/50">{pollOpen ? "Remove" : "Optional"}</span>
            </button>
            {pollOpen && (
              <div className="mt-2.5 space-y-2">
                <Input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value.slice(0, 120))}
                  placeholder="Ask a question…"
                  className="border-white/15 bg-white/10 text-white placeholder:text-white/50"
                  data-testid="input-poll-question"
                />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={opt}
                      onChange={(e) => setPollOptions((opts) => opts.map((o, j) => (j === i ? e.target.value.slice(0, 60) : o)))}
                      placeholder={`Option ${i + 1}`}
                      className="border-white/15 bg-white/10 text-white placeholder:text-white/50"
                      data-testid={`input-poll-option-${i}`}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions((opts) => opts.filter((_, j) => j !== i))}
                        className="shrink-0 rounded-full p-1.5 text-white/60"
                        aria-label="Remove option"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((opts) => [...opts, ""])}
                    className="flex items-center gap-1 text-xs font-medium text-primary"
                    data-testid="button-poll-add-option"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add option
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["friends", "community"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  visibility === v ? "border-primary bg-primary/15 text-primary" : "border-white/15 text-white/70"
                }`}
                data-testid={`button-story-visibility-${v}`}
              >
                {v === "friends" ? "Friends" : "Everyone"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* bottom toolbar */}
      <div className="flex items-center justify-around bg-black px-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2">
        {toolbarButton("filters", Sparkles, "Filters", kind !== "text")}
        {toolbarButton("stickers", StickerIcon, "Stickers")}
        {toolbarButton("text", Type, "Text")}
        {toolbarButton("draw", PenLine, "Draw", kind === "photo")}
        {toolbarButton("more", MoreHorizontal, "More")}
      </div>
    </div>,
    document.body,
  );
}
