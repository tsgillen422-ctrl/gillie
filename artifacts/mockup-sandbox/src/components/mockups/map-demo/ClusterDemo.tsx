import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------------
// Self-contained mock of the Gillie map's 3-layer clustering behavior.
// Mirrors the real app: boats + pins cluster via Supercluster, friendly count
// labels ("8 boats here", "3 fishing spots"), zoom tiers (text labels appear
// only when zoomed in), smooth boat drift, and an Activity-mode "cluster-hot"
// amber glow. Uses fake seeded data over Dale Hollow Lake — no auth, no API.
// ---------------------------------------------------------------------------

const ZOOM_MID = 12.5;
const BOAT_CLUSTER_RADIUS = 60;
const BOAT_CLUSTER_MAXZOOM = 16;
const HOT_THRESHOLD = 4; // clusters this dense glow amber in Activity mode

const PIN_META: Record<string, { emoji: string; category: string }> = {
  fishing: { emoji: "🎣", category: "fishing spot" },
  ramp: { emoji: "🛥️", category: "boat ramp" },
  hazard: { emoji: "⚠️", category: "hazard" },
  swimming: { emoji: "🏊", category: "swimming hole" },
  camp: { emoji: "⛺", category: "campsite" },
  food: { emoji: "🍔", category: "restaurant" },
};
const getPinEmoji = (t: string) => PIN_META[t]?.emoji ?? "📍";
const getPinCategory = (t: string) => PIN_META[t]?.category ?? "spot";
const clusterPinLabel = (type: string, count: number) => {
  const cat = getPinCategory(type);
  return `${count} ${cat}${count === 1 ? "" : "s"}`;
};

const BOAT_COLORS = ["#0ea5e9", "#f97316", "#a855f7", "#22c55e", "#ef4444", "#eab308", "#14b8a6", "#ec4899"];

type Boat = { id: number; name: string; lng: number; lat: number; vx: number; vy: number; bx: number; by: number; color: string };
type Pin = { id: number; type: string; lng: number; lat: number };

function seedBoats(): Boat[] {
  // three coves of friends drifting around Dale Hollow Lake
  const coves: Array<[number, number, number]> = [
    [-85.345, 36.585, 6],
    [-85.255, 36.552, 5],
    [-85.405, 36.612, 3],
  ];
  const names = ["Jess", "Marco", "Priya", "Dale", "Sam", "Tara", "Wade", "Lou", "Nina", "Cody", "Beth", "Rio", "Gus", "Mae"];
  const boats: Boat[] = [];
  let id = 1;
  for (const [clng, clat, n] of coves) {
    for (let i = 0; i < n; i++) {
      const lng = clng + (Math.random() - 0.5) * 0.012;
      const lat = clat + (Math.random() - 0.5) * 0.008;
      boats.push({
        id,
        name: names[(id - 1) % names.length],
        lng,
        lat,
        bx: lng,
        by: lat,
        vx: (Math.random() - 0.5) * 0.00002,
        vy: (Math.random() - 0.5) * 0.000014,
        color: BOAT_COLORS[(id - 1) % BOAT_COLORS.length],
      });
      id++;
    }
  }
  return boats;
}

function seedPins(): Pin[] {
  const groups: Array<[number, number, string[]]> = [
    [-85.32, 36.575, ["fishing", "fishing", "fishing", "ramp", "hazard"]],
    [-85.21, 36.558, ["fishing", "fishing", "swimming", "camp"]],
  ];
  const pins: Pin[] = [];
  let id = 1;
  for (const [clng, clat, types] of groups) {
    for (const t of types) {
      pins.push({
        id: id++,
        type: t,
        lng: clng + (Math.random() - 0.5) * 0.01,
        lat: clat + (Math.random() - 0.5) * 0.007,
      });
    }
  }
  // a couple of standalone pins to show singletons
  pins.push({ id: id++, type: "food", lng: -85.37, lat: 36.55 });
  pins.push({ id: id++, type: "ramp", lng: -85.28, lat: 36.605 });
  return pins;
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function buildClusterEl(count: number, emoji: string, label: string, hot: boolean): HTMLDivElement {
  const root = el("div", "lake-pin") as HTMLDivElement;
  const scale = el("div", "lake-pin-scale");
  const row = el("div", "cluster-row");
  const sizeClass = count >= 25 ? "cluster-lg" : count >= 10 ? "cluster-md" : "cluster-sm";
  const bubble = el("div", `pin-cluster ${sizeClass}${hot ? " cluster-hot" : ""}`);
  const emojiEl = el("span", "pin-cluster-emoji");
  emojiEl.textContent = emoji;
  bubble.appendChild(emojiEl);
  row.appendChild(bubble);
  if (count > 1) {
    const textWrap = el("div", "place-text");
    const titleEl = el("div", "place-title cluster-label");
    titleEl.textContent = label;
    textWrap.appendChild(titleEl);
    row.appendChild(textWrap);
  }
  scale.appendChild(row);
  root.appendChild(scale);
  return root;
}

function buildPinEl(type: string, showLabel: boolean): HTMLDivElement {
  const root = el("div", "lake-pin") as HTMLDivElement;
  const scale = el("div", "lake-pin-scale");
  const row = el("div", "place-row");
  const badge = el("div", `place-badge ${showLabel ? "tier-high" : "tier-low"}`);
  const emojiEl = el("span", "place-badge-emoji");
  emojiEl.textContent = getPinEmoji(type);
  badge.appendChild(emojiEl);
  row.appendChild(badge);
  if (showLabel) {
    const textWrap = el("div", "place-text");
    const titleEl = el("div", "place-title");
    titleEl.style.color = "#fff";
    titleEl.textContent = getPinCategory(type).replace(/^\w/, (c) => c.toUpperCase());
    textWrap.appendChild(titleEl);
    row.appendChild(textWrap);
  }
  return (root.appendChild(scale), scale.appendChild(row), root);
}

function buildBoatEl(boat: Boat): HTMLDivElement {
  const root = el("div", "snap-marker") as HTMLDivElement;
  const bob = el("div", "snap-bob");
  const avatar = el("div", "snap-avatar");
  avatar.style.borderColor = boat.color;
  const initials = el("div", "snap-initials");
  initials.style.background = boat.color;
  initials.textContent = boat.name.slice(0, 2).toUpperCase();
  avatar.appendChild(initials);
  const online = el("i", "snap-online");
  avatar.appendChild(online);
  const hull = el("div", "snap-boat");
  hull.textContent = "🚤";
  bob.appendChild(avatar);
  bob.appendChild(hull);
  root.appendChild(bob);
  return root;
}

function dominantType(leaves: Array<{ properties: { ptype?: string } }>): string {
  const counts: Record<string, number> = {};
  for (const l of leaves) {
    const t = l.properties.ptype;
    if (t) counts[t] = (counts[t] || 0) + 1;
  }
  let best = "fishing";
  let bestN = -1;
  for (const [t, n] of Object.entries(counts)) if (n > bestN) ((bestN = n), (best = t));
  return best;
}

export function ClusterDemo() {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const boatsRef = useRef<Boat[]>(seedBoats());
  const pinsRef = useRef<Pin[]>(seedPins());
  const boatMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());
  const pinMarkers = useRef<maplibregl.Marker[]>([]);
  const activityRef = useRef(false);
  const [activity, setActivity] = useState(false);
  const [zoom, setZoom] = useState(11);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    if (!mapEl.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapEl.current,
        style: {
          version: 8,
          sources: {
            sat: {
              type: "raster",
              tiles: ["https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              tileSize: 256,
              attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
            },
          },
          layers: [{ id: "sat", type: "raster", source: "sat" }],
        },
        center: [-85.32, 36.583],
        zoom: 11,
        attributionControl: false,
      });
    } catch (err) {
      console.warn("WebGL unavailable, showing fallback", err);
      setWebglError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // ----- PIN layer (static): rebuild on view change + activity toggle -----
    const renderPins = () => {
      const z = Math.round(map.getZoom());
      const b = map.getBounds();
      const index = new Supercluster({ radius: 70, maxZoom: 16 });
      index.load(
        pinsRef.current.map((p) => ({
          type: "Feature" as const,
          properties: { ptype: p.type },
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        })),
      );
      const clusters = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z);
      for (const m of pinMarkers.current) m.remove();
      pinMarkers.current = [];
      const showLabels = map.getZoom() >= ZOOM_MID;
      for (const c of clusters) {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        let element: HTMLDivElement;
        if (c.properties.cluster) {
          const count = c.properties.point_count as number;
          const leaves = index.getLeaves(c.properties.cluster_id as number, Infinity) as any[];
          const dom = dominantType(leaves);
          const hot = activityRef.current && count >= HOT_THRESHOLD;
          element = buildClusterEl(count, getPinEmoji(dom), clusterPinLabel(dom, count), hot);
        } else {
          element = buildPinEl(c.properties.ptype as string, showLabels);
        }
        pinMarkers.current.push(new maplibregl.Marker({ element, anchor: "left" }).setLngLat([lng, lat]).addTo(map));
      }
    };

    // ----- BOAT layer (drifting): reconciled ~20fps for smooth movement -----
    const renderBoats = () => {
      const z = Math.round(map.getZoom());
      const b = map.getBounds();
      const index = new Supercluster({ radius: BOAT_CLUSTER_RADIUS, maxZoom: BOAT_CLUSTER_MAXZOOM });
      index.load(
        boatsRef.current.map((bt) => ({
          type: "Feature" as const,
          properties: { bid: bt.id },
          geometry: { type: "Point" as const, coordinates: [bt.lng, bt.lat] },
        })),
      );
      const clusters = index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z);
      const wanted = new Map<string, { lng: number; lat: number; build: () => HTMLDivElement }>();
      for (const c of clusters) {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        if (c.properties.cluster) {
          const count = c.properties.point_count as number;
          const leaves = index.getLeaves(c.properties.cluster_id as number, Infinity) as any[];
          const ids = leaves.map((l) => l.properties.bid).sort((a, b2) => a - b2);
          const key = "bc:" + ids.join("-");
          const hot = activityRef.current && count >= HOT_THRESHOLD;
          wanted.set(key, { lng, lat, build: () => buildClusterEl(count, "🚤", `${count} boats here`, hot) });
        } else {
          const bid = c.properties.bid as number;
          const boat = boatsRef.current.find((x) => x.id === bid)!;
          wanted.set("b:" + bid, { lng, lat, build: () => buildBoatEl(boat) });
        }
      }
      // remove markers no longer wanted
      for (const [key, marker] of boatMarkers.current) {
        if (!wanted.has(key)) {
          marker.remove();
          boatMarkers.current.delete(key);
        }
      }
      // add / move
      for (const [key, w] of wanted) {
        const existing = boatMarkers.current.get(key);
        if (existing) {
          existing.setLngLat([w.lng, w.lat]);
        } else {
          const anchor = key.startsWith("bc:") ? "left" : "center";
          const m = new maplibregl.Marker({ element: w.build(), anchor }).setLngLat([w.lng, w.lat]).addTo(map);
          boatMarkers.current.set(key, m);
        }
      }
    };

    let raf = 0;
    let last = 0;
    const STEP = 60; // ms between drift updates (~16fps)
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < STEP) return;
      last = t;
      // drift boats with gentle bounce around their home cove
      for (const bt of boatsRef.current) {
        bt.lng += bt.vx;
        bt.lat += bt.vy;
        if (Math.abs(bt.lng - bt.bx) > 0.006) bt.vx *= -1;
        if (Math.abs(bt.lat - bt.by) > 0.004) bt.vy *= -1;
        if (Math.random() < 0.02) {
          bt.vx += (Math.random() - 0.5) * 0.000006;
          bt.vy += (Math.random() - 0.5) * 0.000004;
        }
      }
      renderBoats();
    };

    map.on("load", () => {
      renderPins();
      renderBoats();
      raf = requestAnimationFrame(tick);
    });
    const onView = () => {
      setZoom(Number(map.getZoom().toFixed(1)));
      renderPins();
    };
    map.on("moveend", onView);
    map.on("zoom", () => setZoom(Number(map.getZoom().toFixed(1))));

    // right-click / long-press to drop a pin (mirrors create-pin gesture)
    map.on("contextmenu", (e) => {
      pinsRef.current = [...pinsRef.current, { id: Date.now(), type: "fishing", lng: e.lngLat.lng, lat: e.lngLat.lat }];
      renderPins();
    });

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      boatMarkers.current.clear();
      pinMarkers.current = [];
    };
  }, []);

  // re-render pins immediately when activity mode toggles
  const toggleActivity = () => {
    setActivity((a) => {
      activityRef.current = !a;
      return !a;
    });
    const map = mapRef.current;
    if (map) {
      // force pin re-render to apply/remove hot glow
      map.fire("moveend");
    }
  };

  const tier = zoom >= ZOOM_MID ? "Close — labels visible" : "Far — clusters only";

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{CSS}</style>
      <div ref={mapEl} style={{ position: "absolute", inset: 0, background: "#0b2236" }} />

      {webglError && (
        <div className="webgl-fallback">
          <div className="wf-emoji">🗺️</div>
          <div className="wf-title">Map needs WebGL</div>
          <div className="wf-body">
            This live demo renders an interactive MapLibre map of Dale Hollow Lake with clustered boats &amp; pins. Open it
            in a browser with WebGL enabled to see the boats drift and clusters form.
          </div>
        </div>
      )}

      {/* header */}
      <div className="hud hud-top">
        <div className="hud-title">Gillie · Map clustering demo</div>
        <div className="hud-sub">Dale Hollow Lake · live mock with seeded boats &amp; pins</div>
      </div>

      {/* controls */}
      <div className="hud hud-controls">
        <button className={`act-btn${activity ? " on" : ""}`} onClick={toggleActivity}>
          <span className="act-dot" /> Activity mode {activity ? "ON" : "OFF"}
        </button>
        <div className="zoom-chip">
          Zoom {zoom} · <strong>{tier}</strong>
        </div>
      </div>

      {/* legend */}
      <div className="hud hud-legend">
        <div className="legend-row"><span className="lg-em">🚤</span> Boats cluster into <em>“N boats here”</em></div>
        <div className="legend-row"><span className="lg-em">🎣</span> Pins cluster into <em>“N fishing spots”</em></div>
        <div className="legend-row"><span className="lg-em">🔎</span> Zoom in past {ZOOM_MID} to reveal individual markers + labels</div>
        <div className="legend-row"><span className="lg-em">⚡</span> Activity mode glows dense clusters amber</div>
        <div className="legend-row legend-hint">Tip: right-click the water to drop a pin</div>
      </div>
    </div>
  );
}

const CSS = `
  .lake-pin { cursor: pointer; will-change: transform; }
  .lake-pin-scale { position: relative; transform-origin: center center; display: flex; flex-direction: column; align-items: center; }

  /* pin cluster bubble */
  .pin-cluster { display: flex; align-items: center; justify-content: center; border-radius: 999px;
    background: linear-gradient(180deg, #ffffff 0%, #eaf6ff 100%); border: 2px solid #38bdf8;
    box-shadow: 0 6px 16px rgba(2,132,199,0.35); color: #0369a1; font-weight: 800;
    transition: border-color 0.2s ease, box-shadow 0.2s ease; }
  .pin-cluster .pin-cluster-emoji { line-height: 1; }
  .pin-cluster.cluster-sm { width: 36px; height: 36px; }
  .pin-cluster.cluster-md { width: 44px; height: 44px; }
  .pin-cluster.cluster-lg { width: 54px; height: 54px; }
  .pin-cluster.cluster-sm .pin-cluster-emoji { font-size: 18px; }
  .pin-cluster.cluster-md .pin-cluster-emoji { font-size: 22px; }
  .pin-cluster.cluster-lg .pin-cluster-emoji { font-size: 26px; }
  .pin-cluster.cluster-hot { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.28), 0 6px 18px rgba(245,158,11,0.45); }

  .cluster-row { display: flex; flex-direction: row; align-items: center; gap: 7px; }
  .cluster-label { color: #0369a1; }

  /* singleton pin badge */
  .place-row { display: flex; flex-direction: row; align-items: center; gap: 7px; animation: pinFloat 4s ease-in-out infinite; }
  .place-badge { display: flex; align-items: center; justify-content: center; flex: none; background: #fff;
    border-radius: 999px; border: 2px solid rgba(255,255,255,0.95); }
  .place-badge.tier-high { width: 34px; height: 34px; box-shadow: 0 5px 13px rgba(0,0,0,0.28); }
  .place-badge.tier-low { width: 26px; height: 26px; box-shadow: 0 4px 10px rgba(0,0,0,0.24); }
  .place-badge-emoji { line-height: 1; }
  .place-badge.tier-high .place-badge-emoji { font-size: 17px; }
  .place-badge.tier-low .place-badge-emoji { font-size: 13px; }
  .place-text { display: flex; flex-direction: column; line-height: 1.08; }
  .place-title { font-size: 13px; font-weight: 800; white-space: nowrap; max-width: 150px; overflow: hidden;
    text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.45); }
  @keyframes pinFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

  /* boat (snap-style) marker */
  .snap-marker { width: 56px; height: 64px; }
  .snap-bob { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); display: flex; flex-direction: column;
    align-items: center; animation: snapBob 3.2s ease-in-out infinite; }
  @keyframes snapBob { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-5px); } }
  .snap-avatar { position: relative; width: 40px; height: 40px; border-radius: 50%; border: 3px solid #0284c7; background: #fff;
    box-shadow: 0 4px 9px rgba(0,0,0,0.32), 0 0 0 3px rgba(255,255,255,0.9); overflow: visible; }
  .snap-initials { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 15px; }
  .snap-online { position: absolute; bottom: -1px; right: -1px; width: 11px; height: 11px; border-radius: 50%; background: #22c55e;
    border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); animation: snapPulse 1.8s ease-in-out infinite; }
  @keyframes snapPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
  .snap-boat { font-size: 22px; line-height: 1; margin-top: -4px; filter: drop-shadow(0 5px 5px rgba(11,58,91,0.30));
    transform-origin: 50% 80%; animation: snapRock 3.6s ease-in-out infinite; }
  @keyframes snapRock { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }

  /* HUD overlays */
  .hud { position: absolute; z-index: 5; background: rgba(8,25,40,0.78); color: #e8f4ff; backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 12px 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
  .hud-top { left: 16px; top: 16px; }
  .hud-title { font-size: 15px; font-weight: 800; letter-spacing: 0.2px; }
  .hud-sub { font-size: 12px; opacity: 0.78; margin-top: 2px; }
  .hud-controls { left: 16px; top: 86px; display: flex; flex-direction: column; gap: 8px; }
  .act-btn { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border: none; border-radius: 10px;
    padding: 9px 12px; font-size: 13px; font-weight: 700; color: #cfe9ff; background: rgba(255,255,255,0.08); transition: all .15s ease; }
  .act-btn .act-dot { width: 9px; height: 9px; border-radius: 50%; background: #64748b; transition: all .15s ease; }
  .act-btn.on { color: #fff; background: linear-gradient(180deg, #f59e0b, #d97706); box-shadow: 0 0 0 3px rgba(245,158,11,0.3); }
  .act-btn.on .act-dot { background: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.9); }
  .zoom-chip { font-size: 12px; opacity: 0.9; background: rgba(255,255,255,0.06); border-radius: 8px; padding: 6px 9px; }
  .zoom-chip strong { color: #7dd3fc; }
  .hud-legend { left: 16px; bottom: 16px; font-size: 12.5px; max-width: 320px; display: flex; flex-direction: column; gap: 6px; }
  .legend-row { display: flex; align-items: center; gap: 8px; }
  .legend-row em { color: #7dd3fc; font-style: normal; font-weight: 700; }
  .lg-em { width: 18px; text-align: center; }
  .legend-hint { opacity: 0.7; font-style: italic; margin-top: 2px; }

  .webgl-fallback { position: absolute; inset: 0; z-index: 6; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; padding: 32px; gap: 10px;
    background: radial-gradient(circle at 50% 40%, #11324d, #081826); color: #e8f4ff; }
  .wf-emoji { font-size: 48px; }
  .wf-title { font-size: 20px; font-weight: 800; }
  .wf-body { font-size: 14px; opacity: 0.82; max-width: 440px; line-height: 1.5; }
`;
