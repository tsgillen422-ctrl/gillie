import { useRef } from "react";
import { X } from "lucide-react";
import type { StorySticker } from "@workspace/api-client-react";

// Renders stickers positioned by normalized 0-1 coords over story media.
// In edit mode stickers can be dragged and removed; view mode is inert.

function stickerContent(s: StorySticker): { icon: string; text: string } {
  const d = (s.data ?? {}) as Record<string, unknown>;
  switch (s.type) {
    case "location":
      return { icon: String(d.emoji ?? "📍"), text: String(d.name ?? "On the lake") };
    case "weather":
      return {
        icon: String(d.icon ?? "🌤️"),
        text: [d.temp != null ? `${Math.round(Number(d.temp))}°` : null, d.label ?? null]
          .filter(Boolean)
          .join(" "),
      };
    case "boat":
      return { icon: "🚤", text: String(d.name ?? "My boat") };
    case "emoji":
      return { icon: String(d.emoji ?? "🌊"), text: "" };
    default:
      return { icon: "🌊", text: "" };
  }
}

export function StickerLayer({
  stickers,
  editable = false,
  onChange,
}: {
  stickers: StorySticker[];
  editable?: boolean;
  onChange?: (next: StorySticker[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ idx: number; pointerId: number } | null>(null);

  const startDrag = (idx: number) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    dragRef.current = { idx, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const box = containerRef.current?.getBoundingClientRect();
    if (!drag || !box || !onChange) return;
    const x = Math.min(0.98, Math.max(0.02, (e.clientX - box.left) / box.width));
    const y = Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height));
    onChange(stickers.map((s, i) => (i === drag.idx ? { ...s, x, y } : s)));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${editable ? "" : "pointer-events-none"}`}
      onPointerMove={editable ? moveDrag : undefined}
      onPointerUp={editable ? endDrag : undefined}
      onPointerCancel={editable ? endDrag : undefined}
    >
      {stickers.map((s, i) => {
        const { icon, text } = stickerContent(s);
        const emojiOnly = s.type === "emoji";
        return (
          <div
            key={i}
            className={`absolute -translate-x-1/2 -translate-y-1/2 select-none ${editable ? "cursor-grab touch-none" : ""}`}
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
            onPointerDown={startDrag(i)}
            data-testid={`sticker-${s.type}-${i}`}
          >
            {emojiOnly ? (
              <span className="text-4xl drop-shadow-md">{icon}</span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
                <span>{icon}</span>
                {text && <span className="max-w-40 truncate">{text}</span>}
              </span>
            )}
            {editable && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(stickers.filter((_, j) => j !== i));
                }}
                className="absolute -right-2 -top-2 rounded-full bg-black/70 p-0.5 text-white"
                aria-label="Remove sticker"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
