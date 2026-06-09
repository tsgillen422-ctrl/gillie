---
name: Profile interests
description: How profile interests are sourced and where the catalog lives
---

Profile interests are **user-selected**, not activity-derived. Users pick them in Settings; they persist in the `users.interests` text[] column and render on the profile.

**Why:** Originally interests were inferred from activity (catches→fishing, boatName→boating, campsite pins→camping, gallery→photography). That was intentionally replaced with an explicit user choice so people control what shows.

**How to apply:**
- Do NOT reintroduce activity-based derivation; read `user.interests`.
- The selectable catalog is shared at `artifacts/dhl-app/src/lib/interests.ts` (`INTEREST_DEFS`, `INTEREST_MAP`) — used by both Settings (picker) and Profile (display). Add new interests here.
- The server keeps its own allowlist `VALID_INTERESTS` in `artifacts/api-server/src/routes/users.ts` (PATCH /me rejects unknown keys). Keep it in sync with the client catalog keys when adding interests.
- Profile hides the Interests section entirely when the list is empty.
