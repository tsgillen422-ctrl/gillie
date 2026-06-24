---
name: Clerk prod white screen / dev_browser 401 loop
description: Published app shows a white screen while deployment logs flood /api/__clerk/v1/client 401 and POST dev_browser — what it means and the fix.
---

# Clerk prod white screen

Symptom: published app is a white screen; dev preview is fine. Production deployment
logs show a flood of `GET /api/__clerk/v1/client` → 401 plus `POST /api/__clerk/v1/dev_browser`
and session-token refreshes returning 401. ClerkProvider never initializes, so the
`<Show>`-gated landing page renders nothing.

**Key tell:** `dev_browser` calls in *production* mean the prod bundle is running with
Clerk **test** keys (the live `pk_live` swap didn't take), so the dev handshake 401-loops
against the real domain.

**Why it's not a code bug:** verify first — App.tsx uses
`publishableKeyFromHost(window.location.hostname, VITE_CLERK_PUBLISHABLE_KEY)` and an
unconditional `proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}`, and
`clerkProxyMiddleware.ts` is byte-identical to the skill template. When those are canonical,
there is nothing to edit.

**Fix:** do NOT hand-edit Clerk secrets. Per clerk-auth skill: bump `@clerk/*` to latest
allowed (minimumReleaseAge), confirm the dev preview still renders, then **re-publish**. The
fresh build re-runs the live-key swap and clears the bad publish.

## "Development mode" badge is a dev-keys indicator, not a banner to delete
Clerk renders a small "Development mode" pill at the bottom of its `<SignIn>/<SignUp>`
card **only when loaded with development keys** (the Replit dev preview). It is NOT the
Replit `vite-plugin-dev-banner` and it does NOT appear in the published prod build (prod
keys) — which is what the iOS Capacitor wrapper loads via `server.url`. **Do not chase it
with fragile `.cl-badge` CSS** (Clerk warns these structural selectors break on updates);
just confirm it's absent on the live/published site. The separate Replit "Development mode"
banner is the vite dev-banner plugin in `vite.config.ts`.
