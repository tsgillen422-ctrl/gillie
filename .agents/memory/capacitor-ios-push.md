---
name: Capacitor iOS APNs push requirements
description: Non-obvious native-side config needed for @capacitor/push-notifications to work on iOS
---

`@capacitor/push-notifications` (JS) alone is NOT enough for APNs on iOS. The native
Xcode project must also be wired up by hand — `cap sync` does not do this:

1. **AppDelegate forwarding.** `AppDelegate.swift` must implement
   `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)` and
   `application(_:didFailToRegisterForRemoteNotificationsWithError:)`, posting to
   `NotificationCenter.default` with `.capacitorDidRegisterForRemoteNotifications` /
   `.capacitorDidFailToRegisterForRemoteNotifications`. Without these, the JS
   `registration` / `registrationError` listeners never fire and `register()` hangs.
   These Notification.Name constants ship with the Capacitor iOS framework.

2. **Push entitlement.** Need an `.entitlements` file with `aps-environment`, and
   `CODE_SIGN_ENTITLEMENTS` set in the target build config in `project.pbxproj`.
   **Split by configuration**: Debug → `aps-environment=development`, Release →
   `aps-environment=production`. A single hardcoded `development` entitlement used by
   both will fail production/TestFlight push delivery and can break signing.

3. **App ID + provisioning profile must carry the Push capability.** Having
   `aps-environment` in the entitlements is not enough — the App Store archive will fail
   with `xcodebuild` exit 65:
   `Provisioning profile "..." doesn't include the Push Notifications capability` /
   `doesn't include the aps-environment entitlement`. Fix is PORTAL-side, not code:
   (a) developer.apple.com → Identifiers → `app.dalehollowlake` → enable **Push
   Notifications** → Save; (b) regenerate the App Store profile (delete the stale one so
   Codemagic's automatic App Store Connect signing recreates a fresh profile that now
   includes Push). A profile created before Push was enabled on the App ID can never
   include the entitlement — it must be regenerated. The web app genuinely uses native
   push (`src/lib/native-push.ts` calls PushNotifications.register on native), so DON'T
   strip the entitlement to make it build — grant the capability instead.

**Why:** these are App-Store / APNs platform requirements outside the JS bundle, so
they're invisible from the web/TS code and easy to miss when push "looks" wired up.
**How to apply:** any time native iOS push is added to a Capacitor app, verify all
four (AppDelegate hooks, entitlements file, per-config CODE_SIGN_ENTITLEMENTS, and the
App ID/profile actually carrying the Push capability).
