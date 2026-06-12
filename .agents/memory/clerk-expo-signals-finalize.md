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

**The wrapper is NOT stale.** The `SignInFuture`/`SignUpFuture` getters (`status`, `createdSessionId`, etc.) read live from the underlying resource (`this.#ev`), so reading `signIn.status` right after `await signIn.password(...)` in the same handler closure returns the FRESH value. An earlier "stale closure snapshot" theory was wrong — don't repeat it.

**The real precondition — finalize THROWS, it does not return `{ error }`, when the sign-in/up isn't complete.** In clerk-js the body is literally `if(!this.#ev.createdSessionId) throw Error("Cannot finalize sign-in without a created session.")` (same for sign-up). So calling `finalize()` unconditionally crashes with an UNCAUGHT "cannot finalize" error whenever `password()`/`verifyEmailCode()` succeeded but the attempt isn't `complete` (MFA/second factor, captcha, already-signed-in, or any non-complete status).

**How to apply (correct pattern):**
1. `const { error } = await signIn.password(...)` → `if (error) return;` (the `errors` signal renders the message).
2. `if (signIn.status !== "complete") return;` — guard before finalize (status read is fresh/live).
3. `try { await signIn.finalize({ navigate }) } catch (e) { console.error(e) }` — belt-and-suspenders so it can never surface as an uncaught error.

Nothing redirects from the `(auth)` group to `(home)` automatically — `finalize`'s `navigate` callback doing `router.replace("/")` is what moves the user in; the `(home)/_layout` guard only handles the signed-OUT → sign-in direction.

Google SSO is separate: it uses `useSSO().startSSOFlow(...)` which DOES return `{ createdSessionId, setActive }` (classic-style), then `setActive({ session }) + router.replace("/")`.

**Second factor (2FA) is a REAL non-complete status, not an error.** Accounts with 2FA enabled return `signIn.status === "needs_second_factor"` after a successful `password()`. The web app (dhl-app) never hits this in custom code because it uses Clerk's prebuilt `<SignIn>` component which handles all factors. A custom Expo flow must handle it explicitly or sign-in is impossible for those users.

- Read available factors from `signIn.supportedSecondFactors` (`SignInSecondFactor[]`; strategies `totp` | `phone_code` | `backup_code` | `email_code` — but the future API only verifies the first three).
- MFA methods live under the `signIn.mfa` namespace (NOT top-level): `signIn.mfa.sendPhoneCode()`, `signIn.mfa.verifyPhoneCode({code})`, `signIn.mfa.verifyTOTP({code})`, `signIn.mfa.verifyBackupCode({code})`. There is NO email second-factor verify method.
- Flow: after `password()` with no error, `if (signIn.status === "needs_second_factor")` → show a code-entry step. For `totp` just prompt; for `phone_code` call `sendPhoneCode()` first; offer `verifyBackupCode` as fallback. After verify with no error, re-check `status === "complete"` then `finalize()`.
