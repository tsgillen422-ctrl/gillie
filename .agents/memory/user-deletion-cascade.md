---
name: User deletion cascade policy
description: How admin "delete user" must cascade, and the shared-conversation rule that must not be violated.
---

# Admin user-deletion cascade

There are no DB-level `ON DELETE CASCADE` constraints, so deleting a user requires manually deleting every referencing row, children before parents, inside a transaction. The endpoint is admin-only and guarded against deleting yourself or another admin.

## The non-obvious rule: never destroy shared conversations
**Rule:** When deleting a user, only remove *their own* data: delete messages where `senderId = user`, delete their `conversation_participants` rows, then delete a conversation **only if it has zero participants left** (and clean its leftover messages). Do NOT bulk-delete every message/conversation the user was ever in.

**Why:** A first cut deleted all messages + participants + conversations for every thread the user belonged to, which wiped out *other* users' messages and threads — collateral data loss flagged in code review.

**How to apply:** Any future change to user/account deletion (or GDPR-style "delete my data") must preserve other participants' content. Same principle applies to any other shared/many-to-many resource: delete the user's slice, only remove the shared parent when it becomes orphaned.

## Self-delete uses /me, not the admin endpoint
For a user deleting their OWN account, use `useDeleteCurrentUser()` (void args, hits `/api/users/me`). `useDeleteUser({ userId })` is the admin-style `/api/users/{id}` operation and is the wrong choice on a settings/self screen.
**Why:** they share a name shape but target different routes/authorization; using the admin one on a self screen can fail for normal users.

## Coverage reminder
Cascade must hit every table FK-referencing users/posts/pins (likes, comments, comment_likes, event_rsvps, saved_posts, pins + pin_likes/pin_favorites, catches, gallery, friend_requests, blocks, mutes, notifications, reports.reporterId + user-target reports, push_subscriptions, native_push_tokens, messages/participants/conversations). If a new table referencing any of these is added, extend the cascade or deletion will throw on the FK.
