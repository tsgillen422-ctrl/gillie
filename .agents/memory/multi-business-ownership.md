---
name: Multi-business ownership
description: One account can own up to 10 business profiles; legacy /me endpoints target the OLDEST; posting-as selection rules.
---
business_profiles.user_id is NO LONGER unique — one account can own several businesses (cap MAX_BUSINESSES_PER_USER=10 in businesses.ts).

**Rules:**
- Canonical API: `GET /businesses/mine` (all owned, ordered by createdAt), `POST /businesses` (create, status pending), `PUT/DELETE /businesses/:businessId` (owner-checked, 404 on non-owner). Legacy `/businesses/me` GET/PUT/DELETE and `/me/posts` still exist and operate on the OLDEST business — don't repurpose them.
- `POST /posts` with `asBusiness`/business-only types accepts optional `businessId`; server verifies owned + approved, else falls back to oldest approved. Never trust the client's businessId without the ownership check.
- `users.isBusiness` is set on create and cleared ONLY when the last business is removed (shared `removeBusiness()` helper handles child cleanup + post detach).
- Frontend: `/my-businesses` page lists owned businesses; wizard at `/businesses/me/edit` resolves target from `?new=1` / `?id=N` / oldest, and MUST reset form state when that target changes in-place (loadedFor latch) — a simple loaded bool caused stale-form-wrong-target risk.
- Feed composer: "Posting as" Select appears only when >1 approved businesses and a business post type is chosen; compose deep-link supports `&businessId=N`.

**Why:** User runs multiple lake businesses (marina + campground + rentals) on one account instead of juggling logins.
**How to apply:** Any new surface that assumes "the user's business" (singular) must use getMyBusinesses and either take an explicit businessId or default to oldest; admin approval stays per-business.
