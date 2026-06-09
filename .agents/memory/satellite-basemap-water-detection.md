---
name: Satellite basemap vs water detection
description: Why the map keeps vector water fill layers when showing satellite imagery
---

The map (`artifacts/dhl-app/src/pages/map.tsx`) shows Esri World Imagery raster as the basemap, but still loads the OpenFreeMap "liberty" vector style underneath.

**Rule:** When changing the map basemap, keep the vector water FILL layers present and `visibility:visible` (they sit hidden beneath the opaque raster). Insert the satellite raster *beneath the first line/symbol layer* so roads/shields/labels stay on top.

**Why:** `updateLandStates()` decides whether a boat marker is on water vs land via `map.queryRenderedFeatures(point, { layers: waterLayerIds })`. `queryRenderedFeatures` still returns features from visible layers even when they're visually covered by a raster above — but it returns nothing for `visibility:none` layers. So hiding the water fills (or fully replacing the style with a raster-only style) silently breaks the land/water boat toggle.

**How to apply:** A raster-only style, or setting water fills to `visibility:none`, will make `waterLayerIds` empty → `updateLandStates` short-circuits → all boats default to "on water". If you must go raster-only, add a real water polygon source for detection instead.
