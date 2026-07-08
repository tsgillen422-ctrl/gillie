export type Lake = {
  id: number;
  name: string;
  slug: string;
  /** State(s) the lake spans, e.g. "Tennessee/Kentucky". */
  region: string;
  /** Map center. */
  lat: number;
  lng: number;
  /** Sensible initial map zoom for the lake's size. */
  zoom: number;
};

/**
 * Static lake catalog. IDs are stable and stored in the database
 * (users.primary_lake_id, posts.lake_id, ...) — never renumber or delete
 * entries; only append. Dale Hollow (id 1) is the default for all legacy
 * content.
 */
export const LAKES: Lake[] = [
  // Center matches the map page's original proven view — over the main lake
  // body west of Star Point, not the land east of it.
  { id: 1, name: "Dale Hollow Lake", slug: "dale-hollow", region: "Tennessee/Kentucky", lat: 36.53, lng: -85.37, zoom: 12 },
  { id: 2, name: "Lake Cumberland", slug: "lake-cumberland", region: "Kentucky", lat: 36.87, lng: -85.05, zoom: 10 },
  { id: 3, name: "Center Hill Lake", slug: "center-hill", region: "Tennessee", lat: 36.03, lng: -85.78, zoom: 11 },
  { id: 4, name: "Norris Lake", slug: "norris", region: "Tennessee", lat: 36.32, lng: -83.94, zoom: 11 },
  { id: 5, name: "Lake of the Ozarks", slug: "lake-of-the-ozarks", region: "Missouri", lat: 38.13, lng: -92.65, zoom: 10 },
  { id: 6, name: "Lake Havasu", slug: "lake-havasu", region: "Arizona/California", lat: 34.48, lng: -114.35, zoom: 11 },
  { id: 7, name: "Lake Lanier", slug: "lake-lanier", region: "Georgia", lat: 34.25, lng: -83.95, zoom: 11 },
  { id: 8, name: "Lake Travis", slug: "lake-travis", region: "Texas", lat: 30.42, lng: -97.92, zoom: 11 },
  { id: 9, name: "Lake Norman", slug: "lake-norman", region: "North Carolina", lat: 35.58, lng: -80.94, zoom: 11 },
  { id: 10, name: "Lake Powell", slug: "lake-powell", region: "Arizona/Utah", lat: 37.06, lng: -111.25, zoom: 9 },
  { id: 11, name: "Lake Mead", slug: "lake-mead", region: "Nevada/Arizona", lat: 36.14, lng: -114.42, zoom: 10 },
  { id: 12, name: "Table Rock Lake", slug: "table-rock", region: "Missouri", lat: 36.6, lng: -93.31, zoom: 11 },
  { id: 13, name: "Smith Lake", slug: "smith-lake", region: "Alabama", lat: 34.07, lng: -87.11, zoom: 11 },
  { id: 14, name: "Lake Martin", slug: "lake-martin", region: "Alabama", lat: 32.75, lng: -85.92, zoom: 11 },
  { id: 15, name: "Lake Texoma", slug: "lake-texoma", region: "Texas/Oklahoma", lat: 33.87, lng: -96.63, zoom: 10 },
  { id: 16, name: "Lake Tahoe", slug: "lake-tahoe", region: "California/Nevada", lat: 39.09, lng: -120.03, zoom: 10 },
  { id: 17, name: "Lake Champlain", slug: "lake-champlain", region: "New York/Vermont", lat: 44.53, lng: -73.33, zoom: 9 },
  { id: 18, name: "Lake George", slug: "lake-george", region: "New York", lat: 43.6, lng: -73.55, zoom: 11 },
  { id: 19, name: "Lake Winnipesaukee", slug: "lake-winnipesaukee", region: "New Hampshire", lat: 43.63, lng: -71.33, zoom: 11 },
  { id: 20, name: "Shasta Lake", slug: "shasta", region: "California", lat: 40.75, lng: -122.32, zoom: 11 },
];

export const DEFAULT_LAKE_ID = 1;

const byId = new Map(LAKES.map((l) => [l.id, l]));

export function lakeById(id: number | null | undefined): Lake {
  return (id != null && byId.get(id)) || byId.get(DEFAULT_LAKE_ID)!;
}

export function isValidLakeId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && byId.has(id);
}
