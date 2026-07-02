import { useRef, useState } from "react";
import { Camera, Video, Type, Loader2, Aperture } from "lucide-react";
import { toast } from "sonner";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { StoryCamera } from "./StoryCamera";
import { StoryEditor } from "./StoryEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Entry point for creating a story: pick photo / video / text, then hand off
// to the full-screen StoryEditor (Snapchat-style) for filters, stickers,
// text, drawing, and posting.

type StoryKind = "photo" | "video" | "text";

const MAX_VIDEO_MB = 60;

export function AddStoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [pendingKind, setPendingKind] = useState<StoryKind>("photo");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editor, setEditor] = useState<{
    kind: StoryKind;
    mediaPreview: string | null;
    mediaUrl: string | null;
    initialFilterIdx?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload();

  const closeAll = () => {
    setEditor(null);
    setCameraOpen(false);
    onOpenChange(false);
  };

  const uploadMedia = async (file: File, initialFilterIdx?: number) => {
    const isImage = file.type.startsWith("image/");
    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const res = await uploadFile(toUpload);
      if (res?.objectPath) {
        setEditor({
          kind: isImage ? "photo" : "video",
          mediaUrl: `/api/storage${res.objectPath}`,
          mediaPreview: URL.createObjectURL(file),
          initialFilterIdx,
        });
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
    if (pendingKind === "photo" && !isImage) return void toast.error("Please choose a photo.");
    if (pendingKind === "video" && !isVideo) return void toast.error("Please choose a video.");
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return void toast.error(`Videos need to be under ${MAX_VIDEO_MB}MB.`);
    }
    await uploadMedia(file);
  };

  const pick = (kind: StoryKind) => {
    setPendingKind(kind);
    if (kind === "text") {
      setEditor({ kind: "text", mediaPreview: null, mediaUrl: null });
    } else {
      // Defer so the hidden input click isn't swallowed by state updates.
      requestAnimationFrame(() => fileInputRef.current?.click());
    }
  };

  // While the full-screen editor or camera is up, the picker dialog unmounts
  // entirely — a Radix modal under a body portal would treat every tap on the
  // overlay as an "outside" interaction and dismiss it.
  if (editor) {
    return (
      <StoryEditor
        kind={editor.kind}
        mediaPreview={editor.mediaPreview}
        mediaUrl={editor.mediaUrl}
        initialFilterIdx={editor.initialFilterIdx}
        onCancel={() => setEditor(null)}
        onPosted={closeAll}
      />
    );
  }

  if (cameraOpen) {
    return (
      <StoryCamera
        onClose={() => setCameraOpen(false)}
        onCapture={async (file, filterIdx) => {
          setCameraOpen(false);
          await uploadMedia(file, filterIdx);
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeAll(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Today on the Lake</DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept={pendingKind === "video" ? "video/*" : "image/*"}
          className="hidden"
          onChange={handleFile}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 text-primary hover-elevate"
              data-testid="button-story-camera"
            >
              <Aperture className="h-6 w-6" />
              <span className="text-sm font-medium">Take a photo</span>
            </button>
            <button
              type="button"
              onClick={() => pick("photo")}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover-elevate"
              data-testid="button-story-type-photo"
            >
              <Camera className="h-6 w-6" />
              <span className="text-sm">Choose a photo</span>
            </button>
            <button
              type="button"
              onClick={() => pick("video")}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover-elevate"
              data-testid="button-story-type-video"
            >
              <Video className="h-6 w-6" />
              <span className="text-sm">Choose a video</span>
            </button>
            <button
              type="button"
              onClick={() => pick("text")}
              className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover-elevate"
              data-testid="button-story-type-text"
            >
              <Type className="h-6 w-6" />
              <span className="text-sm">Write something</span>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
