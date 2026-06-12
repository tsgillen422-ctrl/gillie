/**
 * Font families used across the app. Loaded in app/_layout.tsx.
 * - sans (body): Plus Jakarta Sans
 * - display (headings): Outfit
 * - script (brand wordmark): Dancing Script
 */
export const fonts = {
  sans: "PlusJakartaSans_400Regular",
  sansMedium: "PlusJakartaSans_500Medium",
  sansSemibold: "PlusJakartaSans_600SemiBold",
  sansBold: "PlusJakartaSans_700Bold",

  displaySemibold: "Outfit_600SemiBold",
  display: "Outfit_700Bold",
  displayBold: "Outfit_800ExtraBold",

  script: "DancingScript_700Bold",
} as const;
