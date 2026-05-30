---
name: DHL app data & API testing
description: How the dev DB is seeded and how to safely smoke-test the API without destroying demo data
---

# DHL dev database & API smoke testing

## Seed data is NOT in source
- The dev Postgres pins/users/etc. were seeded once directly into the DB. There is NO seed script in the repo (no `*seed*` file, nothing in git history, not in `scripts/src` which only has `hello.ts`).
- **Consequence:** deleting/mutating seeded rows is irreversible from source. The only faithful restore is a DB checkpoint rollback. Treat the dev DB as precious — never run destructive DELETE/UPDATE smoke tests against real seeded rows.

## Safe API testing
- API server is reachable at `http://localhost:8080/api` (and :80). `$REPLIT_DEV_DOMAIN/api/...` does NOT route (api-server is a separate artifact) — curl returns 000.
- Session is `SESSION_USER_ID=1`, which also equals `OWNER_ID=1`. So user 1 is the app admin.
  - `DELETE /pins/:pinId` returns **200 for ANY pin** when acting as user 1 (owner override), NOT 403. To actually exercise the 403 own-only path you'd need a non-owner session.
- To test create+delete safely: create your own throwaway row first, delete THAT, never grab "first pin in list" and delete it.

## Pin/landmark delete UI
- `pin.type === "landmark"` distinguishes landmarks from pins (same `pins` table).
- Owner gating in UI: `me != null && pin.userId === me.id`. Server is source of truth for authz.
- After delete invalidate ALL of: `getGetPinsQueryKey()`, `getGetFavoritePinsQueryKey()`, `getGetPendingPinsQueryKey()` (pending matters for owner workflows).
