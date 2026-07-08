---
name: Lake community scoping
description: Product rule — each lake is its own community; only the Friends feed crosses lakes.
---

**Rule:** Gillie is separate per-lake communities, not one network. Every surface
(feed tabs except Friends, stories, map, events, catches, pins, check-ins,
composer) is scoped to the currently selected lake (`useLake()`), and posts are
always created for the current lake — there is deliberately NO lake picker or
"All of Gillie" option on the post screen. The ONLY cross-lake surfaces are the
Friends feed tab (omits `lakeId` in `GET /posts?audience=friends`) and Saved
posts (personal); both show a 📍 lake badge on PostCard when
`post.lakeId !== current lakeId`.

**Why:** Owner explicitly wants each lake to feel like its own community
(July 2026); mixing lakes was seen as destroying that. Friends' posts from
other lakes are the sanctioned exception, labeled with their source lake.

**How to apply:** When adding any new content surface or feed, scope it by the
current lakeId by default; never re-add a lake selector to the composer; do not
"fix" the Friends tab back to lake-filtered — cross-lake there is intentional.
Composer/community labels must use `lake.name`, never hardcoded lake names.
