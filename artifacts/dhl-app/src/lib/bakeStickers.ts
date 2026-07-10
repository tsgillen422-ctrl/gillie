import type { StorySticker } from "@workspace/api-client-react";
import { loadImage } from "@/lib/imageEdit";

// Bakes editor stickers (text, emoji, giphy) onto a flattened canvas. Sticker
// coords are normalized 0-1 against the preview container; sizes in the
// on-screen StickerLayer are fixed CSS px (text 24px, emoji 36px, giphy 96px
// box), so we scale by canvasWidth / previewWidth to match what was seen.

const TEXT_FONTS: Record<string, string> = {
  classic: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, Menlo, monospace",
  script: "'Snell Roundhand', 'Segoe Script', cursive",
  heavy: "system-ui, -apple-system, sans-serif",
};

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split("\n")) {
    const words = hard.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const probe = line ? `${line} ${w}` : w;
      if (ctx.measureText(probe).width <= maxWidth || !line) {
        line = probe;
      } else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTextSticker(
  ctx: CanvasRenderingContext2D,
  d: Record<string, unknown>,
  unit: number, // px per CSS px at bake scale (already includes sticker scale)
) {
  const text = String(d.text ?? "");
  if (!text.trim()) return;
  const font = String(d.font ?? "classic");
  const color = String(d.color ?? "#ffffff");
  const style = String(d.style ?? "plain");
  const fontPx = 24 * unit;
  const weight = font === "heavy" ? 900 : 700;
  ctx.font = `${weight} ${fontPx}px ${TEXT_FONTS[font] ?? TEXT_FONTS.classic}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = 256 * unit; // max-w-64
  const lines = wrapLines(ctx, text, maxWidth);
  const lineHeight = fontPx * 1.15;
  const totalH = lines.length * lineHeight;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);

  if (style === "bubble") {
    const padX = 14 * unit;
    const padY = 8 * unit;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 8 * unit;
    roundRect(ctx, -widest / 2 - padX, -totalH / 2 - padY, widest + padX * 2, totalH + padY * 2, 16 * unit);
    ctx.fill();
    ctx.restore();
  }

  lines.forEach((line, i) => {
    const y = -totalH / 2 + lineHeight * (i + 0.5);
    ctx.save();
    if (style === "shadow") {
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 10 * unit;
      ctx.shadowOffsetY = 2 * unit;
      ctx.fillStyle = color;
      ctx.fillText(line, 0, y);
    } else if (style === "outline") {
      ctx.lineWidth = 3 * unit;
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.strokeText(line, 0, y);
      ctx.fillStyle = color;
      ctx.fillText(line, 0, y);
    } else if (style === "neon") {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 * unit;
      ctx.fillStyle = color;
      ctx.fillText(line, 0, y);
      ctx.shadowBlur = 6 * unit;
      ctx.fillText(line, 0, y);
    } else if (style === "gradient") {
      const grad = ctx.createLinearGradient(-widest / 2, 0, widest / 2, 0);
      grad.addColorStop(0, "#22d3ee");
      grad.addColorStop(0.5, "#a78bfa");
      grad.addColorStop(1, "#f472b6");
      ctx.fillStyle = grad;
      ctx.fillText(line, 0, y);
    } else {
      ctx.fillStyle = color;
      ctx.fillText(line, 0, y);
    }
    ctx.restore();
  });
}

export async function bakeStickers(
  canvas: HTMLCanvasElement,
  stickers: StorySticker[],
  previewWidth: number,
): Promise<void> {
  if (!stickers.length) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const base = canvas.width / Math.max(1, previewWidth); // px per CSS px

  for (const s of stickers) {
    const d = (s.data ?? {}) as Record<string, unknown>;
    const cx = s.x * canvas.width;
    const cy = s.y * canvas.height;
    const scale = s.scale ?? 1;
    const unit = base * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((s.rotation ?? 0) * Math.PI) / 180);
    if (s.type === "text") {
      drawTextSticker(ctx, d, unit);
    } else if (s.type === "emoji") {
      ctx.font = `${36 * unit}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(d.emoji ?? "🌊"), 0, 0);
    } else if (s.type === "giphy") {
      const url = String(d.url ?? "");
      if (url) {
        try {
          const img = await loadImage(url);
          const box = 96 * unit; // h-24 w-24 object-contain
          const ratio = Math.min(box / img.naturalWidth, box / img.naturalHeight);
          const w = img.naturalWidth * ratio;
          const h = img.naturalHeight * ratio;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } catch {
          // Cross-origin GIF that refuses CORS — skip rather than fail the save.
        }
      }
    }
    ctx.restore();
  }
}
