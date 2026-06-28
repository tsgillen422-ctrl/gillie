---
name: Terms/EULA acceptance gate
description: How the App Store Terms of Service / EULA consent gate works and the invariants to keep when touching it.
---

# Terms / EULA acceptance gate

There are now TWO independent fail-closed acceptance gates in `AuthedApp`
(dhl-app `App.tsx`), evaluated in order: loading → error/missing `/me` → waiver
(`waiverVersion !== WAIVER_VERSION`) → terms (`termsVersion !== TERMS_VERSION`).
Only then does the app render. Terms covers ToS + Privacy Policy + Community
Guidelines under one required checkbox (`TermsGate.tsx`), mirroring `WaiverGate`.

Persistence is dual-layer (same as waiver): quick-check columns `termsAcceptedAt`
/`termsVersion` on `users`, plus an immutable history table `terms_acceptances`,
both written in one transaction by `POST /users/me/terms`.

**Why:** Apple requires an enforced EULA consent before app use; a single column
can't prove *when each version* was accepted, so keep the history table.

**How to apply:**
- To force everyone (incl. the App Store reviewer) to re-consent, bump
  `TERMS_VERSION` in `lib/legal.tsx`. Null/mismatch re-prompts automatically.
- Public legal routes (`/terms`, `/privacy-policy`, `/community-guidelines`,
  `/support`) MUST stay registered ABOVE the gated fallback in
  `ClerkProviderWithRoutes`, or a gated/signed-in user can't open them from the
  gate (the fallback would swallow the path and re-show the gate).
- Reviewer-facing behavior depends on the LIVE web bundle (iOS is a webview of
  the prod URL) — republish prod before submission or the gate won't appear.
- When adding new per-user acceptance/legal tables, also delete them in
  `deleteUserAndData` to avoid orphaned rows.
