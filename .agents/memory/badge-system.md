---
name: Badge system (single source of truth)
description: Where badge definitions/thresholds live and how the client consumes them
---

Badges are **server-authoritative**. `computeBadges(userId)` in `artifacts/api-server/src/routes/users.ts` is the ONE place that defines the badge catalog (key, label, description) and earning thresholds, computed live from real DB counts on every read. It returns the FULL catalog with an `earned` flag (earned + locked), not just earned keys.

**Why:** there were previously 3 overlapping badge systems with inconsistent thresholds (server string[] badges, client persona pills, client achievements grid) — e.g. "Angler" meant 10 catches on the server, 1 in persona pills, 5 in the achievement. Users could see the same concept at different thresholds.

**How to apply:**
- Add/change a badge or threshold ONLY in `computeBadges`. Never reintroduce client-side earning/threshold logic.
- API contract: `User.badges` is `Badge[]` ({key,label,description,earned}) in `lib/api-spec/openapi.yaml`. After editing the spec run `pnpm --filter @workspace/api-spec run codegen`.
- Client is presentation-only: `artifacts/dhl-app/src/components/Badges.tsx` maps key→{Icon,pill} via `badgeMeta(key)` (with a fallback for unknown keys). `BadgeRow` renders earned badges as pills; `profile.tsx` achievements grid renders earned/locked straight from `user.badges`.
- Badges are computed-on-read, never stored (no badges DB column) — always reflect current activity.
