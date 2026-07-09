---
name: Dale Hollow branding keeps
description: What legitimately stays "Dale Hollow" after the multi-lake Gillie rebrand, and what must never be renamed.
---

The app rebranded from Dale-Hollow-only to multi-lake Gillie (July 2026 audit). Rules:

**Never rename (shipped identity — breaking):**
- Bundle ID `app.dalehollowlake` (capacitor.config.ts, pbxproj, codemagic.yaml, appleNative.ts APPLE_AUDIENCE, apns.ts default). It's the published App Store identity; renaming breaks the installed app, Apple Sign In token audience, and APNs.
- Capacitor `server.url` `dale-hollow-nav.replit.app` — the real prod domain the iOS webview loads.
- Internal names: `@workspace/dhl-app`, `/dhl-app` base path, `dhl.*`/`dhl-*` localStorage keys and events (renaming resets user state and breaks seed URLs/iOS build).

**Legit domain data (keep):**
- lake-config catalog entry id 1 "Dale Hollow Lake" (default lake), lakePlaces.ts real place names, CWMS gauge id in conditions.ts, schema comments, Dale-Hollow-themed reviewer demo content in demoData.ts.

**Why:** user asked for a full de-branding audit; everything user-facing was genericized ("your lake community"), but these categories were deliberately kept. Future "remove Dale Hollow" requests should not touch them.

**How to apply:** any rebrand/copy sweep — genericize user-facing text freely, leave identity + domain-data categories alone.
