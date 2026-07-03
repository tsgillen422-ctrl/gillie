---
name: iOS build number / CFBundleVersion in Codemagic
description: Why the dhl-app iOS build number kept shipping the wrong value, and the reliable way to pin it.
---

# Pinning the dhl-app iOS build number (CFBundleVersion)

The dhl-app Capacitor iOS project's `Info.plist` sets:
- `CFBundleVersion = $(CURRENT_PROJECT_VERSION)`
- `CFBundleShortVersionString = $(MARKETING_VERSION)`

Both resolve from build settings in `App.xcodeproj/project.pbxproj` (Debug + Release).

## The trap
The Codemagic "Set build number" step used `agvtool new-version -all <n>` with
`ignore_failure: true`. **agvtool requires `VERSIONING_SYSTEM = "apple-generic"`,
which this project does NOT set**, so agvtool silently no-ops. With
`ignore_failure: true` the failure was swallowed, so the build kept shipping the
old/unchanged number — uploads then failed because Apple already had that build.

**Why:** agvtool is a no-op without apple-generic versioning; ignore_failure hid it.

## The reliable fix (how to apply)
agvtool is fine ONLY if you first add `VERSIONING_SYSTEM = "apple-generic"` to both
build configs in pbxproj (now done) — then `agvtool new-version -all <n>` actually
writes. But never rely on agvtool ALONE. The CI step (runs on macOS, after
`cap:sync`, before Build IPA) layers defense in depth:
- (primary) `agvtool new-version -all <n>` + `new-marketing-version <m>`.
- `sed -i ''` the pbxproj to force `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION`.
- `PlistBuddy -c "Set :CFBundleVersion <n>"` (and `:CFBundleShortVersionString`)
  to write literals straight into the archived Info.plist.
- Then `Print` them back and hard-`exit 1` if wrong (no ignore_failure), so a bad
  number can never reach App Store Connect.
All write paths converge on the same value, so there's no double-source conflict.

To ship a build AFTER a pinned one, bump the pinned number — Apple rejects
duplicate build numbers. (Auto-increment `$((LATEST+1))` is an option but only
works if agvtool actually applies it, i.e. needs apple-generic versioning.)

## Always gate the real IPA before upload
Editing the project/Info.plist is NOT proof the binary is correct (silent CI
failures, stale commits, or Info.plist regeneration can all defeat it). Add a
final CI step **before** the `app_store_connect` publishing step that unzips
`build/ios/ipa/*.ipa`, reads `Payload/*.app/Info.plist` CFBundleVersion with
PlistBuddy, and `exit 1` if it isn't the expected number. This is the only
source-of-truth check and it stops a wrong build number from ever uploading.
**Why:** the build number "wrong" bug recurred 4x because every fix verified the
inputs, not the actual archived IPA.

## Codemagic run number is NOT the CFBundleVersion
A "Build 5 failed to upload" report usually means the *Codemagic build run* was #5
— it says nothing about CFBundleVersion, which is whatever the pin step writes.
The config can be pinned to 3 while the CI run counter shows 5. Always check the
pinned number in `codemagic.yaml` + `project.pbxproj`, not the Codemagic run #.

## The REAL recurring root cause: GitHub main lagged on build-4 code
Codemagic builds from GitHub `main`, NOT the Replit working copy. The build-number
fix kept "not working" because GitHub `main` literally still had `codemagic.yaml`
with `agvtool new-version -all 4` + a verify step expecting 4 — so every cloud build
shipped 4 no matter what was fixed locally.
**Why:** local `main` and GitHub `main` had DIVERGED (local ~37 ahead with build 5;
GitHub ~8 ahead with build-4 CI bump, the water-drop app icon + launch splash, and
`ITSAppUsesNonExemptEncryption=false` export compliance). A plain push is rejected
(non-fast-forward); a blind force-push would DROP GitHub's icon/splash/export-
compliance commits that local doesn't have.
**How to apply:** the agent CANNOT fix this — `git push`/`fetch`/`rebase`/`reset` are
all blocked in this env (even inside an assigned Project Task), and the one push that
did run failed GitHub auth ("password authentication is not supported"). Only the
user's Replit Git pane / Shell (their GitHub creds) can. Correct reconciliation =
rebase local onto the GitHub remote's main (replays build-5 commits on top of GitHub's
icon/splash/export-compliance base) and resolve the generated
`artifacts/mockup-sandbox/src/.generated/mockup-components.ts` conflict, then push —
NOT force-push. Verify the GitHub tip's `codemagic.yaml` shows build 5 afterward.

## Read the upload error's floor
App Store Connect upload failure "The provided entity includes an attribute with a
value that has already been used" + `"previousBundleVersion": "N"` means the pin
MUST be strictly greater than N (the highest build ASC already has). Bump the pin
to N+1 (or higher) everywhere: the two `CURRENT_PROJECT_VERSION` in pbxproj AND
every literal in the codemagic set/verify steps (sed, PlistBuddy Set, the `[ "$CFV"
= "N" ]` gates, step names, echo text). Info.plist needs no change — it's
`$(CURRENT_PROJECT_VERSION)`. MARKETING_VERSION stays 1.0.
