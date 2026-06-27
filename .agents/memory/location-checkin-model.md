---
name: Location check-in model (Apple 5.1.2)
description: Location sharing is a manual, expiring check-in — not a persistent boolean. How to gate every coordinate-exposing surface.
---

# Manual check-in location model

Apple Guideline 5.1.2 forbade automatic/persistent location sharing. The app now
uses a **manual, per-session, auto-expiring check-in**, not a standing toggle.

## Source of truth
- `users.locationSharingExpiresAt` (timestamp, nullable) is the ONLY truth for
  "am I sharing." Active iff `expiresAt != null && expiresAt > now()`.
- `shareLocation` (boolean) is legacy/kept-in-sync only. **Never** gate coordinate
  exposure on `shareLocation` alone — it does NOT mean actively sharing.
- Server helper `isActivelySharing(u)` (api-server users.ts) is the canonical check.
- formatUser exposes `isSharingLocation` (boolean) + `locationSharingExpiresAt`
  and only includes currentLat/Lng when actively sharing.

**Why:** iOS location permission being granted must NOT cause publishing; only an
explicit in-app check-in may. Any surface that leaks coords while not actively
checked in is a 5.1.2 regression.

**How to apply:** EVERY surface that returns another user's coordinates (friends
`/locations`, formatUser, posts on-water summary, any future map/presence feed)
must gate on the active-expiry check, and the client must gate "me" rendering on
`me.isSharingLocation` (the map watch effect, me-marker, crew-marker self-include).

## Lifecycle
- `POST /users/me/checkin {lat,lng,onWater,durationHours?}` sets expiry = now +
  clamped hours (default 6, max 8). `POST /users/me/checkout` clears expiry +
  shareLocation + isOnline + isOnWater.
- `PATCH /users/me/location` is a NO-OP unless actively sharing.
- `PATCH /users/me` no longer honors `shareLocation`.
- Cold-launch: App root (AuthedApp) fires checkout ONCE on first `/me` load if
  still `isSharingLocation`, so sharing never persists across an app relaunch.
- Demo seed users get a far-future `locationSharingExpiresAt` so demo boats still
  appear under the new model.

## UI
- `components/CheckInControl.tsx` (variant "card" for Settings, "compact" for the
  map overlay) is the single confirm-dialog + status + Check In/Stop control. It
  grabs a GPS fix via `getCurrentPosition` before calling checkin.
