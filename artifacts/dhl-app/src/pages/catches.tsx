import React from "react";
import {
  useGetCatches,
  useCreateCatch,
  useDeleteCatch,
  useGetMe,
  getGetCatchesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ClickableImage } from "@/components/ClickableImage";
import { MatureGate } from "@/components/MatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Fish, Plus, ImagePlus, X, Trash2, Lock } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { resolveImageSrc } from "@/lib/assets";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useLake } from "@/lib/lake-context";

export function CatchesPage() {
  const { lakeId } = useLake();
  const { data: catches, isLoading } = useGetCatches({ lakeId });
  const { data: me } = useGetMe();
  const createCatch = useCreateCatch();
  const deleteCatch = useDeleteCatch();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading } = useUpload();
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const search = useSearch();
  React.useEffect(() => {
    const targetId = new URLSearchParams(search).get("catch");
    if (!targetId || !catches?.length) return;
    const el = document.getElementById(`catch-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
    return () => clearTimeout(t);
  }, [search, catches]);

  const [open, setOpen] = React.useState(false);
  const [species, setSpecies] = React.useState("");
  const [weight, setWeight] = React.useState("");
  const [length, setLength] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() });

  const reset = () => {
    setSpecies("");
    setWeight("");
    setLength("");
    setNotes("");
    setIsPrivate(false);
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
    if (!species.trim()) {
      toast.error("What did you catch? Add a species.");
      return;
    }
    createCatch.mutate(
      {
        data: {
          lakeId,
          species: species.trim(),
          weight: weight ? parseFloat(weight) : undefined,
          length: length ? parseFloat(length) : undefined,
          notes: notes.trim() || undefined,
          isPrivate,
          imageUrl: imageUrl ? `/api/storage${imageUrl}` : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Catch logged! 🎣");
          setOpen(false);
          reset();
          refresh();
        },
        onError: () => toast.error("Couldn't log that catch."),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCatch.mutate(
      { catchId: id },
      { onSuccess: () => { toast.success("Catch removed."); refresh(); }, onError: () => toast.error("Couldn't delete that catch.") }
    );
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="p-4 bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Fish className="w-6 h-6" /> Catch Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Share your best catches with the lake community.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : catches?.length ? (
          catches.map((c) => (
            <Card key={c.id} id={`catch-${c.id}`} className="border-border/50 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Link href={`/profile/${c.userId}`} className="shrink-0">
                    <UserAvatar name={c.user?.displayName || "User"} username={c.user?.username || ""} avatarUrl={c.user?.avatarUrl} className="w-9 h-9 cursor-pointer" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${c.userId}`}>
                      <h3 className="font-semibold text-sm truncate hover:underline cursor-pointer">{c.user?.displayName || "Angler"}</h3>
                    </Link>
                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.caughtAt), { addSuffix: true })}</p>
                  </div>
                  {c.isPrivate && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  {me && c.userId === me.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this catch?</AlertDialogTitle>
                          <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <MatureGate isMature={c.isMature} rounded="rounded-xl" label="Sensitive catch">
                  {c.imageUrl && (
                    <div className="rounded-xl overflow-hidden bg-muted aspect-video mb-2">
                      <ClickableImage src={resolveImageSrc(c.imageUrl)} alt={c.species} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-lg">{c.species}</span>
                    {c.weight != null && <span className="text-sm text-muted-foreground">{c.weight} lb</span>}
                    {c.length != null && <span className="text-sm text-muted-foreground">{c.length} in</span>}
                  </div>
                  {c.notes && <p className="text-sm mt-1 whitespace-pre-wrap">{c.notes}</p>}
                </MatureGate>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-16 px-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
              <Fish className="w-8 h-8 text-cyan-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No catches yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Log your first catch and start building your fishing journal.</p>
          </div>
        )}
      </div>

      {me && (
        <div className="absolute bottom-6 right-6 z-20">
          <Button
            onClick={() => setOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            aria-label="Log a catch"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log a catch</DialogTitle>
            <DialogDescription>Record what you reeled in today.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Species</Label>
              <Input value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="Largemouth Bass" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Weight (lb)</Label>
                <Input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="4.2" />
              </div>
              <div className="space-y-1.5">
                <Label>Length (in)</Label>
                <Input type="number" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} placeholder="18" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where, what bait, the story..." rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Photo</Label>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              {imageUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                  <img src={`/api/storage${imageUrl}`} alt="Catch" className="object-cover w-full h-full" />
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
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Keep private</Label>
                <p className="text-xs text-muted-foreground">Only you can see private catches.</p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createCatch.isPending || isUploading}>
              {createCatch.isPending ? "Saving..." : "Log catch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
