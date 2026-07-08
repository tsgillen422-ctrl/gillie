import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronLeft, MapPin, Users, Calendar, Play } from "lucide-react";
import {
  useGetLakePlaceDetail,
  getGetLakePlaceDetailQueryKey,
  useGetPlaceStories,
  getGetPlaceStoriesQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { isValidLakeId } from "@workspace/lake-config";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { resolveImageSrc } from "@/lib/assets";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Small read-only map showing where the place sits on the lake. Falls back to
 * a plain coordinates card when WebGL isn't available (older webviews,
 * headless browsers) instead of crashing the page.
 */
function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapFailed) return;
    let map: maplibregl.Map | null = null;
    let marker: maplibregl.Marker | null = null;
    try {
      map = new maplibregl.Map({
        container: el,
        style: MAP_STYLE,
        center: [lng, lat],
        zoom: 13,
        interactive: false,
        attributionControl: false,
      });
      map.on("error", () => {
        /* tile/style hiccups shouldn't surface as crashes on a static preview */
      });
      marker = new maplibregl.Marker({ color: "#0d9488" }).setLngLat([lng, lat]).addTo(map);
    } catch {
      setMapFailed(true);
      return;
    }
    return () => {
      marker?.remove();
      map?.remove();
    };
  }, [lat, lng, mapFailed]);

  if (mapFailed) {
    return (
      <div
        className="flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-gradient-to-br from-teal-500/10 to-sky-500/10"
        data-testid="place-mini-map"
      >
        <MapPin className="h-6 w-6 text-primary" />
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <div ref={containerRef} className="h-40 w-full" data-testid="place-mini-map" aria-label={`Map location of ${label}`} />
    </div>
  );
}

/**
 * Place detail: everything happening at one named spot on a lake — its live
 * story photos, who's posting there, nearby upcoming events, and where it is
 * on the map. Reached from Trending Places on the Lake Overview.
 */
export function PlaceDetailPage() {
  const params = useParams<{ lakeId: string; placeName: string }>();
  const rawId = Number(params.lakeId);
  const validId = isValidLakeId(rawId) ? rawId : undefined;
  // wouter v3 already URL-decodes route params — decoding again would corrupt
  // place names containing a literal "%".
  const placeName = (params.placeName ?? "").trim();

  const { data: me } = useGetMe();
  const enabled = validId !== undefined && placeName.length > 0;
  const { data: place, isLoading, isError } = useGetLakePlaceDetail(validId ?? 0, placeName, {
    query: {
      enabled,
      queryKey: getGetLakePlaceDetailQueryKey(validId ?? 0, placeName),
    },
  });

  // Full-screen story viewer for this place, fetched lazily on tap. Scoped by
  // the page's lakeId (NOT the current lake context — the viewer may be
  // browsing a lake they haven't entered).
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStoryId, setViewerStoryId] = useState<number | null>(null);
  const { data: storyGroups, isLoading: storiesLoading } = useGetPlaceStories(
    placeName,
    { lakeId: validId ?? 0 },
    {
      query: {
        enabled: viewerOpen && enabled,
        queryKey: getGetPlaceStoriesQueryKey(placeName, { lakeId: validId ?? 0 }),
      },
    },
  );
  useEffect(() => {
    if (viewerOpen && !storiesLoading && storyGroups && storyGroups.length === 0) {
      setViewerOpen(false);
    }
  }, [viewerOpen, storiesLoading, storyGroups]);

  const openViewerAt = (storyId: number | null) => {
    setViewerStoryId(storyId);
    setViewerOpen(true);
  };

  // Locate the tapped story inside the fetched groups (fall back to start).
  let initialGroupIndex = 0;
  let initialStoryIndex = 0;
  if (viewerStoryId != null && storyGroups) {
    outer: for (let g = 0; g < storyGroups.length; g++) {
      const idx = storyGroups[g].stories.findIndex((s) => s.id === viewerStoryId);
      if (idx >= 0) {
        initialGroupIndex = g;
        initialStoryIndex = idx;
        break outer;
      }
    }
  }

  const backHref = validId !== undefined ? `/lakes/${validId}` : "/lakes";

  if (!enabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">That place doesn't exist.</p>
        <Link href="/lakes" className="text-sm font-semibold text-primary underline">
          Back to Explore Lakes
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="relative flex-1 overflow-y-auto pb-8">
        <div className="absolute left-3 top-3 z-20">
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
            data-testid="button-place-back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-none" />
            <div className="space-y-3 px-4">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </div>
        ) : isError || !place ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing live at this spot right now — stories here have expired.
            </p>
            <Link href={backHref} className="text-sm font-semibold text-primary underline">
              Back to the lake
            </Link>
          </div>
        ) : (
          <>
            {/* Hero: latest story photo at this place */}
            <div className="relative h-52 w-full shrink-0 overflow-hidden">
              {place.photos[0] ? (
                <img
                  src={resolveImageSrc(place.photos[0].url)}
                  alt={place.placeName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-600/30 to-sky-600/30">
                  <MapPin className="h-10 w-10 text-primary/60" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
              <div className="pointer-events-none absolute bottom-3 left-4 right-4">
                <h1 className="font-display text-2xl font-bold tracking-tight text-white drop-shadow-sm" data-testid="text-place-name">
                  {place.placeName}
                </h1>
                <p className="text-sm font-medium text-white/85">{place.lakeName}</p>
              </div>
            </div>

            <div className="space-y-5 p-4">
              {/* Stat strip + watch button */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm font-bold text-foreground">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-[2.5px] border-pink-500" aria-hidden />
                  {place.storyCount} {place.storyCount === 1 ? "story" : "stories"}
                </div>
                <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm font-bold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  {place.activeUsers} {place.activeUsers === 1 ? "person" : "people"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openViewerAt(null)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-[0.99]"
                data-testid="button-watch-place-stories"
              >
                <Play className="h-4 w-4 fill-current" />
                {viewerOpen && storiesLoading ? "Loading stories…" : "Watch stories from here"}
              </button>

              {/* Who's been posting */}
              {place.authors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {place.authors.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-full border border-border/50 bg-card py-1 pl-1 pr-3"
                      data-testid={`chip-author-${a.id}`}
                    >
                      <UserAvatar name={a.displayName} username={a.username} avatarUrl={a.avatarUrl} className="h-7 w-7" />
                      <span className="text-xs font-semibold text-foreground">{a.displayName}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Photo wall */}
              {place.photos.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="font-display text-base font-bold tracking-tight text-foreground">
                    <span aria-hidden>📷</span> Latest photos
                  </h2>
                  <div className="grid grid-cols-3 gap-1.5">
                    {place.photos.map((ph) => (
                      <button
                        key={ph.storyId}
                        type="button"
                        onClick={() => openViewerAt(ph.storyId)}
                        className="aspect-square overflow-hidden rounded-lg transition-transform active:scale-95"
                        data-testid={`photo-${ph.storyId}`}
                      >
                        <img
                          src={resolveImageSrc(ph.url)}
                          alt={ph.authorName ? `Photo by ${ph.authorName}` : "Story photo"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Nearby upcoming events */}
              {place.nearbyEvents.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
                    <Calendar className="h-4 w-4 text-violet-500" /> Events nearby
                  </h2>
                  <div className="space-y-2">
                    {place.nearbyEvents.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3"
                        data-testid={`place-event-${e.id}`}
                      >
                        {e.imageUrl ? (
                          <img src={resolveImageSrc(e.imageUrl)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xl">🎉</div>
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

              {/* Where it is */}
              {place.lat != null && place.lng != null && (
                <section className="space-y-2.5">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-foreground">
                    <MapPin className="h-4 w-4 text-primary" /> Where it is
                  </h2>
                  <MiniMap lat={place.lat} lng={place.lng} label={place.placeName} />
                </section>
              )}
            </div>
          </>
        )}
      </div>

      {viewerOpen && storyGroups && storyGroups.length > 0 && (
        <StoryViewer
          groups={storyGroups}
          initialGroupIndex={initialGroupIndex}
          initialStoryIndex={initialStoryIndex}
          meId={me?.id}
          lakeId={validId}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
