import React from "react";
import {
  useGetPosts,
  useCreatePost,
  useDeletePost,
  useReactToPost,
  useGetMe,
  getGetPostsQueryKey,
} from "@workspace/api-client-react";
import { PostInputPostType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearch } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sailboat, Plus, ImagePlus, X } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PostCard } from "@/pages/feed";

export function BoatsPage() {
  const { data: boats, isLoading } = useGetPosts({ type: "boat_showcase" });
  const { data: me } = useGetMe();
  const createPost = useCreatePost();
  const deletePost = useDeletePost();
  const reactPost = useReactToPost();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  const photosInputRef = React.useRef<HTMLInputElement>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });

  const search = useSearch();
  React.useEffect(() => {
    const targetId = new URLSearchParams(search).get("post");
    if (!targetId || !boats?.length) return;
    const el = document.getElementById(`boat-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-2xl");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-2xl"), 2000);
    return () => clearTimeout(t);
  }, [search, boats]);

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [engineSetup, setEngineSetup] = React.useState("");
  const [horsepower, setHorsepower] = React.useState("");
  const [topSpeed, setTopSpeed] = React.useState("");
  const [mods, setMods] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);

  const reset = () => {
    setTitle("");
    setContent("");
    setEngineSetup("");
    setHorsepower("");
    setTopSpeed("");
    setMods("");
    setPhotos([]);
    if (photosInputRef.current) photosInputRef.current.value = "";
  };

  const handlePhotosSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (photosInputRef.current) photosInputRef.current.value = "";
    if (!files.length) return;
    const remaining = 8 - photos.length;
    if (remaining <= 0) {
      toast.error("You can add up to 8 photos.");
      return;
    }
    const toUpload = files.filter((f) => f.type.startsWith("image/")).slice(0, remaining);
    if (!toUpload.length) {
      toast.error("Please choose image files.");
      return;
    }
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const res = await uploadFile(await compressImage(file));
        if (res?.objectPath) uploaded.push(`/api/storage${res.objectPath}`);
      }
      if (uploaded.length) setPhotos((prev) => [...prev, ...uploaded]);
      else toast.error("Couldn't upload those photos.");
    } catch {
      toast.error("Couldn't upload those photos.");
    }
  };

  const handleSubmit = () => {
    if (photos.length === 0) {
      toast.error("Add at least one photo of your boat.");
      return;
    }
    const hp = parseInt(horsepower, 10);
    const speed = parseFloat(topSpeed);
    createPost.mutate(
      {
        data: {
          title: title.trim() || "Boat Showcase",
          content: content.trim() || "Check out this boat!",
          postType: "boat_showcase" as PostInputPostType,
          photos: photos.length ? photos : undefined,
          engineSetup: engineSetup.trim() || undefined,
          horsepower: !Number.isNaN(hp) ? hp : undefined,
          topSpeed: !Number.isNaN(speed) ? speed : undefined,
          mods: mods.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Boat showcased! 🚤");
          setOpen(false);
          reset();
          refresh();
        },
        onError: () => toast.error("Couldn't share your boat."),
      }
    );
  };

  const handleDelete = (id: number) => {
    deletePost.mutate(
      { postId: id },
      { onSuccess: () => { toast.success("Boat removed."); refresh(); }, onError: () => toast.error("Couldn't delete that boat.") }
    );
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Sailboat className="w-6 h-6" /> Boat Showcase
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Show off your rig and check out everyone's boats on the lake.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-2xl" />)
        ) : boats?.length ? (
          boats.map((b) => (
            <div key={b.id} id={`boat-${b.id}`}>
              <PostCard
                post={b}
                onReact={(reaction) => reactPost.mutate({ postId: b.id, data: { reaction } }, { onSuccess: refresh })}
                canDelete={me != null && (b.userId === me.id || me.isAdmin)}
                onDelete={() => handleDelete(b.id)}
                currentUserId={me?.id}
              />
            </div>
          ))
        ) : (
          <div className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center mb-4">
              <Sailboat className="w-8 h-8 text-sky-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No boats yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Be the first to show off your boat and start the lineup.</p>
          </div>
        )}
      </div>

      {me && (
        <div className="absolute bottom-6 right-6 z-20">
          <Button
            onClick={() => setOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Showcase your boat"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Showcase your boat</DialogTitle>
            <DialogDescription>Add photos and specs so the lake can admire your rig.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Boat name / title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reel Therapy — 24' Sea Ray" />
            </div>
            <div className="space-y-1.5">
              <Label>About this boat (optional)</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tell the story behind your build…" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Engine setup</Label>
              <Input value={engineSetup} onChange={(e) => setEngineSetup(e.target.value)} placeholder="e.g. Twin Mercury 400R Verado" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Horsepower</Label>
                <Input type="number" inputMode="numeric" value={horsepower} onChange={(e) => setHorsepower(e.target.value)} placeholder="e.g. 800" />
              </div>
              <div className="space-y-1.5">
                <Label>Top speed (mph)</Label>
                <Input type="number" inputMode="decimal" value={topSpeed} onChange={(e) => setTopSpeed(e.target.value)} placeholder="e.g. 72" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mods</Label>
              <Textarea value={mods} onChange={(e) => setMods(e.target.value)} placeholder="e.g. Custom prop, hydraulic jack plate, JL Audio system" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Photos</Label>
              <input ref={photosInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotosSelect} />
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, i) => (
                    <div key={`${url}-${i}`} className="relative rounded-lg overflow-hidden bg-muted aspect-square">
                      <img src={url} alt={`Boat ${i + 1}`} className="object-cover w-full h-full" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 8 && (
                <Button type="button" variant="outline" className="w-full" disabled={isUploading} onClick={() => photosInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : photos.length ? "Add more photos" : "Add photos"}
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createPost.isPending || isUploading}>
              {createPost.isPending ? "Posting..." : "Showcase boat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
