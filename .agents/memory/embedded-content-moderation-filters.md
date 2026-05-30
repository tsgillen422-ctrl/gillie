---
name: Embedded content must re-apply moderation filters
description: Nested/embedded content (reposts, quoted posts, previews) must re-run the same mute/block/visibility filters as top-level rows, or filters leak.
---

The feed's `GET /posts` mute filter only excludes rows where the **top-level** `posts.userId` is muted. Embedded content (the `sharedPost` a repost points at) bypasses that WHERE clause because it's fetched separately inside `formatPost`.

**Why:** A repost authored by an unmuted user can embed an original authored by a *muted* user, making muted content reappear. The same trap applies to any future embed/quote/preview feature and to block lists, not just mutes.

**How to apply:** When `formatPost` (or any formatter) embeds another entity, re-check the viewer's mute/block status against the embedded author before including it; drop it (set to null) if filtered. Do not assume the parent query's filter covers nested fetches.
