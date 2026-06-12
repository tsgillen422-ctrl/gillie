---
name: Mobile theme locked to light + app icon source
description: Why gillie-mobile is locked to the light palette and where the app icon comes from
---

# gillie-mobile is locked to the LIGHT palette

`hooks/useColors.ts` always returns `colors.light` (it ignores `useColorScheme`).
`app/_layout.tsx` uses `<StatusBar style="dark" />` to match the light background.

**Why:** The web app (dhl-app) uses `defaultTheme="system"`, but the signature
"Premium Lake Life" brand identity is the bright/light look (white bg, navy text,
teal accents). The user kept saying mobile "looks nothing like" the web because
they compared their light web app (desktop / light browser) against the mobile app
rendering DARK on a dark-mode phone. Locking mobile to light is what makes it match
the brand they actually see.

**How to apply:** Do NOT "restore" system/dark theme support on mobile unless the
user explicitly asks for dark mode. If they do, re-enable the `useColorScheme`
branch and switch StatusBar back to `style="auto"`.

# App icon

Mobile `assets/images/icon.png` is rendered from the web app's real logo
`artifacts/dhl-app/public/favicon.svg` (teal gradient rounded tile + white water
drop + waves) via ImageMagick at 1024x1024. If the brand mark changes on web,
regenerate the mobile icon from that same SVG so they stay in sync.
