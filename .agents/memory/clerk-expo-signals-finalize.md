---
name: Clerk Expo signals API — finalize gate
description: gillie-mobile uses Clerk's new signals useSignIn/useSignUp; finalize() must not be gated on a stale status snapshot or auth silently never completes.
---

# Clerk Expo signals (future) API in gillie-mobile

`@clerk/expo` (v3.x, backed by `@clerk/react` v6 + `@clerk/shared` v4) exports the **new signals API** from its main entry — NOT the classic `{ isLoaded, signIn, setActive }`.

- `useSignIn()` → `{ signIn, errors, fetchStatus }` (`SignInSignalValue`). `signIn` is a `SignInFutureResource`.
- `useSignUp()` → `{ signUp, errors, fetchStatus }`.
- Methods like `signIn.password(...)`, `signIn.create(...)`, `signUp.password(...)`, `signUp.verifications.sendEmailCode()/verifyEmailCode(...)` all resolve to `{ error: ClerkError | null }` — they do NOT return status/createdSessionId.
- Loading state = `fetchStatus === "fetching"`. Field errors read from the `errors` signal (`errors.fields.identifier/password/code`, `errors.global[0]`).
- The classic `{ isLoaded, signIn, setActive }` shape lives at `@clerk/react/legacy` only — do not assume it.

**The bug to avoid (cost a debugging session):** after a successful `password()`/`verifyEmailCode()`, you MUST call `signIn.finalize({ navigate })` / `signUp.finalize({ navigate })` to activate the session and route. Do NOT gate that call behind `if (signIn.status === "complete")` — the `signIn`/`signUp` captured in the async closure is a stale render snapshot, the status check is falsy, finalize never runs, and the user is silently stuck on the sign-in/sign-up screen even though Clerk authenticated them.

**How to apply:** call `finalize()` whenever the preceding step returns no `error` (matches Clerk's official future-API custom-flow examples). For non-MFA password instances the status is already complete. Nothing redirects from the `(auth)` group to `(home)` automatically — `finalize`'s `navigate` callback doing `router.replace("/")` is what moves the user in; the `(home)/_layout` guard only handles the signed-OUT → sign-in direction.

Google SSO is separate: it uses `useSSO().startSSOFlow(...)` which DOES return `{ createdSessionId, setActive }` (classic-style), then `setActive({ session }) + router.replace("/")`.
