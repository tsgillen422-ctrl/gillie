---
name: App Store reviewer Clerk account self-heal
description: Why ensureReviewerClerkAccount must repair (not just create) the reviewer's Clerk user, and how to introspect the prod Clerk tenant without secrets.
---

# Reviewer Clerk account must self-heal on boot

`ensureReviewerClerkAccount()` (api-server boot) must REPAIR an existing reviewer
Clerk user, not return early when one is found. On every boot it: syncs the
password from `APPLE_REVIEW_PASSWORD`, marks the email `verified`, and calls
`disableUserMFA`.

**Why:** With Replit-managed Clerk's prebuilt `<SignIn/>`, if the reviewer's
account is half-provisioned (email unverified and/or no usable password), Clerk
falls back to an `email_code` first factor and mails a code to
`apple-review@gillie.app` — an unreachable mailbox — so the reviewer is locked
out even though the password is correct. The old code did `if (list.length>0) return;`
so a stray account (e.g. from a sign-up attempt) was never fixed.

**How to apply:** Any reviewer/demo Clerk bootstrap that "creates if missing"
must also reconcile the existing account's verification + password + MFA. The
reviewer email TLD must be a real one (`.app`), NOT a reserved TLD (`.test`/
`.example`) — Clerk rejects those with `form_param_format_invalid`.

# Introspecting the PROD Clerk tenant without secrets

Dev and prod are SEPARATE Clerk tenants; the agent only has the dev (test)
secret key locally, so it cannot query prod via `clerkClient`. To see the prod
instance's real auth config (first/second factors, verification strategies),
fetch the PUBLIC environment endpoint the browser already uses:
`curl https://<app-domain>/api/__clerk/v1/environment` → `auth_config` +
`user_settings.attributes`. `second_factors:[]` there means a sign-in "code"
prompt is an `email_code` FIRST-factor fallback, not real MFA.

**Why:** Replit-managed Clerk doesn't support end-user MFA and gives no prod
dashboard access; this endpoint is the only ground-truth view of prod config
from the dev environment. Deployment logs show the flow shape too
(`attempt_first_factor` then `prepare_*` on `/api/__clerk/v1/client/sign_ins`).
