---
name: Storage URL persistence convention
description: Uploaded media paths must be persisted with the /api/storage prefix, not raw objectPath
---

The rule: whenever a post/comment/anything persists an uploaded file reference,
store `/api/storage${res.objectPath}` — never the raw `objectPath` from
useUpload. resolveImageSrc passes non-seed URLs through untouched, so a raw
objectPath renders as a broken URL after save.

**Why:** the feed redesign's new comment composer briefly persisted raw
objectPath; previews looked fine (preview code adds the prefix ad hoc) but
saved comments would have rendered broken images.

**How to apply:** any new upload flow (composer, comments, profile, catches)
must prefix at submit time, matching the post-composer convention. Preview
`<img src>` uses the same `/api/storage${path}` form.
