---
name: pnpm version must be 10/11 (overrides live in pnpm-workspace.yaml)
description: Why any CI/tooling for this monorepo must use pnpm >=10, not pnpm 9, or frozen installs fail.
---

This monorepo keeps `overrides:` (90+ entries nulling out platform-specific optional
deps), plus `catalog:`, `minimumReleaseAge:`, and `onlyBuiltDependencies:` in
**`pnpm-workspace.yaml`** — NOT in root `package.json` (`package.json` has no `pnpm`
block at all). Local toolchain is **pnpm 11.6.0**; lockfile is `lockfileVersion: '9.0'`.

**The trap:** `lockfileVersion: '9.0'` does NOT mean "use pnpm 9." Lockfile format 9.0
is used by pnpm 9, 10, and 11. Workspace-level `overrides`/`catalog` are pnpm **10+**
features. If CI runs pnpm 9, it can't read those overrides, so resolved overrides come
out empty while the lockfile records 90+ → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` on
`--frozen-lockfile`. The lockfile itself is fine (`pnpm install --lockfile-only` under
pnpm 11 produces zero diff).

**Why:** Codemagic CI for the iOS Capacitor build pinned `npm install -g pnpm@9.0.0`,
which broke frozen installs even though the lockfile was in sync.

Proof pnpm 9.0.0 can't install this repo: `catalog:` deps (10 package.json files use it)
fail with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER  zod@catalog:` — catalogs need
pnpm 9.5+, workspace overrides need pnpm 10+.

**Codemagic corepack "configured to use yarn" trap:** on Codemagic mac runners, the
build user's HOME has `/Users/builder/package.json` with `packageManager: yarn`. corepack
searches UPWARD from cwd for the nearest `packageManager` field; the repo root had none,
so corepack walked up to that yarn file and refused to run pnpm (`pnpm -v` failed with
"This project is configured to use yarn because /Users/builder/package.json has a
packageManager field"). FIX: add `"packageManager": "pnpm@11.6.0"` to the repo root
package.json — nearest-wins, so the runner's ancestor yarn field is ignored. Keep it in
lockstep with the local pnpm version. `corepack prepare pnpm@X --activate` alone does NOT
fix this (the shim still resolves the project's package manager via the ancestor file).

**How to apply:** Any CI / external build (Codemagic, GitHub Actions, etc.) must install
pnpm **>=10** (use 11.6.0 to match local). Codemagic now pins it via corepack:
`corepack enable && corepack prepare pnpm@11.6.0 --activate`, then
`pnpm install --no-frozen-lockfile`. Don't "downgrade pnpm to match the lockfile version
number." Verify lockfile sync with `pnpm install --lockfile-only` + `git diff`, never by
changing the pnpm major.
