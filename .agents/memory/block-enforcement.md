---
name: Block enforcement surfaces
description: Every surface where a block between two users must be enforced, and the read-time-filter policy for group threads.
---

Blocks (blocksTable) are symmetric for enforcement: if EITHER user blocked the other, they must not reach each other. Helper `isBlockedBetween(a,b)` (messages.ts) and directional-id exclusion (`getDirectionalIds`/`getBlockedUserIds` in friends.ts) implement this.

**Rule:** any NEW interaction surface that lets user X reach user Y must gate on the block relationship. Blocks take effect immediately (no logout) because every read filters live.

**Where it's enforced (keep this list whole when adding features):**
- Friends/followers/following/mutual/suggestions, `/friends/locations`, user search — excluded via directional-id filtering.
- `/friends/:userId/follow` — 403 if blocked either direction.
- Posts feed + GET /:id + every post interaction (save/react/poll vote/rsvp/comment/comment react) — via `canViewPost`.
- Messaging 1:1: `POST /messages/conversations` (create) AND `POST /messages/conversations/:id` (send) — hard 403.
- Group threads: do NOT hard-block sends (that punishes unrelated members). Instead FILTER at read time — `getBlockedIdsFor(viewer)` hides blocked senders' messages in `GET /conversations/:id` and the conversation-list last-message preview. So a blocked pair simply never sees each other's messages while the group still works for everyone else.
- Message reactions `POST /messages/:messageId/react` — 403 if blocked vs the message sender.

**Why the group split:** Apple 5.1.2 requires blocked users can't interact, but hard-blocking a group send when one member is blocked breaks the group for the sender + all other members. Read-time filtering satisfies "can't interact with each other" without collateral damage.

**Block op itself** (`POST /friends/:userId/block`): transactionally deletes friend_requests both directions THEN inserts the block. No FK cascade exists, so the delete is manual.

**Confirmation dialog copy (Apple-reviewed, keep exact) on profile + feed post menu:** "Blocked users will no longer be able to view your location or interact with you. You can unblock them later from Settings."

Verified end-to-end with a two-account test: messaging works pre-block, then post-block gives 403 on send/create/follow and removes the user from friends/locations/search both directions.
- Business surfaces (profiles/follow/reviews/business posts tab + followed-business feed inclusion) are block-gated via isBlockedBetween in businesses.ts and a block filter in getFollowedBusinessOwnerIds; any NEW business-discovery surface must reuse these.
