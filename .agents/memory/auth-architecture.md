---
name: Auth architecture (Clerk)
description: How real auth works in this app and the build/security gotchas around it.
---

# Clerk auth in the DHL app

Auth is Replit-managed Clerk. The web app (dhl-app) uses **cookie-based, same-origin** sessions — NOT Bearer tokens. This works because `/api` shares the browser origin with the frontend via path-based routing, so the Clerk session cookie is automatically sent on every `/api` request (and on the `/api/ws` upgrade). Do not add a Bearer/token getter on the web client.

**Why:** mixing in Bearer logic is redundant and breaks the cookie flow assumptions; the proxy + path routing already make cookies first-class.

## Backend specifics
- Local app rows key off integer `users.id`. `users.clerk_id` (unique, nullable) bridges Clerk → local user. `requireAuth` JIT-provisions a local row the first time a Clerk user is seen (`provisionLocalUser`, exported from middlewares/auth.ts and reused by the WS path). Pre-existing seed users have NULL clerk_id and are unaffected.
- WebSocket upgrades MUST validate `Origin === Host` (cookies are auto-sent, so without it you have a cross-site WebSocket hijacking hole) and reject unauthenticated upgrades early.

## Passkeys / biometric (Face ID) — NOT available
- The Replit-managed Clerk tenant has passkeys **disabled** (`user_settings.attributes.passkey.enabled = false` in the FAPI `/v1/environment`) and there is **no way to enable them**: no Clerk dashboard access, the Auth pane only covers login providers/OAuth/consent, and the Backend API `PATCH /v1/instance` silently ignores a `passkey_settings` field (returns 204 but the flag stays false; `/v1/instance/passkey_settings` is 404).
- **Therefore web biometric/Face ID/Touch ID quick login is not deliverable** here — it relies on WebAuthn passkeys, which need that tenant switch.
- **Stay signed in** already works by default: Clerk web sessions are persistent (httpOnly cookie + refresh), so users stay logged in across browser restarts until they explicitly sign out. No "remember me" toggle exists in the prebuilt component, and none is needed.
- To inspect tenant auth config: decode the FAPI domain from the publishable key (`Buffer.from(pk.split('_')[2],'base64')`, strip trailing `$`) and GET `https://<domain>/v1/environment?__clerk_api_version=...`. Run from the shell (secrets are env vars there); the code_execution sandbox masks secret values.

## Build gotcha (bit us once)
- api-server builds/runs via **esbuild bundle (build.mjs → dist/index.mjs), with NO tsc typecheck gate**. So TypeScript errors do NOT block the server and will NOT catch runtime bugs.
- **How to apply:** never rely on type errors to surface bugs here. A scripted find/replace (e.g. `SESSION_USER_ID` → `currentUserId(req)`) silently introduced a `ReferenceError: req is not defined` inside a helper with no `req` param, which only a code review / e2e test caught. After bulk edits, review helper signatures and run the e2e/testing skill.
