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
- Do NOT use `@capacitor-community/apple-sign-in` (latest 7.1.0): its iOS Package.swift pins
  `capacitor-swift-pm >=7 <8`, which conflicts with `@capacitor/push-notifications@8`
  (`capacitor-swift-pm >=8`). SwiftPM resolution fails at build time (Codemagic). There is no
  Cap 8 release of that community plugin.
- Instead: a self-contained Swift Capacitor plugin (`AppleNativeSignInPlugin`, jsName
  `AppleNativeSignIn`) built directly on `ASAuthorizationAppleIDProvider`, living INSIDE
  `ios/App/App/AppDelegate.swift`. Putting it in AppDelegate.swift (already in the App target's
  compile sources) avoids editing project.pbxproj by hand — no Mac/Xcode needed. Capacitor
  auto-registers any `CAPBridgedPlugin`-conforming `@objc` class; JS reaches it via
  `registerPlugin("AppleNativeSignIn")`. Cancel = `ASAuthorizationError.canceled` → reject
  message "cancelled"/code "1001"; JS maps that to a quiet AppleSignInCancelled.
- Native-only: gate every call behind `Capacitor.isNativePlatform()`.
- Requires `com.apple.developer.applesignin = [Default]` in BOTH `App.entitlements` and
  `App.release.entitlements`, AND the "Sign in with Apple" capability enabled on the App ID
  in the Apple Developer portal (agent cannot do this — user must) or native signing fails.
- The Clerk web "Sign in with Apple" button is hidden EVERYWHERE (web + native) via base
  appearance `socialButtonsBlockButton__apple: "hidden"` — the web OAuth flow is dead, web
  offers Google + email only; native provides the real Apple button.
