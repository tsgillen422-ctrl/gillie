import Supercluster from "supercluster";

// Map clustering + zoom-tier configuration, extracted from the map page so the
// grouping behaviour can be unit-tested headlessly (no browser/WebGL needed).
// map.tsx is the single consumer; the test file asserts these values drive the
// expected "dense boats collapse far out, split as you zoom in, heatmap goes hot
// at 6+" behaviour.

// Default map zoom on load — the "far" tier where dense boats should cluster.
export const DEFAULT_ZOOM = 12;

// Shared zoom tiers used by every layer (boats, pins, places) so visibility is
// consistent: below ZOOM_MID is the "far" tier (clusters + badges only, no text
// labels); at/above ZOOM_MID individual markers and place labels appear; at/above
// SECONDARY_PIN_ZOOM ("close") the low-priority pin chips are revealed too.
export const ZOOM_MID = 12.5;
export const SECONDARY_PIN_ZOOM = 13.5;

// Boat clustering: friends within this pixel radius collapse into one bubble when
// dense. Mirrors the low-pin cluster settings so all layers cluster consistently.
export const BOAT_CLUSTER_RADIUS = 60;
export const BOAT_CLUSTER_MAXZOOM = 16;

// Low-priority pin clustering settings.
export const PIN_CLUSTER_RADIUS = 70;
export const PIN_CLUSTER_MAXZOOM = 16;

// A cluster of this many or more reads as a "busy spot" and gets the heatmap
// "hot" emphasis when heatmap mode is on.
export const HEATMAP_HOT_MIN_COUNT = 6;

// Whether a cluster of the given size flags the heatmap "hot" (busy spot) state.
export const isClusterHot = (count: number): boolean =>
  count >= HEATMAP_HOT_MIN_COUNT;

// Build the supercluster index used to group boats (friends) on the map.
export function createBoatIndex(): Supercluster {
  return new Supercluster({
    radius: BOAT_CLUSTER_RADIUS,
    maxZoom: BOAT_CLUSTER_MAXZOOM,
  });
}

// Build the supercluster index used to group low-priority pins on the map.
export function createPinIndex(): Supercluster {
  return new Supercluster({
    radius: PIN_CLUSTER_RADIUS,
    maxZoom: PIN_CLUSTER_MAXZOOM,
  });
}

// --- Business markers -------------------------------------------------------
// Approved businesses cluster like low-priority pins so a busy shoreline of
// shops doesn't overlap into an unreadable pile when zoomed out.
export const BUSINESS_CLUSTER_RADIUS = 60;
export const BUSINESS_CLUSTER_MAXZOOM = 16;

// Business name pills only appear at/above this zoom (or when the business is
// selected); below it markers are icon-only so browsing stays uncluttered.
export const BUSINESS_LABEL_ZOOM = 13.5;

// Build the supercluster index used to group approved businesses on the map.
export function createBusinessIndex(): Supercluster {
  return new Supercluster({
    radius: BUSINESS_CLUSTER_RADIUS,
    maxZoom: BUSINESS_CLUSTER_MAXZOOM,
  });
}

// Map a free-text business type to a category emoji so users can identify a
// business without a text label. businessType is free text (the app only
// offers autocomplete suggestions), so this keyword-matches. Order matters:
// e.g. "Fuel Dock" must hit fuel before dock, "Vacation Rental" must hit
// vacation before rental, "Grocery / Lake Delivery" grocery before delivery.
export function businessEmoji(type: string | null | undefined): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("marina")) return "⚓";
  if (t.includes("camp")) return "🏕️";
  if (t.includes("fuel") || t.includes("gas")) return "⛽";
  if (t.includes("bait") || t.includes("tackle")) return "🪱";
  if (t.includes("grocery")) return "🛒";
  if (
    t.includes("restaurant") || t.includes("food") || t.includes("grill") ||
    t.includes("cafe") || t.includes("café") || t.includes("bar") ||
    t.includes("pizza") || t.includes("doordash") || t.includes("delivery")
  ) return "🍔";
  if (t.includes("vacation") || t.includes("lodg") || t.includes("cabin") || t.includes("resort")) return "🏡";
  if (t.includes("guide") || t.includes("charter") || t.includes("fishing")) return "🎣";
  if (t.includes("rental")) return "🛥️";
  if (t.includes("mechanic") || t.includes("repair") || t.includes("engine")) return "🔧";
  if (t.includes("detail") || t.includes("clean")) return "🧽";
  if (t.includes("dive") || t.includes("underwater") || t.includes("recovery")) return "🤿";
  if (t.includes("watersport") || t.includes("lesson") || t.includes("ski") ||
      t.includes("wake") || t.includes("paddle")) return "🏄";
  if (t.includes("storage")) return "📦";
  if (t.includes("dock")) return "🔨";
  return "🏪";
}

// Most common category emoji among a business cluster's members, so the
// cluster bubble still hints at what's inside (falls back to the generic
// storefront when empty).
export function dominantBusinessEmoji(businesses: Array<{ businessType?: string | null }>): string {
  const counts: Record<string, number> = {};
  for (const b of businesses) {
    const e = businessEmoji(b.businessType);
    counts[e] = (counts[e] || 0) + 1;
  }
  let best = "🏪";
  let bestN = 0;
  for (const [e, n] of Object.entries(counts)) {
    if (n > bestN) {
      bestN = n;
      best = e;
    }
  }
  return best;
}

// --- Pin priority tiers ---------------------------------------------------
// Pin priority tiers control visual weight and clustering behavior.
// High-priority places (marinas, campsites, hazards) are always visible,
// large, and never clustered. Low-priority (user-generated) pins are smaller,
// icon-only, and cluster together when zoomed out so the map stays uncluttered.
export const HIGH_PRIORITY_PINS = new Set(["marina", "campsite", "hazard"]);
export const pinTier = (type: string): "high" | "low" =>
  HIGH_PRIORITY_PINS.has(type) ? "high" : "low";

// Pick the most common pin-type among a cluster's leaves (drives both the
// representative emoji and the friendly "N <category>s" label). Returns "" when
// the cluster has no typed leaves or supercluster throws on the id.
export function dominantClusterType(index: Supercluster, clusterId: number): string {
  try {
    const leaves = index.getLeaves(clusterId, Infinity) as any[];
    const counts: Record<string, number> = {};
    for (const leaf of leaves) {
      const t = leaf.properties?.pin?.type;
      if (t) counts[t] = (counts[t] || 0) + 1;
    }
    let best = "";
    let bestN = -1;
    for (const [t, n] of Object.entries(counts)) {
      if (n > bestN) {
        bestN = n;
        best = t;
      }
    }
    return best;
  } catch {
    return "";
  }
}

// --- Same-boat (rafted crew) grouping -------------------------------------
// Friends whose *live* GPS fixes are within this many meters of each other are
// treated as sharing one boat (same hull / rafted together) and drawn as a
// single "crew" marker. This is real-world distance (not screen pixels), so a
// crew stays merged at every zoom level — unlike the supercluster grouping
// above, which splits apart as you zoom in.
export const SAME_BOAT_METERS = 25;

// Great-circle distance between two lng/lat points, in meters.
export function haversineMeters(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371000; // Earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Initial great-circle bearing from point A to point B, in degrees (0-360,
// where 0 = due north, 90 = east). Used by the "boat to friend" link to tell
// you which way to point your bow.
export function bearingDegrees(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Nearest 8-point compass label (N, NE, E, SE, S, SW, W, NW) for a bearing.
export function compassPoint(deg: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// Single-linkage proximity grouping (union-find): any two items within `meters`
// of each other end up in the same group, transitively. Returns arrays of the
// original items, group order/contents stable for a given input.
export function groupByProximity<T>(
  items: T[],
  getLngLat: (item: T) => [number, number],
  meters: number,
): T[][] {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i++) {
    const [aLng, aLat] = getLngLat(items[i]);
    for (let j = i + 1; j < n; j++) {
      const [bLng, bLat] = getLngLat(items[j]);
      if (haversineMeters(aLng, aLat, bLng, bLat) <= meters) union(i, j);
    }
  }
  const groups = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(items[i]);
    else groups.set(r, [items[i]]);
  }
  return [...groups.values()];
}
