import { useGetCatches, useGetPins, useGetPosts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";

type Trend = {
  key: string;
  label: string;
  emoji: string;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  accent: string;
  href?: string;
};

export function TrendingSection() {
  const { data: catches } = useGetCatches({});
  const { data: pins } = useGetPins({});
  const { data: posts } = useGetPosts({});

  const items: Trend[] = [];

  const biggestCatch = [...(catches ?? [])]
    .filter((c: any) => c.weight != null)
    .sort((a: any, b: any) => b.weight - a.weight)[0];
  if (biggestCatch) {
    items.push({
      key: "catch",
      label: "Biggest Catch",
      emoji: "🎣",
      title: biggestCatch.species,
      subtitle: `${biggestCatch.weight} lb · ${biggestCatch.user?.displayName ?? "Angler"}`,
      imageUrl: biggestCatch.imageUrl,
      accent: "from-amber-400/20 to-amber-500/5 text-amber-600",
      href: `/catches?catch=${biggestCatch.id}`,
    });
  }

  const mostLikedPhoto = [...(posts ?? [])]
    .filter((p: any) => p.imageUrl)
    .sort((a: any, b: any) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];
  if (mostLikedPhoto) {
    items.push({
      key: "photo",
      label: "Most Liked Photo",
      emoji: "📸",
      title: mostLikedPhoto.title || mostLikedPhoto.user?.displayName || "Photo",
      subtitle: `${mostLikedPhoto.likeCount ?? 0} ${(mostLikedPhoto.likeCount ?? 0) === 1 ? "like" : "likes"} · ${mostLikedPhoto.user?.displayName ?? ""}`,
      imageUrl: mostLikedPhoto.imageUrl,
      accent: "from-rose-400/20 to-rose-500/5 text-rose-600",
      href: `/feed?post=${mostLikedPhoto.id}`,
    });
  }

  const popularPin = (pins ?? [])
    .slice()
    .sort((a: any, b: any) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];
  if (popularPin) {
    items.push({
      key: "pin",
      label: "Popular Pin",
      emoji: "📍",
      title: popularPin.title,
      subtitle: `${popularPin.likeCount ?? 0} ${(popularPin.likeCount ?? 0) === 1 ? "like" : "likes"} · ${(popularPin.type || "").replace(/_/g, " ")}`,
      accent: "from-sky-400/20 to-sky-500/5 text-sky-600",
      href:
        popularPin.lat != null && popularPin.lng != null
          ? `/map?lat=${popularPin.lat}&lng=${popularPin.lng}`
          : "/pins",
    });
  }

  const now = Date.now();
  const upcomingEvent = (posts ?? [])
    .filter((p: any) => p.postType === "event" && p.eventDate && new Date(p.eventDate).getTime() >= now)
    .sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
  if (upcomingEvent) {
    items.push({
      key: "event",
      label: "Upcoming Event",
      emoji: "📅",
      title: upcomingEvent.title || "Event",
      subtitle: format(new Date(upcomingEvent.eventDate), "EEE, MMM d · h:mm a"),
      accent: "from-violet-400/20 to-violet-500/5 text-violet-600",
      href: `/feed?post=${upcomingEvent.id}`,
    });
  }

  const tieUps = (posts ?? []).filter((p: any) => p.postType === "tie_up");
  const upcomingTieUp = tieUps
    .filter((p: any) => p.eventDate && new Date(p.eventDate).getTime() >= now)
    .sort((a: any, b: any) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())[0];
  const tieUp = upcomingTieUp ?? [...tieUps].sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0))[0];
  if (tieUp) {
    items.push({
      key: "tieup",
      label: "Tie-up",
      emoji: "⚓",
      title: tieUp.title || "Tie-up spot",
      subtitle: tieUp.eventDate
        ? format(new Date(tieUp.eventDate), "EEE, MMM d · h:mm a")
        : "Rafting up on the lake",
      accent: "from-teal-400/20 to-teal-500/5 text-teal-600",
      href: `/tie-ups?post=${tieUp.id}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <h2 className="text-sm font-bold tracking-tight">Trending This Week</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
        {items.map((item) => {
          const card = (
            <div className="w-[160px] shrink-0 rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm transition-transform active:scale-[0.98]">
              {item.imageUrl ? (
                <div className="h-20 bg-muted overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="object-cover w-full h-full" />
                </div>
              ) : (
                <div className={`h-20 bg-gradient-to-br ${item.accent} flex items-center justify-center`}>
                  <span className="text-3xl">{item.emoji}</span>
                </div>
              )}
              <div className="p-2.5">
                <p className={`text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-br ${item.accent} bg-clip-text mb-0.5`}>
                  {item.emoji} {item.label}
                </p>
                <p className="text-sm font-bold truncate leading-tight">{item.title}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
              </div>
            </div>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} className="shrink-0">
              {card}
            </Link>
          ) : (
            <div key={item.key} className="shrink-0">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
