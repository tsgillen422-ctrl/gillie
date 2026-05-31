import React from "react";
import {
  useGetPosts,
  useCreatePost,
  useDeletePost,
  useToggleRsvp,
  useGetMe,
  getGetPostsQueryKey,
} from "@workspace/api-client-react";
import { PostInputPostType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { ClickableImage } from "@/components/ClickableImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { Link, useSearch } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Anchor, Plus, ImagePlus, X, Trash2, Calendar, Users, Check } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { resolveImageSrc } from "@/lib/assets";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function TieUpsPage() {
  const { data: tieUps, isLoading } = useGetPosts({ type: "tie_up" });
  const { data: me } = useGetMe();
  const createPost = useCreatePost();
  const deletePost = useDeletePost();
  const toggleRsvp = useToggleRsvp();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const search = useSearch();
  React.useEffect(() => {
    const targetId = new URLSearchParams(search).get("post");
    if (!targetId || !tieUps?.length) return;
    const el = document.getElementById(`tieup-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
    return () => clearTimeout(t);
  }, [search, tieUps]);

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [whenAt, setWhenAt] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetPostsQueryKey() });

  const reset = () => {
    setTitle("");
    setContent("");
    setWhenAt("");
    setImageUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      const res = await uploadFile(await compressImage(file));
      if (res?.objectPath) setImageUrl(res.objectPath);
      else toast.error("Couldn't upload that photo.");
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  };

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error("Where's the tie-up? Add a spot.");
      return;
    }
    createPost.mutate(
      {
        data: {
          title: title.trim() || "Tie-up",
          content: content.trim(),
          postType: "tie_up" as PostInputPostType,
          eventDate: whenAt ? new Date(whenAt).toISOString() : undefined,
          imageUrl: imageUrl ? `/api/storage${imageUrl}` : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Tie-up posted! ⚓");
          setOpen(false);
          reset();
          refresh();
        },
        onError: () => toast.error("Couldn't post that tie-up."),
      }
    );
  };

  const handleDelete = (id: number) => {
    deletePost.mutate(
      { postId: id },
      { onSuccess: () => { toast.success("Tie-up removed."); refresh(); }, onError: () => toast.error("Couldn't delete that tie-up.") }
    );
  };

  const handleRsvp = (id: number) => {
    toggleRsvp.mutate(
      { postId: id },
      { onSuccess: refresh, onError: () => toast.error("Couldn't update your RSVP.") }
    );
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Anchor className="w-6 h-6" /> Tie-ups
        </h1>
        <p className="text-sm text-muted-foreground mt-1">See where everyone's rafting up on the lake — and jump in.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
        ) : tieUps?.length ? (
          tieUps.map((t) => {
            const when = t.eventDate ? new Date(t.eventDate) : null;
            return (
              <Card key={t.id} id={`tieup-${t.id}`} className="border-border/50 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Link href={`/profile/${t.userId}`} className="shrink-0">
                      <UserAvatar name={t.user?.displayName || "User"} username={t.user?.username || ""} avatarUrl={t.user?.avatarUrl} className="w-9 h-9 cursor-pointer" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${t.userId}`}>
                        <h3 className="font-semibold text-sm truncate hover:underline cursor-pointer">{t.user?.displayName || "Boater"}</h3>
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</p>
                    </div>
                    {me && t.userId === me.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this tie-up?</AlertDialogTitle>
                            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  {t.imageUrl && (
                    <div className="rounded-xl overflow-hidden bg-muted aspect-video mb-2">
                      <ClickableImage src={resolveImageSrc(t.imageUrl)} alt={t.title} className="object-cover w-full h-full" />
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-600 bg-teal-500/10 px-2 py-1 rounded-full mb-2">
                    <Anchor className="w-3.5 h-3.5" />
                    Tie-up
                  </div>

                  {t.title && t.title !== "Tie-up" && <h2 className="font-bold text-lg leading-tight mb-1">{t.title}</h2>}

                  {when && (
                    <div className="flex items-center gap-2 text-sm text-accent-foreground bg-accent/20 px-3 py-2 rounded-md mb-2 font-medium">
                      <Calendar className="w-4 h-4 text-accent" />
                      {when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  )}

                  {t.content && <p className="text-sm whitespace-pre-wrap mb-3">{t.content}</p>}

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={t.rsvpByMe ? "default" : "outline"}
                      onClick={() => handleRsvp(t.id)}
                      disabled={toggleRsvp.isPending}
                    >
                      {t.rsvpByMe ? <Check className="w-4 h-4 mr-2" /> : <Anchor className="w-4 h-4 mr-2" />}
                      {t.rsvpByMe ? "I'm in" : "Join tie-up"}
                    </Button>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {t.rsvpCount || 0} tying up
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-4">
              <Anchor className="w-8 h-8 text-teal-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No tie-ups yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Be the first to call a tie-up and let everyone know where to raft up.</p>
          </div>
        )}
      </div>

      {me && (
        <div className="absolute bottom-6 right-6 z-20">
          <Button
            onClick={() => setOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Start a tie-up"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start a tie-up</DialogTitle>
            <DialogDescription>Let the lake know where everyone's rafting up.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Spot name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sandbar at Mile Marker 12 (optional)" />
            </div>
            <div className="space-y-1.5">
              <Label>Where's the tie-up?</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Drop the spot where everyone's tying up…" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>When (optional)</Label>
              <Input type="datetime-local" value={whenAt} onChange={(e) => setWhenAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Photo</Label>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              {imageUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                  <img src={`/api/storage${imageUrl}`} alt="Tie-up" className="object-cover w-full h-full" />
                  <Button type="button" variant="secondary" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => { setImageUrl(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full" disabled={isUploading} onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Add a photo"}
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createPost.isPending || isUploading}>
              {createPost.isPending ? "Posting..." : "Post tie-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
