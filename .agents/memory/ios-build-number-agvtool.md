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
Do NOT rely on agvtool. In the CI step (runs on macOS, after `cap:sync`, before
Build IPA):
- `sed -i ''` the pbxproj to force `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION`.
- `PlistBuddy -c "Set :CFBundleVersion <n>"` (and `:CFBundleShortVersionString`)
  to write literals straight into the archived Info.plist.
- Then `Print` them back and hard-`exit 1` if wrong (no ignore_failure), so a bad
  number can never reach App Store Connect.

To ship a build AFTER a pinned one, bump the pinned number — Apple rejects
duplicate build numbers. (Auto-increment `$((LATEST+1))` is an option but only
works if agvtool actually applies it, i.e. needs apple-generic versioning.)
