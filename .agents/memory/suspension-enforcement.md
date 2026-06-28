---
name: Suspension (ban) enforcement
description: How a moderator "suspend" actually blocks app access, and the reversible restore path.
---

# Suspension enforcement

The `suspend` moderation action sets `users.isSuspended = true`, but for a long time
NOTHING enforced it — the ban was cosmetic. Enforcement is now twofold:

- **Server (authoritative):** `requireAuth` (api-server `middlewares/auth.ts`) returns
  `403 {error, suspended:true}` for any suspended user, EXCEPT `GET`/`DELETE` `/users/me`
  (via `isSuspensionExempt`; `req.path` is relative to the `/api` mount). The exemption is
  intentionally narrow so the client can still load `/me` to render the suspension screen
  and the user can still self-delete.
- **Client:** `App.tsx` gates `if (me.isSuspended) return <SuspendedGate/>` placed BEFORE the
  waiver/terms gates and after the fail-closed loading/error screens, so suspended users never
  reach the app shell.

**Restore is reversible:** `PATCH /api/users/:userId/suspension` (admin-only, body
`{suspended:boolean}`) toggles `isSuspended`; rejects self-target; sends a best-effort
`warning`-type "account restored" notification (wrapped in try/catch — a failed notify must not
fail the restore). `GET /api/users/suspended` lists suspended users for the admin Members tab.

**Why:** App Store UGC compliance requires the ability to actually remove/suspend abusive
users, and a mistaken suspension must be undoable.

**How to apply:** Any new authenticated surface is already covered by `requireAuth`. If you add
a route a suspended user MUST reach (rare), widen `isSuspensionExempt` deliberately — do not
loosen the default-deny.
