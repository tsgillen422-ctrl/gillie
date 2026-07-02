import { useRef, useState } from "react";
import { Camera, Video, Type, MapPin, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCreateStory,
  getGetStoriesQueryKey,
  getGetStoryPlacesQueryKey,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { LAKE_PLACES, placeEmoji } from "@/lib/lakePlaces";
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

export function AddStoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [kind, setKind] = useState<StoryKind>("photo");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState(TEXT_BGS[0]);
  const [caption, setCaption] = useState("");
  const [placeName, setPlaceName] = useState<string>("");
  const [visibility, setVisibility] = useState<"friends" | "community">("friends");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload();
  const createStory = useCreateStory();
  const queryClient = useQueryClient();

  const reset = () => {
    setKind("photo");
    setMediaUrl(null);
    setMediaPreview(null);
    setText("");
    setBgColor(TEXT_BGS[0]);
    setCaption("");
    setPlaceName("");
    setVisibility("friends");
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

  const canPost =
    !isUploading &&
    !createStory.isPending &&
    (kind === "text" ? text.trim().length > 0 : !!mediaUrl);

  const handlePost = async () => {
    const place = LAKE_PLACES.find((p) => p.name === placeName);
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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
              onClick={() => { setKind(k); setMediaUrl(null); setMediaPreview(null); }}
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
                  <img src={mediaPreview} alt="" className="max-h-64 w-full object-contain" />
                ) : (
                  <video src={mediaPreview} className="max-h-64 w-full object-contain" controls playsInline />
                )}
                <button
                  type="button"
                  onClick={() => { setMediaUrl(null); setMediaPreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover-elevate"
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
    </Dialog>
  );
}
