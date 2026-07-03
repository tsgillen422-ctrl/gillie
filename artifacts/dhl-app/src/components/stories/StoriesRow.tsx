import { useEffect, useMemo, useState } from "react";
import { Plus, Flame } from "lucide-react";
import {
  useGetStories,
  useGetStoryPlaces,
  useGetPlaceStories,
  useGetMe,
  type StoryGroup,
} from "@workspace/api-client-react";
import { UserAvatar } from "@/components/UserAvatar";
import { resolveImageSrc } from "@/lib/assets";
import { AddStoryDialog } from "./AddStoryDialog";
import { StoryViewer } from "./StoryViewer";

// Feed section: "Today on the Lake" story circles + Trending Today places.
export function StoriesRow() {
  const { data: me } = useGetMe();
  const { data: groups } = useGetStories();
  const { data: places } = useGetStoryPlaces();
  const [addOpen, setAddOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [placeViewer, setPlaceViewer] = useState<string | null>(null);

  const trending = useMemo(() => (places ?? []).slice(0, 3), [places]);
  const hasStories = (groups?.length ?? 0) > 0;

  return (
    <div className="space-y-3 pb-2 pt-1 border-b border-border/40">
      <div className="flex items-center gap-2 px-1">
        <div className="h-5 w-1.5 rounded-full bg-primary" />
        <span className="text-sm font-display font-bold tracking-tight text-foreground">Today on the Lake</span>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {/* Add story circle */}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-16 shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95 ml-1"
          data-testid="button-add-story"
        >
          <div className="relative rounded-full p-[1.5px] bg-border border-dashed border-2 border-transparent">
            <UserAvatar
              name={me?.displayName || "You"}
              username={me?.username || ""}
              avatarUrl={me?.avatarUrl}
              className="h-[52px] w-[52px] opacity-90"
            />
            <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </div>
          </div>
          <span className="w-full truncate text-center text-[10px] font-semibold text-muted-foreground">Add Story</span>
        </button>

        {(groups ?? []).map((g, i) => (
          <StoryCircle key={g.user.id} group={g} onClick={() => setViewerIndex(i)} />
        ))}

        {!hasStories && (
          <div className="flex items-center pl-1 text-xs text-muted-foreground">
            Be the first to share what's happening today!
          </div>
        )}
      </div>

      {/* Trending Today */}
      {trending.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1 mt-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trending places</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-1">
            {trending.map((p) => (
              <button
                key={p.placeName}
                type="button"
                onClick={() => setPlaceViewer(p.placeName)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-orange-200/60 bg-orange-50/50 px-3 py-1.5 text-left dark:border-orange-900/40 dark:bg-orange-950/20 transition-all hover:bg-orange-100/50 active:scale-95"
                data-testid={`button-trending-${p.placeName}`}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/50">
                  <Flame className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="min-w-0 pr-1">
                  <span className="block max-w-28 truncate text-[11px] font-bold text-foreground">{p.placeName}</span>
                  <span className="block text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                    {p.storyCount} {p.storyCount === 1 ? "story" : "stories"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AddStoryDialog open={addOpen} onOpenChange={setAddOpen} />
      {viewerIndex != null && groups && groups[viewerIndex] && (
        <StoryViewer groups={groups} initialGroupIndex={viewerIndex} meId={me?.id} onClose={() => setViewerIndex(null)} />
      )}
      {placeViewer && <PlaceStoriesViewer placeName={placeViewer} meId={me?.id} onClose={() => setPlaceViewer(null)} />}
    </div>
  );
}

function StoryCircle({ group, onClick }: { group: StoryGroup; onClick: () => void }) {
  const ring = group.allViewed
    ? "bg-border opacity-70"
    : "bg-gradient-to-tr from-teal-400 via-sky-500 to-blue-600";
  // Stories arrive sorted oldest -> newest, so the last one is the latest post.
  const latest = group.stories[group.stories.length - 1];
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-1" data-testid={`button-story-${group.user.id}`}>
      <div className={`relative rounded-full p-[1.5px] transition-transform active:scale-95 ${ring}`}>
        <div className="rounded-full bg-background p-[1px]">
          <StoryThumb story={latest} user={group.user} />
        </div>
        {group.user.isLive && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded border-2 border-background bg-red-500 px-1.5 py-[2px] text-[8px] font-bold uppercase tracking-widest text-white shadow-sm">
            Live
          </span>
        )}
      </div>
      <span className={`w-full truncate text-center text-[10px] ${group.allViewed ? "text-muted-foreground" : "font-bold text-foreground"}`}>
        {group.user.displayName.split(" ")[0]}
      </span>
    </button>
  );
}

// Circle preview of the user's latest story: photo/video frame (with its
// filter), or the text story's background. Falls back to the avatar.
function StoryThumb({ story, user }: { story: StoryGroup["stories"][number]; user: StoryGroup["user"] }) {
  const [failed, setFailed] = useState(false);
  // A transient load error shouldn't stick once a newer story arrives.
  useEffect(() => setFailed(false), [story?.id]);
  const size = "h-[52px] w-[52px] rounded-full object-cover";
  if (!failed && story?.mediaType === "photo" && story.mediaUrl) {
    return (
      <img
        src={resolveImageSrc(story.mediaUrl)}
        alt=""
        className={size}
        style={story.filterCss ? { filter: story.filterCss } : undefined}
        draggable={false}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  if (!failed && story?.mediaType === "video" && story.mediaUrl) {
    return (
      <video
        // #t=0.1 nudges iOS Safari to actually render the first frame.
        src={`${resolveImageSrc(story.mediaUrl)}#t=0.1`}
        className={size}
        style={story.filterCss ? { filter: story.filterCss } : undefined}
        muted
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }
  if (!failed && story?.mediaType === "text") {
    return (
      <div
        className={`${size} flex items-center justify-center overflow-hidden px-1`}
        style={{ background: story.bgColor || "linear-gradient(160deg, #0d9488, #0369a1)" }}
      >
        <span className="line-clamp-3 break-words text-center text-[7px] font-semibold leading-tight text-white">
          {story.text}
        </span>
      </div>
    );
  }
  return <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} className="h-[52px] w-[52px]" />;
}

// Opens the viewer for every active story at a named place (used by Trending
// Today and the map's story-marker preview cards).
export function PlaceStoriesViewer({
  placeName,
  meId,
  initialUserId,
  onClose,
}: {
  placeName: string;
  meId?: number;
  initialUserId?: number;
  onClose: () => void;
}) {
  const { data: groups, isLoading } = useGetPlaceStories(placeName);
  useEffect(() => {
    if (!isLoading && groups && groups.length === 0) onClose();
  }, [isLoading, groups, onClose]);
  if (isLoading || !groups || !groups.length) return null;
  const initialIdx = initialUserId != null ? groups.findIndex((g) => g.user.id === initialUserId) : -1;
  return <StoryViewer groups={groups} initialGroupIndex={Math.max(0, initialIdx)} meId={meId} onClose={onClose} />;
}
