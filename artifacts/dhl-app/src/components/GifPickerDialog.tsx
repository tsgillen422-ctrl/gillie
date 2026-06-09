import React from "react";
import { useSearchGifs, type GifResult } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function GifPickerDialog({
  open,
  onOpenChange,
  onSelect,
  description = "Search for a GIF to attach.",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (url: string) => void;
  description?: string;
}) {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  React.useEffect(() => {
    if (!open) {
      setQ("");
      setDebounced("");
    }
  }, [open]);
  const { data: gifs, isLoading, isError } = useSearchGifs(
    { q: debounced || undefined },
    { query: { enabled: open } },
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a GIF</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" className="pl-9" autoFocus />
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          {isError ? (
            <p className="py-8 text-center text-sm text-muted-foreground">GIF search isn't available right now.</p>
          ) : isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading GIFs…</p>
          ) : gifs && gifs.length ? (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((g: GifResult) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g.url)}
                  className="overflow-hidden rounded-lg bg-muted transition hover:opacity-80 active:scale-95"
                >
                  <img src={g.previewUrl} alt="GIF" className="h-32 w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No GIFs found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
