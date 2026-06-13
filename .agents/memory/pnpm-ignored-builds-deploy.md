---
name: pnpm ignored-builds deploy failure
description: Why publish fails at the pnpm install step with ERR_PNPM_IGNORED_BUILDS and how to actually fix it
---

# pnpm ERR_PNPM_IGNORED_BUILDS breaks publish at the install step

A publish can fail **before any build/typecheck runs** — during the deploy's `pnpm install`
phase — with `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: ...` (exit 1). This is an
install-phase failure, not an app code/typecheck problem, so reproducing the app build alone
will mislead you. Always pull the real build logs (`getDeploymentBuild`) first.

**Rule:** every dependency that has a postinstall/build script must be listed in
`onlyBuiltDependencies` in `pnpm-workspace.yaml`. Anything not listed is "ignored".

**Gotchas that cost time here:**
- The deploy runs plain `pnpm install`, which exits **1** on ignored builds. Locally,
  `pnpm install --frozen-lockfile` may exit **0** for the same ignored builds — so a green
  local frozen install does NOT prove the deploy install will pass. Verify with plain
  `CI=true pnpm install` (it mirrors the deploy's strict exit code).
- The ignored-builds state is cached in `node_modules/.modules.yaml` under `ignoredBuilds`.
  Editing `onlyBuiltDependencies` alone won't clear it because an "Already up to date" install
  skips re-running scripts. You must run `pnpm rebuild <pkgs>` to actually execute the now-
  approved scripts; then the cache clears and plain `pnpm install` exits 0.
- An `allowBuilds:` block with placeholder values like `pkg: set this to true or false` is
  **NOT** a real pnpm key — it's auto-regenerated tooling noise that appears whenever ignored
  builds exist. It does nothing. Don't treat it as the fix and don't hand-edit it; once
  `onlyBuiltDependencies` is correct and the cache is cleared, it stops regenerating.

**Why:** pnpm blocks dependency build scripts by default (supply-chain defense); the deploy
environment enforces it strictly. Keep the allowlist tight (only packages that genuinely need
their script), not a global enable.
