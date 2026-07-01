---
name: Public support & legal pages
description: Which dhl-app routes must be reachable without auth (App Store), and how routing enforces it.
---

# Public (no-auth) pages in dhl-app

App Store review requires the Support page and the policy pages it links to be
viewable **without signing in** (a reviewer may open the Support URL directly).

**Rule:** public pages must be registered in the TOP-LEVEL `Switch` in
`App.tsx` (the one alongside `/sign-in` / `/sign-up`), BEFORE the `GatedRoutes`
fallback. Currently public: `/support`, `/privacy-policy`, `/community-guidelines`.
Do NOT rely on the copies inside `AuthedApp` — those only render when signed in.

**Why:** `GatedRoutes` shows `LandingPage` when signed out, so any route only
defined inside `AuthedApp` is a login wall for logged-out visitors.

**How to apply:**
- Adding another publicly-linkable page (e.g. a real Terms page): put its
  `<Route>` in the top-level Switch, not in `AuthedApp`.
- Because the top-level route wins for everyone, signed-in users also get the
  standalone (non-`AppLayout`) version — that's intended/acceptable.
- Pages reachable both signed-in (from Settings) and signed-out (from Support)
  must make their back/nav target auth-aware (`useAuth().isSignedIn`), or they
  dead-end signed-out viewers at a gated route. `LegalPageShell` does this:
  back → `/settings` when signed in, `/support` when signed out.

# Misc
- A single support email is shown in both Settings and the Support page (keep them in sync); the address itself lives in the app source, not here.
- "Terms of Service" link points at the Community Guidelines page — there is no
  separate ToS document in the app.
- Production Support URL: `https://dale-hollow-nav.replit.app/support`. SPA
  deep-links resolve via vite preview's SPA fallback (same as `/sign-in`).
