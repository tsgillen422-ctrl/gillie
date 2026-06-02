---
name: Admin bootstrap & production DB separation
description: How admin access works, the first-admin bootstrap deadlock, and prod-vs-dev DB realities
---

# Admin bootstrap & production database

## Admin is a DB boolean with a bootstrap deadlock
Admin = `users.is_admin`. The only in-app grant path (`PATCH /users/:id/admin`)
requires the caller to already be an admin, so there is no way to create the
*first* admin through the app. Solved with an `ADMIN_CLERK_IDS` shared env var
(comma-separated Clerk user IDs); `ensureOwnerAdmin` in the auth middleware
auto-promotes a matching user on login (writes once, no-op otherwise).
**How to apply:** to make someone an owner, add their Clerk user id to
`ADMIN_CLERK_IDS`; takes effect in prod only after a republish.

## Users are matched by clerkId — different Clerk identity = duplicate account
`requireAuth` finds the local user by `clerk_id`; if none, it provisions a new
row (username derived from email local-part, random suffix on collision). If the
same person signs in under a *different* Clerk account, they get a brand-new
local user (not their old one). Symptom seen: an owner had two prod rows with the
same email base but different clerk_ids — only the older one was admin.

## Production DB is separate and read-only to the agent
Publishing creates a **separate** production database with its own data (dev data
is NOT copied; only schema is migrated on publish). The agent's `executeSql`
against `environment: "production"` is **read-only (SELECT only)** — you cannot
UPDATE/INSERT prod directly. Any data/privilege fix that must land in production
has to run *inside the app* (e.g. a login-time bootstrap) and then be deployed,
not written directly.
