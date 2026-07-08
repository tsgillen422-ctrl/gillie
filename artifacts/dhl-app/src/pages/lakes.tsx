import { Link, useLocation } from "wouter";
import { ChevronLeft, Users, Flame, Calendar, CircleCheck } from "lucide-react";
import { useGetLakesOverview, type LakeOverview } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLake } from "@/lib/lake-context";

/** Photo generated for each lake, shipped with the app in public/lakes/. */
function lakePhotoUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}lakes/${slug}.png`;
}

function StoryRingIcon() {
  return (
    <span className="inline-block h-3 w-3 rounded-full border-[2px] border-current" aria-hidden />
  );
}

function LakeCard({
  lake,
  isCurrent,
  isTrending,
  onSelect,
}: {
  lake: LakeOverview;
  isCurrent: boolean;
  isTrending: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`card-lake-${lake.id}`}
      className="group relative block w-full overflow-hidden rounded-[20px] border border-border/50 bg-card text-left shadow-sm transition-all active:scale-[0.98]"
    >
      <div className="relative h-32 w-full overflow-hidden">
        <img
          src={lakePhotoUrl(lake.slug)}
          alt={lake.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {isCurrent && (
            <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
              <CircleCheck className="h-3 w-3" /> You're here
            </span>
          )}
          {isTrending && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <Flame className="h-3 w-3" /> Trending
            </span>
          )}
        </div>
        <div className="absolute bottom-2.5 left-3 right-3">
          <p className="truncate font-display text-lg font-bold tracking-tight text-white drop-shadow-sm">
            {lake.name}
          </p>
          <p className="truncate text-[11px] font-medium text-white/80">{lake.region}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5" title="Active this week">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">{lake.activeUsers}</span> active
        </span>
        <span className="flex items-center gap-1.5 text-pink-500" title="Live stories">
          <StoryRingIcon />
          <span className="font-semibold text-foreground">{lake.storyCount}</span>
          <span className="text-muted-foreground">stories</span>
        </span>
        <span className="flex items-center gap-1.5" title="Events today or upcoming">
          <Calendar className="h-3.5 w-3.5 text-violet-500" />
          <span className="font-semibold text-foreground">{lake.liveEvents}</span> events
        </span>
        <span className="ml-auto flex items-center gap-1 text-orange-500" title="Trending score">
          <Flame className="h-3.5 w-3.5" />
          <span className="font-bold">{lake.trendingScore}</span>
        </span>
      </div>
    </button>
  );
}

/**
 * Explore Lakes: every Gillie community at a glance — photo, live activity,
 * and a trending rank. Picking a lake switches the whole app (map, feed,
 * stories, events, catches) into that lake's community.
 */
export function LakesPage() {
  const { lakeId, setLakeId } = useLake();
  const [, navigate] = useLocation();
  const { data: lakes, isLoading } = useGetLakesOverview();

  // Server returns lakes ranked by trending score already.
  const topScore = lakes?.[0]?.trendingScore ?? 0;

  const selectLake = (lake: LakeOverview) => {
    setLakeId(lake.id);
    navigate("/feed");
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="z-30 flex h-14 shrink-0 items-center border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
        <Link
          href="/feed"
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/50"
          data-testid="button-lakes-back"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="ml-2 flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <span aria-hidden>🌎</span> Explore Lakes
        </h1>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-24">
        <p className="text-sm text-muted-foreground">
          Every lake is its own hometown community. Pick one to see its map, feed,
          stories, and events — Gillie will remember where you left off.
        </p>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[172px] w-full rounded-[20px]" />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {(lakes ?? []).map((lake, i) => (
            <LakeCard
              key={lake.id}
              lake={lake}
              isCurrent={lake.id === lakeId}
              isTrending={i < 3 && lake.trendingScore > 0 && topScore > 0}
              onSelect={() => selectLake(lake)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
