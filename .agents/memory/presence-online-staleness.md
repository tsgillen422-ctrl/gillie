---
name: Presence / "on the water" count
description: Why is_online over-counts presence and how the feed "Now on the water" count must be computed
---

- `users.is_online` is set to `true` when a user shares location (the location-update endpoint also sets `last_seen = now()`), but it is **never set back to `false`** — there is no offline event, no heartbeat, no cron.
- The map shares location on map mount (effect keyed on `me?.shareLocation`); there is no periodic heartbeat, so `last_seen` is not continuously refreshed.
- **Water vs land is client-only.** Only the map can tell whether a coordinate is over water (it uses `map.queryRenderedFeatures` against water layers → `meOnLand`/`onLandIds`; the map's own presence uses `meOnWater = !meOnLand`). The backend has NO geospatial knowledge of the lake.

**Rule:** The feed's "Now on the water" stat must NOT use raw `is_online`. `is_online`-based counts include people on land (homes, marinas) who merely shared a location — that produced the bug where the lone viewer, sitting on land, counted as "1 on the water."

**Why:** Reported twice — first as demo/seed accounts stuck online for days; then as the viewer themselves being counted while on land. `is_online` means "shared a location somewhere recently," not "out on the lake."

**How to apply:** There is now a client-reported `users.is_on_water` boolean column. The client sends `onWater` in the `PATCH /users/me/location` body (`LocationUpdate.onWater` in openapi → regenerate client) computed from `!meOnLand`; map.tsx re-reports it whenever `meOnLand` flips. `/api/posts/summary` "Now on the water" counts `is_on_water = true AND share_location = true AND last_seen >= now() - 10 min`. `is_on_water` is never cleared, so the `last_seen` freshness window is still required to drop people who left. There is still no real heartbeat, so the window effectively means "reported on-water in the last 10 min."

**The map's "Who's on the lake" presence list/count is per-FRIEND authoritative, not viewer-detected.** It must use each friend's own self-reported `isOnWater` (now serialized by `GET /friends/locations`) + a fresh `lastSeen` window, NOT the viewer's client `onLandIds`. `onLandIds` only classifies on-screen markers, so off-screen friends defaulted to on-water → people on land showed "on the lake" on live (worked in dev only because seed friends sat near the viewport). Keep `onLandIds` only as a secondary exclusion for friends the viewer currently sees.

**`meOnLand` must default to `true` (fail-safe), NOT `false`.** With a `false` default, the mount "share my location" effect reports `onWater: !meOnLand = true` before the geospatial pass runs, marking the user on-water; since `is_on_water` is never cleared, they get stuck "on the lake" even when on land (reported bug). Defaulting `meOnLand`/`meOnLandRef` to `true` means we only ever report on-water after the map confirms coords are over a water layer; opening the map then re-reports `false` and self-heals anyone already stuck.
