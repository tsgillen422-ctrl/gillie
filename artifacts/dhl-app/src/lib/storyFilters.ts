// Preset photo/video filters for stories. filterCss is a CSS `filter` value
// stored on the story so every viewer renders it identically. Keep values in
// sync with the server's FILTER_CSS_RE allowlist (api-server routes/stories.ts).
export type StoryFilter = { name: string; label: string; css: string };

export const STORY_FILTERS: StoryFilter[] = [
  { name: "original", label: "Original", css: "" },
  { name: "crisp", label: "Crisp", css: "contrast(1.1) saturate(1.15)" },
  { name: "golden", label: "Golden Hour", css: "sepia(0.25) saturate(1.3) brightness(1.05)" },
  { name: "coolwater", label: "Cool Water", css: "hue-rotate(-10deg) saturate(1.2) brightness(1.02)" },
  { name: "vivid", label: "Vivid", css: "saturate(1.5) contrast(1.08)" },
  { name: "dusk", label: "Dusk", css: "brightness(0.92) contrast(1.12) saturate(0.9) hue-rotate(10deg)" },
  { name: "vintage", label: "Vintage", css: "sepia(0.45) contrast(0.95) brightness(1.05)" },
  { name: "bw", label: "B&W", css: "grayscale(1) contrast(1.08)" },
];
