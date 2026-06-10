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
