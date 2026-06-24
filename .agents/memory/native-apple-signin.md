---
name: Native iOS Sign in with Apple
description: Why dhl-app uses a native-Apple→backend-ticket flow instead of web OAuth, and the auth-bypass trap on the public endpoint.
---

# Native iOS Sign in with Apple (dhl-app Capacitor)

The web Apple OAuth via Replit-managed Clerk is broken: Clerk can't sign the Apple
"client secret" JWT because the production Apple `.p8` is malformed (oauth_token_exchange_error
/ EC private key parse). Rather than fix the `.p8`, native iOS uses Apple's own
ASAuthorizationController popup (`@capacitor-community/apple-sign-in`), and a PUBLIC
backend endpoint verifies the resulting Apple identity token against Apple's PUBLIC
JWKS (no `.p8` needed), then mints a Clerk sign-in token consumed via the
`ticket` strategy — exactly the reviewer-login pattern. Google stays as Clerk web OAuth.

**Flow:** native popup → `POST /api/auth/apple-native {identityToken, fullName}` →
`jose.jwtVerify` (iss `https://appleid.apple.com`, aud = bundle id `app.dalehollowlake`)
→ resolve Clerk user → `signInTokens.createSignInToken` → webview
`signIn.create({strategy:"ticket"})` + `setActive`.

**Why aud = bundle id, not Services ID:** a NATIVE Apple identity token's audience is the
app's Bundle ID (the native "client_id"), NOT the web Services ID.

## Auth-bypass trap (critical)
On a PUBLIC token-verification endpoint, NEVER trust a client-supplied email for account
matching or creation. Apple's email claim lives INSIDE the signed identity token; the
plugin also returns a body email, but that is attacker-controllable. If you fall back to
body email when the token email is absent, an attacker can present a valid token for THEIR
own `sub` plus a forged body email of any victim and mint a ticket for the victim's account.
**Rule:** match/create only by (a) `externalId` = `apple:<sub>` from the verified token, or
(b) the VERIFIED token email claim. No verified email + no externalId match → 400.

**Account anchoring:** when you match an existing user by verified email, persist
`externalId = apple:<sub>` on them (if empty) via `updateUser`. Apple omits the email claim
on re-authorization, so without the anchor a returning user can't be resolved.

## Plugin / native config
- Plugin is `@capacitor-community/apple-sign-in@7.1.0` running on Capacitor 8 core — cap:sync
  registers it fine (SPM, not CocoaPods). Native-only: gate every call behind `Capacitor.isNativePlatform()`.
- Requires `com.apple.developer.applesignin = [Default]` in BOTH `App.entitlements` and
  `App.release.entitlements`, AND the "Sign in with Apple" capability enabled on the App ID
  in the Apple Developer portal (agent cannot do this — user must) or native signing fails.
- Hide Clerk's web Apple button in native only via appearance `socialButtonsBlockButton__apple: "hidden"`.
