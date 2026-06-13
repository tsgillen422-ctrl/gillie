---
name: Mobile must match web's clean chrome (no gradient banners)
description: gillie-mobile's look must mirror the dhl-app web app; the defining difference was gradient header banners, not colors/fonts.
---

# Gillie mobile must visually match the dhl-app web app

The mobile app (artifacts/gillie-mobile) is meant to be a faithful visual match of
the web app (artifacts/dhl-app, "the app the user built"). Design **tokens already
match** — same palette (lake-blue/teal/sun-gold) and fonts (Plus Jakarta Sans /
Outfit / Dancing Script), synced in constants/colors.ts + fonts.ts.

**The real divergence was layout/chrome, not colors.** The web app uses a SLIM
white/card-colored header bar (Gillie wordmark + round icons) and clean pages
(source: dhl-app/src/components/AppLayout.tsx). The mobile app had instead been
plastering a big teal **LinearGradient banner** on top of every screen — that single
thing made the user say it "looks nothing like" the web app.

**Rule:** No teal gradient banner headers on mobile. Use the clean shared header
(components/ui/ScreenHeader.tsx — card bg, hairline border, dark text, optional
`back` chevron) or the slim global bar (components/AppHeader.tsx). Web HIDES the
header on /feed, so mobile feed has no top header either (just safe-area padding).
Gradients are fine for in-content cards (e.g. the conditions banner), never for the
page header.

**Why:** user repeatedly (6+ times) reported the mobile app didn't match; root cause
was confirmed via user_query to be pure style/layout, not auth/stale-bundle. The
agent cannot screenshot the logged-in mobile app headlessly (no Clerk session), so
fidelity must be derived from the web source code, not from rendered mobile shots.

**How to apply:** when touching any mobile screen header, mirror dhl-app's page
chrome. Pushed/detail screens get a `back` chevron; tab screens don't. Recolor any
white-on-gradient icons to colors.primary/foreground when removing a gradient.
