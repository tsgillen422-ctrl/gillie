---
name: App-blocking gates must fail closed
description: Why AuthedApp gates (waiver, onboarding, suspension) must not render the app when /me is unavailable
---

Any gate in `dhl-app` `App.tsx` `AuthedApp` that blocks access until a condition is met (liability waiver, future onboarding/suspension checks) must **fail closed**: render a loading/error/blocking state and NEVER fall through to `AppLayout`/routes when `useGetMe()` is loading, errored, or returns no `me`.

**Why:** A first cut used `if (me && me.waiverVersion !== WAIVER_VERSION) return <WaiverGate/>` then rendered the app. When `/users/me` errored, `me` was undefined so the gate was skipped and the whole app rendered — a bypass of a mandatory liability waiver. Architect flagged it as blocking.

**How to apply:** Order the checks: `isLoading` → loader; `isError || !me` → blocking "couldn't load account" screen with a refetch button (no app); only with a loaded `me` evaluate the gate condition, then render the app. Re-prompting on a version/condition change works by comparing `me.<field>` to a client constant (e.g. `WAIVER_VERSION`); bumping the constant re-prompts everyone. Acceptance is recorded server-side (timestamp + version columns on users), nullable so existing users re-accept once.
