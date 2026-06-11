---
name: Hidden built-in places
description: How admins remove built-in marina/landmark markers from the map for everyone
---

Built-in places live in the static `LAKE_PLACES` array in `map.tsx` and have NO id —
they are keyed by `name`. They are NOT a persistent map layer; a place is only ever
selectable via the search bar (`flyToPlace` → `setSelected({kind:"place"})` + a temporary
marker). So the ONLY surface that needs hidden-filtering is the search loop.

Hiding is server-authoritative + permanent: `hidden_places` table (`place_key` unique +
userId + createdAt). `GET /hidden-places` is readable by any authed user (all clients need
the hidden set); `POST /hidden-places` is admin-only (mirrors the dockLabels admin pattern).
Frontend: `useGetHiddenPlaces` → `hiddenPlaceKeys` Set → `visiblePlaces` filter used in
search; admin-only "Remove place" button in the place popup calls `useHidePlace`.

**Why:** places aren't DB rows, so any "delete a built-in place" feature must hide by name
via this side table, not by deleting a row.
**How to apply:** if you ever render LAKE_PLACES as a real map layer/markers, filter that
layer by `visiblePlaces`/`hiddenPlaceKeys` too — today only search is filtered because
that's the only entry point.
