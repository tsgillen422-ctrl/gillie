---
name: showBoat privacy model
description: How the showBoat toggle hides boat details — what's redacted server-side vs. what must stay public for the map.
---

# showBoat privacy model

Rule: when a user sets `showBoat=false`, boat *showcase* details (boatBrand, boatModel, boatYear, boatPhotoUrl, homeMarina) are redacted **server-side** for non-self viewers (users.ts formatUser `redactHiddenBoat` opt on GET /users/:userId; friends.ts formatUser nulls boatPhotoUrl). boatName/boatColor/boatType stay visible.

**Why:** the map's boat markers depend on boatName/color/type — nulling them would break check-in rendering for everyone. Client-only hiding was rejected as an IDOR-style leak (same lesson as post-visibility-enforcement).

**How to apply:** any new endpoint or serializer that surfaces boat showcase fields for *other* users must apply the same redaction; self responses (/me, PATCH /me) must NOT redact or the vessel settings form loses saved values while the toggle is off. Client boat cards/thumbnails gate on `showBoat !== false && (boatName || boatPhotoUrl)` (boatType is NOT NULL default "speedboat", so never gate on it alone).
