import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ChevronLeft,
  Users,
  Calendar,
  MapPin,
  Flame,
  ArrowRight,
  CircleCheck,
} from "lucide-react";
import {
  useGetLakeDetail,
  getGetLakeDetailQueryKey,
  useGetStories,
  getGetStoriesQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { isValidLakeId } from "@workspace/lake-config";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { ConditionsWidget } from "@/components/ConditionsWidget";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { resolveImageSrc } from "@/lib/assets";
import { useLake } from "@/lib/lake-context";

/** Photo generated for each lake, shipped with the app in public/lakes/. */
function lakePhotoUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}lakes/${slug}.png`;
}

function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Auto-advancing, swipeable photo carousel for the lake hero. */
function HeroCarousel({
  photos,
  name,
  region,
  credit,
}: {
  photos: string[];
  name: string;
  region: string;
  /** Shown over the first slide only (the featured community photo). */
  credit?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  // Auto-advance every 4s unless the user is touching the carousel.
  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const el = scrollerRef.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % photos.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(t);
  }, [photos.length]);

  return (
    <div className="relative h-64 w-full shrink-0 overflow-hidden">
      <div
        ref={scrollerRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none" }}
        onTouchStart={() => (pausedRef.current = true)}
        onTouchEnd={() => (pausedRef.current = false)}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((url, i) => (
          <img
            key={`${url}-${i}`}
            src={url}
            alt={i === 0 ? name : `Recent photo from ${name}`}
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
      {credit && index === 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-10">{credit}</div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-4 right-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white drop-shadow-sm">
          {name}
        </h1>
        <p className="text-sm font-medium text-white/85">{region}</p>
      </div>
      {photos.length > 1 && (
        <div className="pointer-events-none absolute bottom-3 right-4 flex gap-1.5">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

/**
 * Lake Overview: a live preview of one lake community — photos, stories,
 * conditions, events, trending places, and friends already there — before
 * the user commits to switching into it.
 */
export function LakeOverviewPage() {
  const params = useParams<{ lakeId: string }>();
  const rawId = Number(params.lakeId);
  const validId = isValidLakeId(rawId) ? rawId : undefined;
  const { lakeId: currentLakeId, setLakeId } = useLake();
  const [, navigate] = useLocation();

  const { data: lake, isLoading } = useGetLakeDetail(validId ?? 0, {
    query: {
      enabled: validId !== undefined,
      queryKey: getGetLakeDetailQueryKey(validId ?? 0),
    },
  });

  const { data: me } = useGetMe();

  // Full-screen story viewer for this lake's stories; fetched lazily on tap.
  const [storiesOpen, setStoriesOpen] = useState(false);
  const { data: storyGroups, isLoading: storiesLoading } = useGetStories(
    { lakeId: validId ?? 0 },
    {
      query: {
        enabled: storiesOpen && validId !== undefined,
        queryKey: getGetStoriesQueryKey({ lakeId: validId ?? 0 }),
      },
    },
  );
  // If the stories all expired between page load and tap, close gracefully.
  useEffect(() => {
    if (storiesOpen && !storiesLoading && storyGroups && storyGroups.length === 0) {
      setStoriesOpen(false);
    }
  }, [storiesOpen, storiesLoading, storyGroups]);

  // Real community photos lead; the generated lake artwork only appears when
  // the community hasn't shared any photos yet (never mixed with real ones).
  const photos = useMemo(() => {
    if (!lake) return [];
    const community = [
      ...(lake.heroPhoto ? [lake.heroPhoto.url] : []),
      ...lake.recentPhotos.filter((u) => u !== lake.heroPhoto?.url),
    ].map(resolveImageSrc);
    return community.length ? [...new Set(community)] : [lakePhotoUrl(lake.slug)];
  }, [lake]);

  if (validId === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">That lake doesn't exist.</p>
        <Link href="/lakes" className="text-sm font-semibold text-primary underline">
          Back to Explore Lakes
        </Link>
      </div>
    );
  }

  const isCurrent = validId === currentLakeId;

  const enterLake = () => {
    setLakeId(validId);
    navigate("/feed");
  };

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="relative flex-1 overflow-y-auto pb-32">
        {/* Floating back button over the hero */}
        <div className="absolute left-3 top-3 z-20">
          <Link
            href="/lakes"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
            data-testid="button-lake-overview-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
        </div>

        {isLoading || !lake ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-none" />
            <div className="space-y-3 px-4">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            <HeroCarousel
              photos={photos}
              name={lake.name}
              region={lake.region}
              credit={
                lake.heroPhoto ? (
                  <span
                    className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
                    data-testid="hero-photo-credit"
                  >
                    <span aria-hidden>⭐</span>
                    Top photo
                    {lake.heroPhoto.authorName ? ` · ${lake.heroPhoto.authorName}` : ""}
                    {lake.heroPhoto.likeCount > 0 && (
                      <span className="text-white/80">❤️ {lake.heroPhoto.likeCount}</span>
                    )}
                  </span>
                ) : undefined
              }
            />

            <div className="space-y-5 p-4">
              {/* Stat strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-lg font-bold text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    {lake.activeUsers}
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground">active this week</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-lg font-bold text-foreground">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border-[2.5px] border-pink-500" aria-hidden />
                    {lake.stories.count}
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground">stories today</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-lg font-bold text-foreground">
                    <Calendar className="h-4 w-4 text-violet-500" />
                    {lake.upcomingEvents.length}
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground">upcoming events</p>
                </div>
              </div>

              {/* Friends already on this lake */}
              {lake.friendsHere.length > 0 && (
                <section className="space-y-2.5">
                  <SectionTitle>
                    <span aria-hidden>🛥️</span> Friends on the water here
                  </SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {lake.friendsHere.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 rounded-full border border-border/50 bg-card py-1 pl-1 pr-3"
                        data-testid={`chip-friend-${f.id}`}
                      >
                        <UserAvatar
                          name={f.displayName}
                          username={f.username}
                          avatarUrl={f.avatarUrl}
                          className="h-7 w-7"
                        />
                        <span className="text-xs font-semibold text-foreground">{f.displayName}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Today's stories — tap to watch them full-screen */}
              {lake.stories.count > 0 && lake.stories.authors.length > 0 && (
                <section className="space-y-2.5">
                  <SectionTitle>
                    <span aria-hidden>📸</span> Watch Today's Stories ({lake.stories.count})
                  </SectionTitle>
                  <button
                    type="button"
                    onClick={() => setStoriesOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-left transition-all hover:bg-accent/40 active:scale-[0.99]"
                    data-testid="button-watch-stories"
                  >
                    <div className="flex -space-x-2">
                      {lake.stories.authors.slice(0, 6).map((a) => (
                        <div
                          key={a.id}
                          className="rounded-full ring-2 ring-pink-500 ring-offset-2 ring-offset-card"
                        >
                          <UserAvatar
                            name={a.displayName}
                            username={a.username}
                            avatarUrl={a.avatarUrl}
                            className="h-9 w-9"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="flex-1 text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">{lake.stories.count}</span>{" "}
                      {lake.stories.count === 1 ? "story" : "stories"} shared today —{" "}
                      {storiesOpen && storiesLoading ? "loading…" : "tap to watch"}
                    </p>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </section>
              )}

              {/* Weather + fishing conditions */}
              <section className="space-y-2.5">
                <SectionTitle>
                  <span aria-hidden>🌤️</span> Conditions right now
                </SectionTitle>
                <ConditionsWidget lakeId={lake.id} />
              </section>

              {/* Local businesses */}
              <section className="space-y-2.5">
                <SectionTitle>
                  <span aria-hidden>🏪</span> Local businesses
                </SectionTitle>
                <Link
                  href="/businesses"
                  className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-left transition-all hover:bg-accent/40 active:scale-[0.99]"
                  data-testid="link-lake-businesses"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
                    ⚓
                  </div>
                  <p className="flex-1 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">Marinas, guides, rentals & more</span>
                    <br />
                    Browse and follow lake businesses
                  </p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </section>

              {/* Upcoming events */}
              {lake.upcomingEvents.length > 0 && (
                <section className="space-y-2.5">
                  <SectionTitle>
                    <Calendar className="h-4 w-4 text-violet-500" /> Upcoming events
                  </SectionTitle>
                  <div className="space-y-2">
                    {lake.upcomingEvents.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3"
                        data-testid={`event-${e.id}`}
                      >
                        {e.imageUrl ? (
                          <img
                            src={resolveImageSrc(e.imageUrl)}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xl">
                            🎉
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{formatEventDate(e.eventDate)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Trending places */}
              {lake.trendingPlaces.length > 0 && (
                <section className="space-y-2.5">
                  <SectionTitle>
                    <Flame className="h-4 w-4 text-orange-500" /> Trending places
                  </SectionTitle>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {lake.trendingPlaces.map((p) => (
                      <button
                        key={p.placeName}
                        type="button"
                        onClick={() =>
                          navigate(`/lakes/${validId}/places/${encodeURIComponent(p.placeName)}`)
                        }
                        className="w-36 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-card text-left transition-all hover:bg-accent/40 active:scale-[0.98]"
                        data-testid={`card-place-${p.placeName}`}
                      >
                        {p.thumbnailUrl ? (
                          <img
                            src={resolveImageSrc(p.thumbnailUrl)}
                            alt=""
                            className="h-20 w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-20 w-full items-center justify-center bg-gradient-to-br from-teal-500/15 to-sky-500/15">
                            <MapPin className="h-6 w-6 text-primary/60" />
                          </div>
                        )}
                        <div className="space-y-0.5 p-2.5">
                          <p className="truncate text-xs font-bold text-foreground">{p.placeName}</p>
                          <p className="text-[10px] font-medium text-muted-foreground">
                            {p.storyCount} {p.storyCount === 1 ? "story" : "stories"} ·{" "}
                            {p.activeUsers} {p.activeUsers === 1 ? "person" : "people"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Quiet-lake nudge */}
              {lake.activeUsers === 0 && lake.stories.count === 0 && lake.upcomingEvents.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  It's quiet out here… be the one who gets {lake.name} going. 🌊
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Full-screen Snapchat-style viewer for this lake's stories */}
      {storiesOpen && storyGroups && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={0}
          meId={me?.id}
          lakeId={validId}
          onClose={() => setStoriesOpen(false)}
        />
      )}

      {/* Enter button pinned above the bottom nav */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4">
        <div className="pointer-events-auto mx-auto max-w-md">
          <Button
            size="lg"
            className="h-12 w-full rounded-full text-base font-bold shadow-lg"
            onClick={enterLake}
            data-testid="button-enter-lake"
          >
            {isCurrent ? (
              <>
                <CircleCheck className="mr-2 h-5 w-5" /> You're here — back to the feed
              </>
            ) : (
              <>
                Enter Lake Community <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
