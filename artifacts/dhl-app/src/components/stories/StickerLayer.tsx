import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { StorySticker } from "@workspace/api-client-react";

// Renders stickers positioned by normalized 0-1 coords over story media, with
// optional scale + rotation transforms. In edit mode stickers can be dragged
// (one finger), pinched to resize / rotated (two fingers), and removed by
// dropping them on the trash zone. View mode is inert.

export type TextStickerData = {
  text: string;
  font?: string;
  color?: string;
  style?: string;
};

const TEXT_FONTS: Record<string, string> = {
  classic: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, Menlo, monospace",
  script: "'Snell Roundhand', 'Segoe Script', cursive",
  heavy: "system-ui, -apple-system, sans-serif",
};

function textStickerStyle(d: Record<string, unknown>): React.CSSProperties {
  const font = String(d.font ?? "classic");
  const color = String(d.color ?? "#ffffff");
  const style = String(d.style ?? "plain");
  const base: React.CSSProperties = {
    fontFamily: TEXT_FONTS[font] ?? TEXT_FONTS.classic,
    fontWeight: font === "heavy" ? 900 : 700,
    color,
    lineHeight: 1.15,
  };
  switch (style) {
    case "outline":
      return { ...base, WebkitTextStroke: "1.5px rgba(0,0,0,0.9)" };
    case "shadow":
      return { ...base, textShadow: "0 2px 10px rgba(0,0,0,0.85)" };
    case "neon":
      return { ...base, textShadow: `0 0 6px ${color}, 0 0 16px ${color}, 0 0 28px ${color}` };
    case "gradient":
      return {
        ...base,
        background: "linear-gradient(90deg, #22d3ee, #a78bfa, #f472b6)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      };
    default:
      return base;
  }
}

function StickerBody({ s }: { s: StorySticker }) {
  const d = (s.data ?? {}) as Record<string, unknown>;
  switch (s.type) {
    case "location":
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
          <span>{String(d.emoji ?? "📍")}</span>
          <span className="max-w-40 truncate">{String(d.name ?? "On the lake")}</span>
        </span>
      );
    case "weather": {
      const text = [d.temp != null ? `${Math.round(Number(d.temp))}°` : null, d.label ?? null].filter(Boolean).join(" ");
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
          <span>{String(d.icon ?? "🌤️")}</span>
          {text && <span className="max-w-40 truncate">{text}</span>}
        </span>
      );
    }
    case "boat":
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
          <span>🚤</span>
          <span className="max-w-40 truncate">{String(d.name ?? "My boat")}</span>
        </span>
      );
    case "emoji":
      return <span className="text-4xl drop-shadow-md">{String(d.emoji ?? "🌊")}</span>;
    case "giphy":
      return (
        <img
          src={String(d.url ?? "")}
          alt=""
          draggable={false}
          className="pointer-events-none h-24 w-24 object-contain drop-shadow-md"
        />
      );
    case "text": {
      const style = String(d.style ?? "plain");
      const inner = (
        <span className="block max-w-64 whitespace-pre-wrap break-words text-center text-2xl" style={textStickerStyle(d)}>
          {String(d.text ?? "")}
        </span>
      );
      if (style === "bubble") {
        return <span className="block rounded-2xl bg-white/90 px-3.5 py-2 shadow-lg">{inner}</span>;
      }
      return inner;
    }
    default:
      return <span className="text-4xl drop-shadow-md">🌊</span>;
  }
}

type Gesture =
  | { mode: "drag"; idx: number; pointerId: number }
  | {
      mode: "pinch";
      idx: number;
      p1: number;
      p2: number;
      startDist: number;
      startAngle: number;
      startScale: number;
      startRotation: number;
    };

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
  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [dragging, setDragging] = useState(false);
  const [overTrash, setOverTrash] = useState(false);

  const trashHit = (clientX: number, clientY: number): boolean => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return false;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height - 56;
    return Math.hypot(clientX - cx, clientY - cy) < 48;
  };

  const startPointer = (idx: number) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const g = gestureRef.current;
    if (!g) {
      gestureRef.current = { mode: "drag", idx, pointerId: e.pointerId };
      setDragging(true);
    } else if (g.mode === "drag" && g.idx === idx) {
      // Second finger on the same sticker: switch to pinch.
      const pts = [...pointersRef.current.entries()];
      if (pts.length >= 2) {
        const [[id1, a], [id2, b]] = pts.slice(-2);
        const s = stickers[idx];
        gestureRef.current = {
          mode: "pinch",
          idx,
          p1: id1,
          p2: id2,
          startDist: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)),
          startAngle: Math.atan2(b.y - a.y, b.x - a.x),
          startScale: s?.scale ?? 1,
          startRotation: s?.rotation ?? 0,
        };
        setOverTrash(false);
      }
    }
  };

  const movePointer = (e: React.PointerEvent) => {
    if (!editable) return;
    const pts = pointersRef.current;
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    const box = containerRef.current?.getBoundingClientRect();
    if (!g || !box || !onChange) return;
    if (g.mode === "drag" && g.pointerId === e.pointerId) {
      const x = Math.min(0.98, Math.max(0.02, (e.clientX - box.left) / box.width));
      const y = Math.min(0.97, Math.max(0.03, (e.clientY - box.top) / box.height));
      setOverTrash(trashHit(e.clientX, e.clientY));
      onChange(stickers.map((s, i) => (i === g.idx ? { ...s, x, y } : s)));
    } else if (g.mode === "pinch") {
      const a = pts.get(g.p1);
      const b = pts.get(g.p2);
      if (!a || !b) return;
      const dist = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const scale = Math.min(5, Math.max(0.2, g.startScale * (dist / g.startDist)));
      // Normalize the angle delta to the shortest arc so crossing the ±π
      // seam doesn't produce a ~360° jump.
      let delta = angle - g.startAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      let rotation = g.startRotation + (delta * 180) / Math.PI;
      rotation = Math.max(-360, Math.min(360, rotation));
      onChange(stickers.map((s, i) => (i === g.idx ? { ...s, scale, rotation } : s)));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    if (!editable) return;
    const g = gestureRef.current;
    pointersRef.current.delete(e.pointerId);
    if (!g) return;
    if (g.mode === "drag" && g.pointerId === e.pointerId) {
      if (trashHit(e.clientX, e.clientY)) {
        onChange?.(stickers.filter((_, i) => i !== g.idx));
      }
      gestureRef.current = null;
      setDragging(false);
      setOverTrash(false);
    } else if (g.mode === "pinch" && (e.pointerId === g.p1 || e.pointerId === g.p2)) {
      // Fall back to dragging with the remaining finger.
      const remaining = e.pointerId === g.p1 ? g.p2 : g.p1;
      if (pointersRef.current.has(remaining)) {
        gestureRef.current = { mode: "drag", idx: g.idx, pointerId: remaining };
      } else {
        gestureRef.current = null;
        setDragging(false);
        setOverTrash(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${editable ? "" : "pointer-events-none"}`}
      onPointerMove={editable ? movePointer : undefined}
      onPointerUp={editable ? endPointer : undefined}
      onPointerCancel={editable ? endPointer : undefined}
    >
      {stickers.map((s, i) => (
        <div
          key={i}
          className={`absolute select-none ${editable ? "cursor-grab touch-none" : ""}`}
          style={{
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${s.rotation ?? 0}deg) scale(${s.scale ?? 1})`,
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
          }}
          onPointerDown={startPointer(i)}
          data-testid={`sticker-${s.type}-${i}`}
        >
          <StickerBody s={s} />
        </div>
      ))}
      {editable && dragging && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all ${
              overTrash ? "scale-125 border-red-400 bg-red-500/80" : "border-white/70 bg-black/50"
            }`}
          >
            <Trash2 className="h-6 w-6 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
