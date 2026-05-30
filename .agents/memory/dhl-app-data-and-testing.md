---
name: DHL app data & API/visual testing
description: Dev DB seeding reality and how to safely + effectively test the DHL app (API + map visuals)
---

# DHL dev database & testing constraints

## Seed data is NOT in source
- The dev Postgres (pins/users/etc.) was seeded once directly into the DB. There is NO seed script in the repo or git history.
- **Consequence:** deleting/mutating seeded rows is irreversible from source; the only faithful restore is a DB checkpoint rollback. Treat the dev DB as precious — never run destructive DELETE/UPDATE smoke tests against real seeded rows. Create your own throwaway row, mutate THAT.

## Safe API testing
- API server is reachable at `http://localhost:8080/api` (also :80). `$REPLIT_DEV_DOMAIN/api/...` does NOT route (api-server is a separate artifact) — curl returns 000.
- Session is `SESSION_USER_ID=1`, which also equals the owner/admin id. So `DELETE /pins/:pinId` returns **200 for ANY pin** as user 1 (owner override), NOT 403 — you can't exercise the own-only 403 path without a non-owner session.

## Map visuals can't be auto-verified in this env
- The `runTest` Playwright harness has **no WebGL**, so MapLibre can't render — the map page shows the app's own "Map needs WebGL" fallback. Map/marker visuals CANNOT be verified there.
- The `screenshot` app_preview tool DOES have WebGL, but it can't script localStorage, so the onboarding overlay (gated by localStorage `dhl-onboarding-complete-v1`) blocks an unattended map screenshot.
- **Takeaway:** for map/marker visual changes, rely on build + sound logic and ask the user to confirm in a real browser; don't burn cycles trying to screenshot the map automatically.
