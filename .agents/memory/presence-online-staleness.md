---
name: Presence / "on the water" count
description: Why is_online over-counts presence and how the feed "Now on the water" count must be computed
---

- `users.is_online` is set to `true` when a user shares location (the location-update endpoint also sets `last_seen = now()`), but it is **never set back to `false`** — there is no offline event, no heartbeat, no cron.
- The map shares location on map mount (effect keyed on `me?.shareLocation`); there is no periodic heartbeat, so `last_seen` is not continuously refreshed.
- **Water vs land is client-only.** Only the map can tell whether a coordinate is over water (it uses `map.queryRenderedFeatures` against water layers → `meOnLand`/`onLandIds`; the map's own presence uses `meOnWater = !meOnLand`). The backend has NO geospatial knowledge of the lake.

**Rule:** The feed's "Now on the water" stat must NOT use raw `is_online`. `is_online`-based counts include people on land (homes, marinas) who merely shared a location — that produced the bug where the lone viewer, sitting on land, counted as "1 on the water."

**Why:** Reported twice — first as demo/seed accounts stuck online for days; then as the viewer themselves being counted while on land. `is_online` means "shared a location somewhere recently," not "out on the lake."

**How to apply:** There is now a client-reported `users.is_on_water` boolean column. The client sends `onWater` in the `PATCH /users/me/location` body (`LocationUpdate.onWater` in openapi → regenerate client) computed from `!meOnLand`; map.tsx re-reports it whenever `meOnLand` flips. `/api/posts/summary` "Now on the water" counts `is_on_water = true AND share_location = true AND last_seen >= now() - 10 min`. `is_on_water` is never cleared, so the `last_seen` freshness window is still required to drop people who left. There is still no real heartbeat, so the window effectively means "reported on-water in the last 10 min." Brief mount-time skew is possible (default `meOnLand=false` until the geospatial pass runs) but self-corrects.
