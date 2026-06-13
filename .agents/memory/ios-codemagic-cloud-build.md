---
name: iOS via Codemagic cloud build
description: How the dhl-app Capacitor iOS app is cloud-built/signed on Codemagic, and the non-obvious signing gotchas.
---

# iOS via Codemagic cloud build

dhl-app Capacitor iOS app (appId `app.dalehollowlake`, a `server.url` webview of the
live site) is built on Codemagic because the user has no modern Mac. Config is
`codemagic.yaml` at the repo root; workflow key `ios-capacitor-appstore`. Needed a
shared `App.xcscheme` so `xcode-project build-ipa --scheme App` resolves.

## The signing private-key trap (the real blocker behind "profile lacks Push")
- Apple's App Store Connect API only ever returns the **public** distribution
  certificate. The matching **private key** exists ONLY on the machine that created
  the cert. Codemagic cannot sign with a cert whose private key it doesn't hold.
- Symptom: `fetch-signing-files` fails with `Cannot save Signing Certificates
  without certificate private key`, even though `certificates list` shows a valid
  "Apple Distribution: …" cert exists.
- **Fix:** CI must own a private key. Generate one
  (`ssh-keygen -t rsa -b 2048 -m PEM -f codemagic_private_key -q -N ""`), store its
  PEM contents as a **secure** Codemagic env var `CERTIFICATE_PRIVATE_KEY` in an
  env-var group (we use group `appstore_signing`, referenced via
  `environment.groups`), then pass `--certificate-key @env:CERTIFICATE_PRIVATE_KEY`
  to `fetch-signing-files` plus `--create`. With `--create`, the first build creates
  ONE new distribution cert from that key and later builds reuse it (the stored key
  matches the cert). Also need `keychain initialize` before and
  `keychain add-certificates` after, so the identity lands in the build keychain.
  **Why:** without a key you control, automatic signing keeps "finding" the keyless
  cert and failing; a CI-owned key makes signing deterministic.

## Provisioning-profile / Push gotchas
- A profile only carries a capability (e.g. Push `aps-environment`) if that
  capability was enabled on the App ID **at profile-creation time**. After enabling
  Push, OLD profiles stay push-less. So wipe pre-installed profiles
  (`rm -f "$HOME/Library/MobileDevice/Provisioning Profiles/"*.mobileprovision`)
  and let `--create` mint a fresh one.
- `xcode-project use-profiles` exits 0 even when NO profile was installed, silently
  masking failures. Use `set -e` and hard-fail if no `.mobileprovision` is present.
- CLI flag traps: there is NO `--profile-name` on `fetch-signing-files` (rejects it
  with `unrecognized arguments`). `app-store-connect list-certificates` is
  deprecated → use `app-store-connect certificates list`. Modern accounts use cert
  type `DISTRIBUTION` ("Apple Distribution"), not legacy `IOS_DISTRIBUTION`.

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
