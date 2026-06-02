---
name: Presence / "on the lake" online staleness
description: Why is_online over-counts and how the top-bar "on the lake" count must be computed
---

- `users.is_online` is set to `true` when a user shares location (the location-update endpoint also sets `last_seen = now()`), but it is **never set back to `false`** — there is no offline event, no heartbeat, and no cron.
- The map only shares location **once on map mount** (effect keyed on `me?.shareLocation`); there is no periodic heartbeat, so `last_seen` is not continuously refreshed.

**Rule:** Any count or list of "who's online / on the lake" must treat presence as stale via a `last_seen >= now() - window` filter, not raw `is_online = true`. Otherwise demo/seed accounts and anyone who ever shared a location stay counted forever.

**Why:** Users reported the feed top bar showing "N on the lake" when nobody was actually out — the count was raw `is_online = true`, which included demo accounts (sarah_m, dhl_marina, lakeside_grill) stuck online for days.

**How to apply:** The `/api/posts/summary` "on the lake" count now uses `is_online = true AND last_seen >= now() - 10 min`. If you want active users to *stay* counted while they keep using the app, you'd also need a real presence heartbeat (not present today) — without it, the freshness window means "shared location in the last 10 min." The map's friend "who's on the lake" list still reads raw `isOnline`, but seed accounts aren't usually a user's friends so it wasn't part of the report.
