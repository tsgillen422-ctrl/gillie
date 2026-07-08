---
name: Multi-lake model
description: How lake scoping works across API, frontend, and legacy iOS builds.
---

# Multi-lake scoping

- Static 20-lake catalog lives in `@workspace/lake-config` (id, name, slug, region, lat/lng/zoom). Lake 1 = Dale Hollow = DEFAULT_LAKE_ID.
- **Rule:** `lakeId` is OPTIONAL on every API param/body (server defaults to lake 1).
  **Why:** shipped iOS builds don't send it; making it required breaks old phones.
  **How to apply:** any new content surface (posts, pins, stories, check-ins, conditions, dock labels) gets an optional `lakeId` filter/field, never required.
- Frontend: `LakeProvider` opens at the LAST-BROWSED lake (localStorage `gillie:selectedLakeId:<userId>`), falling back to `me.primaryLakeId` (product decision reversed July 2026 — selection now persists). Recents stored similarly per user. Provider is mounted with `key={me.id}` so account switches on a shared device remount it and never leak another user's selection. `LakeSwitcher` + 🌎 Explore Lakes button (`/lakes` page, `GET /lakes/overview` stats) live in the GLOBAL header (AppLayout + feed top bar), NOT on the map. Every content query passes `{ lakeId }`; every creation includes `lakeId` in the body.
- Same-named places on different lakes: `/stories/place/:placeName` also takes optional `lakeId` — any place-keyed surface must scope by lake or story viewers mix lakes.
- orval gotcha: a route with BOTH path and query params makes api-zod emit a zod const and a type sharing the name `<Op>Params` → TS2308 star-export clash in `lib/api-zod/src/index.ts`; fix = explicit `export { <Op>Params } from "./generated/api"`.
- Invalidation: use no-arg `getGetXQueryKey()` (prefix key matching all param variants). `getGetXQueryKey({})` does NOT match `{ lakeId }` caches.
- `LAKE_PLACES` (named-places catalog) and CWMS water-level feed are Dale Hollow-specific — gate to `lakeId === DEFAULT_LAKE_ID` on other lakes.
- Map recenters via a prev-lakeId ref effect (`flyTo` lake.lat/lng/zoom); `BASE_ZOOM=12` stays as the marker-scaling reference, camera uses `lake.zoom`.
- Home lake: onboarding picker step (before payoff; Skip bypasses it) and `/settings/home-lake` both PATCH `primaryLakeId` and call `setLakeId` to follow immediately.
