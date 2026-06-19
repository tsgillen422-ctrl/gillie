---
name: iOS safe-area requires viewport-fit=cover
description: Why env(safe-area-inset-*) silently does nothing in dhl-app and how it was fixed
---

`env(safe-area-inset-top/bottom/...)` evaluates to **0** unless the page's
viewport meta includes `viewport-fit=cover`. dhl-app shipped without it, so the
header (AppLayout), feed hero, waiver gate, and landing all had safe-area padding
that did NOTHING on device — the header rode up under the iOS status bar /
Dynamic Island and overlapped content below it.

**Fix:** `index.html` viewport meta must be
`width=device-width, initial-scale=1.0, maximum-scale=1, viewport-fit=cover`.

**How to apply:** before adding/ debugging any `env(safe-area-inset-*)` padding,
confirm `viewport-fit=cover` is present. If a "safe-area fix" appears to have no
effect on device, this is the first thing to check. Note insets are 0 on desktop
browsers regardless, so the preview pane never reveals this.
