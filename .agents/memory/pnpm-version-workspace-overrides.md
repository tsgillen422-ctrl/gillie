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

**pnpm 11.6.0 needs Node >= 22.13** (it `require`s the built-in `node:sqlite`, added in
Node 22). On Node 20 the corepack-fetched pnpm 11.6.0 crashes at load with
`ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite`. So CI Node must be
**22+** when using pnpm 11 — Node 20 and pnpm 11 are mutually exclusive.

**ERR_PNPM_IGNORED_BUILDS on a foreign CI:** pnpm 10/11 refuses to run dependency build
scripts unless allowlisted, and a fresh CI install HARD-FAILS (exit 1) if any build-script
dep is neither allowed nor acknowledged. The `.modules.yaml ignoredBuilds` list (e.g.
browser-tabs-lock, core-js) is local runtime state, NOT committed config, so CI doesn't
inherit it. **esbuild gotcha:** esbuild is in `onlyBuiltDependencies` yet STILL gets ignored
(reproducible) — because it has a version-pinning `overrides: esbuild: "0.27.3"` entry;
the override breaks onlyBuiltDependencies name-matching for it (swc/msw/unrs in the same
list build fine). `ignoredBuiltDependencies` did not silence it either in testing.

**macOS CI can't run the web build:** the `overrides:` strip every non-`linux-x64`
platform binary (esbuild/rollup/lightningcss/@tailwindcss-oxide darwin-*). On a mac runner
those are gone, so `vite build` dies with `The package "@esbuild/darwin-arm64" could not be
found`. The overrides are tuned for Replit's linux-x64 box, not cross-platform CI.

**Webview CI fix (the winning move):** the dhl-app iOS app is a `server.url` webview
(capacitor.config.ts → live site); bundled `dist/public` assets are NEVER loaded. So CI
needs ZERO native binaries: install with **`pnpm install --ignore-scripts`** (exits 0, no
ERR_PNPM_IGNORED_BUILDS, skips all native builds) and REPLACE the `vite build` step with a
tiny placeholder `dist/public/index.html` (dist is gitignored) just so `cap sync` has a
webDir to copy. No pnpm-workspace.yaml or lockfile changes needed.

**How to apply:** Any CI / external build (Codemagic, GitHub Actions, etc.) must install
pnpm **>=10** (use 11.6.0 to match local) AND run **Node 22+**. Codemagic pins it via corepack:
`corepack enable && corepack prepare pnpm@11.6.0 --activate`. For the iOS webview build use
`pnpm install --ignore-scripts` (NOT a real build). Don't "downgrade pnpm to match the
lockfile version number." Verify lockfile sync with `pnpm install --lockfile-only` +
`git diff`, never by changing the pnpm major.
