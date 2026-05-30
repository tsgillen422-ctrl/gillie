---
name: Post/pin deletion needs manual cleanup
description: No FK onDelete cascade in the DB schema; deleting a post or pin requires manually deleting child rows first.
---

The `references()` foreign keys in `lib/db/src/schema` (posts, pins, etc.) have NO `onDelete: "cascade"`. Deleting a row that has children throws a Postgres FK violation (500).

**Why:** Any deletion path (user delete routes, moderation "remove" action, future cleanup jobs) must delete child rows before the parent, or it will fail at runtime on real content that has likes/comments/rsvps.

**How to apply:** Before `db.delete(postsTable)` for a post id, also delete from: `post_likes`, `post_comments`, `event_rsvps`, `saved_posts`. Note `comment_likes` is a grandchild (references `post_comments`), so deleting a post must remove `comment_likes` for that post's comments BEFORE deleting the comments; deleting a single comment must remove its `comment_likes` first. Before `db.delete(pinsTable)` for a pin id, also delete from: `pin_likes`, `pin_favorites`. The pin and post delete routes both now do this cleanup AND enforce an owner check (403 if `userId !== SESSION_USER_ID`). `sharedPostId` has no FK constraint, so reposts of a deleted post are intentionally left orphaned (feed renders them as "no longer available").
