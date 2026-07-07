import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, Waves } from "lucide-react";
import { LAKES, lakeById, type Lake } from "@workspace/lake-config";
import { useLake } from "@/lib/lake-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function distanceMi(a: Lake, b: Lake): number {
  // Haversine — close enough for sorting lakes by distance.
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function LakeRow({
  lake,
  selected,
  meta,
  onSelect,
}: {
  lake: Lake;
  selected: boolean;
  meta?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`menu-lake-${lake.id}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        selected ? "bg-primary/10" : "hover:bg-muted active:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-primary text-primary-foreground" : "bg-teal-500/10 text-teal-600",
        )}
      >
        <Waves className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{lake.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {lake.region}
          {meta ? ` · ${meta}` : ""}
        </span>
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
      {children}
    </p>
  );
}

/**
 * Header lake selector: "〰 Dale Hollow Lake ▾" trigger that opens a
 * searchable bottom sheet with Primary, Recent, Nearby, and Browse All lakes.
 */
export function LakeSwitcher({ className }: { className?: string }) {
  const { lakeId, lake, setLakeId, primaryLakeId, recentLakeIds } = useLake();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      q
        ? LAKES.filter(
            (l) => l.name.toLowerCase().includes(q) || l.region.toLowerCase().includes(q) || l.slug.includes(q),
          )
        : null,
    [q],
  );

  const primaryLake = primaryLakeId != null ? lakeById(primaryLakeId) : null;
  const recents = recentLakeIds.map((id) => lakeById(id)).filter((l) => l.id !== primaryLakeId);
  const nearby = useMemo(() => {
    const excluded = new Set<number>([lakeId, ...(primaryLakeId != null ? [primaryLakeId] : []), ...recentLakeIds]);
    return LAKES.filter((l) => !excluded.has(l.id))
      .map((l) => ({ lake: l, mi: distanceMi(lake, l) }))
      .sort((a, b) => a.mi - b.mi)
      .slice(0, 4);
  }, [lakeId, lake, primaryLakeId, recentLakeIds]);

  const choose = (id: number) => {
    setLakeId(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-left font-semibold text-foreground hover:bg-muted active:bg-muted transition-colors",
          className,
        )}
        data-testid="button-lake-switcher"
      >
        <Waves className="h-4 w-4 shrink-0 text-teal-600" />
        <span className="truncate">{lake.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85dvh] flex-col rounded-t-2xl p-0"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
            <SheetTitle className="text-left text-base">Choose a lake</SheetTitle>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search lakes..."
                className="h-10 w-full rounded-xl border-none bg-muted pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                data-testid="input-lake-search"
              />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-2 pb-4 pt-1">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No lakes match "{query.trim()}".</p>
              ) : (
                filtered.map((l) => (
                  <LakeRow key={l.id} lake={l} selected={l.id === lakeId} onSelect={() => choose(l.id)} />
                ))
              )
            ) : (
              <>
                {primaryLake && (
                  <>
                    <SectionLabel>⭐ Primary Lake</SectionLabel>
                    <LakeRow
                      lake={primaryLake}
                      selected={primaryLake.id === lakeId}
                      meta="Home"
                      onSelect={() => choose(primaryLake.id)}
                    />
                  </>
                )}

                {recents.length > 0 && (
                  <>
                    <SectionLabel>🕒 Recent Lakes</SectionLabel>
                    {recents.map((l) => (
                      <LakeRow key={l.id} lake={l} selected={l.id === lakeId} onSelect={() => choose(l.id)} />
                    ))}
                  </>
                )}

                <SectionLabel>📍 Nearby Lakes</SectionLabel>
                {nearby.map(({ lake: l, mi }) => (
                  <LakeRow
                    key={l.id}
                    lake={l}
                    selected={l.id === lakeId}
                    meta={`${Math.round(mi)} mi away`}
                    onSelect={() => choose(l.id)}
                  />
                ))}

                <SectionLabel>🌎 Browse All Lakes</SectionLabel>
                {LAKES.map((l) => (
                  <LakeRow key={`all-${l.id}`} lake={l} selected={l.id === lakeId} onSelect={() => choose(l.id)} />
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
