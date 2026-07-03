import { useGetCatches, useGetPins, useGetPosts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";

import { Fish, Camera, MapPin, Calendar, Anchor, Sailboat } from "lucide-react";

type Trend = {
  key: string;
  label: string;
  icon: React.ElementType;
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
      icon: Fish,
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
      icon: Camera,
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
      icon: MapPin,
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
      icon: Calendar,
      title: upcomingEvent.title || "Event",
      subtitle: upcomingEvent.eventDate ? format(new Date(upcomingEvent.eventDate), "EEE, MMM d · h:mm a") : "Upcoming",
      accent: "from-violet-400/20 to-violet-500/5 text-violet-600",
      href: `/feed?tab=event&post=${upcomingEvent.id}`,
    });
  }

  const boatOfWeek = [...(posts ?? [])]
    .filter((p: any) => p.postType === "boat_showcase")
    .sort((a: any, b: any) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];
  if (boatOfWeek) {
    const boatImg = (Array.isArray(boatOfWeek.photos) && boatOfWeek.photos.length ? boatOfWeek.photos[0] : boatOfWeek.imageUrl) ?? null;
    items.push({
      key: "boat",
      label: "Boat of the Week",
      icon: Sailboat,
      title: boatOfWeek.title || boatOfWeek.user?.displayName || "Boat",
      subtitle: boatOfWeek.horsepower != null
        ? `${boatOfWeek.horsepower} HP · ${boatOfWeek.user?.displayName ?? ""}`
        : `${boatOfWeek.likeCount ?? 0} ${(boatOfWeek.likeCount ?? 0) === 1 ? "like" : "likes"} · ${boatOfWeek.user?.displayName ?? ""}`,
      imageUrl: boatImg,
      accent: "from-sky-400/20 to-blue-500/5 text-sky-600",
      href: `/boats?post=${boatOfWeek.id}`,
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
      icon: Anchor,
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
      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          const card = item.imageUrl ? (
            <div className="group relative overflow-hidden rounded-2xl bg-muted shadow-sm transition-transform active:scale-[0.99] animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: `${index * 50}ms` }}>
              <img src={item.imageUrl} alt={item.title} className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  <Icon className="w-3 h-3" />
                  {item.label}
                </div>
                <p className="text-base font-bold leading-tight text-white drop-shadow-sm truncate">{item.title}</p>
                <p className="mt-0.5 text-xs text-white/80 truncate">{item.subtitle}</p>
              </div>
            </div>
          ) : (
            <div className="group flex items-stretch rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm transition-transform active:scale-[0.99] hover-elevate animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: `${index * 50}ms` }}>
              <div className={`w-24 shrink-0 bg-gradient-to-br ${item.accent} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
                <Icon className="w-8 h-8 opacity-70" />
              </div>
              <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
                <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-br ${item.accent} bg-clip-text text-transparent mb-0.5`}>
                  <Icon className="w-3 h-3 text-current" />
                  {item.label}
                </div>
                <p className="text-sm font-bold truncate leading-tight text-foreground">{item.title}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
              </div>
            </div>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={item.key}>
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
