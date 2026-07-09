---
name: Feed audience tab semantics
description: How GET /posts audience=friends|community filters relate to the viewer's own posts
---

Rule: `GET /posts?audience=friends` must include the viewer's own posts (`inArray(userId, [...friendIds, uid])`); `audience=community` intentionally excludes self + friends ("others on the lake").

**Why:** Filtering the friends tab to `friendIds` only made a user's own friends-visibility posts/reposts invisible to their creator — "Share with friends" appeared to silently fail in e2e even though the POST returned 201.

**How to apply:** Any new audience/tab filter on posts (or stories/catches) must decide explicitly whether self is included; friends-style tabs include self, community/discover-style tabs exclude self.
