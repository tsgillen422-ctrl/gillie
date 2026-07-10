---
name: Business posting model
description: Businesses post via the shared feed composer, not a separate flow; badge + Local tab rules.
---
Businesses use the SAME feed composer as users — there is no separate business composer UI (the old dialog on the business detail page was removed; owner CTA deep-links to `/feed?compose=1&type=announcement`).

**Rules:**
- Business-only post types: announcement, event, deal, new_arrival, check_in. UI uses `biz_event` as the select value and maps it to API `event`.
- Client sends `asBusiness: true`; server requires an approved business for `asBusiness` or business-only types (403 otherwise), sets `businessId`, and FORCES `community` visibility.
- Local tab (`GET /posts?type=business`) matches legacy `postType='business'` OR `businessId IS NOT NULL` — it mixes official business posts with community posts about businesses.
- Business posts show a small badge (Deal / Event / New Arrival / Check-In / default "Official Business"); no Sponsored badge — there is no boost system.
- `/businesses/:id/posts` create endpoint still exists (used by e2e) but has no UI; don't resurrect a separate composer.

**Why:** User explicitly asked to simplify — one composer, posts auto-appear in community feed + Local tab + business profile.
**How to apply:** Any new business post type must be added to the openapi enum (3 spots), posts.ts allowlist, feed.tsx composer map, and both badge renderers (PostCard + BusinessPostCard).
