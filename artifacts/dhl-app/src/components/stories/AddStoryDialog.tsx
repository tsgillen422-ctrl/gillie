import { useRef, useState } from "react";
import { Camera, Video, Type, MapPin, Loader2, X, Aperture, Ship, BarChart3, Plus, Sticker } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCreateStory,
  useGetMe,
  useGetConditions,
  getGetStoriesQueryKey,
  getGetStoryPlacesQueryKey,
  type StorySticker,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { LAKE_PLACES, placeEmoji } from "@/lib/lakePlaces";
import { STORY_FILTERS } from "@/lib/storyFilters";
import { StoryCamera } from "./StoryCamera";
import { StickerLayer } from "./StickerLayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StoryKind = "photo" | "video" | "text";

const TEXT_BGS = [
  "linear-gradient(160deg, #0d9488, #0369a1)",
  "linear-gradient(160deg, #f97316, #db2777)",
  "linear-gradient(160deg, #7c3aed, #2563eb)",
  "linear-gradient(160deg, #16a34a, #115e59)",
  "linear-gradient(160deg, #0f172a, #334155)",
  "linear-gradient(160deg, #e11d48, #7c2d12)",
];

const MAX_VIDEO_MB = 60;
const MAX_STICKERS = 8;
const STICKER_EMOJIS = ["🌊", "🚤", "🎣", "🐟", "☀️", "🌅", "🍻", "🔥", "😎", "🤙", "🦅", "⚓"];

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

export function AddStoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [kind, setKind] = useState<StoryKind>("photo");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(TEXT_BGS[0]);
  const [caption, setCaption] = useState("");
  const [placeName, setPlaceName] = useState<string>("");
  const [visibility, setVisibility] = useState<"friends" | "community">("friends");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [filterIdx, setFilterIdx] = useState(0);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [emojiTrayOpen, setEmojiTrayOpen] = useState(false);
  const [boatId, setBoatId] = useState<number | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload();
  const createStory = useCreateStory();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: conditions } = useGetConditions();
  const fleet: any[] = (me as any)?.fleet ?? [];

  const reset = () => {
    setKind("photo");
    setMediaUrl(null);
    setMediaPreview(null);
    setText("");
    setBgColor(TEXT_BGS[0]);
    setCaption("");
    setPlaceName("");
    setVisibility("friends");
    setCameraOpen(false);
    setFilterIdx(0);
    setStickers([]);
    setEmojiTrayOpen(false);
    setBoatId(null);
    setPollOpen(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  const uploadMedia = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const res = await uploadFile(toUpload);
      if (res?.objectPath) {
        setMediaUrl(`/api/storage${res.objectPath}`);
        setMediaPreview(URL.createObjectURL(file));
      } else {
        toast.error("Upload failed. Try again.");
      }
    } catch {
      toast.error("Upload failed. Try again.");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (kind === "photo" && !isImage) return void toast.error("Please choose a photo.");
    if (kind === "video" && !isVideo) return void toast.error("Please choose a video.");
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return void toast.error(`Videos need to be under ${MAX_VIDEO_MB}MB.`);
    }
    await uploadMedia(file);
  };

  const addSticker = (sticker: Omit<StorySticker, "x" | "y">) => {
    if (stickers.length >= MAX_STICKERS) return void toast.error("That's the sticker limit for one story.");
    // Stagger drop position slightly so stacked stickers stay grabbable.
    const n = stickers.length;
    setStickers((s) => [...s, { ...sticker, x: 0.5, y: Math.min(0.8, 0.35 + n * 0.09) } as StorySticker]);
  };

  const addLocationSticker = () => {
    const place = LAKE_PLACES.find((p) => p.name === placeName);
    addSticker({
      type: "location",
      data: place
        ? { name: place.name, emoji: placeEmoji(place.category) }
        : { name: "Dale Hollow Lake", emoji: "📍" },
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

  const validPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid = !pollOpen || (pollQuestion.trim().length > 0 && validPollOptions.length >= 2);
  const pollIncomplete = pollOpen && !pollValid && (pollQuestion.trim().length > 0 || validPollOptions.length > 0);

  const canPost =
    !isUploading &&
    !createStory.isPending &&
    pollValid &&
    (kind === "text" ? text.trim().length > 0 : !!mediaUrl);

  const handlePost = async () => {
    const place = LAKE_PLACES.find((p) => p.name === placeName);
    const filter = STORY_FILTERS[filterIdx];
    try {
      await createStory.mutateAsync({
        data: {
          mediaType: kind,
          mediaUrl: kind === "text" ? null : mediaUrl,
          text: kind === "text" ? text.trim() : null,
          bgColor: kind === "text" ? bgColor : null,
          caption: caption.trim() || null,
          lat: place?.lat ?? null,
          lng: place?.lng ?? null,
          placeName: place?.name ?? null,
          visibility,
          boatId: boatId ?? null,
          filterName: kind !== "text" && filter.css ? filter.name : null,
          filterCss: kind !== "text" && filter.css ? filter.css : null,
          stickers: stickers.length ? stickers : null,
          pollQuestion: pollOpen && pollValid && pollQuestion.trim() ? pollQuestion.trim() : null,
          pollOptions: pollOpen && pollValid && validPollOptions.length >= 2 ? validPollOptions.slice(0, 4) : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStoryPlacesQueryKey() });
      toast.success("Your story is live for 24 hours 🌊");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't post your story. Try again.");
    }
  };

  const filterCss = STORY_FILTERS[filterIdx].css;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-md"
        onPointerDownOutside={(e) => { if (cameraOpen) e.preventDefault(); }}
        onInteractOutside={(e) => { if (cameraOpen) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (cameraOpen) { e.preventDefault(); setCameraOpen(false); } }}
      >
        <DialogHeader>
          <DialogTitle>Add to Today on the Lake</DialogTitle>
        </DialogHeader>

        {/* type picker */}
        <div className="grid grid-cols-3 gap-2">
          {([
            ["photo", Camera, "Photo"],
            ["video", Video, "Video"],
            ["text", Type, "Text"],
          ] as const).map(([k, Icon, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setMediaUrl(null); setMediaPreview(null); setFilterIdx(0); }}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition ${
                kind === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"
              }`}
              data-testid={`button-story-type-${k}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        {/* media / text input */}
        {kind !== "text" ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={kind === "photo" ? "image/*" : "video/*"}
              className="hidden"
              onChange={handleFile}
            />
            {mediaPreview ? (
              <div className="relative overflow-hidden rounded-xl bg-black">
                {kind === "photo" ? (
                  <img src={mediaPreview} alt="" className="max-h-72 w-full object-contain" style={filterCss ? { filter: filterCss } : undefined} />
                ) : (
                  <video src={mediaPreview} className="max-h-72 w-full object-contain" style={filterCss ? { filter: filterCss } : undefined} controls playsInline />
                )}
                <StickerLayer stickers={stickers} editable onChange={setStickers} />
                <button
                  type="button"
                  onClick={() => { setMediaUrl(null); setMediaPreview(null); setStickers([]); setFilterIdx(0); }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {kind === "photo" && (
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    disabled={isUploading}
                    className="flex h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 text-primary hover-elevate"
                    data-testid="button-story-camera"
                  >
                    <Aperture className="h-6 w-6" />
                    <span className="text-sm font-medium">Take a photo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`flex h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover-elevate ${kind === "photo" ? "" : "col-span-2"}`}
                  data-testid="button-story-upload"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : kind === "photo" ? (
                    <Camera className="h-6 w-6" />
                  ) : (
                    <Video className="h-6 w-6" />
                  )}
                  <span className="text-sm">{isUploading ? "Uploading…" : kind === "photo" ? "Choose a photo" : "Choose a video"}</span>
                </button>
              </div>
            )}

            {/* filters */}
            {mediaPreview && kind === "photo" && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {STORY_FILTERS.map((f, i) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setFilterIdx(i)}
                    className="flex shrink-0 flex-col items-center gap-1"
                    data-testid={`button-story-filter-${f.name}`}
                  >
                    <span
                      className={`block h-14 w-14 overflow-hidden rounded-lg border-2 ${filterIdx === i ? "border-primary" : "border-transparent"}`}
                    >
                      <img src={mediaPreview} alt="" className="h-full w-full object-cover" style={f.css ? { filter: f.css } : undefined} />
                    </span>
                    <span className={`text-[10px] font-medium ${filterIdx === i ? "text-primary" : "text-muted-foreground"}`}>{f.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* sticker bar */}
            {mediaPreview && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={addLocationSticker} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover-elevate" data-testid="button-sticker-location">
                    📍 Location
                  </button>
                  <button type="button" onClick={addWeatherSticker} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover-elevate" data-testid="button-sticker-weather">
                    🌤️ Weather
                  </button>
                  <button type="button" onClick={addBoatSticker} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover-elevate" data-testid="button-sticker-boat">
                    🚤 Boat
                  </button>
                  <button type="button" onClick={() => setEmojiTrayOpen((o) => !o)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover-elevate ${emojiTrayOpen ? "border-primary text-primary" : "border-border text-muted-foreground"}`} data-testid="button-sticker-emoji">
                    <Sticker className="h-3.5 w-3.5" /> Emoji
                  </button>
                </div>
                {emojiTrayOpen && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {STICKER_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => addSticker({ type: "emoji", data: { emoji: em } })}
                        className="rounded-lg p-1 text-xl hover-elevate"
                        data-testid={`button-emoji-${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">Drag stickers to place them on your story.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="flex min-h-40 items-center justify-center rounded-xl px-4 py-6"
              style={{ background: bgColor }}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="What's happening on the lake?"
                className="min-h-24 resize-none border-0 bg-transparent text-center text-lg font-semibold text-white placeholder:text-white/60 focus-visible:ring-0"
                data-testid="input-story-text"
              />
            </div>
            <div className="flex gap-2">
              {TEXT_BGS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setBgColor(bg)}
                  className={`h-7 w-7 rounded-full border-2 ${bgColor === bg ? "border-primary" : "border-transparent"}`}
                  style={{ background: bg }}
                  aria-label="Background color"
                />
              ))}
            </div>
          </div>
        )}

        {kind !== "text" && (
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder="Add a caption (optional)"
            data-testid="input-story-caption"
          />
        )}

        {/* location tag */}
        <Select value={placeName || "none"} onValueChange={(v) => setPlaceName(v === "none" ? "" : v)}>
          <SelectTrigger data-testid="select-story-place">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
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

        {/* boat tag */}
        {fleet.length > 0 && (
          <Select
            value={boatId != null ? String(boatId) : "none"}
            onValueChange={(v) => setBoatId(v === "none" ? null : Number(v))}
          >
            <SelectTrigger data-testid="select-story-boat">
              <div className="flex items-center gap-1.5">
                <Ship className="h-4 w-4 text-muted-foreground" />
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

        {/* poll */}
        <div className="rounded-xl border border-border p-3">
          <button
            type="button"
            onClick={() => setPollOpen((o) => !o)}
            className="flex w-full items-center justify-between text-sm font-medium"
            data-testid="button-story-poll-toggle"
          >
            <span className="flex items-center gap-1.5 text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" /> Add a poll
            </span>
            <span className="text-xs text-muted-foreground">{pollOpen ? "Remove" : "Optional"}</span>
          </button>
          {pollOpen && (
            <div className="mt-2.5 space-y-2">
              <Input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value.slice(0, 120))}
                placeholder="Ask a question…"
                data-testid="input-poll-question"
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={opt}
                    onChange={(e) => setPollOptions((opts) => opts.map((o, j) => (j === i ? e.target.value.slice(0, 60) : o)))}
                    placeholder={`Option ${i + 1}`}
                    data-testid={`input-poll-option-${i}`}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((opts) => opts.filter((_, j) => j !== i))}
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground hover-elevate"
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
              {pollIncomplete && (
                <p className="text-[11px] text-muted-foreground">Polls need a question and at least 2 options.</p>
              )}
            </div>
          )}
        </div>

        {/* audience */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVisibility("friends")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              visibility === "friends" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"
            }`}
            data-testid="button-story-visibility-friends"
          >
            Friends
          </button>
          <button
            type="button"
            onClick={() => setVisibility("community")}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              visibility === "community" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"
            }`}
            data-testid="button-story-visibility-community"
          >
            Everyone
          </button>
        </div>

        <Button onClick={handlePost} disabled={!canPost} className="w-full" data-testid="button-post-story">
          {createStory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Share to Today on the Lake
        </Button>
      </DialogContent>

      {cameraOpen && (
        <StoryCamera
          onClose={() => setCameraOpen(false)}
          onCapture={async (file) => {
            setCameraOpen(false);
            await uploadMedia(file);
          }}
        />
      )}
    </Dialog>
  );
}
