import { useGetActiveHazards } from "@workspace/api-client-react";
import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";

const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };

export function HazardBanner() {
  const { data: hazards } = useGetActiveHazards({
    query: { refetchInterval: 1000 * 60 * 5 },
  });

  if (!hazards || hazards.length === 0) return null;

  const sorted = [...hazards].sort(
    (a, b) => (severityRank[b.severity ?? "low"] ?? 1) - (severityRank[a.severity ?? "low"] ?? 1)
  );
  const top = sorted[0];
  const extra = sorted.length - 1;

  return (
    <Link
      href="/map"
      className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 mb-4 text-red-700 dark:text-red-300"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">
          Hazard: {top.title}
          {extra > 0 && <span className="font-normal"> +{extra} more</span>}
        </div>
        {top.description && (
          <div className="text-xs opacity-80 truncate">{top.description}</div>
        )}
      </div>
      <span className="text-xs font-medium underline shrink-0">View on map</span>
    </Link>
  );
}
