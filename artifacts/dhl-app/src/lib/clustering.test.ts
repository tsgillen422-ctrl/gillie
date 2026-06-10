import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ZOOM,
  BOAT_CLUSTER_RADIUS,
  BOAT_CLUSTER_MAXZOOM,
  PIN_CLUSTER_RADIUS,
  PIN_CLUSTER_MAXZOOM,
  HEATMAP_HOT_MIN_COUNT,
  isClusterHot,
  createBoatIndex,
  createPinIndex,
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
