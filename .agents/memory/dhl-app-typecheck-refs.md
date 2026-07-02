---
name: dhl-app typecheck TS6306
description: dhl-app `pnpm run typecheck` fails on a pre-existing project-reference config error; how to typecheck anyway
---

`artifacts/dhl-app` tsconfig references `lib/object-storage-web`, which does NOT set `"composite": true`, so `tsc -p tsconfig.json --noEmit` always fails with TS6306 — this predates any feature work and is not caused by your changes.

**Why:** the lib was never made composite; only `lib/api-client-react` is. Root `typecheck:libs` (`tsc --build`) passes because object-storage-web isn't in the build graph the same way.

**How to apply:** to typecheck dhl-app changes, strip the references first:
`sed 's/"references": \[/"_references": [/' tsconfig.json > tsconfig.check.json && npx tsc -p tsconfig.check.json --noEmit` (then delete the temp file). Expect a body of pre-existing errors (queryKey-missing pattern, api.schemas deep imports); judge only errors in files you touched. `vite build` needs `PORT` and `BASE_PATH` env vars when run manually.
