---
name: Demo / seed data
description: How the App-Review demo world is built, kept "live", and toggled.
---

# Demo / seed data (App Review)

Demo accounts are flagged `users.isDemo = true`. All seed logic lives in
`artifacts/api-server/src/lib/demoData.ts`; admin-gated toggle endpoints are
`/admin/demo-data` (GET/POST/DELETE).

## Why demo boats actually render on the map
A boat only shows to a viewer when ALL hold: the viewer FOLLOWS the user,
`shareLocation=true`, `followerSeeLocation=true`, `isOnWater=true`, and
`lastSeen` within the 10-min presence window. So demo data alone is not enough —
two mechanisms make boats visible:
- **autoFollowDemoUsers** runs in `auth.ts provisionLocalUser` so every NEW user
  auto-follows (and is followed back by) the `autoFollow` demo accounts.
- **startDemoPresenceRefresher** (called in `index.ts` on boot) ticks every 2 min
  to refresh `lastSeen` + jitter coords, keeping demo boats inside the window.

## Durable rules / gotchas
- **Seeding must be self-healing, not just "skip if any demo user exists."** A
  partial seed (crash midway) must reset+rebuild — re-inserting collides on the
  unique username constraint. Guard: `existing >= DEMO_USERS.length` → no-op;
  `0 < existing < len` → clearDemoData() then rebuild.
- **autoFollow must heal partial follow state** — insert only the missing target
  pairs, never early-return just because one follow row exists.
- Posts/pins use `visibility: "community"` so they show to everyone (friends-only
  needs a follow). Community pins must be `approved: true` to render.
- clearDemoData reuses `deleteUserAndData` (exported from routes/users.ts) inside
  a tx — there is no FK cascade, so that helper is the canonical cleanup path.
- Benign import cycle auth → demoData → users → auth; safe because refs are all
  inside function bodies. Server boots clean.
