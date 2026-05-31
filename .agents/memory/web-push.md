---
name: Web push notifications
description: Design constraints for the web-push feature (VAPID, subscription ownership, decoupling)
---

# Web push notifications

Server uses `web-push` with VAPID keys stored as shared env vars
(`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`). Notification
events flow through the `notify` helper, which both inserts a notification row
and fires a push.

## Subscription endpoint ownership (security)
The `push_subscriptions` table has a globally-unique `endpoint`. A subscribe
upsert that blindly rebinds `user_id` on conflict lets any authenticated user
re-route another browser's endpoint to themselves (delivery hijack / DoS).
**Rule:** before upserting, reject (409) if an existing row for that endpoint
belongs to a different user. Same-user re-subscribe (refresh) must still update.
**Why:** an attacker who learns a victim's endpoint could otherwise reassign it.

## Push must be best-effort, never block the domain action
Notification creation is called from friend/SOS/report flows. Wrap the push
dispatch in try/catch (the `safePush` helper) so a push/DB failure logs a
warning but never fails the originating request — those flows previously only
inserted a notification row.

## Readiness gating
`GET /push/vapid-public-key` must gate on full config (`isPushConfigured()` =
public+private+subject present), not just the public key. Otherwise clients can
subscribe while the server can't actually send.

## iOS caveat
iOS web push only works when the site is installed as a PWA; the Replit dev
preview is an iframe (permission may be blocked). Test on the published
top-level `.replit.app` domain installed to the home screen.
