---
name: App Store reviewer sign-in (Clerk new-device challenge)
description: Why the reviewer couldn't sign in on prod Clerk, why email-verify wasn't enough, and the password-gated sign-in-ticket workaround. Plus how to introspect the prod Clerk tenant without secrets.
---

# Real blocker: Clerk "new device" sign-in verification (NOT unverified email)

On prod, the reviewer's password IS accepted (`attempt_first_factor` → 200) and
then Clerk forces an email code via `prepare_second_factor` → 200, shown as
"You're signing in from a new device. We're asking for verification to keep your
account secure." This is Clerk **account protection / new-device verification**,
distinct from user MFA — note prod config shows `second_factors: []` yet the flow
still calls `prepare_second_factor`.

**Why the earlier fixes didn't work:** marking the email verified, syncing the
password, and `disableUserMFA` do NOT affect the new-device challenge. It fires
on every fresh device regardless. The code is mailed to the reviewer's
unreachable mailbox, so they're locked out. Dev doesn't hit this because dev
instances run in test mode; prod does not.

**Why we can't just disable it:** Replit-managed Clerk gives no dashboard, and
the Backend SDK `InstanceApi`/restrictions expose no toggle for new-device
verification (only test_mode, HIBP, email deliverability, allowlist/blocklist).
Docs don't cover disabling it either.

# The fix: password-gated Clerk sign-in TICKET

`ticket` is a first factor on the prod instance. A Clerk sign-in token
(`signInTokens.createSignInToken`) completes the sign-in directly and SKIPS the
new-device email step. Flow:
1. Public endpoint `POST /api/reviewer/login` (mounted before `requireAuth`):
   verify the typed password server-side with `users.verifyPassword` (so it's
   NOT an open backdoor — only someone with the reviewer password gets in;
   in-memory per-IP throttle on top), then mint a sign-in token.
2. Frontend "App Store reviewer sign-in" form consumes the token PROGRAMMATICALLY
   off the CLASSIC Clerk resource:
   `const clerk = useClerk()` → `clerk.client?.signIn.create({ strategy: "ticket", ticket })`
   → `clerk.setActive({ session: result.createdSessionId })` → navigate.

GOTCHA A — DO NOT use `useSignIn()` here. `@clerk/react` v6 ships the SIGNALS API:
`useSignIn()` returns `{ signIn, errors, fetchStatus }` — there is NO `isLoaded`
and NO `setActive`. A first fix did `const { isLoaded, signIn, setActive } =
useSignIn()`; `isLoaded` was `undefined`, so the guard `!isLoaded` made the submit
handler silently return on EVERY click ("does nothing", no error, no console log).
Vite build does NOT type-check, so this wrong destructure compiled fine. Use the
classic resource via `useClerk().client?.signIn` + `clerk.setActive` instead (same
hybrid pattern gillie-mobile uses: `getClerkInstance().client?.signIn` for classic
ops alongside the signals API).

GOTCHA B — the prebuilt `<SignIn>` does NOT auto-consume a sign-in-token via a
`?__clerk_ticket=` query param (that param is for sign-UP / org invitations). An
even-earlier attempt redirected to `/sign-in?__clerk_ticket=...` and the component
just showed the normal email/password form, so the reviewer fell back into the
new-device challenge. You must consume the ticket yourself.

Verified against the PROD tenant: a ticket sign-in returns `status: "complete"`
with `first_factor_verification.strategy: "ticket"` and
`second_factor_verification: null` — i.e. it genuinely skips the new-device step.

**How to apply:** any time a Clerk sign-in must bypass new-device/email
verification for a fixed account (reviewer/demo), the ticket strategy is the
lever — keep it gated (password check) so it isn't a public login bypass.
`verifyPassword` THROWS on a wrong password (catch → 401); on success returns
`{ verified: true }`.

# Introspecting the PROD Clerk tenant without secrets

Dev and prod are SEPARATE Clerk tenants; the agent only has the dev (test)
secret key locally, so it cannot query prod via `clerkClient`. Read prod's real
auth config from the PUBLIC endpoint the browser uses:
`curl https://<app-domain>/api/__clerk/v1/environment` → `auth_config` +
`user_settings`. Deployment logs show the flow shape on
`/api/__clerk/v1/client/sign_ins` (`attempt_first_factor`, `prepare_second_factor`).

Reviewer email must be a real, non-reserved TLD (`.app`), NOT `.test`/`.example`
— Clerk rejects those with `form_param_format_invalid`.
