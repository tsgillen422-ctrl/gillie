import { Link } from "wouter";
import {
  ChevronLeft, Calendar, Fish, ChevronRight, Waves, MapPin, Camera,
} from "lucide-react";
import {
  useGetCatches,
  useGetPins,
  useGetPosts,
  getGetCatchesQueryKey,
  getGetPinsQueryKey,
  getGetPostsQueryKey,
  type Post,
  type Pin,
  type Catch,
} from "@workspace/api-client-react";
import { resolveImageSrc } from "@/lib/assets";
import { format } from "date-fns";
import { useLake } from "@/lib/lake-context";

/**
 * Explore hub: big photo category cards backed by real community photos from
 * the current lake (highest-liked, never AI/stock), plus a highlights list.
 */
export function ExplorePage() {
  const { lakeId, lake } = useLake();
  const { data: catches } = useGetCatches({ lakeId }, { query: { queryKey: getGetCatchesQueryKey({ lakeId }) } });
  const { data: pins } = useGetPins({ lakeId }, { query: { queryKey: getGetPinsQueryKey({ lakeId }) } });
  const { data: posts } = useGetPosts({ lakeId }, { query: { queryKey: getGetPostsQueryKey({ lakeId }) } });

  // Moderated media never headlines a category card.
  const cleanPosts = (posts ?? []).filter((p: Post) => !p.isMature);
  const cleanPins = (pins ?? []).filter((p: Pin) => !p.isMature && p.imageUrl);
  const cleanCatches = (catches ?? []).filter((c: Catch) => !c.isMature && c.imageUrl);

  const byLikes = (a: { likeCount?: number }, b: { likeCount?: number }) =>
    (b.likeCount ?? 0) - (a.likeCount ?? 0);

  const photoPosts = cleanPosts.filter((p) => p.imageUrl).sort(byLikes);

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const trendingPhoto =
    photoPosts.find((p) => new Date(p.createdAt).getTime() >= weekAgo)?.imageUrl ??
    photoPosts[0]?.imageUrl ??
    null;

  const fishingPhoto =
    [...cleanCatches].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0]?.imageUrl ?? null;

  const eventPosts = photoPosts.filter((p) => p.postType === "event");
  const eventPhoto =
    eventPosts
      .filter((p) => p.eventDate && new Date(p.eventDate).getTime() >= now)
      .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())[0]?.imageUrl ??
    eventPosts[0]?.imageUrl ??
    null;

  const popularPin = [...cleanPins].sort(byLikes)[0];
  const placesPhoto = popularPin?.imageUrl ?? null;
  const communityPhoto = photoPosts.find((p) => p.postType === "post")?.imageUrl ?? null;
  // "For You" prefers the runner-up photo so it doesn't mirror Trending.
  const forYouPhoto = (photoPosts[1] ?? photoPosts[0])?.imageUrl ?? null;
  const businessPhoto = photoPosts.find((p) => p.postType === "business")?.imageUrl ?? null;

  const categories: Array<{
    emoji: string;
    title: string;
    href: string;
    photo: string | null;
    fallback: string;
  }> = [
    { emoji: "🔥", title: "Trending", href: "/feed?tab=trending", photo: trendingPhoto, fallback: "from-orange-500 to-red-500" },
    { emoji: "🎣", title: "Fishing", href: "/feed?tab=fishing", photo: fishingPhoto, fallback: "from-emerald-500 to-teal-600" },
    { emoji: "📅", title: "Events", href: "/feed?tab=event", photo: eventPhoto, fallback: "from-violet-500 to-purple-600" },
    { emoji: "📍", title: "Places", href: "/pins", photo: placesPhoto, fallback: "from-rose-500 to-pink-600" },
    { emoji: "👥", title: "Community", href: "/feed?tab=community", photo: communityPhoto, fallback: "from-blue-500 to-indigo-600" },
    { emoji: "⭐", title: "For You", href: "/feed?tab=all", photo: forYouPhoto, fallback: "from-amber-400 to-orange-500" },
    { emoji: "🏪", title: "Businesses", href: "/feed?tab=business", photo: businessPhoto, fallback: "from-teal-500 to-cyan-600" },
  ];

  const biggestCatch = [...(catches ?? [])]
    .filter((c) => c.weight != null && !c.isMature)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];

  const mostLikedPhoto = photoPosts[0];

  const upcomingEvent = cleanPosts
    .filter((p) => p.postType === "event" && p.eventDate && new Date(p.eventDate).getTime() >= now)
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())[0];

  return (
    <div className="h-full overflow-y-auto bg-background pb-20">
      <header className="sticky top-0 z-30 flex items-center h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border/50">
        <Link href="/feed" className="flex items-center justify-center w-8 h-8 -ml-2 rounded-full hover:bg-muted/50 transition-colors text-foreground" data-testid="button-explore-back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="ml-2 text-xl font-display font-bold tracking-tight flex items-center gap-2">
          <Waves className="w-5 h-5 text-primary" />
          Explore
        </h1>
        <span className="ml-auto truncate text-xs font-semibold text-muted-foreground">{lake.name}</span>
      </header>

      <div className="p-4 space-y-6">
        <section>
          <h2 className="text-sm font-bold tracking-tight mb-3 text-muted-foreground uppercase">Discover</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat, i) => (
              <Link
                key={cat.title}
                href={cat.href}
                data-testid={`card-explore-${cat.title.toLowerCase().replace(/\s+/g, "-")}`}
                className={`group relative block overflow-hidden rounded-[20px] shadow-sm hover:shadow-md transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-[4/3]"}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {cat.photo ? (
                  <img
                    src={resolveImageSrc(cat.photo)}
                    alt={cat.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.fallback}`}>
                    <span className="absolute right-3 top-3 text-4xl opacity-25" aria-hidden>{cat.emoji}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-3">
                  <span className="text-lg leading-none" aria-hidden>{cat.emoji}</span>
                  <span className="text-sm font-bold text-white drop-shadow-sm">{cat.title}</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-white/80" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
          <h2 className="text-sm font-bold tracking-tight text-muted-foreground uppercase">Highlights</h2>

          <div className="flex flex-col gap-3">
            {biggestCatch && (
              <Link href={`/catches?catch=${biggestCatch.id}`} className="block relative overflow-hidden rounded-[20px] bg-card border border-border/50 shadow-sm transition-transform active:scale-[0.98]">
                {biggestCatch.imageUrl && (
                  <div className="absolute inset-0">
                    <img src={resolveImageSrc(biggestCatch.imageUrl)} alt={biggestCatch.species} className="w-full h-full object-cover opacity-20 dark:opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-transparent" />
                  </div>
                )}
                <div className="relative p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                    <Fish className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Biggest Catch</p>
                    <p className="font-bold text-base truncate">{biggestCatch.species}</p>
                    <p className="text-xs text-muted-foreground truncate">{biggestCatch.weight} lb · {biggestCatch.user?.displayName}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )}

            {mostLikedPhoto && (
              <Link href={`/feed?post=${mostLikedPhoto.id}`} className="block relative overflow-hidden rounded-[20px] bg-card border border-border/50 shadow-sm transition-transform active:scale-[0.98]">
                {mostLikedPhoto.imageUrl && (
                  <div className="absolute inset-0">
                    <img src={resolveImageSrc(mostLikedPhoto.imageUrl)} alt="Most Liked Photo" className="w-full h-full object-cover opacity-20 dark:opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-transparent" />
                  </div>
                )}
                <div className="relative p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
                    <Camera className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Most Liked Photo</p>
                    <p className="font-bold text-base truncate">{mostLikedPhoto.title || mostLikedPhoto.user?.displayName || "Photo"}</p>
                    <p className="text-xs text-muted-foreground truncate">{mostLikedPhoto.likeCount} likes · {mostLikedPhoto.user?.displayName}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )}

            {upcomingEvent && (
              <Link href={`/feed?tab=event&post=${upcomingEvent.id}`} className="block relative overflow-hidden rounded-[20px] bg-card border border-border/50 shadow-sm transition-transform active:scale-[0.98]">
                {upcomingEvent.imageUrl && (
                  <div className="absolute inset-0">
                    <img src={resolveImageSrc(upcomingEvent.imageUrl)} alt="Upcoming Event" className="w-full h-full object-cover opacity-20 dark:opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-transparent" />
                  </div>
                )}
                <div className="relative p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 border border-violet-200 dark:border-violet-800">
                    <Calendar className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Upcoming Event</p>
                    <p className="font-bold text-base truncate">{upcomingEvent.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{upcomingEvent.eventDate ? format(new Date(upcomingEvent.eventDate), "EEE, MMM d · h:mm a") : "Upcoming"}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )}

            {popularPin && (
              <Link href={popularPin.lat != null && popularPin.lng != null ? `/map?lat=${popularPin.lat}&lng=${popularPin.lng}` : "/pins"} className="block relative overflow-hidden rounded-[20px] bg-card border border-border/50 shadow-sm transition-transform active:scale-[0.98]">
                {popularPin.imageUrl && (
                  <div className="absolute inset-0">
                    <img src={resolveImageSrc(popularPin.imageUrl)} alt="Popular Pin" className="w-full h-full object-cover opacity-20 dark:opacity-10" />
                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-transparent" />
                  </div>
                )}
                <div className="relative p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-800">
                    <MapPin className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Popular Pin</p>
                    <p className="font-bold text-base truncate">{popularPin.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{popularPin.likeCount} likes · {(popularPin.type || "").replace(/_/g, " ")}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
