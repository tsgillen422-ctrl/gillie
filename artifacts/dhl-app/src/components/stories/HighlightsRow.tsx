import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Loader2, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useGetUserHighlights,
  useGetHighlightStories,
  useCreateHighlight,
  useDeleteHighlight,
  useGetUserStories,
  getGetUserHighlightsQueryKey,
  getGetHighlightStoriesQueryKey,
  getGetUserStoriesQueryKey,
  type Highlight,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StickerLayer } from "./StickerLayer";

const SLIDE_MS = 5000;

// ---- Highlight viewer (lightweight pager; snapshots have no reactions/polls) ----
function HighlightViewer({
  highlight,
  isOwn,
  onClose,
  onDeleted,
}: {
  highlight: Highlight;
  isOwn: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { data: stories, isLoading } = useGetHighlightStories(highlight.id, {
    query: { queryKey: getGetHighlightStoriesQueryKey(highlight.id) },
  });
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteHighlight();
  const queryClient = useQueryClient();

  const item = stories?.[idx];

  const goNext = useCallback(() => {
    setProgress(0);
    if (stories && idx < stories.length - 1) setIdx((i) => i + 1);
    else onClose();
  }, [stories, idx, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  // Auto-advance photos/text; videos advance on ended.
  useEffect(() => {
    if (!item || item.mediaType === "video" || confirmDelete) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const p = (Date.now() - started) / SLIDE_MS;
      if (p >= 1) goNext();
      else setProgress(p);
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, confirmDelete]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ highlightId: highlight.id });
      queryClient.invalidateQueries({ queryKey: getGetUserHighlightsQueryKey(highlight.userId) });
      toast.success("Highlight removed");
      onDeleted();
    } catch {
      toast.error("Couldn't remove that highlight.");
      setConfirmDelete(false);
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    if (confirmDelete) return;
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.35) goPrev();
    else goNext();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black" data-testid="highlight-viewer">
      <div className="relative h-full w-full max-w-lg select-none overflow-hidden" onClick={handleTap}>
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/80" />
          </div>
        )}
        {item && (
          <>
            {item.mediaType === "photo" && (
              <img
                src={item.mediaUrl ?? ""}
                alt=""
                className="h-full w-full object-contain"
                style={item.filterCss ? { filter: item.filterCss } : undefined}
                draggable={false}
              />
            )}
            {item.mediaType === "video" && (
              <video
                key={item.id}
                src={item.mediaUrl ?? ""}
                className="h-full w-full object-contain"
                style={item.filterCss ? { filter: item.filterCss } : undefined}
                autoPlay
                playsInline
                onEnded={goNext}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration > 0) setProgress(v.currentTime / v.duration);
                }}
              />
            )}
            {item.mediaType === "text" && (
              <div
                className="flex h-full w-full items-center justify-center px-8"
                style={{ background: item.bgColor || "linear-gradient(160deg, #0d9488, #0369a1)" }}
              >
                <p className="whitespace-pre-wrap break-words text-center text-2xl font-semibold leading-snug text-white drop-shadow-md">
                  {item.text}
                </p>
              </div>
            )}
            {!!item.stickers?.length && <StickerLayer stickers={item.stickers} />}
          </>
        )}

        {/* top chrome */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent pb-10 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
          {!!stories?.length && (
            <div className="flex gap-1 px-3">
              {stories.map((s, i) => (
                <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: i < idx ? "100%" : i === idx ? `${Math.round(progress * 100)}%` : "0%" }}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2.5 flex items-center gap-2.5 px-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">✨ {highlight.title}</p>
              {item?.placeName && (
                <div className="flex items-center gap-0.5 text-xs text-white/80">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{item.placeName}</span>
                </div>
              )}
            </div>
            {isOwn && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="rounded-full bg-black/30 p-2 text-white"
                aria-label="Delete highlight"
                data-testid="button-delete-highlight"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="rounded-full bg-black/30 p-2 text-white"
              aria-label="Close"
              data-testid="button-close-highlight"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {item?.caption && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-10">
            <p className="text-sm text-white">{item.caption}</p>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 px-8" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-xs rounded-2xl bg-card p-5 text-card-foreground shadow-xl">
            <p className="text-base font-semibold">Remove this highlight?</p>
            <p className="mt-1 text-sm text-muted-foreground">The saved stories in it will be removed from your profile.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover-elevate"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
                data-testid="button-confirm-delete-highlight"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ---- Create dialog: name it + pick from your active (last 24h) stories ----
function CreateHighlightDialog({
  meId,
  open,
  onOpenChange,
}: {
  meId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const { data: myStories } = useGetUserStories(meId, {
    query: { queryKey: getGetUserStoriesQueryKey(meId), enabled: open && !!meId },
  });
  const createMutation = useCreateHighlight();
  const queryClient = useQueryClient();

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync({ data: { title: title.trim(), storyIds: selected } });
      queryClient.invalidateQueries({ queryKey: getGetUserHighlightsQueryKey(meId) });
      toast.success("Highlight saved to your profile ✨");
      setTitle("");
      setSelected([]);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't create the highlight. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setTitle(""); setSelected([]); } onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Highlight</DialogTitle>
        </DialogHeader>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 40))}
          placeholder="Name it (e.g. Summer '26)"
          data-testid="input-highlight-title"
        />
        {myStories?.length ? (
          <>
            <p className="text-xs text-muted-foreground">Pick stories from the last 24 hours to keep forever:</p>
            <div className="grid grid-cols-3 gap-2">
              {myStories.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={`relative aspect-[3/4] overflow-hidden rounded-xl border-2 ${on ? "border-primary" : "border-transparent"}`}
                    data-testid={`button-highlight-pick-${s.id}`}
                  >
                    {s.mediaType === "photo" && (
                      <img src={s.mediaUrl ?? ""} alt="" className="h-full w-full object-cover" style={s.filterCss ? { filter: s.filterCss } : undefined} />
                    )}
                    {s.mediaType === "video" && (
                      <video src={s.mediaUrl ?? ""} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    )}
                    {s.mediaType === "text" && (
                      <span
                        className="flex h-full w-full items-center justify-center p-1.5 text-center text-[10px] font-semibold text-white"
                        style={{ background: s.bgColor || "linear-gradient(160deg, #0d9488, #0369a1)" }}
                      >
                        <span className="line-clamp-4">{s.text}</span>
                      </span>
                    )}
                    {on && (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {selected.indexOf(s.id) + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You don't have any active stories right now. Post a story first, then save it as a highlight before it expires.
          </p>
        )}
        <Button
          onClick={handleCreate}
          disabled={!title.trim() || selected.length === 0 || createMutation.isPending}
          className="w-full"
          data-testid="button-create-highlight"
        >
          {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Highlight
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ---- Row of highlight circles on a profile ----
export function HighlightsRow({ userId, meId }: { userId: number; meId?: number }) {
  const isOwn = meId != null && meId === userId;
  const { data: highlights } = useGetUserHighlights(userId, {
    query: { queryKey: getGetUserHighlightsQueryKey(userId), enabled: !!userId },
  });
  const [openHighlight, setOpenHighlight] = useState<Highlight | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useMemo(() => highlights ?? [], [highlights]);
  if (!isOwn && list.length === 0) return null;

  return (
    <div className="mt-3" data-testid="highlights-row">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {isOwn && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
            data-testid="button-new-highlight"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground">
              <Plus className="h-5 w-5" />
            </span>
            <span className="w-full truncate text-center text-[11px] text-muted-foreground">New</span>
          </button>
        )}
        {list.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setOpenHighlight(h)}
            className="flex w-16 shrink-0 flex-col items-center gap-1"
            data-testid={`button-highlight-${h.id}`}
          >
            <span className="block h-14 w-14 overflow-hidden rounded-full border-2 border-primary/60 bg-muted">
              {h.coverUrl ? (
                <img src={h.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-lg">✨</span>
              )}
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-foreground">{h.title}</span>
          </button>
        ))}
      </div>

      {openHighlight && (
        <HighlightViewer
          highlight={openHighlight}
          isOwn={isOwn}
          onClose={() => setOpenHighlight(null)}
          onDeleted={() => setOpenHighlight(null)}
        />
      )}
      {isOwn && meId != null && (
        <CreateHighlightDialog meId={meId} open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </div>
  );
}
