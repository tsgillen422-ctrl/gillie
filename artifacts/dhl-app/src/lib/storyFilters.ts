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
      { name: "bright", label: "Bright", css: "brightness(1.12) contrast(1.04)" },
      { name: "crisp", label: "Crisp", css: "contrast(1.1) saturate(1.15)" },
      { name: "vibrant", label: "Vibrant", css: "saturate(1.45) contrast(1.06)" },
      { name: "warm", label: "Warm", css: "sepia(0.18) saturate(1.25) brightness(1.04)" },
      { name: "cool", label: "Cool", css: "hue-rotate(-8deg) saturate(1.1) brightness(1.03)" },
      { name: "golden", label: "Golden Hour", css: "sepia(0.25) saturate(1.3) brightness(1.05)" },
    ],
  },
  {
    id: "vintage",
    label: "Vintage",
    filters: [
      { name: "film", label: "Film", css: "contrast(1.08) saturate(0.85) sepia(0.12) brightness(1.03)" },
      { name: "vintage", label: "Retro", css: "sepia(0.45) contrast(0.95) brightness(1.05)" },
      { name: "vhs", label: "VHS", css: "saturate(1.35) contrast(1.15) hue-rotate(-5deg) brightness(0.96)" },
      { name: "disposable", label: "Disposable", css: "contrast(1.12) brightness(1.08) saturate(0.9) sepia(0.08)" },
      { name: "bw", label: "B&W", css: "grayscale(1) contrast(1.08)" },
      { name: "faded", label: "Faded", css: "contrast(0.88) brightness(1.1) saturate(0.75)" },
    ],
  },
  {
    id: "lake",
    label: "Lake",
    filters: [
      { name: "coolwater", label: "Crystal Water", css: "hue-rotate(-10deg) saturate(1.2) brightness(1.02)" },
      { name: "sunset", label: "Sunset", css: "sepia(0.3) saturate(1.5) hue-rotate(-12deg) brightness(1.02)" },
      { name: "morningfog", label: "Morning Fog", css: "brightness(1.12) contrast(0.85) saturate(0.7)" },
      { name: "emerald", label: "Emerald", css: "hue-rotate(18deg) saturate(1.3) contrast(1.05)" },
      { name: "deepblue", label: "Deep Blue", css: "hue-rotate(-18deg) saturate(1.35) contrast(1.1) brightness(0.95)" },
      { name: "summerglow", label: "Summer Glow", css: "brightness(1.08) saturate(1.35) sepia(0.12)" },
      { name: "dusk", label: "Dusk", css: "brightness(0.92) contrast(1.12) saturate(0.9) hue-rotate(10deg)" },
    ],
  },
  {
    id: "fun",
    label: "Fun",
    filters: [
      { name: "hdr", label: "HDR", css: "contrast(1.25) saturate(1.4) brightness(1.02)" },
      { name: "dream", label: "Dream", css: "brightness(1.1) saturate(1.2) blur(0.6px) contrast(0.92)" },
      { name: "neon", label: "Neon", css: "saturate(2) contrast(1.3) hue-rotate(12deg)" },
      { name: "comic", label: "Comic", css: "saturate(1.8) contrast(1.5)" },
      { name: "sketch", label: "Sketch", css: "grayscale(1) contrast(1.6) brightness(1.15)" },
      { name: "invert", label: "Flip", css: "invert(0.9) hue-rotate(180deg)" },
    ],
  },
];

// Flat list in category order; index 0 is always Original.
export const STORY_FILTERS: StoryFilter[] = FILTER_CATEGORIES.flatMap((c) => c.filters);
