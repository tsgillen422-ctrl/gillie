---
name: FAB feels dead on iOS = geolocation hang, not touch
description: A map/create button that "won't respond to taps" in the iOS Capacitor webview is often an onClick that silently hangs on getCurrentPosition, not a z-index/pointer-events problem.
---

When a button on the dhl-app map "is visible but doesn't respond to taps" in
TestFlight / the iOS Capacitor webview, suspect the **click handler**, not the
touch layer, first.

The map "+" FAB looked dead because `handleFabClick` early-returned into
`navigator.geolocation.getCurrentPosition(success)` with **no error callback and
no timeout**. A fresh user (e.g. the App Store reviewer) has no shared location,
so the success callback was the only path that opened the dialog — and on iOS a
denied/slow permission prompt means it never fires. onClick fired every time;
nothing visible happened.

**Rule:** any tap handler that gates UI on geolocation must open the UI
immediately with a fallback location and only *refine* coords in the background
(with a `timeout` + error callback). Never let geolocation be the sole path that
opens something.

**Why:** silent geolocation hangs are indistinguishable from a dead button, so
they get misdiagnosed as z-index/pointer-events/overlay issues and waste time.

**How to apply:** before chasing stacking-context / pointer-events / overlay
theories for an unresponsive iOS button, confirm the onClick path can't silently
no-op (geolocation, awaited fetch, permission prompt). The map iOS touch-callout
CSS is already correctly scoped to `.maplibregl-canvas*`/`.maplibregl-marker`/`.ln`
only, so it does NOT disable overlay buttons.
