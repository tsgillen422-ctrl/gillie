// Non-destructive image edit pipeline for the post composer media editor.
// All edits (crop/rotate/straighten, filter preset, adjustments, text,
// stickers, drawing) are kept as state while editing and only flattened into
// a brand-new JPEG when the user taps Save — the original upload is never
// modified.
//
// Filters + adjustments are applied with per-pixel math (not ctx.filter,
// which is unsupported in some WebKit builds) so the flattened result is
// identical everywhere, including the iOS Capacitor webview.

export type Adjustments = {
  brightness: number; // -100..100 (0 = unchanged)
  contrast: number; // -100..100
  saturation: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
};

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  highlights: 0,
  shadows: 0,
};

export function adjustmentsAreDefault(a: Adjustments): boolean {
  return (
    a.brightness === 0 && a.contrast === 0 && a.saturation === 0 && a.highlights === 0 && a.shadows === 0
  );
}

export type CropAreaPixels = { x: number; y: number; width: number; height: number };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Crop + rotate (react-easy-crop convention: rotation in degrees, crop area in
// pixels relative to the rotated image bounding box).

function rotatedSize(width: number, height: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  };
}

export async function renderCroppedCanvas(
  src: string,
  cropAreaPixels: CropAreaPixels | null,
  rotationDeg: number,
): Promise<HTMLCanvasElement> {
  const image = await loadImage(src);
  const rotated = rotatedSize(image.naturalWidth, image.naturalHeight, rotationDeg);

  // Paint the rotated image into a bounding-box canvas.
  const boxCanvas = document.createElement("canvas");
  boxCanvas.width = Math.max(1, Math.round(rotated.width));
  boxCanvas.height = Math.max(1, Math.round(rotated.height));
  const boxCtx = boxCanvas.getContext("2d");
  if (!boxCtx) throw new Error("Could not get canvas context");
  boxCtx.translate(boxCanvas.width / 2, boxCanvas.height / 2);
  boxCtx.rotate((rotationDeg * Math.PI) / 180);
  boxCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  if (!cropAreaPixels) return boxCanvas;

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cropAreaPixels.width));
  out.height = Math.max(1, Math.round(cropAreaPixels.height));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(
    boxCanvas,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    out.width,
    out.height,
  );
  return out;
}

// ---------------------------------------------------------------------------
// CSS filter string parsing → per-pixel ops. Supports the primitives used by
// the preset filter catalog: brightness, contrast, saturate, sepia,
// grayscale, hue-rotate, invert, blur.

type FilterOp =
  | { fn: "brightness" | "contrast" | "saturate" | "sepia" | "grayscale" | "invert"; amount: number }
  | { fn: "hue-rotate"; deg: number }
  | { fn: "blur"; px: number };

export function parseFilterCss(css: string): FilterOp[] {
  const ops: FilterOp[] = [];
  const re = /([a-z-]+)\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const fn = m[1];
    const raw = m[2].trim();
    if (fn === "hue-rotate") {
      const deg = parseFloat(raw);
      if (Number.isFinite(deg)) ops.push({ fn, deg });
    } else if (fn === "blur") {
      const px = parseFloat(raw);
      if (Number.isFinite(px) && px > 0) ops.push({ fn, px });
    } else if (
      fn === "brightness" ||
      fn === "contrast" ||
      fn === "saturate" ||
      fn === "sepia" ||
      fn === "grayscale" ||
      fn === "invert"
    ) {
      let amount = parseFloat(raw);
      if (raw.endsWith("%")) amount /= 100;
      if (Number.isFinite(amount)) ops.push({ fn, amount });
    }
  }
  return ops;
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function applyColorOps(data: Uint8ClampedArray, ops: FilterOp[]) {
  for (const op of ops) {
    if (op.fn === "blur") continue; // handled separately
    if (op.fn === "brightness") {
      const k = op.amount;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(data[i] * k);
        data[i + 1] = clamp255(data[i + 1] * k);
        data[i + 2] = clamp255(data[i + 2] * k);
      }
    } else if (op.fn === "contrast") {
      const k = op.amount;
      const o = 255 * 0.5 * (1 - k);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(data[i] * k + o);
        data[i + 1] = clamp255(data[i + 1] * k + o);
        data[i + 2] = clamp255(data[i + 2] * k + o);
      }
    } else if (op.fn === "saturate") {
      const k = op.amount;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        data[i] = clamp255(lum + (r - lum) * k);
        data[i + 1] = clamp255(lum + (g - lum) * k);
        data[i + 2] = clamp255(lum + (b - lum) * k);
      }
    } else if (op.fn === "grayscale") {
      const k = op.amount;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        data[i] = clamp255(r + (lum - r) * k);
        data[i + 1] = clamp255(g + (lum - g) * k);
        data[i + 2] = clamp255(b + (lum - b) * k);
      }
    } else if (op.fn === "sepia") {
      const k = op.amount;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        data[i] = clamp255(r + (sr - r) * k);
        data[i + 1] = clamp255(g + (sg - g) * k);
        data[i + 2] = clamp255(b + (sb - b) * k);
      }
    } else if (op.fn === "invert") {
      const k = op.amount;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(data[i] + (255 - 2 * data[i]) * k);
        data[i + 1] = clamp255(data[i + 1] + (255 - 2 * data[i + 1]) * k);
        data[i + 2] = clamp255(data[i + 2] + (255 - 2 * data[i + 2]) * k);
      }
    } else if (op.fn === "hue-rotate") {
      const rad = (op.deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Standard SVG/CSS hue-rotate matrix.
      const a00 = 0.213 + cos * 0.787 - sin * 0.213;
      const a01 = 0.715 - cos * 0.715 - sin * 0.715;
      const a02 = 0.072 - cos * 0.072 + sin * 0.928;
      const a10 = 0.213 - cos * 0.213 + sin * 0.143;
      const a11 = 0.715 + cos * 0.285 + sin * 0.14;
      const a12 = 0.072 - cos * 0.072 - sin * 0.283;
      const a20 = 0.213 - cos * 0.213 - sin * 0.787;
      const a21 = 0.715 - cos * 0.715 + sin * 0.715;
      const a22 = 0.072 + cos * 0.928 + sin * 0.072;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        data[i] = clamp255(a00 * r + a01 * g + a02 * b);
        data[i + 1] = clamp255(a10 * r + a11 * g + a12 * b);
        data[i + 2] = clamp255(a20 * r + a21 * g + a22 * b);
      }
    }
  }
}

// Cheap separable box blur for the small (<1px at preview scale) blur amounts
// in the preset filters. Radius is rounded; radius 0 is a no-op.
function boxBlur(imageData: ImageData, radiusPx: number) {
  const radius = Math.round(radiusPx);
  if (radius < 1) return;
  const { data, width, height } = imageData;
  const tmp = new Uint8ClampedArray(data.length);
  const pass = (srcArr: Uint8ClampedArray, dst: Uint8ClampedArray, horizontal: boolean) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = horizontal ? x + k : x;
          const yy = horizontal ? y : y + k;
          if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
          const i = (yy * width + xx) * 4;
          r += srcArr[i];
          g += srcArr[i + 1];
          b += srcArr[i + 2];
          a += srcArr[i + 3];
          n++;
        }
        const j = (y * width + x) * 4;
        dst[j] = r / n;
        dst[j + 1] = g / n;
        dst[j + 2] = b / n;
        dst[j + 3] = a / n;
      }
    }
  };
  pass(data, tmp, true);
  pass(tmp, data, false);
}

// Adjustments: brightness/contrast/saturation map onto the same math as the
// CSS primitives; highlights/shadows use a luminance-weighted tone shift
// (positive highlights brightens the bright end, negative recovers it, etc).
function applyAdjustmentOps(data: Uint8ClampedArray, adj: Adjustments) {
  const ops: FilterOp[] = [];
  if (adj.brightness !== 0) ops.push({ fn: "brightness", amount: 1 + adj.brightness / 200 });
  if (adj.contrast !== 0) ops.push({ fn: "contrast", amount: 1 + adj.contrast / 200 });
  if (adj.saturation !== 0) ops.push({ fn: "saturate", amount: 1 + adj.saturation / 100 });
  if (ops.length) applyColorOps(data, ops);

  if (adj.highlights !== 0 || adj.shadows !== 0) {
    const hK = adj.highlights / 100; // -1..1
    const sK = adj.shadows / 100;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // Weight: highlights act on bright pixels, shadows on dark pixels.
      const hw = lum * lum;
      const sw = (1 - lum) * (1 - lum);
      const delta = hK * hw * 80 + sK * sw * 80;
      if (delta !== 0) {
        data[i] = clamp255(r + delta);
        data[i + 1] = clamp255(g + delta);
        data[i + 2] = clamp255(b + delta);
      }
    }
  }
}

/** Apply a preset filter (CSS string) + adjustments to a canvas in place. */
export function applyPixelEdits(canvas: HTMLCanvasElement, filterCss: string, adj: Adjustments) {
  const ops = parseFilterCss(filterCss);
  const hasColorWork = ops.some((o) => o.fn !== "blur") || !adjustmentsAreDefault(adj);
  const blurOp = ops.find((o) => o.fn === "blur") as { fn: "blur"; px: number } | undefined;
  if (!hasColorWork && !blurOp) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (hasColorWork) {
    applyColorOps(imageData.data, ops);
    applyAdjustmentOps(imageData.data, adj);
  }
  if (blurOp) boxBlur(imageData, blurOp.px);
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Downscaled preview render used by the editor so what you see matches the
 * flattened output exactly (CSS preview can't express highlights/shadows).
 */
export async function renderPreviewDataUrl(
  src: string,
  filterCss: string,
  adj: Adjustments,
  maxEdge = 900,
): Promise<string> {
  const image = await loadImage(src);
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  applyPixelEdits(canvas, filterCss, adj);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export async function canvasToJpegFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("Could not create image");
  return new File([blob], fileName, { type: "image/jpeg" });
}
