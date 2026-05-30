---
name: Follower / following counts
description: Why follower counts must be computed dynamically, not read from the users table
---

The `users` table declares `followerCount` and `followingCount` as `serial`
(auto-increment) columns — a schema mistake. Their values are meaningless.

**Rule:** Never return those columns. Compute counts from the `friend_requests`
table where `status = 'accepted'`:
- followers = rows where `followeeId = user.id`
- following = rows where `followerId = user.id`

**How to apply:** Any endpoint that serializes a user (api-server users.ts,
friends.ts) should spread real counts (e.g. via a `getFollowCounts()` /
`formatUserWithCounts()` helper). Some serializers still hardcode
`followerCount: 0` (e.g. messages.ts formatUser) — fine for contexts where the
count isn't shown, but switch to the helper if a count surfaces in the UI there.
