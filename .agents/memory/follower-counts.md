---
name: Follower / following counts
description: Why follower counts must be computed dynamically, not read from the users table
---

The `users` table declares `followerCount` and `followingCount` as `serial`
(auto-increment) columns — a schema mistake. Their values are meaningless.

**Rule:** Never return those columns. Compute counts from the `friend_requests`
table where `status = 'accepted'`.

**Friendships are MUTUAL (Facebook-style), read-time symmetric.** An accepted
`friend_request` row is one-directional in storage (followerId, followeeId) but
must be interpreted as a two-way friendship. So followers, following, AND friends
of a user all resolve to the SAME set: the distinct other-party IDs of every
accepted row where the user is on either side. Helper `getAcceptedConnectionIds`
(friends.ts) does this (dedupe via Set, drop self, filter requester blocks); the
`/:userId/followers`, `/:userId/following`, `/:userId/friends` endpoints all use
it. `getFollowCounts` returns the distinct-friend count for BOTH followerCount and
followingCount.
**Why:** chosen read-time (no reciprocal-row migration) so prod self-heals on
redeploy — the agent cannot write the prod DB. Without this, people you follow
showed only under Following, never Followers ("friends aren't popping up as
followers").

**Two copies of `getFollowCounts` exist** — `friends.ts` AND `users.ts` — keep
them identical or profile stat cards drift.

**How to apply:** Any endpoint that serializes a user should spread real counts
(via `getFollowCounts()` / `formatUserWithCounts()`). Some serializers hardcode
`followerCount: 0` (e.g. messages.ts) — fine where the count isn't shown, but
switch to the helper if a count surfaces there.
