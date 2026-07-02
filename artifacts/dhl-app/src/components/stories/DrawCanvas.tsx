import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

// Freehand drawing layer for the story editor. Strokes are stored in
// normalized 0-1 coords so they survive resizes and can be composited onto
// the exported photo at post time. Tools: pen, marker, neon, highlighter,
// eraser. Undo/redo is stroke-based.

export type DrawTool = "pen" | "marker" | "neon" | "highlighter" | "eraser";

export type DrawStroke = {
  tool: DrawTool;
  color: string;
  size: number; // relative to a 1000px-wide canvas
  points: { x: number; y: number }[];
};

export type DrawCanvasHandle = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  hasStrokes: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Renders all strokes onto a canvas of the given pixel size. */
  renderTo: (width: number, height: number) => HTMLCanvasElement;
};

function paintStroke(ctx: CanvasRenderingContext2D, s: DrawStroke, w: number, h: number) {
  if (s.points.length === 0) return;
  const px = (p: { x: number; y: number }) => [p.x * w, p.y * h] as const;
  const width = (s.size / 1000) * w;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const trace = () => {
    ctx.beginPath();
    const [x0, y0] = px(s.points[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < s.points.length; i++) {
      const [x, y] = px(s.points[i]);
      ctx.lineTo(x, y);
    }
    if (s.points.length === 1) ctx.lineTo(x0 + 0.01, y0 + 0.01);
    ctx.stroke();
  };
  switch (s.tool) {
    case "pen":
      ctx.strokeStyle = s.color;
      ctx.lineWidth = width;
      trace();
      break;
    case "marker":
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = width * 1.8;
      trace();
      break;
    case "neon":
      ctx.shadowColor = s.color;
      ctx.shadowBlur = width * 1.6;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = width;
      trace();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = Math.max(1, width * 0.4);
      trace();
      break;
    case "highlighter":
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = width * 2.6;
      trace();
      break;
    case "eraser":
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = width * 2.2;
      trace();
      break;
  }
  ctx.restore();
}

export const DrawCanvas = forwardRef<
  DrawCanvasHandle,
  {
    active: boolean;
    tool: DrawTool;
    color: string;
    size: number;
    onStrokesChange?: (count: number) => void;
  }
>(function DrawCanvas({ active, tool, color, size, onStrokesChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<DrawStroke[]>([]);
  const redoRef = useRef<DrawStroke[]>([]);
  const liveRef = useRef<DrawStroke | null>(null);
  const drawingPointer = useRef<number | null>(null);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) paintStroke(ctx, s, canvas.width, canvas.height);
    if (liveRef.current) paintStroke(ctx, liveRef.current, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      repaint();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [repaint]);

  useImperativeHandle(ref, () => ({
    undo: () => {
      const s = strokesRef.current.pop();
      if (s) redoRef.current.push(s);
      onStrokesChange?.(strokesRef.current.length);
      repaint();
    },
    redo: () => {
      const s = redoRef.current.pop();
      if (s) strokesRef.current.push(s);
      onStrokesChange?.(strokesRef.current.length);
      repaint();
    },
    clear: () => {
      strokesRef.current = [];
      redoRef.current = [];
      liveRef.current = null;
      onStrokesChange?.(0);
      repaint();
    },
    hasStrokes: () => strokesRef.current.length > 0,
    canUndo: () => strokesRef.current.length > 0,
    canRedo: () => redoRef.current.length > 0,
    renderTo: (width: number, height: number) => {
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const ctx = out.getContext("2d");
      if (ctx) for (const s of strokesRef.current) paintStroke(ctx, s, width, height);
      return out;
    },
  }));

  const norm = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!active || drawingPointer.current != null) return;
    e.stopPropagation();
    drawingPointer.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    liveRef.current = { tool, color, size, points: [norm(e)] };
    repaint();
  };

  const onMove = (e: React.PointerEvent) => {
    if (drawingPointer.current !== e.pointerId || !liveRef.current) return;
    liveRef.current.points.push(norm(e));
    repaint();
  };

  const onUp = (e: React.PointerEvent) => {
    if (drawingPointer.current !== e.pointerId) return;
    drawingPointer.current = null;
    if (liveRef.current) {
      strokesRef.current.push(liveRef.current);
      redoRef.current = [];
      liveRef.current = null;
      onStrokesChange?.(strokesRef.current.length);
      repaint();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${active ? "touch-none" : "pointer-events-none"}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      data-testid="story-draw-canvas"
    />
  );
});
