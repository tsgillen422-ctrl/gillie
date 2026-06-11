---
name: One-way follow model
description: How following works after the move from mutual friendship to directional follows, and where follower-privacy must be enforced.
---

# One-way follow model

An accepted `friend_requests` row means `followerId` follows `followeeId` — ONE direction. "Mutual" = both rows exist. There is no longer any concept of a single row meaning friendship.

- `GET /friends` returns people I follow (followees). `/:id/followers` and `/:id/following` are directional; `/:id/friends` is the mutual intersection.
- Following creates only my→target; unfollow deletes only my→target. Do NOT auto-accept an incoming row when I follow back.
- Per-user booleans (default true) govern what a NON-mutual follower (follows me, I don't follow back) may see/do: `followerSeeLocation`, `followerSeePosts`, `followerSendMessages`. Mutual = always full access.

**Why:** legacy data had one accepted row per mutual friendship. A startup backfill (`backfillReciprocalFollows.ts`, idempotent) inserts the reciprocal accepted row for every existing accepted pair so old friendships stay mutual; new follows after the change stay one-way.

**How to apply — follower-privacy must be enforced at EVERY surface, not just the obvious one:**
- Location: `GET /friends/locations` gates non-mutual followees by `followerSeeLocation`.
- Posts: `getFriendIds` in posts.ts = authors I follow where mutual OR `followerSeePosts` (blocked excluded). Name kept so canViewPost/visibilityCondition reuse it.
- Messages: BOTH `POST /messages/conversations` (1:1) AND `POST /messages/conversations/group` must apply the gate (mutual OR I-follow AND target.followerSendMessages). The group path was an IDOR bypass that let strangers be added to a group to message them — any new conversation-creation entry point needs the same per-participant check.
