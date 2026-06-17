---
name: Map GeoJSON ensure() must check layers independently
description: Why a map source-add helper must verify the source AND each layer separately, not early-return on source presence.
---

When adding a custom maplibre GeoJSON overlay, the `ensure()` helper must check
the source and EACH layer independently — do not `return` early just because the
source already exists.

**Why:** A basemap `styledata` reload can drop custom layers; if the helper
early-returns after `setData` on a surviving source, the missing layer is never
re-added and the overlay silently vanishes. The older heatmap effect uses the
fragile early-return pattern; the boat-link effect is the corrected reference.

**How to apply:** In any `styledata`-guarded overlay effect, structure ensure as:
add-or-setData the source, then `if (!map.getLayer(id)) map.addLayer(...)` for
every layer. The `styledata` handler should re-run ensure whenever any layer is
missing.
