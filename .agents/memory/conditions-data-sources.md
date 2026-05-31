---
name: Lake conditions data sources
description: Where the /api/conditions metrics come from and the non-obvious external-API quirks for Dale Hollow Lake.
---

# Conditions data sources (Dale Hollow Lake)

`/api/conditions` (artifacts/api-server/src/routes/conditions.ts) pulls live data; metrics and their real sources:

- **Weather, wind, humidity, sunrise/sunset**: Open-Meteo forecast API (keyless). Daily `sunrise`/`sunset` come back as local strings with NO timezone suffix (e.g. `2026-05-31T05:24`). Top-level `utc_offset_seconds` gives the lake's offset — synthesize "local now" via `new Date(Date.now()+offset*1000)` and read with `getUTC*` accessors.
- **Water temperature**: NOT a real source — estimated `airTemp*0.6 + 68*0.4`. No free lake-surface-temp feed exists.
- **Water level (pool elevation)**: USACE CWMS Data API (keyless). **No USGS gauge exists for this lake.**
  - **Why the catalog probe is fiddly:** the v2 `/timeseries/identifier-descriptors` endpoint returns **501**. Use the legacy `GET /cwms-data/catalog/TIMESERIES?office=LRN&like=<regex>` instead — it works and returns `{entries:[{name}]}`.
  - Locations endpoint returns a bare JSON **array** (not `{locations:[...]}`); Dale Hollow is office **LRN**.
  - Latest value: `GET /cwms-data/timeseries?office=LRN&name=<tsid>&begin=&end=&unit=ft` with header `Accept: application/json;version=2`; response `.values` is `[ts_ms, value, quality]` rows — scan from the end for the last non-null.
- **Moon phase**: computed (mean synodic month, no API).
- **Fishing pressure**: labeled heuristic (day-of-week/season/weather), NOT a real feed — present it as an estimate.

**Quirk:** in this repo, rg/bash text output mangles words like weather/conditions/wind/water/post/catch into "ln" — trust the `read` tool, not grep output, for those words.
