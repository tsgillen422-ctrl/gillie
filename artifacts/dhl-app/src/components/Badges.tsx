import {
  Award,
  Fish,
  Sparkles,
  Star,
  Map as MapIcon,
  MapPin,
  BadgeCheck,
  Compass,
  Tent,
  Anchor,
  Camera,
  Heart,
  BookOpen,
} from "lucide-react";

type BadgeItem = { key: string; label: string; description: string; earned: boolean };

type BadgeMeta = { Icon: typeof Award; pill: string };

// Presentation only — earning logic + labels live on the server (single source of truth).
const BADGE_META: Record<string, BadgeMeta> = {
  explorer: { Icon: Compass, pill: "bg-primary/15 text-primary border-primary/30" },
  first_post: { Icon: Sparkles, pill: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  frequent_poster: { Icon: BookOpen, pill: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  first_catch: { Icon: Star, pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  angler: { Icon: Fish, pill: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  pathfinder: { Icon: MapPin, pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  trailblazer: { Icon: MapIcon, pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  shutterbug: { Icon: Camera, pill: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  popular: { Icon: Heart, pill: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  camper: { Icon: Tent, pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  boater: { Icon: Anchor, pill: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" },
  local_guide: { Icon: Award, pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  verified_business: { Icon: BadgeCheck, pill: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
};

const FALLBACK_META: BadgeMeta = { Icon: Award, pill: "bg-muted text-muted-foreground border-border" };

export function badgeMeta(key: string): BadgeMeta {
  return BADGE_META[key] ?? FALLBACK_META;
}

export function BadgeRow({
  badges,
  limit,
  onViewAll,
}: {
  badges?: BadgeItem[] | null;
  limit?: number;
  onViewAll?: () => void;
}) {
  const earned = (badges ?? []).filter((b) => b.earned);
  // Badges are computed live with no earned-at timestamp, so approximate
  // "most recent" by catalog tier: advanced badges sit later and are earned later.
  const ordered = [...earned].reverse();
  const shown = typeof limit === "number" ? ordered.slice(0, limit) : ordered;
  if (shown.length === 0 && !onViewAll) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
      {shown.map((b) => {
        const { Icon, pill } = badgeMeta(b.key);
        return (
          <span
            key={b.key}
            title={b.description}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-soft ${pill}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {b.label}
          </span>
        );
      })}
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground hover-elevate active-elevate-2"
        >
          View all
        </button>
      )}
    </div>
  );
}
