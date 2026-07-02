// Preset photo/video filters for stories. filterCss is a CSS `filter` value
// stored on the story so every viewer renders it identically. Keep values in
// sync with the server's FILTER_CSS_RE allowlist (api-server routes/stories.ts):
// only letters, digits, ( ) . , % whitespace and - are allowed.
export type StoryFilter = { name: string; label: string; css: string };
export type StoryFilterCategory = { id: string; label: string; filters: StoryFilter[] };

export const FILTER_CATEGORIES: StoryFilterCategory[] = [
  {
    id: "natural",
    label: "Natural",
    filters: [
      { name: "original", label: "Original", css: "" },
      { name: "bright", label: "Bright", css: "brightness(1.16) contrast(1.06) saturate(1.08)" },
      { name: "crisp", label: "Crisp", css: "contrast(1.16) saturate(1.22) brightness(1.03)" },
      { name: "vibrant", label: "Vibrant", css: "saturate(1.6) contrast(1.1) brightness(1.04)" },
      { name: "warm", label: "Warm", css: "sepia(0.24) saturate(1.4) brightness(1.06) contrast(1.04)" },
      { name: "cool", label: "Cool", css: "hue-rotate(-10deg) saturate(1.18) brightness(1.05) contrast(1.04)" },
      { name: "golden", label: "Golden Hour", css: "sepia(0.32) saturate(1.45) brightness(1.08) contrast(1.05) hue-rotate(-6deg)" },
    ],
  },
  {
    id: "beauty",
    label: "Beauty",
    filters: [
      { name: "smooth", label: "Smooth", css: "brightness(1.08) contrast(0.92) saturate(1.06) blur(0.4px)" },
      { name: "glow", label: "Glow", css: "brightness(1.12) contrast(0.94) saturate(1.15) blur(0.3px)" },
      { name: "softlight", label: "Soft Light", css: "brightness(1.1) contrast(0.88) saturate(1.02) sepia(0.06)" },
      { name: "porcelain", label: "Porcelain", css: "brightness(1.14) saturate(0.88) contrast(0.94) blur(0.3px)" },
      { name: "brighteyes", label: "Bright Eyes", css: "brightness(1.1) contrast(1.08) saturate(1.1)" },
      { name: "rosy", label: "Rosy", css: "brightness(1.08) saturate(1.2) hue-rotate(-4deg) contrast(0.96)" },
    ],
  },
  {
    id: "vintage",
    label: "Vintage",
    filters: [
      { name: "film", label: "Film", css: "contrast(1.14) saturate(0.82) sepia(0.16) brightness(1.05)" },
      { name: "vintage", label: "Retro", css: "sepia(0.55) contrast(0.98) brightness(1.08) saturate(1.1)" },
      { name: "vhs", label: "VHS", css: "saturate(1.5) contrast(1.22) hue-rotate(-6deg) brightness(0.95)" },
      { name: "disposable", label: "Disposable", css: "contrast(1.18) brightness(1.12) saturate(0.92) sepia(0.12)" },
      { name: "bw", label: "B&W", css: "grayscale(1) contrast(1.18) brightness(1.04)" },
      { name: "noir", label: "Noir", css: "grayscale(1) contrast(1.4) brightness(0.92)" },
      { name: "faded", label: "Faded", css: "contrast(0.84) brightness(1.14) saturate(0.7) sepia(0.08)" },
    ],
  },
  {
    id: "lake",
    label: "Lake",
    filters: [
      { name: "coolwater", label: "Crystal Water", css: "hue-rotate(-12deg) saturate(1.35) brightness(1.06) contrast(1.08)" },
      { name: "sunset", label: "Sunset", css: "sepia(0.38) saturate(1.7) hue-rotate(-14deg) brightness(1.04) contrast(1.06)" },
      { name: "morningfog", label: "Morning Fog", css: "brightness(1.16) contrast(0.82) saturate(0.68) blur(0.3px)" },
      { name: "emerald", label: "Emerald", css: "hue-rotate(22deg) saturate(1.45) contrast(1.1) brightness(1.02)" },
      { name: "deepblue", label: "Deep Blue", css: "hue-rotate(-20deg) saturate(1.5) contrast(1.16) brightness(0.94)" },
      { name: "summerglow", label: "Summer Glow", css: "brightness(1.12) saturate(1.5) sepia(0.16) contrast(1.05)" },
      { name: "dusk", label: "Dusk", css: "brightness(0.9) contrast(1.18) saturate(1.05) hue-rotate(12deg)" },
    ],
  },
  {
    id: "fun",
    label: "Fun",
    filters: [
      { name: "hdr", label: "HDR", css: "contrast(1.32) saturate(1.5) brightness(1.04)" },
      { name: "dream", label: "Dream", css: "brightness(1.14) saturate(1.3) blur(0.7px) contrast(0.9)" },
      { name: "neon", label: "Neon", css: "saturate(2.2) contrast(1.35) hue-rotate(14deg) brightness(1.02)" },
      { name: "comic", label: "Comic", css: "saturate(1.9) contrast(1.55) brightness(1.02)" },
      { name: "sketch", label: "Sketch", css: "grayscale(1) contrast(1.7) brightness(1.18)" },
      { name: "invert", label: "Flip", css: "invert(0.9) hue-rotate(180deg)" },
    ],
  },
];

// Flat list in category order; index 0 is always Original.
export const STORY_FILTERS: StoryFilter[] = FILTER_CATEGORIES.flatMap((c) => c.filters);
