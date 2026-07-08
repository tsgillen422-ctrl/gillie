---
name: wouter param decoding
description: wouter v3 route params are already URL-decoded; maplibre must fail soft
---
Rule: wouter v3 (`useParams`) already URL-decodes route params — never call `decodeURIComponent` on them again (corrupts values containing a literal `%`, e.g. place names).
**Why:** Place-detail route `/lakes/:lakeId/places/:placeName` initially double-decoded; caught in architect review.
**How to apply:** When adding routes with string params (place names, usernames), use the param raw; only `encodeURIComponent` when *building* the href.

Related: `new maplibregl.Map()` THROWS when WebGL is unavailable (headless tests, old webviews). Any mini-map/preview map must wrap construction in try/catch and render a static fallback card, or the whole page crashes with the Vite error overlay.
