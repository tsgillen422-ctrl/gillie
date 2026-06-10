---
name: Two separate "mute" systems
description: DHL/Gillie has two unrelated mute features that are easy to confuse
---

There are TWO distinct, unrelated "mute" concepts in this app:

1. **Feed mute (mute a user)** — `useMuteUser`/`useUnmuteUser`, backed by the `ns`
   table (schema type `Mute`, routes `/friends/:userId/n`). This hides that user's
   POSTS from your feed. It has nothing to do with messaging.

2. **Conversation mute (mute notifications)** — per-participant
   `conversation_participants.muted` flag, toggled via
   `POST /messages/conversations/:id/mute`. This silences message NOTIFICATIONS for
   that one conversation for the current user only.

**Why:** both surface as "mute" in the UI but live in completely separate tables and
routes. Reaching for `useMuteUser` to mute a conversation (or vice versa) is wrong.

**How to apply:** notification suppression for conversation mute is enforced in the
message SEND path — the recipients query in messages.ts filters `muted = false`. If
you add new message-notification channels, replicate that filter or mute will leak.
