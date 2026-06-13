---
name: iOS via Codemagic cloud build
description: How the dhl-app Capacitor iOS app is cloud-built/signed on Codemagic, and the non-obvious signing gotchas.
---

# iOS via Codemagic cloud build

dhl-app Capacitor iOS app (appId `app.dalehollowlake`, a `server.url` webview of the
live site) is built on Codemagic because the user has no modern Mac. Config is
`codemagic.yaml` at the repo root; workflow key `ios-capacitor-appstore`. Needed a
shared `App.xcscheme` so `xcode-project build-ipa --scheme App` resolves.

## Use AUTOMATIC signing — do NOT hand-roll fetch-signing-files
- The working setup is Codemagic **automatic** signing: `integrations.app_store_connect`
  + `environment.ios_signing: {distribution_type: app_store, bundle_identifier}`, and a
  single signing step that just runs `xcode-project use-profiles`. Codemagic's auto-prep
  fetches the cert, its private key (which it generated and **stores in your Codemagic
  account**), and a profile BEFORE the scripts run.
- **The trap I fell into (regression):** switching to an explicit
  `app-store-connect fetch-signing-files --certificate-key …` broke everything, because
  Apple's API only returns the **public** cert — the private key lives wherever the cert
  was created. Explicit fetch then fails with `Cannot save Signing Certificates without
  certificate private key`, and trying to supply your own key via a Codemagic var is a
  rabbit hole (multi-line PEM loses newlines when pasted; base64 paste can silently end
  up EMPTY → `Provided value "" is not valid`). Automatic signing avoids all of this
  because Codemagic owns the key. **Why:** the user's clue — "it wasn't throwing an error
  until we tried to fix the build IPA" — was exactly right: automatic signing reached the
  Build IPA step fine; the explicit path was strictly worse.
- **Symptom that this regression is happening:** signing fails at the *fetch* step, not
  the build-ipa/archive step. If the cert error shows up in fetch, you've over-engineered
  — revert to automatic.

## Provisioning-profile / Push gotchas (the actual original blocker)
- A profile only carries a capability (e.g. Push `aps-environment`) if that capability
  was enabled on the App ID **at profile-creation time**. After enabling Push, OLD
  profiles stay push-less and automatic signing will happily reuse one → archive fails
  with "requires a provisioning profile with Push Notifications".
- **Fix (no YAML/key changes):** delete the stale App Store profiles for the bundle in
  the Apple Developer portal so automatic signing regenerates a fresh push-enabled one.
  Local `rm` of installed `.mobileprovision` files does NOT delete the API/portal
  profile, so it alone does not force regeneration.
- Keep a read-only diagnostic in the signing step: loop the installed
  `*.mobileprovision`, `security cms -D -i` each, and grep for `aps-environment` to print
  PUSH OK / PUSH MISSING. This tells you whether the profile is the problem without
  another guess-and-build cycle.
- `xcode-project use-profiles` exits 0 even when NO profile was installed.

## Entitlements wiring (already correct, don't churn)
- pbxproj Release config → `App.release.entitlements` (aps-environment=production);
  Debug → `App.entitlements` (development). App genuinely uses native push
  (`src/lib/native-push.ts` + AppDelegate APNs forwarding) — do NOT strip the push
  entitlement to dodge signing errors.

## Operational notes
- The agent runs on Linux and CANNOT push or run iOS builds. The user pushes via the
  Replit Git panel (remote `github.com/tsgillen422-ctrl/gillie.git`) then reruns
  Codemagic. **YAML changes require a push; Codemagic UI changes (env vars, keys) do not.**
- Validate `codemagic.yaml` locally with the workspace `yaml` lib
  (`node_modules/.pnpm/yaml@*/.../dist`); there is no python yaml.
- App Store Connect integration is named exactly `AppStoreConnect`;
  `APP_STORE_APPLE_ID` 6779852403; DEVELOPMENT_TEAM/team id `T6769T4X35`.
