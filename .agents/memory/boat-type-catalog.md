---
name: Boat type catalog
description: Shared boat-config package rules and the stored-value vs label naming decision
---

# Boat type catalog

The 14 boat types (labels, descriptions, SVG artwork, allowlist) live in the shared
`@workspace/boat-config` package — the single source of truth for the web app,
mobile app, and API-server validation. To add a boat type, edit only that package.

**Stored values ≠ labels.** `speedboat` renders as "Performance Boat" and
`fishing` renders as "Bass Boat". The stored values were intentionally kept when
the labels were renamed so existing users' saved boats keep working (no DB
migration).

**Why:** users' `boat_type` column and demo seed data reference the old value
strings; renaming values would orphan them or require a migration.

**How to apply:**
- Never rename an existing `value` in BOAT_TYPES — change only the `label`.
- Any UI that displays a boat type name must use `boatLabelFor()` (never
  `prettify(value)` or a hardcoded map — both regress to old/wrong names).
- Server validation derives from `BOAT_TYPE_VALUES`; don't hand-write allowlists
  (a hand-written one previously omitted `fishing`, silently breaking saves).
- Demo seed data (`demoData.ts`) must use canonical values from the catalog.
