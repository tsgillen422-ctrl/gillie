---
name: App Store screenshot frame gotchas
description: Layout/contrast rules for the mockup-sandbox appstore Frame01..Frame10 marketing screenshots
---

App Store marketing frames live in `artifacts/mockup-sandbox/src/components/mockups/appstore/` (FrameNN.tsx + `_shared.tsx`), rendered at exactly 1290x2796 and captured 1:1 via the screenshot tool at viewport [1290,2796] (JPEG is App Store-compliant; no Playwright/sharp needed).

**Translucent-gradient trap:** in `_shared.tsx`, bg-gradient classes set the CSS `background` *shorthand*. Classes using translucent stops (`bg-gradient-4`, `bg-gradient-6` use `#0ea5e915`/`#0ea5e920`) wipe the dark base color and render LIGHT, killing white caption contrast. Only solid-dark gradients (1,2,5,7,8) are safe for white captions.
**Why:** shorthand `background:` resets background-color to transparent, so translucent stops composite over the page (white), not over #020617.
**How to apply:** for any frame with the white `Caption`, use a solid-dark bgClass (1/2/7/8); never 4/6 unless rewritten to solid colors.

**Status-bar overlay:** the `.status-bar` (9:41 + icons) is `position:absolute; top:0; height:150px` overlaying app-content. Any in-screen header must use `paddingTop >= ~150px` or it collides with the status text. Default status text is dark (#000); add `darkMode` to `DeviceMockup` for white status text over dark screens (also darkens the bottom tab bar).
**How to apply:** light screens → no darkMode (dark status text, light tab bar); dark/satellite-map screens → darkMode.
