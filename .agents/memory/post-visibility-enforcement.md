---
name: Post visibility enforcement
description: Where per-post audience (community vs friends-only) is and isn't enforced.
---

Posts have a `visibility` column: `community` (everyone) or `friends` (author + accepted friends only).

**Rule:** any route that reads or acts on a single post by id must gate on audience, not just the feed list. Use `canViewPost(uid, post)` in `artifacts/api-server/src/routes/posts.ts`.

**Why:** visibility was added with the poll feature. The feed list (`GET /`) and direct fetch (`GET /:postId`) and the poll-vote route are guarded, but **save/unsave, share/repost, comments, likes/rsvps list** routes were NOT updated and can leak or act on friends-only posts via a known post id (IDOR). Left out deliberately to stay in task scope.

**How to apply:** if you touch those interaction routes, add `if (!(await canViewPost(uid, post))) return res.status(404)...` after the post lookup.
