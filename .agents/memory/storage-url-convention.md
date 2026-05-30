---
name: Storage URL convention (dhl-app)
description: How object-storage paths must be rendered in the dhl-app frontend, and the avatar gotcha.
---

# Object-storage URL convention

Object storage in api-server is served under the `/api` router at `/storage/objects/*`,
so a stored object path like `/objects/uploads/<id>` only resolves in the browser when
prefixed: `/api/storage/objects/uploads/<id>`. Requesting the raw `/objects/...` path 404s.

**Convention across the app:** the DB/API stores the *raw* object path (e.g. `/objects/uploads/<id>`),
and each render site prepends `/api/storage` (feed/profile/map/settings all do `` `/api/storage${url}` ``).
When uploading via `useUpload().uploadFile(...)`, store the returned `objectPath` raw if it will be
re-prefixed at render, OR store it already-prefixed — be consistent with how that field is rendered.

**Why:** there is no route at bare `/objects/...`; only `/api/storage/objects/...` exists.

**Gotcha (was a real bug):** `UserAvatar` originally rendered `avatarUrl` directly without the prefix,
so every avatar 404'd app-wide. It now normalizes via a `resolveAvatarUrl` helper that prefixes
`/objects/` and `/public-objects/` paths and leaves http/data/blob/already-`/api/storage` URLs alone.
**How to apply:** when adding new media rendering, never render a raw `/objects/...` path directly —
prefix with `/api/storage` or route it through a helper like `UserAvatar`'s `resolveAvatarUrl`.
