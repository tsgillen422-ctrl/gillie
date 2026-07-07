import { Link } from "wouter";
import { 
  ChevronLeft, Calendar, Users, Fish, Flame, Store, MapPin, 
  Camera, ChevronRight, Waves, Sparkles
} from "lucide-react";
import { 
  useGetCatches, 
  useGetPins, 
  useGetPosts,
  getGetCatchesQueryKey,
  getGetPinsQueryKey,
  getGetPostsQueryKey
} from "@workspace/api-client-react";
import { resolveImageSrc } from "@/lib/assets";
import { format } from "date-fns";
import { useLake } from "@/lib/lake-context";

export function ExplorePage() {
  const { lakeId } = useLake();
  const { data: catches } = useGetCatches({}, { query: { queryKey: getGetCatchesQueryKey({}) } });
  const { data: pins } = useGetPins({ lakeId }, { query: { queryKey: getGetPinsQueryKey({ lakeId }) } });
  const { data: posts } = useGetPosts({ lakeId }, { query: { queryKey: getGetPostsQueryKey({ lakeId }) } });

  const biggestCatch = [...(catches ?? [])]
    .filter((c: any) => c.weight != null)
    .sort((a: any, b: any) => b.weight - a.weight)[0];

  const mostLikedPhoto = [...(posts ?? [])]
    .filter((p: any) => p.imageUrl)
    .sort((a: any, b: any) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];

  const popularPin = (pins ?? [])
    .slice()
    .sort((a: any, b: any) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];

  const now = Date.now();
  const upcomingEvent = (posts ?? [])
    .filter((p: any) => p.postType === "event" && p.eventDate && new Date(p.eventDate).getTime() >= now)
    .sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];

  const categories = [
    { title: "Trending", icon: Flame, href: "/feed?tab=trending", bg: "bg-orange-500", text: "text-orange-50", color: "text-orange-500" },
    { title: "Fishing", icon: Fish, href: "/feed?tab=fishing", bg: "bg-emerald-500", text: "text-emerald-50", color: "text-emerald-500" },
    { title: "For You", icon: Sparkles, href: "/feed?tab=all", bg: "bg-pink-500", text: "text-pink-50", color: "text-pink-500" },
    { title: "Events", icon: Calendar, href: "/feed?tab=event", bg: "bg-violet-500", text: "text-violet-50", color: "text-violet-500" },
    { title: "Community", icon: Users, href: "/feed?tab=community", bg: "bg-blue-500", text: "text-blue-50", color: "text-blue-500" },
    { title: "Places", icon: MapPin, href: "/pins", bg: "bg-rose-500", text: "text-rose-50", color: "text-rose-500" },
    { title: "Business", icon: Store, href: "/feed?tab=business", bg: "bg-teal-500", text: "text-teal-50", color: "text-teal-500" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <header className="sticky top-0 z-30 flex items-center h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border/50">
        <Link href="/feed" className="flex items-center justify-center w-8 h-8 -ml-2 rounded-full hover:bg-muted/50 transition-colors text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="ml-2 text-xl font-display font-bold tracking-tight flex items-center gap-2">
          <Waves className="w-5 h-5 text-primary" />
          Explore
        </h1>
      </header>

      <div className="p-4 space-y-6">
        <section>
          <h2 className="text-sm font-bold tracking-tight mb-3 text-muted-foreground uppercase">Discover</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <Link key={cat.title} href={cat.href} className={`group block relative overflow-hidden rounded-[20px] bg-card border border-border/50 shadow-sm hover:shadow-md transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 fill-mode-both`} style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="p-4 flex flex-col items-start gap-3 relative z-10">
                    <div className={`p-2.5 rounded-xl ${cat.bg} ${cat.text} shadow-sm group-hover:scale-110 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm">{cat.title}</span>
                  </div>
                  <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${cat.bg} opacity-[0.03] group-hover:scale-150 transition-transform duration-500`} />
                </Link>
              );
            })}
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
