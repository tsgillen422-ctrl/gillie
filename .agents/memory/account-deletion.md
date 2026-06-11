---
name: Self-serve account deletion
description: How a user deletes their own account (App Store compliance) and the route-ordering / Clerk gotchas.
---

Regular users delete their own account via `DELETE /users/me` (operationId `deleteCurrentUser`).

- **Route ordering matters:** `router.delete("/me")` MUST be registered before `router.delete("/:userId")` in `users.ts`, or Express matches `/me` as `:userId` → `parseInt("me")` is NaN → 400.
- The admin route `DELETE /users/:userId` is admin-only AND explicitly blocks self-delete; it is NOT the self-serve path.
- Both routes reuse the same `deleteUserAndData(tx, userId)` helper (deletes all the user's rows incl. the users row itself at the end; no DB FK cascades exist).
- Self-delete also deletes the Clerk identity (`clerkClient.users.deleteUser(clerkId)`), best-effort/try-catch.
  **Why:** without it, the same Clerk login re-provisions a fresh empty local user on next sign-in (see `provisionLocalUser`), so the account isn't really gone.
- Frontend: `useDeleteCurrentUser` in Settings → Account, confirm via AlertDialog, then `signOut({ redirectUrl })`.
