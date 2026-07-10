import React from "react";
import { GripVertical, Pencil, Play, X } from "lucide-react";
import type { ComposerMediaItem } from "./MediaEditor";

// Reorderable thumbnail strip for the post composer. Uses pointer events
// (not HTML5 drag-and-drop) so it works with touch in the iOS webview:
// press and hold a tile's grip, drag horizontally, tiles shift as you cross
// their midpoints.

export function MediaStrip({
  items,
  onReorder,
  onRemove,
  onEdit,
}: {
  items: ComposerMediaItem[];
  onReorder: (next: ComposerMediaItem[]) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);
  const dragState = React.useRef<{ pointerId: number; startX: number; startY: number; active: boolean } | null>(null);

  const tileCenter = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.left + r.width / 2;
  };

  const indexFromPointer = (clientX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const tiles = Array.from(container.querySelectorAll("[data-media-tile]"));
    let idx = tiles.length - 1;
    for (let i = 0; i < tiles.length; i++) {
      if (clientX < tileCenter(tiles[i])) {
        idx = i;
        break;
      }
    }
    return idx;
  };

  const startDrag = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: true };
    setDragIdx(index);
    setOverIdx(index);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st || st.pointerId !== e.pointerId || dragIdx == null) return;
    setOverIdx(indexFromPointer(e.clientX));
  };

  const endDrag = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st || st.pointerId !== e.pointerId) return;
    dragState.current = null;
    if (dragIdx != null && overIdx != null && overIdx !== dragIdx) {
      const next = [...items];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      onReorder(next);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  if (!items.length) return null;

  return (
    <div ref={containerRef} className="flex gap-2 overflow-x-auto pb-1" data-testid="media-strip">
      {items.map((m, i) => (
        <div
          key={`${m.url}-${i}`}
          data-media-tile
          className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted transition-all ${
            dragIdx === i ? "scale-95 opacity-60 ring-2 ring-primary" : ""
          } ${overIdx === i && dragIdx != null && dragIdx !== i ? "ring-2 ring-primary/60" : ""}`}
          data-testid={`media-tile-${i}`}
        >
          {m.type === "image" ? (
            <img src={m.url} alt={`Media ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <>
              <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <Play className="h-6 w-6 text-white drop-shadow" />
              </span>
            </>
          )}
          <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{i + 1}</span>
          <button
            type="button"
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
            onClick={() => onRemove(i)}
            aria-label={`Remove media ${i + 1}`}
            data-testid={`button-media-remove-${i}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1 text-white"
            onClick={() => onEdit(i)}
            aria-label={`Edit media ${i + 1}`}
            data-testid={`button-media-edit-${i}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="absolute bottom-1 left-1 cursor-grab touch-none rounded-full bg-black/60 p-1 text-white active:cursor-grabbing"
            onPointerDown={startDrag(i)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-label={`Reorder media ${i + 1}`}
            data-testid={`button-media-drag-${i}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
