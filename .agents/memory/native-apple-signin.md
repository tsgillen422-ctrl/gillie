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
## Debugging the failure on-device (no console access)
The native app is a server.url webview, so you can't open devtools on the phone. To debug
the Apple flow, the endpoint and button surface staged diagnostics: backend returns JSON
`{error, stage, detail}` (stages: `rate_limit`, `missing_token`, `verify_token`, `no_subject`,
`no_email_for_create`, `clerk_user_or_token`) and logs each stage server-side (presence/length
only — NEVER the raw token or email). The button reads the raw response body once, parses JSON
safely, and renders the exact `HTTP <status> [stage]: detail` in a selectable on-screen box so a
non-technical user can read/copy it. Backend logs are visible via deployment logs.
**There is NO nonce in this flow** — Apple's request sends none and the token has no nonce claim,
so "nonce verification" is not a real stage; backend verification = signature(JWKS)+iss+aud+exp.
**Returning `detail` to the client is debug-only** (leaks jose/Clerk error internals); gate or
sanitize it before a long-term production release.
**Token-leak trap (critical):** the SUCCESS response body is `{token: <Clerk sign-in ticket>}` —
an auth secret. The on-screen/console debug readout must NEVER print the raw success body; show
only `token received: yes/no`. Raw body is safe to show ONLY for non-OK responses (those carry
just `{error, stage, detail}`, no token).
**authorizationCode:** Apple also returns a short-lived `authorizationCode`; the Swift plugin now
includes it (informational only — backend verifies the identityToken, not the code). It's surfaced
as `authorizationCode present: yes/no`. Note: that Swift field is NATIVE → only appears after the
next build; older installed binaries show "no" even on success.
**Channel reminder:** the debug READOUT + redaction are WEB changes → take effect via Replit
REPUBLISH (no Codemagic build needed); the installed build-12 binary works as-is. The only NATIVE
change is the Swift plugin returning `authorizationCode`, which needs the next Codemagic build to
take effect — until then the readout shows `authorizationCode present: no`.

- The Clerk web "Sign in with Apple" button is hidden EVERYWHERE (web + native) via base
  appearance `socialButtonsBlockButton__apple: "!hidden"` (NOT plain "hidden" — Clerk styles
  live under the "clerk" CSS layer and beat a layered `hidden` utility in the iOS webview, so
  the broken button stayed tappable; the !important form wins). Backed by an unlayered
  !important kill-switch in index.css on `.cl-socialButtonsBlockButton__apple`. The web OAuth
  flow is dead — web offers Google + email only; native provides the real Apple button.
