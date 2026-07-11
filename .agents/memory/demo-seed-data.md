---
name: Demo / seed data
description: How the App-Review demo world is built, kept "live", and toggled.
---

# Demo / seed data (App Review)

Demo accounts are flagged `users.isDemo = true`. All seed logic lives in
`artifacts/api-server/src/lib/demoData.ts`; admin-gated toggle endpoints are
`/admin/demo-data` (GET/POST/DELETE).

## Two audiences: legacy demo-on-signup vs reviewer-only Demo Mode
There are now TWO isolation models in play; do not conflate them.
- **Reviewer Demo Mode (current App Store model):** a single pre-created Clerk
  reviewer (email constant in `auth.ts`, on a real TLD — Clerk rejects reserved
  `.test`) is flagged `users.demoMode = true` (NOT `isDemo`; isDemo must stay
  false on the reviewer or clearDemoData/countDemoUsers would delete/miscount it).
  Demo posts/pins seed with `visibility: "friends"` and ONLY the reviewer
  auto-follows demo users, so regular users see nothing demo. `demoMode` also
  drives a UI "Demo Mode" badge.
  - **The reviewer is a STANDARD non-admin user** (`isAdmin=false`). Apple
    reviewers must see the app exactly as a regular user — no admin panels,
    moderation, user mgmt, analytics, config. `demoMode` only controls demo-world
    visibility and grants NO admin. `ensureReviewerNotAdmin` in `auth.ts` demotes
    any older reviewer row (demoMode && isAdmin) on login. Do NOT re-grant admin
    to the reviewer. **Why:** demoMode and isAdmin are orthogonal; the reviewer
    needs populated content, not elevated access.
- A boat only renders when the viewer FOLLOWS the user AND `shareLocation`,
  `followerSeeLocation`, `isOnWater` all true AND `lastSeen` is within the 10-min
  window. `startDemoPresenceRefresher` (index.ts, every 2 min) keeps demo boats
  fresh; only the reviewer's auto-follow makes them visible to that account.

## Durable rules / gotchas
- **Seeding must be self-healing, not just "skip if any demo user exists."** A
  partial seed (crash midway) must reset+rebuild — re-inserting collides on the
  unique username constraint. Guard: `existing >= DEMO_USERS.length` → no-op;
  `0 < existing < len` → clearDemoData() then rebuild.
- **autoFollow must heal partial follow state** — insert only the missing target
  pairs, never early-return just because one follow row exists.
- Demo posts/pins use `visibility: "friends"` (NOT "community") — visibility is
  the primary isolation lever: only the auto-following reviewer can see them.
- **Demo isolation must be enforced at EVERY surface, not just follow-gated ones.**
  `getHiddenDemoUserIds(viewer)` returns `[]` for a demoMode viewer else all
  isDemo ids; non-follow-gated reads must exclude/404 those ids. The friends
  router was the worst offender — discovery leaked through follower/following/
  friends/mutual lists, the self `/` + `/locations` lists, `/blocks` + `/mutes`,
  AND follow/mute/block-by-id (existence oracle). Also posts `/summary`
  (counts + upcomingEvents) and users `/search` + `/:userId`. Rule: any endpoint
  returning a user/profile or accepting a `:userId` is a potential demo leak —
  gate it.
- **Businesses are demo-seedable and their many subroutes ALL leak by owner.**
  Demo businesses (`DEMO_BUSINESSES` in demoData.ts) are `approved` + PUBLIC, so
  they must be gated by owner id via `getHiddenDemoUserIds`. Beyond list `/` +
  detail `/:id`, the leaky surfaces are: search.ts businesses query, and the
  ID-based subroutes POST save, POST follow, GET/PUT reviews, GET posts (use the
  `isDemoHiddenBusiness(viewer, ownerId)` helper). Owner-scoped writes
  (PUT/DELETE/customize) already 404 non-owners; admin `/status` and self-keyed
  DELETE save/follow/reviews are fine. clearDemoData must delete business child
  rows (saves/follows/reviews/posts/profile) BEFORE deleteUserAndData — that
  helper does NOT touch business tables, so leftover FKs would fail the tx.
- clearDemoData reuses `deleteUserAndData` (exported from routes/users.ts) inside
  a tx — there is no FK cascade, so that helper is the canonical cleanup path.
- Benign import cycle auth → demoData → users → auth; safe because refs are all
  inside function bodies. Server boots clean.

## Seed drift & reconciliation
`seedDemoData()` short-circuits when the demo world is complete, so edits to
DEMO_USERS never reach already-seeded users on their own. `reconcileDemoUsers()`
(run at server startup + on repeat seed calls) syncs catalog-driven fields
(boatType/boatBrand) onto existing demo users. When adding new seed fields,
extend the reconcile `.set()` too, or prod demo users silently keep stale data.
