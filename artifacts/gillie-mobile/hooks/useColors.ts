import colors from "@/constants/colors";

/**
 * Returns the design tokens for the app.
 *
 * The Gillie experience uses the bright "Premium Lake Life" light palette as its
 * signature identity (matching the web app's branding), so the app is locked to
 * the light palette regardless of the device's appearance setting.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
