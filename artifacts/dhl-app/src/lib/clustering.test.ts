import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ZOOM,
  ZOOM_MID,
  SECONDARY_PIN_ZOOM,
  BOAT_CLUSTER_RADIUS,
  BOAT_CLUSTER_MAXZOOM,
  PIN_CLUSTER_RADIUS,
  PIN_CLUSTER_MAXZOOM,
  HEATMAP_HOT_MIN_COUNT,
  isClusterHot,
  createBoatIndex,
  createPinIndex,
  pinTier,
  dominantClusterType,
  SAME_BOAT_METERS,
  haversineMeters,
  groupByProximity,
} from "./clustering.ts";

// Offset a lng/lat by a given number of metres (north/east) for building
// synthetic "boats" at known real-world distances apart.
function offsetMeters(lng: number, lat: number, metersN: number, metersE: number): [number, number] {
  const dLat = metersN / 111_320;
  const dLng = metersE / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

// A bounding box covering the whole world, so getClusters returns every
// cluster/point regardless of where the synthetic boats sit.
const WORLD: [number, number, number, number] = [-180, -85, 180, 85];

// Build ~14 boats jittered within a few hundred metres of a center point — tight
// enough that they should collapse into a single bubble when zoomed out.
function denseBoats(count: number, centerLng = -83.5, centerLat = 42.5) {
  return Array.from({ length: count }, (_, i) => {
    const ring = i / count;
    return {
      type: "Feature" as const,
      properties: { userId: i },
      geometry: {
        type: "Point" as const,
        coordinates: [
          centerLng + Math.cos(ring * Math.PI * 2) * 0.0015,
          centerLat + Math.sin(ring * Math.PI * 2) * 0.0015,
        ],
      },
    };
  });
}

test("supercluster config matches the documented boat/pin settings", () => {
  const boat = createBoatIndex() as any;
  const pin = createPinIndex() as any;
  assert.equal(BOAT_CLUSTER_RADIUS, 60);
  assert.equal(BOAT_CLUSTER_MAXZOOM, 16);
  assert.equal(PIN_CLUSTER_RADIUS, 70);
  assert.equal(PIN_CLUSTER_MAXZOOM, 16);
  assert.equal(boat.options.radius, BOAT_CLUSTER_RADIUS);
  assert.equal(boat.options.maxZoom, BOAT_CLUSTER_MAXZOOM);
  assert.equal(pin.options.radius, PIN_CLUSTER_RADIUS);
  assert.equal(pin.options.maxZoom, PIN_CLUSTER_MAXZOOM);
});

test("~14 tightly grouped boats collapse into one cluster at the default zoom", () => {
  const index = createBoatIndex();
  index.load(denseBoats(14) as any);

  const clusters = index.getClusters(WORLD, Math.floor(DEFAULT_ZOOM));
  assert.equal(clusters.length, 1, "expected a single grouped bubble far out");

  const [bubble] = clusters as any[];
  assert.equal(bubble.properties.cluster, true, "the lone marker is a cluster");
  assert.equal(
    bubble.properties.point_count,
    14,
    "the cluster aggregates all 14 boats",
  );
});

test("the same boats split into individual markers as you zoom in (~14-16)", () => {
  const index = createBoatIndex();
  index.load(denseBoats(14) as any);

  // Still a single bubble at the default far tier...
  assert.equal(
    index.getClusters(WORLD, Math.floor(DEFAULT_ZOOM)).length,
    1,
    "still one bubble at the default zoom",
  );

  // ...begins breaking apart into multiple markers as you zoom in...
  assert.ok(
    index.getClusters(WORLD, 14).length > 1,
    "the single bubble should have started splitting by zoom 14",
  );

  // ...and is fully resolved into 14 individual (non-cluster) markers when
  // zoomed all the way in.
  const closeUp = index.getClusters(WORLD, 16) as any[];
  assert.equal(
    closeUp.length,
    14,
    "expected 14 individual markers when zoomed in to 16",
  );
  assert.ok(
    closeUp.every((c) => !c.properties.cluster),
    "no aggregated clusters should remain at zoom 16",
  );
});

test("a cluster of >=6 is what flags the heatmap 'hot' busy-spot state", () => {
  assert.equal(HEATMAP_HOT_MIN_COUNT, 6);
  assert.equal(isClusterHot(5), false);
  assert.equal(isClusterHot(6), true);
  assert.equal(isClusterHot(14), true);
  assert.equal(isClusterHot(0), false);

  // And the threshold lines up with a real grouped cluster: load exactly 6
  // dense boats and confirm the resulting cluster reads as hot.
  const index = createBoatIndex();
  index.load(denseBoats(6) as any);
  const [bubble] = index.getClusters(WORLD, Math.floor(DEFAULT_ZOOM)) as any[];
  assert.equal(bubble.properties.cluster, true);
  assert.ok(
    isClusterHot(bubble.properties.point_count),
    "a 6-boat cluster should be flagged hot",
  );
});

test("haversineMeters measures real-world distance between two fixes", () => {
  const lng = -85.2;
  const lat = 36.6;
  const [eLng, eLat] = offsetMeters(lng, lat, 0, 100); // 100m east
  // allow a small tolerance for the flat-earth offset vs great-circle math
  assert.ok(Math.abs(haversineMeters(lng, lat, eLng, eLat) - 100) < 1);
  assert.equal(haversineMeters(lng, lat, lng, lat), 0);
});

test("boats within SAME_BOAT_METERS raft into one crew; far boats stay solo", () => {
  const lng = -85.2;
  const lat = 36.6;
  const a = { id: "a", lng, lat };
  // b is ~10m from a (well inside the 25m threshold) -> same boat
  const [bLng, bLat] = offsetMeters(lng, lat, 0, 10);
  const b = { id: "b", lng: bLng, lat: bLat };
  // c is ~500m away -> its own boat
  const [cLng, cLat] = offsetMeters(lng, lat, 500, 0);
  const c = { id: "c", lng: cLng, lat: cLat };

  const groups = groupByProximity([a, b, c], (m) => [m.lng, m.lat], SAME_BOAT_METERS);
  assert.equal(groups.length, 2, "a+b raft together, c stays separate");

  const crew = groups.find((g) => g.length === 2)!;
  const solo = groups.find((g) => g.length === 1)!;
  assert.deepEqual(crew.map((m) => m.id).sort(), ["a", "b"]);
  assert.deepEqual(solo.map((m) => m.id), ["c"]);
});

test("grouping is transitive (single-linkage chains raft together)", () => {
  const lng = -85.2;
  const lat = 36.6;
  // three boats in a line, each ~20m from the next: a-b and b-c are within 25m
  // but a-c is ~40m apart. Single-linkage should still merge all three.
  const a = { id: "a", lng, lat };
  const [bLng, bLat] = offsetMeters(lng, lat, 0, 20);
  const b = { id: "b", lng: bLng, lat: bLat };
  const [cLng, cLat] = offsetMeters(lng, lat, 0, 40);
  const c = { id: "c", lng: cLng, lat: cLat };

  assert.ok(haversineMeters(lng, lat, cLng, cLat) > SAME_BOAT_METERS, "a and c are too far to link directly");
  const groups = groupByProximity([a, b, c], (m) => [m.lng, m.lat], SAME_BOAT_METERS);
  assert.equal(groups.length, 1, "the chain a-b-c rafts into one crew");
  assert.equal(groups[0].length, 3);
});

// --- Low-priority pin grouping --------------------------------------------

// Build `count` low-priority pin features jittered within a few hundred metres
// of a center point, each carrying a `pin.type` (cycled through `types`) in the
// supercluster `properties` shape the map page feeds in.
function densePins(
  count: number,
  types: string[] = ["fishing"],
  centerLng = -83.5,
  centerLat = 42.5,
) {
  return Array.from({ length: count }, (_, i) => {
    const ring = i / count;
    return {
      type: "Feature" as const,
      properties: { pin: { type: types[i % types.length] } },
      geometry: {
        type: "Point" as const,
        coordinates: [
          centerLng + Math.cos(ring * Math.PI * 2) * 0.0015,
          centerLat + Math.sin(ring * Math.PI * 2) * 0.0015,
        ],
      },
    };
  });
}

test("pinTier marks marinas/campsites/hazards high (never clustered), the rest low", () => {
  // High-priority places are always-visible and excluded from the pin index.
  assert.equal(pinTier("marina"), "high");
  assert.equal(pinTier("campsite"), "high");
  assert.equal(pinTier("hazard"), "high");
  // Everything else is a low-priority, clusterable user pin.
  assert.equal(pinTier("fishing"), "low");
  assert.equal(pinTier("swimming"), "low");
  assert.equal(pinTier("anchorage"), "low");
  assert.equal(pinTier("anything-unknown"), "low");
});

test("dense low pins collapse into one cluster zoomed out, then resolve to individual chips when close", () => {
  const index = createPinIndex();
  index.load(densePins(12) as any);

  // Far tier (default zoom): a single grouped bubble keeps the map uncluttered.
  const farClusters = index.getClusters(WORLD, Math.floor(DEFAULT_ZOOM)) as any[];
  assert.equal(farClusters.length, 1, "expected one pin cluster far out");
  assert.equal(farClusters[0].properties.cluster, true);
  assert.equal(farClusters[0].properties.point_count, 12, "the cluster aggregates all 12 pins");

  // Close tier (zoomed all the way in): fully resolved into 12 individual chips.
  const closeClusters = index.getClusters(WORLD, PIN_CLUSTER_MAXZOOM) as any[];
  assert.equal(closeClusters.length, 12, "expected 12 individual pin markers when zoomed in");
  assert.ok(
    closeClusters.every((c) => !c.properties.cluster),
    "no aggregated pin clusters should remain when zoomed in",
  );
});

test("the pin zoom tiers are ordered far < mid (labels) < secondary (chips)", () => {
  // Documented tier values that drive when pins reveal in renderPins.
  assert.equal(ZOOM_MID, 12.5);
  assert.equal(SECONDARY_PIN_ZOOM, 13.5);

  // The default load sits in the "far" tier, below both reveal thresholds.
  assert.ok(DEFAULT_ZOOM < ZOOM_MID, "default zoom is in the far tier");
  assert.ok(ZOOM_MID < SECONDARY_PIN_ZOOM, "place labels reveal before pin chips");

  // renderPins gates: place labels appear at/above ZOOM_MID; low-priority pin
  // chips are only revealed at/above SECONDARY_PIN_ZOOM.
  const showPlaceLabels = (zoom: number) => zoom >= ZOOM_MID;
  const revealChips = (zoom: number) => zoom >= SECONDARY_PIN_ZOOM;

  // Far tier (default): clusters/badges only — no labels, no chips.
  assert.equal(showPlaceLabels(DEFAULT_ZOOM), false);
  assert.equal(revealChips(DEFAULT_ZOOM), false);

  // Mid tier (just past ZOOM_MID): place labels on, pin chips still hidden.
  assert.equal(showPlaceLabels(12.6), true);
  assert.equal(revealChips(12.6), false);
  // Exactly at the boundary the mid tier engages but chips do not.
  assert.equal(showPlaceLabels(ZOOM_MID), true);
  assert.equal(revealChips(ZOOM_MID), false);

  // Close tier (at/just past SECONDARY_PIN_ZOOM): chips revealed too.
  assert.equal(revealChips(SECONDARY_PIN_ZOOM), true);
  assert.equal(revealChips(13.6), true);
});

test("dominantClusterType returns the most common pin type among a cluster's leaves", () => {
  // 9 pins in one tight cluster: 5 fishing, 3 swimming, 1 anchorage.
  const index = createPinIndex();
  index.load(
    densePins(9, ["fishing", "fishing", "swimming", "fishing", "swimming", "fishing", "anchorage", "fishing", "swimming"]) as any,
  );

  const [cluster] = index.getClusters(WORLD, Math.floor(DEFAULT_ZOOM)) as any[];
  assert.equal(cluster.properties.cluster, true, "the pins formed one cluster");
  assert.equal(cluster.properties.point_count, 9);
  assert.equal(
    dominantClusterType(index, cluster.properties.cluster_id),
    "fishing",
    "fishing is the plurality type and should win",
  );
});

test("dominantClusterType returns '' for an unknown cluster id instead of throwing", () => {
  const index = createPinIndex();
  index.load(densePins(4) as any);
  // A made-up cluster id supercluster doesn't know about: helper swallows the
  // error and returns "" so renderPins can fall back gracefully.
  assert.equal(dominantClusterType(index, 999_999), "");
});
