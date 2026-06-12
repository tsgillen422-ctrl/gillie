---
name: Demo seed images are served by the web app, not the API
description: Why seed catch/post photos can show blank on mobile and in production
---

Demo data in `artifacts/api-server/src/lib/demoData.ts` builds image URLs via
`SEED(name) => /dhl-app/seed/<name>` — these files live in
`artifacts/dhl-app/public/seed/` and are served by the WEB app, NOT the API server.

On mobile, `resolveAssetUrl` prefixes the API base (`EXPO_PUBLIC_DOMAIN`). In the
Replit dev environment that base is the shared proxy domain, so `/dhl-app/seed/...`
path-routes to the web app and the images load — but ONLY while the dhl-app
workflow is running. In production the API and web app are separate deployments
with different domains, so these seed image URLs 404.

**How to apply:** Treat broken seed images as expected for demo data, not a mobile
bug. User-uploaded catch/post images use object storage (`/objects/`,
`/api/storage`) which `resolveAssetUrl` handles correctly. Always give remote
`<Image>`s a graceful placeholder (muted bg + icon) so a 404 looks intentional,
never a stark white box.
