---
name: Map iOS long-press pin drop
description: Why the maplibre map canvas + markers need callout/selection suppression for the press-and-hold pin-drop gesture on iOS.
---

The map's press-and-hold "drop a pin" gesture can be swallowed on iOS (Safari
and especially the Capacitor webview) because a stationary long-press triggers
the native text/image selection callout or magnifier.

**Rule:** suppress the iOS callout/selection on the map canvas and markers
(callout + user-select none). maplibre's canvas only sets `touch-action: none`,
which is NOT enough to stop the callout/magnifier.

**Why:** without it the long-press either does nothing or pops the native menu
instead of opening the create-pin dialog.

**How to apply:** scope the suppression to the map canvas + markers ONLY, never
the outer map page container — the search box and side panels are
absolutely-positioned siblings whose text must stay selectable.

**Haptic feedback:** the pin-drop fires a haptic when the long-press commits.
`navigator.vibrate` is a NO-OP on iOS, so native uses `@capacitor/haptics`
(ImpactStyle.Medium) gated on `Capacitor.isNativePlatform()`, with
navigator.vibrate as the web/Android fallback. Adding the plugin requires
`cap sync` AND an Xcode rebuild of the native app before the device buzzes.

**Still open:** the final tap-vs-drag-vs-hold confirmation requires a human on a
physical iPhone (Safari + Capacitor); it cannot be exercised in the agent
environment (no device; e2e harness has no WebGL for maplibre).
