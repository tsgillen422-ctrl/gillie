import { Award, Fish, Sparkles, Star, Map as MapIcon, BadgeCheck } from "lucide-react";

type BadgeDef = { label: string; icon: typeof Award; className: string };

const BADGES: Record<string, BadgeDef> = {
  verified_business: { label: "Verified Business", icon: BadgeCheck, className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  frequent_poster: { label: "Frequent Poster", icon: Sparkles, className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  trailblazer: { label: "Trailblazer", icon: MapIcon, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  angler: { label: "Master Angler", icon: Fish, className: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  first_catch: { label: "First Catch", icon: Star, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
};

export function BadgeRow({ badges }: { badges?: string[] | null }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
      {badges.map((key) => {
        const def = BADGES[key];
        if (!def) return null;
        const Icon = def.icon;
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${def.className}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {def.label}
          </span>
        );
      })}
    </div>
  );
}
