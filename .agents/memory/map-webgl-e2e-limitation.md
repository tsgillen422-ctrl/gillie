---
name: Map WebGL e2e limitation
description: Why signed-in map/cluster pages can't be visually e2e-tested in the Playwright harness, and how to verify instead.
---

The Playwright testing subagent's browser context has no working WebGL, so any
maplibre-gl map page renders only its "Map needs WebGL" fallback — `.pin-cluster`
/ `.snap-marker` markers never mount and the test reports `unable`.

**Why:** maplibre-gl requires a GL context; the harness browser can't start one.
This is an environment limitation, not an app bug (the map page has a proper
WebGL fallback in `map.tsx`, gated on `mapError`).

**How to apply:** Don't try to verify map clustering/markers/long-press visually
through `runTest`. Instead verify the clustering *logic* headlessly: load the real
`supercluster` module with the production constants (boats: radius 60 / maxZoom 16;
pins: radius 70 / maxZoom 16; default view zoom 12) and assert dense points collapse
to one bubble at zoom 12 and split into individuals by zoom ~14–16. Run such a
script from inside `artifacts/dhl-app/` so the workspace `supercluster` resolves
(it won't resolve from `.local/`). Reason about touch/long-press (550ms timer in
`map.tsx`, cleared on touchmove/drag/zoom/mouseup) by code, not the harness.
