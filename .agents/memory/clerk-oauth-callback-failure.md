---
name: Clerk OAuth callback "Unable to complete action"
description: Diagnosing post-callback OAuth (Apple/Google) sign-in failures on Replit-managed Clerk proxy
---

When a social sign-in (e.g. Apple) shows correct branding and completes Apple's
screen but then bounces back to the login page with "Unable to complete action":

- It is **NOT a callback-URL / redirect-URI problem**. Proof: in prod deployment
  logs the proxied `POST /api/__clerk/v1/oauth_callback` returns **303** (Clerk
  accepted the callback) and Apple round-trips. A wrong return URL fails at Apple
  *before* coming back. So rule callback URL out the moment you see a 303 there.
- The failure is in Clerk's **post-callback user resolution**, narrowed to two causes:
  1. **Existing-account linking conflict** — the OAuth email matches an existing
     account (email/password or Google). Clerk auto-links only when the existing
     email is *verified*; otherwise it refuses (anti-takeover) → generic error.
     Apple "Hide My Email" returns a relay address that won't match → forces a new
     sign-up instead of linking.
  2. **Password is a required sign-up attribute** (`user_settings.attributes.password.required=true`).
     A brand-new social user (incl. Hide-My-Email relay) transfers sign-in→sign-up,
     which then sits at missing_requirements needing a password OAuth can't supply.

**Why hard to pin exactly:** the Replit Clerk proxy logs only HTTP status codes,
not response bodies, and the workspace browser-console tool only sees the **dev**
Clerk instance (dev uses pk_test, has no Apple). Prod error body is not accessible
to the agent. Diagnose from `/api/__clerk/v1/environment` `user_settings` instead.

**Fixes (all in the Auth pane, NOT code, NOT branding):** make password optional so
social-only users complete sign-up; confirm automatic account linking for verified
emails is on. **How to tell which:** new Apple ID w/ Hide-My-Email failing = sign-up
/password path; signing in with the same real email as an existing account failing
= linking path.
