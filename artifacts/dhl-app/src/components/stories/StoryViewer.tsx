import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Trash2, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useViewStory,
  useDeleteStory,
  getGetStoriesQueryKey,
  getGetStoryPlacesQueryKey,
  type StoryGroup,
  type Story,
} from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";

const PHOTO_MS = 5000;
const TEXT_MS = 6000;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function StoryViewer({
  groups,
  initialGroupIndex,
  initialStoryIndex = 0,
  meId,
  onClose,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  initialStoryIndex?: number;
  meId?: number;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0); // 0..1 within current story
  const [paused, setPaused] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const queryClient = useQueryClient();
  const viewMutation = useViewStory();
  const deleteMutation = useDeleteStory();

  const group = groups[groupIdx];
  const story: Story | undefined = group?.stories[storyIdx];
  const isOwn = meId != null && group?.user.id === meId;

  // ---- view tracking ----
  const viewedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!story || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    viewMutation.mutate({ storyId: story.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const closeAndRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStoryPlacesQueryKey() });
    onClose();
  }, [onClose, queryClient]);

  // ---- navigation ----
  const goNext = useCallback(() => {
    setProgress(0);
    if (group && storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      closeAndRefresh();
    }
  }, [group, storyIdx, groupIdx, groups.length, closeAndRefresh]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(Math.max(0, prevGroup.stories.length - 1));
    } else {
      setProgress(0);
    }
  }, [storyIdx, groupIdx, groups]);

  // ---- auto-advance timer (photos & text; videos advance on ended) ----
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!story || paused) return;
    if (story.mediaType === "video") {
      videoRef.current?.play().catch(() => {});
      return;
    }
    const duration = story.mediaType === "text" ? TEXT_MS : PHOTO_MS;
    const started = Date.now() - progress * duration;
    const id = window.setInterval(() => {
      const p = (Date.now() - started) / duration;
      if (p >= 1) goNext();
      else setProgress(p);
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  useEffect(() => {
    if (story?.mediaType !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, story?.id, story?.mediaType]);

  // ---- gestures: tap left/right, hold to pause, swipe down to close ----
  const pointerRef = useRef<{ x: number; y: number; t: number; holdTimer: number | null; held: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const holdTimer = window.setTimeout(() => {
      if (pointerRef.current) pointerRef.current.held = true;
      setPaused(true);
    }, 220);
    pointerRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), holdTimer, held: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    if (Math.abs(dy) > 12 || Math.abs(dx) > 12) {
      if (p.holdTimer) {
        window.clearTimeout(p.holdTimer);
        p.holdTimer = null;
      }
    }
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy);
  };

  const endPointer = (e: React.PointerEvent) => {
    const p = pointerRef.current;
    pointerRef.current = null;
    if (!p) return;
    if (p.holdTimer) window.clearTimeout(p.holdTimer);
    const wasHeld = p.held;
    setPaused(false);
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    setDragY(0);
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      closeAndRefresh();
      return;
    }
    if (wasHeld) return;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - p.t < 350) {
      const x = e.clientX;
      const w = window.innerWidth;
      if (x < w * 0.35) goPrev();
      else goNext();
    }
  };

  // Escape to close on desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAndRefresh();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeAndRefresh, goNext, goPrev]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleDelete = async () => {
    if (!story) return;
    try {
      await deleteMutation.mutateAsync({ storyId: story.id });
      toast.success("Story deleted");
      setConfirmDelete(false);
      if (group.stories.length <= 1) {
        closeAndRefresh();
      } else {
        // Drop the story locally and stay in the viewer.
        group.stories.splice(storyIdx, 1);
        setStoryIdx((i) => Math.min(i, group.stories.length - 1));
        setProgress(0);
        queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStoryPlacesQueryKey() });
      }
    } catch {
      toast.error("Couldn't delete that story.");
      setConfirmDelete(false);
    }
  };

  const dim = useMemo(() => Math.min(0.6, dragY / 500), [dragY]);

  if (!group || !story) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      style={{ opacity: 1 - dim }}
      data-testid="story-viewer"
    >
      <div
        className="relative h-full w-full max-w-lg select-none overflow-hidden"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px) scale(${1 - Math.min(0.12, dragY / 900)})` : undefined,
          transition: dragY === 0 ? "transform 180ms ease" : "none",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {/* media */}
        {story.mediaType === "photo" && (
          <img src={story.mediaUrl ?? ""} alt="" className="h-full w-full object-contain" draggable={false} />
        )}
        {story.mediaType === "video" && (
          <video
            ref={videoRef}
            key={story.id}
            src={story.mediaUrl ?? ""}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            onEnded={goNext}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration > 0) setProgress(v.currentTime / v.duration);
            }}
          />
        )}
        {story.mediaType === "text" && (
          <div
            className="flex h-full w-full items-center justify-center px-8"
            style={{ background: story.bgColor || "linear-gradient(160deg, #0d9488, #0369a1)" }}
          >
            <p className="whitespace-pre-wrap break-words text-center text-2xl font-semibold leading-snug text-white drop-shadow-md">
              {story.text}
            </p>
          </div>
        )}

        {/* top gradient + progress bars + header (padded for iOS notch) */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent pb-10 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
          <div className="flex gap-1 px-3">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: i < storyIdx ? "100%" : i === storyIdx ? `${Math.round(progress * 100)}%` : "0%" }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-2.5 px-3">
            <UserAvatar
              name={group.user.displayName}
              username={group.user.username}
              avatarUrl={group.user.avatarUrl}
              className="h-9 w-9 ring-2 ring-white/70"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-white">{group.user.displayName}</span>
                {group.user.isLive && (
                  <span className="rounded bg-red-500 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">Live</span>
                )}
                <span className="shrink-0 text-xs text-white/70">{timeAgo(story.createdAt)}</span>
              </div>
              {story.placeName && (
                <div className="flex items-center gap-0.5 text-xs text-white/80">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{story.placeName}</span>
                </div>
              )}
            </div>
            {isOwn && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setConfirmDelete(true)}
                className="rounded-full bg-black/30 p-2 text-white"
                aria-label="Delete story"
                data-testid="button-delete-story"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={closeAndRefresh}
              className="rounded-full bg-black/30 p-2 text-white"
              aria-label="Close"
              data-testid="button-close-story"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* caption + own view count */}
        {(story.caption || (isOwn && story.viewCount != null)) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-10">
            {story.caption && <p className="text-sm text-white">{story.caption}</p>}
            {isOwn && story.viewCount != null && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-white/80">
                <Eye className="h-3.5 w-3.5" />
                <span>{story.viewCount} {story.viewCount === 1 ? "view" : "views"}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline confirm — no Radix portal inside the z-[100] overlay (it would land under it). */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 px-8"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-xs rounded-2xl bg-card p-5 text-card-foreground shadow-xl">
            <p className="text-base font-semibold">Delete this story?</p>
            <p className="mt-1 text-sm text-muted-foreground">It will disappear for everyone right away.</p>
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
                data-testid="button-confirm-delete-story"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
