import { Check, ChevronDown, Waves } from "lucide-react";
import { LAKES } from "@workspace/lake-config";
import { useLake } from "@/lib/lake-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * "Dale Hollow Lake ▾" dropdown — lets the user browse any lake community.
 * Rendered in the feed top bar and on the map.
 */
export function LakeSwitcher({ className }: { className?: string }) {
  const { lakeId, lake, setLakeId } = useLake();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left font-semibold text-foreground",
            className,
          )}
          data-testid="button-lake-switcher"
        >
          <span className="truncate">{lake.name}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] w-64 overflow-y-auto">
        {LAKES.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => setLakeId(l.id)}
            className="flex items-center gap-2"
            data-testid={`menu-lake-${l.id}`}
          >
            <Waves className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{l.name}</span>
              <span className="truncate text-xs text-muted-foreground">{l.region}</span>
            </span>
            {l.id === lakeId ? <Check className="h-4 w-4 shrink-0 text-teal-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
