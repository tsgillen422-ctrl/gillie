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
- **Portal deletion is unreliable here:** the user insisted the stale "Gillie app store
  profile" was deleted, yet builds kept fetching+signing with it. The profile lived in
  the Apple account the **Codemagic API key** talks to, which can differ from the portal
  the user browses (different Apple ID, or it's marked Invalid and hidden by a filter).
  Local `rm` of installed `.mobileprovision` files does NOT delete the API/portal profile.
- **Deterministic fix (current approach):** a CI step ("Regenerate App Store profile with
  Push") that runs AFTER auto-prep but BEFORE `use-profiles`, using the SAME API key, to:
  rm local profiles → `bundle-ids list --bundle-id-identifier $BUNDLE_ID --strict-match-identifier --json`
  for the bundle resource id → `certificates list --type DISTRIBUTION --json` for the cert id →
  `profiles list --type IOS_APP_STORE --json` then delete (by NAME match: legacy
  "Gillie app store profile" + prefix "Gillie CI AppStore", since profiles list has NO
  bundle filter — matching by name avoids nuking other apps' profiles) → `profiles create
  <BUNDLE_RESOURCE_ID> --certificate-ids <CERT_ID> --type IOS_APP_STORE --name "Gillie CI
  AppStore <ts>" --save`. A freshly created profile inherits the App ID's CURRENT
  capabilities (incl. Push); **no cert private key needed** (profiles reference the cert by
  ID only), so this sidesteps the fetch-signing-files key trap.
- **Why this over portal deletion:** it operates on the exact account Codemagic fetches
  from, so it can't be defeated by the "I don't see it in the portal" discrepancy.
- CLI flag gotchas: `profiles create` takes BUNDLE_ID_RESOURCE_ID as a **positional** arg
  and the flag is `--certificate-ids` (NOT --certificate-resource-ids). `certificates list`
  modern Apple Distribution cert type is `DISTRIBUTION`. Codemagic JSON output is a bare
  list; parse with `python3` (jq not guaranteed on the mac runner). Keep python as
  single-line `-c` (YAML block indentation breaks multi-line/heredoc python).
- The AppStoreConnect integration exports `APP_STORE_CONNECT_ISSUER_ID/KEY_IDENTIFIER/
  PRIVATE_KEY` to the script env, so the `app-store-connect` CLI authenticates with no
  explicit creds passed.
- **Two profile directories (bit me):** `profiles create/list --save` writes to the MODERN
  Xcode dir `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`, NOT the legacy
  `~/Library/MobileDevice/Provisioning Profiles/`. A push-verification gate that only
  looked in the legacy dir saw it empty and false-failed ("MISSING aps-environment")
  even though the profile was created fine. **Always handle BOTH dirs:** rm both, mirror
  the saved profile into both, and inspect/verify across both.
- **User pivoted AWAY from regeneration, then away from name-matching too:** create/delete
  churn is gone, AND hard-coding a profile name is gone (the account had only the leftover
  "Gillie CI AppStore <ts>" profile, no "Gillie Distribution"). Current approach = "Select
  App Store profile for the bundle id": read-only `profiles list --type IOS_APP_STORE --save
  --json`, then decode each saved .mobileprovision (`security cms -D -i` + `plutil -extract
  Entitlements.application-identifier raw`) and keep the one whose App ID ends with
  ".app.dalehollowlake"; if several match, pick newest by CreationDate. Mirror into both
  dirs, use-profiles. NO blocking push gate — push status is diagnostic-only; don't
  reintroduce a hard aps-environment gate (user found it false-blocking/frustrating).
  Selecting by BUNDLE ID (not name) is robust to whatever the profile happens to be called.
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
