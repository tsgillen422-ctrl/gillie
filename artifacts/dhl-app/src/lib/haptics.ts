import { Capacitor } from "@capacitor/core";

/**
 * Fire a short tactile "tap" when the press-and-hold gesture commits (e.g. the
 * map drop-a-pin long-press). On the native iOS/Android Capacitor build this
 * uses the Haptics engine (navigator.vibrate is a no-op on iOS). On the web it
 * falls back to navigator.vibrate where supported (Android Chrome); on browsers
 * without vibration (desktop, iOS Safari) it silently does nothing.
 */
export async function hapticTap(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    }
  } catch {
    // Plugin missing or call failed — fall through to the web fallback.
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(30);
    }
  } catch {
    // Ignore: vibration is best-effort feedback only.
  }
}
