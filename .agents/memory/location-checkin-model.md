---
name: Location sharing model (Apple 5.1.2, Snapchat-style)
description: Location sharing is a one-time opt-in with a sliding 24h auto-ghost window; coords are DENY-BY-DEFAULT in serializers. How to gate every coordinate surface.
---

# Snapchat-style location sharing model

Replaced the old manual expiring check-in (1–8h, cold-launch auto-checkout) with
a **one-time opt-in + sliding 24h auto-ghost window** (user accepted the 5.1.2
risk and chose this deliberately; consent dialog + privacy policy + TERMS_VERSION
bump carry the disclosure).

## Source of truth
- `users.locationSharingExpiresAt` is still the ONLY truth for "sharing window
  active": `isActivelySharing(u)` / friends' `isSharingActive(u)` = expiry > now.
- `shareLocation` (boolean) = the user's standing opt-in intent; the web client's
  keep-alive uses it to resume the window, but **never** gate coordinate exposure
  on it alone.
- Two tiers: `isSharingActive` (window active → coords visible, avatar stays,
  Snapchat-style) vs `isLocationLive` (window active AND lastSeen <10min →
  client shows live; otherwise "Last seen Xm/h/d ago"). `/friends/locations`
  returns `isLive` per friend.

## Deny-by-default serialization (the 5.1.2 rule)
Both `formatUser` serializers (api-server users.ts and friends.ts) emit NULL
coords + null expiry unless the route passes `includeLiveLocation: true`.
Opt-in is limited to: self endpoints (/me + its mutations), the profile route
after its `canSeeLive` audience check, and GET /friends with a PER-USER gate
(`mutual || followerSeeLocation` — same rule as /friends/locations; "people I
follow" is one-way and NOT automatically the sharer's audience). Search, admin
lists, other users' followers/following/friends lists, requests, and mutes must
stay null.

**Why:** a previous pass leaked active coords through /users/search and
/friends/requests to strangers — audience gating only on the map endpoint is not
enough; the serializer itself must fail closed.

**How to apply:** any NEW route returning user objects gets no coords for free.
Only add `includeLiveLocation` after proving the viewer is the sharer's audience.
Beware point-free `.map(formatUserWithCounts)` — the array index lands in the
opts param; always wrap in an arrow.

## Lifecycle
- Opt-in: consent dialog (CheckInControl.tsx) → `POST /me/checkin` (durationHours
  clamped 1–24, default 24; requires fresh coords).
- Keep-alive: `useLocationSharingKeepAlive` in App.tsx — if `me.shareLocation`,
  heartbeat on launch/visibilitychange/4-min interval; active window → `PATCH
  /me/location` (slides expiry +24h), lapsed window → silent re-checkin 24h.
  NO cold-launch auto-checkout anymore.
- Ghost Mode: `POST /me/checkout` clears expiry + shareLocation instantly.
- `PATCH /me/location` is a no-op unless the window is active (iOS permission
  alone must never publish). It preserves `isOnWater` when `onWater` is omitted.
- Geolocation UI: the spec `timeout` doesn't tick while a permission prompt is
  unanswered — every getCurrentPosition flow needs a hard failsafe timer or the
  UI hangs on "Locating…" forever.

## Map client
- Stale friends (isLive === false) render dimmed with a "Last seen …" chip;
  the boat-group `sig` must include the stale flag or markers won't rebuild on
  the live↔stale flip.
- Demo seed users have far-future expiry → visible but isLive false ("last
  seen" label) — acceptable/intended.
