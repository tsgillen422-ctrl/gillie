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
