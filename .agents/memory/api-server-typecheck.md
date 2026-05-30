---
name: api-server typecheck noise
description: Why `tsc --noEmit` on artifacts/api-server reports many errors that are not regressions
---

Running `tsc --noEmit` on `artifacts/api-server` reports many `TS7030: Not all code paths return a value` errors across nearly every route file (messages, pins, posts, search, users, friends, ...).

**Why:** Express handlers use the `if (!x) return res.json(...)` ... `res.json(...)` pattern (last statement has no `return`). This is the project-wide style and is pre-existing, not caused by new edits.

**How to apply:** The API server runs via `tsx` (dev) which does NOT typecheck, so these errors never block the server. Don't treat TS7030 from api-server as a regression or try to "fix" them wholesale. To validate real type issues, focus on errors other than TS7030, or check the specific lines you changed.
