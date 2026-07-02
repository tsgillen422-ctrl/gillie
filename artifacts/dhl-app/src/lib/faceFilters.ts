import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

// Live AR face lenses for the story camera, Snapchat-style. Face tracking runs
// on-device via MediaPipe FaceLandmarker (wasm + model self-hosted under
// public/mediapipe so it works in the shipped Capacitor app without a CDN).
// Lenses are drawn on an overlay canvas anchored to face landmarks and are
// baked into the captured JPEG (unlike color filters, which stay CSS metadata).

export type FaceLens = { name: string; label: string; icon: string };

export const FACE_LENSES: FaceLens[] = [
  { name: "none", label: "No lens", icon: "🚫" },
  { name: "dog", label: "Puppy", icon: "🐶" },
  { name: "cat", label: "Kitty", icon: "🐱" },
  { name: "sunglasses", label: "Shades", icon: "🕶️" },
  { name: "mustache", label: "Mustache", icon: "🥸" },
  { name: "freckles", label: "Freckles", icon: "🧡" },
  { name: "blush", label: "Blush", icon: "😊" },
  { name: "sparkles", label: "Sparkles", icon: "✨" },
  { name: "hearts", label: "Hearts", icon: "💕" },
  { name: "butterflies", label: "Butterflies", icon: "🦋" },
  { name: "goofy", label: "Goofy", icon: "🤪" },
];

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Lazily create the face landmarker (heavy: ~10MB wasm + 3.7MB model). */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    const base = `${import.meta.env.BASE_URL}mediapipe`;
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(`${base}/wasm`);
      try {
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
      } catch {
        // Some devices reject the GPU delegate — retry on CPU before failing.
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate: "CPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });
      }
    })();
    landmarkerPromise.catch(() => {
      landmarkerPromise = null; // allow a retry on the next attempt
    });
  }
  return landmarkerPromise;
}

// Mapping from normalized landmark space to overlay-canvas pixels. The video
// is rendered with object-cover, so the canvas must apply the same crop.
export type CoverMapping = { vw: number; vh: number; cw: number; ch: number };

function project(lm: NormalizedLandmark, m: CoverMapping): { x: number; y: number } {
  const scale = Math.max(m.cw / m.vw, m.ch / m.vh);
  const offX = (m.cw - m.vw * scale) / 2;
  const offY = (m.ch - m.vh * scale) / 2;
  return { x: lm.x * m.vw * scale + offX, y: lm.y * m.vh * scale + offY };
}

// FaceMesh landmark indices (478-point model).
const IDX = {
  eyeROuter: 33,
  eyeLOuter: 263,
  eyeRTop: 159,
  eyeRBottom: 145,
  eyeLTop: 386,
  eyeLBottom: 374,
  noseTip: 1,
  upperLip: 0,
  lowerLip: 17,
  forehead: 10,
  chin: 152,
  cheekR: 205,
  cheekL: 425,
} as const;

type Pt = { x: number; y: number };
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

function emoji(ctx: CanvasRenderingContext2D, glyph: string, x: number, y: number, size: number, alpha = 1, rot = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${Math.round(size)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, 0, 0);
  ctx.restore();
}

function drawEar(ctx: CanvasRenderingContext2D, kind: "dog" | "cat", flip: number, w: number) {
  ctx.save();
  ctx.scale(flip, 1);
  if (kind === "dog") {
    // Floppy rounded ear hanging outward.
    ctx.fillStyle = "#7a4a21";
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.16, w * 0.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9c6430";
    ctx.beginPath();
    ctx.ellipse(0, w * 0.04, w * 0.09, w * 0.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Pointy triangle ear with pink inner.
    ctx.fillStyle = "#3f3f46";
    ctx.beginPath();
    ctx.moveTo(-w * 0.16, w * 0.16);
    ctx.lineTo(0, -w * 0.3);
    ctx.lineTo(w * 0.18, w * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f9a8d4";
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, w * 0.1);
    ctx.lineTo(0, -w * 0.18);
    ctx.lineTo(w * 0.1, w * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Deterministic pseudo-random offsets so freckles/sparkles don't jitter.
const FRECKLES: [number, number][] = [
  [-0.06, -0.03], [0.05, -0.05], [0.0, 0.04], [-0.09, 0.05], [0.09, 0.02], [0.03, 0.09], [-0.03, -0.09],
];
const SPARKLE_SPOTS: [number, number, number][] = [
  [-0.75, -0.9, 0], [0.8, -0.75, 1.1], [-0.95, -0.1, 2.3], [0.95, -0.25, 3.1], [0, -1.25, 4.2], [-0.5, -1.15, 5.0], [0.55, -1.2, 0.7],
];

/**
 * Draw one animation frame of the given lens. `landmarks` is the first face
 * from FaceLandmarker.detectForVideo; no-op when the face is missing.
 */
export function drawLensFrame(
  ctx: CanvasRenderingContext2D,
  lens: string,
  landmarks: NormalizedLandmark[] | undefined,
  m: CoverMapping,
  timeMs: number,
) {
  if (!landmarks || lens === "none") return;
  const p = (i: number) => project(landmarks[i], m);
  const eyeR = p(IDX.eyeROuter);
  const eyeL = p(IDX.eyeLOuter);
  const eyeMid = mid(eyeR, eyeL);
  const faceW = dist(eyeR, eyeL) * 1.55; // approx full face width
  const angle = Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x);
  const forehead = p(IDX.forehead);
  const nose = p(IDX.noseTip);
  const t = timeMs / 1000;

  const local = (draw: () => void, origin: Pt = eyeMid) => {
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(angle);
    draw();
    ctx.restore();
  };

  switch (lens) {
    case "dog":
      local(() => {
        ctx.save();
        ctx.translate(-faceW * 0.42, -faceW * 0.62);
        drawEar(ctx, "dog", -1, faceW);
        ctx.restore();
        ctx.save();
        ctx.translate(faceW * 0.42, -faceW * 0.62);
        drawEar(ctx, "dog", 1, faceW);
        ctx.restore();
      }, forehead);
      local(() => {
        // Dog nose over the real nose.
        ctx.fillStyle = "#27272a";
        ctx.beginPath();
        ctx.ellipse(0, 0, faceW * 0.09, faceW * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.ellipse(-faceW * 0.025, -faceW * 0.02, faceW * 0.022, faceW * 0.014, 0, 0, Math.PI * 2);
        ctx.fill();
      }, nose);
      break;

    case "cat":
      local(() => {
        ctx.save();
        ctx.translate(-faceW * 0.38, -faceW * 0.55);
        drawEar(ctx, "cat", -1, faceW);
        ctx.restore();
        ctx.save();
        ctx.translate(faceW * 0.38, -faceW * 0.55);
        drawEar(ctx, "cat", 1, faceW);
        ctx.restore();
      }, forehead);
      local(() => {
        // Pink nose + whiskers.
        ctx.fillStyle = "#f472b6";
        ctx.beginPath();
        ctx.moveTo(-faceW * 0.05, -faceW * 0.02);
        ctx.lineTo(faceW * 0.05, -faceW * 0.02);
        ctx.lineTo(0, faceW * 0.045);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(1.5, faceW * 0.008);
        for (const side of [-1, 1]) {
          for (const dy of [-0.01, 0.02, 0.05]) {
            ctx.beginPath();
            ctx.moveTo(side * faceW * 0.09, faceW * dy);
            ctx.lineTo(side * faceW * 0.34, faceW * (dy - 0.02) - faceW * 0.01);
            ctx.stroke();
          }
        }
      }, nose);
      break;

    case "sunglasses":
      local(() => {
        const lensW = faceW * 0.26;
        const lensH = faceW * 0.17;
        const gap = faceW * 0.3;
        ctx.fillStyle = "rgba(10,10,12,0.9)";
        ctx.strokeStyle = "#18181b";
        ctx.lineWidth = faceW * 0.02;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.roundRect(side * gap - lensW / 2, -lensH / 2, lensW, lensH, lensH * 0.4);
          ctx.fill();
        }
        // bridge + arms
        ctx.beginPath();
        ctx.moveTo(-gap + lensW / 2, -lensH * 0.15);
        ctx.quadraticCurveTo(0, -lensH * 0.45, gap - lensW / 2, -lensH * 0.15);
        ctx.stroke();
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(side * (gap + lensW / 2), -lensH * 0.1);
          ctx.lineTo(side * (gap + lensW / 2 + faceW * 0.12), -lensH * 0.3);
          ctx.stroke();
        }
        // glare
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * gap - lensW * 0.15, -lensH * 0.15, lensW * 0.14, lensH * 0.22, -0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      break;

    case "mustache":
      local(() => {
        ctx.fillStyle = "#3b2415";
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.scale(side, 1);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(faceW * 0.06, -faceW * 0.05, faceW * 0.2, -faceW * 0.04, faceW * 0.26, -faceW * 0.1);
          ctx.bezierCurveTo(faceW * 0.24, faceW * 0.02, faceW * 0.1, faceW * 0.05, 0, faceW * 0.02);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }, mid(nose, p(IDX.upperLip)));
      break;

    case "freckles": {
      for (const cheekIdx of [IDX.cheekR, IDX.cheekL]) {
        const cheek = p(cheekIdx);
        local(() => {
          ctx.fillStyle = "rgba(133,77,36,0.6)";
          for (const [fx, fy] of FRECKLES) {
            ctx.beginPath();
            ctx.arc(fx * faceW, fy * faceW, Math.max(1.5, faceW * 0.011), 0, Math.PI * 2);
            ctx.fill();
          }
        }, cheek);
      }
      // A few across the nose bridge.
      local(() => {
        ctx.fillStyle = "rgba(133,77,36,0.5)";
        for (const [fx, fy] of FRECKLES.slice(0, 4)) {
          ctx.beginPath();
          ctx.arc(fx * faceW * 0.7, fy * faceW * 0.5 - faceW * 0.06, Math.max(1.2, faceW * 0.009), 0, Math.PI * 2);
          ctx.fill();
        }
      }, nose);
      break;
    }

    case "blush":
      for (const cheekIdx of [IDX.cheekR, IDX.cheekL]) {
        const cheek = p(cheekIdx);
        const r = faceW * 0.14;
        const g = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, r);
        g.addColorStop(0, "rgba(251,113,133,0.4)");
        g.addColorStop(1, "rgba(251,113,133,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cheek.x, cheek.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // small hearts above cheeks
      emoji(ctx, "💗", p(IDX.cheekR).x, p(IDX.cheekR).y - faceW * 0.18, faceW * 0.1, 0.9);
      emoji(ctx, "💗", p(IDX.cheekL).x, p(IDX.cheekL).y - faceW * 0.18, faceW * 0.1, 0.9);
      break;

    case "sparkles":
      for (const [sx, sy, phase] of SPARKLE_SPOTS) {
        const tw = 0.55 + 0.45 * Math.sin(t * 2.4 + phase);
        emoji(ctx, "✨", eyeMid.x + sx * faceW, eyeMid.y + sy * faceW, faceW * (0.12 + 0.05 * tw), 0.5 + 0.5 * tw);
      }
      break;

    case "hearts":
      for (let i = 0; i < 5; i++) {
        const cycle = (t * 0.35 + i / 5) % 1;
        const hx = eyeMid.x + Math.sin(i * 2.1 + t * 0.8) * faceW * 0.85;
        const hy = eyeMid.y - faceW * 0.5 - cycle * faceW * 1.1;
        emoji(ctx, i % 2 ? "💕" : "❤️", hx, hy, faceW * 0.14, 1 - cycle);
      }
      break;

    case "butterflies":
      for (const [i, side] of [-1, 1].entries()) {
        const bob = Math.sin(t * 2 + i * 1.7) * faceW * 0.05;
        emoji(
          ctx,
          "🦋",
          forehead.x + side * faceW * 0.5,
          forehead.y - faceW * 0.45 + bob,
          faceW * 0.2,
          1,
          Math.sin(t * 1.4 + i) * 0.25,
        );
      }
      emoji(ctx, "🦋", forehead.x, forehead.y - faceW * 0.75 + Math.sin(t * 1.8) * faceW * 0.04, faceW * 0.14);
      break;

    case "goofy": {
      // Big cartoon eyes with wandering pupils + tongue out.
      const eyeCR = mid(p(IDX.eyeRTop), p(IDX.eyeRBottom));
      const eyeCL = mid(p(IDX.eyeLTop), p(IDX.eyeLBottom));
      const r = faceW * 0.13;
      for (const [i, c] of [eyeCR, eyeCL].entries()) {
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = Math.max(1.5, faceW * 0.012);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const px = Math.cos(t * 2.2 + i * Math.PI) * r * 0.4;
        const py = Math.sin(t * 1.7 + i * 1.3) * r * 0.4;
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(c.x + px, c.y + py, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      emoji(ctx, "👅", p(IDX.lowerLip).x, p(IDX.lowerLip).y + faceW * 0.1, faceW * 0.26, 1, angle);
      break;
    }
  }
}
