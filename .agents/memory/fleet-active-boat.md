---
name: My Fleet / active boat sync & privacy
description: Rules for the boats table, denormalized users.boat* "active boat" columns, and showBoat redaction surfaces.
---

## Denormalized active boat
`users.boat*` columns are the "active boat" every legacy surface (map markers, feed chips, friends list) reads. The boats table is the source of truth; `syncActiveBoat()` in api-server routes/boats.ts copies a boat onto users.boat*.

**Why:** avoids touching every consumer of users.boat*; check-in can pick a non-primary boat, so users.boat* is NOT always the primary.

**How to apply:** any boat mutation that could affect the displayed boat must re-sync deterministically:
- create/edit primary → sync that boat
- delete primary → promote oldest remaining + sync (or clear)
- delete NON-primary → re-sync to current primary (deleted boat may have been the checked-in active one)
- check-in with boatId → validate ownership then sync

## showBoat privacy has multiple surfaces
When `showBoat=false` and viewer ≠ self, redact fleet at EVERY surface: `/users/:userId` returns `fleet: []`, AND `/gallery?profileUserId=` must null out each item's `boatId` (boat tags leak fleet existence). boatName/color/type on the user object stay public for map markers.

## Client gotchas
- CheckInControl keeps a selectedBoatId in state — always validate it against the current fleet before sending (boat may have been deleted in Settings).
- Fleet UI: settings-vessel.tsx is the fleet manager; profile FleetSection only renders when fleet.length > 1 (single-boat profiles look unchanged; primary showcase card = MyBoatCard from users.boat*).
- Backfill order in api-server index.ts: backfillFleets() must run BEFORE reconcileDemoUsers() or demo extra boats block primary migration.
