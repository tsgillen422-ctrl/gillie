---
name: Me-marker rendered separately from friends
description: The current user's boat marker is drawn by its own effect, not the friends render path — any feature merging me with friends must gate it to avoid a double-draw.
---

In `artifacts/dhl-app/src/pages/map.tsx`, friend boats render through `renderBoats`
(supercluster + pooled `friendMarkerMap`), but the current user ("me") is drawn by a
SEPARATE `useEffect` (`meMarker.current`), gated on `me.shareLocation` + coords.

**Why:** me and friends come from different data sources (`useGetMe` vs
`useGetFriendLocations`) and me must always render even when not in the friends list.

**How to apply:** Any feature that can place me *together with* friends (e.g. the
same-boat/crew proximity grouping) must:
- include me in the grouping by mapping `me` into a friend-like record (`isMe: true`,
  `userId: me.id`, `lat: me.currentLat`, `lng: me.currentLng`), and
- gate the standalone me-effect (a `meInCrew` flag) so me isn't drawn twice — once
  in the crew marker and once by the me-effect. Add the flag to the me-effect deps.

Same-boat grouping itself is frontend-only and computed BEFORE supercluster
(`groupByProximity` in `lib/clustering.ts`, `SAME_BOAT_METERS`): a crew becomes ONE
supercluster point, so `point_count` then counts boats, not people — label cluster
sheets with a separate `boatCount` (leaf count), not flattened member length.
