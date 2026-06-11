---
name: Friend suggestions privacy
description: Why /friends/suggestions returns a trimmed DTO instead of the full user payload
---

The `GET /friends/suggestions` endpoint recommends **strangers** (non-friends). It
must never reuse `formatUserWithCounts()` / the full User payload, because that
includes `currentLat`/`currentLng` (when `shareLocation=true`) and `lastSeen` —
i.e. precise live location of people you are not friends with.

**Rule:** suggestion endpoints return only identity + presentational fields:
id, username, displayName, avatarUrl, isOnline, boatType, boatName,
mutualFriendCount, reason. The OpenAPI `SuggestedUser` schema is a standalone
object (NOT `allOf: User`) so codegen can't silently re-add sensitive fields.

**Why:** code review caught a privacy leak where suggested strangers' live GPS
was returned to the client even though the UI only shows avatar/name/boat. Any
"discover people" surface (suggestions, search-by-proximity, etc.) inherits this
constraint.

**How to apply:** when adding/editing a recommendation or discovery endpoint,
build an explicit minimal projection in the route; never spread a full user row.
Dropping the per-user follow-count lookup also removed N extra queries.
