---
name: iOS Capacitor wrapper for dhl-app
description: Why the native iOS app is a server.url webview wrapper, not a bundled build
---

# iOS App Store wrapper (Capacitor) for dhl-app

The native iOS app is a Capacitor wrapper that loads the **live published site**
via `server.url` (capacitor.config.ts), NOT a locally-bundled build.

**Why:** the app uses Clerk **cookie-based, same-origin** auth and a **relative
`/api`** backend (frontend + API share one origin behind the Replit proxy).
Bundling assets locally (`capacitor://localhost`) would make every API/auth call
cross-origin and break Clerk cookies. Pointing the webview at the production
origin keeps auth and `/api` working exactly as in mobile Safari.

**How to apply:**
- Production origin is `https://dale-hollow-nav.replit.app`; bundle id `app.dalehollowlake`; app name "Dale Hollow Lake".
- `webDir` is `dist/public` (Vite output nests under `public/`), required by `cap sync` even though `server.url` overrides it at runtime.
- Capacitor 8 uses Swift Package Manager (CapApp-SPM / Package.swift) — **no CocoaPods / `pod install`**. Open `ios/App/App.xcodeproj` in Xcode.
- Re-sync after web changes: `pnpm --filter @workspace/dhl-app run cap:sync`.
- Caveat: pure webview wrappers risk Apple Guideline 4.2 rejection.
- Final build, signing, and App Store submission require a Mac + Xcode + Apple Developer Program ($99/yr) — cannot be done in Replit.

## OAuth (Sign in with Apple / Google) needs server.allowNavigation
Social sign-in works on the live web but **silently fails in the native
webview** if `server.allowNavigation` is unset. Reason: the OAuth flow
redirects the top-level page to an off-origin provider (appleid.apple.com /
accounts.google.com). Without allowNavigation, Capacitor treats off-origin
top-level navigations as "external" and opens them in the system browser, so
the session cookie is set in Safari and never returns to the WKWebView — login
appears to do nothing in the app.
**Fix:** list the provider hosts in `server.allowNavigation`
(`appleid.apple.com`, `*.apple.com`, `accounts.google.com`, `*.google.com`,
`*.googleusercontent.com`) so the OAuth pages load *inside* the webview and the
redirect chain (and cookies) stay same-context.
**How to apply:** this is baked into the native app at build time — editing
capacitor.config.ts requires `cap:sync` + a NEW Codemagic build (not a Replit
republish, which only updates the web origin the wrapper loads).
