---
name: Static (public/) asset URLs vs app base path
description: Why DB-stored /dhl-app/seed/... image paths break in dev and how to reference public assets
---

Seed/demo images live in `artifacts/dhl-app/public/seed/` and are referenced by
URL from stored data (e.g. catch/post `imageUrl`). The app base path differs by
environment, so a hardcoded prefix breaks in one of them:
- dev server runs with `base="/"` (BASE_URL `/`) → asset served at `/seed/x.png`
- prod build runs with `BASE_PATH=/dhl-app` (BASE_URL `/dhl-app/`) → `/dhl-app/seed/x.png`

A stored path like `/dhl-app/seed/x.png` returns the SPA `index.html`
(`text/html`, broken image) in dev because it doesn't match the public dir.

**Rule:** never render a hardcoded-base path for public assets. Rebase against
`import.meta.env.BASE_URL` at render time. Helper `resolveImageSrc()` in
`src/lib/assets.ts` re-anchors anything containing `/seed/` to BASE_URL and
passes object-storage (`/api/...`), http, and data URIs through unchanged.

**Why:** object-storage uploads (`/api/storage/...`) are environment-agnostic and
work as-is, but bundled public assets are not — they move with the build base.
