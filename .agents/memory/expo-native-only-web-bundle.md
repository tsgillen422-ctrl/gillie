---
name: Expo native-only modules break the web bundle
description: Why react-native-maps (and similar native-only libs) crash the Expo web bundle, and the canonical component-split fix.
---

Native-only libraries (e.g. `react-native-maps`) import modules like
`react-native/Libraries/Utilities/codegenNativeCommands` that do not exist on web.
On an Expo app they crash the **web** Metro bundle with
"Importing native-only module ... on web", returning a 500 for `entry.bundle`.
This matters even for a native-first app because the Replit canvas preview and the
`screenshot` tool render the **web** bundle.

**Fix — split at the component level, not the route level.** A `.web.tsx` sibling of
a *route* file does NOT keep the native file out of the web graph: expo-router's
`require.context` route discovery still pulls in the native `index.tsx`. Instead:
- Keep ONE route file that renders a component (`<LiveMap/>`).
- Provide `components/LiveMap.tsx` (native, imports the native-only lib) and
  `components/LiveMap.web.tsx` (web fallback, no native lib).
Metro's per-platform resolver picks the right one on a normal module import, so the
native lib never enters the web module graph.

**Why:** route-level platform extensions are unreliable for expo-router because the
route is discovered via a glob context, but a plain `import` is resolved per-platform.

**How to apply:** any time a screen needs a native-only RN lib, wrap that lib in a
component and ship a `.web.tsx` twin; never import the native-only lib from a shared
or route path. Verify by fetching the web `entry.bundle` (expect HTTP 200) after a
Metro restart — Metro caches the bundle error, so restart before re-testing.
