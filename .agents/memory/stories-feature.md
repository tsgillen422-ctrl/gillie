---
name: Today on the Lake stories
description: Privacy + integration rules for the 24h stories feature (api-server stories routes, dhl-app stories components, map rings/LIVE badges)
---

- Stories reuse the posts follow-model audience (mutual OR author.followerSeePosts) and must exclude blocked/muted/hidden-demo authors at EVERY surface — including the single-story view-tracking endpoint (use the shared `canViewerAccessStory` helper in the stories routes, not ad-hoc checks).
- **Notifications are a privacy surface**: story notifications must be audience-filtered per recipient (mutuals-only for friends stories unless followerSeePosts; never to users who muted the author) — otherwise ineligible followers learn about private stories and their placeName. Throttle is 6h per author via recent `type="story"` notification lookup.
- "LIVE" on a boat = has active story AND isLocationLive; map boat-marker rebuild is driven by the group `sig` string, so any per-member visual state (like hasActiveStory) must be encoded into sig or markers go stale.
- Story-place ring markers are a pooled-by-placeName Marker map keyed off `useGetStoryPlaces`; place names are user data — build labels with `textContent`, never innerHTML.
- **Why:** first architect review failed on exactly these gaps (view-endpoint authz, notification leak); the pattern generalizes to any new per-item social feature.
- **How to apply:** when adding any story/post-adjacent surface (reactions, replies, shares), run the same checklist: list endpoints + single-item endpoints + notifications + map/feed aggregations all gated identically.
