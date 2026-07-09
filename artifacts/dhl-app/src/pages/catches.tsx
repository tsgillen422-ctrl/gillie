import React from "react";
import {
  useGetCatches,
  useCreateCatch,
  useDeleteCatch,
  useGetMe,
  getGetCatchesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { CatchCard } from "@/components/feed/CatchCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Fish, ImagePlus, X } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { compressImage } from "@/lib/compress";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

  // The global "+" menu deep-links here with ?compose=1 to open the catch form.
  React.useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("compose") === "1") {
      setOpen(true);
      params.delete("compose");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
  const [bait, setBait] = React.useState("");
  const [locationName, setLocationName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() });

  const reset = () => {
    setSpecies("");
    setWeight("");
    setLength("");
    setBait("");
    setLocationName("");
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
          bait: bait.trim() || undefined,
          locationName: locationName.trim() || undefined,
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
            <CatchCard
              key={c.id}
              anchorId={`catch-${c.id}`}
              catchData={c}
              meId={me?.id}
              onDelete={handleDelete}
            />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bait / lure</Label>
                <Input value={bait} onChange={(e) => setBait(e.target.value)} placeholder="Green pumpkin jig" data-testid="input-catch-bait" />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Mitchell Creek" data-testid="input-catch-location" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tell the story behind the catch..." rows={3} data-testid="input-catch-caption" />
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
