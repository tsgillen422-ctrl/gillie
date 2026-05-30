---
name: esbuild undefined JSX refs
description: Why a passing vite/esbuild build does not prove a page works, and what to double-check.
---

The dhl-app build (`vite build` / esbuild) does NOT catch a JSX component used without an import — e.g. `<ClickableImage>` rendered in a file that never imports it. The build succeeds; the page then crashes at runtime with "X is not defined".

**Why:** esbuild does not run TypeScript type-checking or undefined-identifier analysis during the app build. The full `tsc` typecheck is also unreliable here (pre-existing composite/TS errors), so a green build is not a green typecheck.

**How to apply:** After adding a new component and swapping it into multiple files, explicitly grep that each consuming file has the matching `import`. Don't rely on the build passing. For broad correctness, run the per-package build AND verify imports, or load the affected page and check the browser console.
