import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import {
  ZOOM_MID,
  SECONDARY_PIN_ZOOM,
  BOAT_CLUSTER_RADIUS,
  BOAT_CLUSTER_MAXZOOM,
  isClusterHot,
  createBoatIndex,
  createPinIndex,
  SAME_BOAT_METERS,
  groupByProximity,
} from "@/lib/clustering";
import { useGetMe, useGetFriendLocations, useGetPins, useUpdateMyLocation, useCreatePin, useLikePin, useToggleFavoritePin, useDeletePin, getGetPinsQueryKey, getGetFavoritePinsQueryKey, useGetDockLabels, useCreateDockLabel, useDeleteDockLabel, getGetDockLabelsQueryKey } from "@workspace/api-client-react";
import { PinInputType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { ClickableImage } from "@/components/ClickableImage";
import { Navigation, MessageSquare, Plus, Minus, Crosshair, Droplet, X, ImagePlus, Heart, Star, Search, Trash2, Flame } from "lucide-react";
import { Link, useSearch } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserAvatar, resolveAvatarUrl } from "@/components/UserAvatar";
import { AnimatePresence, motion } from "framer-motion";
import { useUpload } from "@workspace/object-storage-web";
import { boatSvgFor, FLAG_SVG } from "../boats";
import { hapticTap } from "@/lib/haptics";

const LAKE_CENTER: [number, number] = [-85.37, 36.53]; // [lng, lat]
const BASE_ZOOM = 12;

// Well-known named places around Dale Hollow Lake (marinas, resorts, recreation
// areas, towns, and landmarks) so the search bar can fly to them by name even
// when no user has pinned them. Coordinates are approximate, placed within each
// area. [lng, lat]
type LakePlace = { name: string; category: string; lat: number; lng: number; aliases?: string[] };
const LAKE_PLACES: LakePlace[] = [
  { name: "Willow Grove", category: "Recreation Area", lat: 36.5985, lng: -85.2098, aliases: ["willow grove resort", "willow grove marina"] },
  { name: "Dale Hollow Dam", category: "Dam", lat: 36.5396, lng: -85.4558 },
  { name: "Dale Hollow National Fish Hatchery", category: "Landmark", lat: 36.5417, lng: -85.4561, aliases: ["fish hatchery"] },
  { name: "Sunset Marina & Resort", category: "Marina", lat: 36.5905, lng: -85.2456, aliases: ["sunset marina"] },
  { name: "Star Point Resort", category: "Marina", lat: 36.6019, lng: -85.1936, aliases: ["star point marina"] },
  { name: "East Port Marina & Resort", category: "Marina", lat: 36.5723, lng: -85.2966, aliases: ["eastport", "east port"] },
  { name: "Cedar Hill Resort", category: "Marina", lat: 36.6107, lng: -85.1648, aliases: ["cedar hill marina"] },
  { name: "Mitchell Creek Marina", category: "Marina", lat: 36.5631, lng: -85.4123, aliases: ["mitchell creek"] },
  { name: "Holly Creek Resort & Marina", category: "Marina", lat: 36.5887, lng: -85.3573, aliases: ["holly creek"] },
  { name: "Horse Creek Resort & Marina", category: "Marina", lat: 36.5668, lng: -85.4441, aliases: ["horse creek"] },
  { name: "Wisdom Resort & Dock", category: "Marina", lat: 36.6126, lng: -85.2391, aliases: ["wisdom dock", "wisdom resort"] },
  { name: "Eagle Cove Resort", category: "Marina", lat: 36.6203, lng: -85.1902, aliases: ["eagle cove"] },
  { name: "Lillydale Recreation Area", category: "Recreation Area", lat: 36.6155, lng: -85.1879, aliases: ["lillydale", "lily dale"] },
  { name: "Obey River Park", category: "Recreation Area", lat: 36.5523, lng: -85.3856, aliases: ["obey river"] },
  { name: "Pleasant Grove Recreation Area", category: "Recreation Area", lat: 36.5784, lng: -85.3304, aliases: ["pleasant grove"] },
  { name: "Dale Hollow Lake State Resort Park", category: "State Park", lat: 36.6628, lng: -85.2003, aliases: ["state park", "state resort park"] },
  { name: "Byrdstown", category: "Town", lat: 36.5748, lng: -85.1266 },
  { name: "Celina", category: "Town", lat: 36.5512, lng: -85.5036 },
];

const placeEmoji = (category: string) => {
  switch (category.toLowerCase()) {
    case "marina": return "⚓";
    case "dam": return "🌊";
    case "recreation area": return "🏕️";
    case "state park": return "🌲";
    case "town": return "🏘️";
    default: return "📍";
  }
};
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Pin priority tiers control visual weight and clustering behavior.
// High-priority places are always visible, large, and never clustered.
// Low-priority (user-generated) pins are smaller, icon-only, and cluster
// together when zoomed out so the map stays uncluttered near the marina.
const HIGH_PRIORITY_PINS = new Set(["marina", "campsite", "hazard"]);
const pinTier = (type: string): "high" | "low" =>
  HIGH_PRIORITY_PINS.has(type) ? "high" : "low";

// Friendly plural label for a cluster of a given pin type, e.g. "3 fishing spots".
const clusterPinLabel = (type: string, count: number) => {
  const cat = getPinCategory(type).toLowerCase();
  return `${count} ${cat}${count === 1 ? "" : "s"}`;
};

// --- Satellite / aerial imagery basemap ---
const SAT_SOURCE = "satellite-imagery-src";
const SAT_LAYER = "satellite-imagery";

// Turn the OpenMapTiles "liberty" vector style into a satellite/aerial map:
// drop Esri World Imagery in above the polygon fills but below the roads and
// labels, so we keep the vector roads, highway shields, and place names sitting
// on top of real aerial imagery. The vector water/land fills stay in the style
// (hidden beneath the imagery) so map.queryRenderedFeatures can still tell
// whether a marker sits on water or land.
function applySatelliteStyle(map: maplibregl.Map) {
  if (!map.getSource(SAT_SOURCE)) {
    map.addSource(SAT_SOURCE, {
      type: "raster",
      tiles: [
        // Esri "Clarity" imagery — higher-resolution source than standard
        // World_Imagery for this rural lake (~2x detail at the same zoom).
        "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    });
  }

  const layers = map.getStyle().layers || [];
  // Slot imagery just beneath the first road/label layer.
  const firstOverlay = layers.find((l) => l.type === "line" || l.type === "symbol");
  if (!map.getLayer(SAT_LAYER)) {
    map.addLayer(
      { id: SAT_LAYER, type: "raster", source: SAT_SOURCE, paint: { "raster-opacity": 1 } },
      firstOverlay?.id,
    );
  }

  for (const layer of layers) {
    const id = layer.id;
    const type = layer.type;
    try {
      if (type === "symbol") {
        if (/poi|building|housenumber|continent|aerodrome|airport|transit/i.test(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        } else if (layer.layout && (layer.layout as any)["text-field"]) {
          // White labels with a dark halo read cleanly over dark imagery.
          map.setPaintProperty(id, "text-color", "#ffffff");
          map.setPaintProperty(id, "text-halo-color", "rgba(0,0,0,0.85)");
          map.setPaintProperty(id, "text-halo-width", 1.6);
          map.setPaintProperty(id, "text-halo-blur", 0.4);
        }
        continue;
      }
      if (type === "line") {
        if (/water|river|stream|canal|waterway/i.test(id)) {
          // The imagery already shows the water; hide the vector waterway lines.
          map.setLayoutProperty(id, "visibility", "none");
        } else if (/bridge|tunnel|road|street|highway|motorway|trunk|primary|secondary|tertiary|path|service/i.test(id)) {
          if (/casing|outline/i.test(id)) {
            map.setPaintProperty(id, "line-color", "rgba(0,0,0,0.35)");
          } else {
            map.setPaintProperty(id, "line-color", "rgba(255,255,255,0.55)");
          }
        } else if (/admin|boundary|border/i.test(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        }
        continue;
      }
    } catch {
      // some layers may not accept a given property — ignore
    }
  }
}

// Interpolate between two #rrggbb colors, returning an rgb() string.
function lerpHex(a: string, b: string, t: number): string {
  const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

const getPinEmoji = (type: string) => {
  switch (type) {
    case "fishing_spot": return "🎣";
    case "cliff": return "🏔️";
    case "waterfall": return "💧";
    case "rope_swing": return "🪢";
    case "shallow_water": return "🏖️";
    case "tubing": return "🛟";
    case "skiing": return "🎿";
    case "houseboat": return "🛥️";
    case "landmark": return "📍";
    case "hazard": return "⚠️";
    case "marina": return "⛵";
    case "campsite": return "🏕️";
    default: return "📍";
  }
};

// Category color drives the Snap Map style text label tint.
const getPinColor = (type: string) => {
  switch (type) {
    case "fishing_spot": return "#0284c7";
    case "cliff": return "#7c3aed";
    case "waterfall": return "#0891b2";
    case "rope_swing": return "#0d9488";
    case "shallow_water": return "#d97706";
    case "tubing": return "#e11d48";
    case "skiing": return "#2563eb";
    case "houseboat": return "#9333ea";
    case "landmark": return "#db2777";
    case "hazard": return "#dc2626";
    case "marina": return "#ea7317";
    case "campsite": return "#15803d";
    default: return "#0284c7";
  }
};

// Human-readable category shown as the small subtitle under a place name.
const getPinCategory = (type: string) => {
  switch (type) {
    case "fishing_spot": return "Fishing Spot";
    case "cliff": return "Cliff";
    case "waterfall": return "Waterfall";
    case "rope_swing": return "Rope Swing";
    case "shallow_water": return "Shallow Water";
    case "tubing": return "Tubing";
    case "skiing": return "Skiing";
    case "houseboat": return "Houseboat";
    case "landmark": return "Landmark";
    case "hazard": return "Hazard";
    case "marina": return "Marina";
    case "campsite": return "Campground";
    default: return "Place";
  }
};

const formatPinWindow = (startTime?: string | null, endTime?: string | null) => {
  if (!startTime && !endTime) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (startTime && endTime) return `${fmt(startTime)} - ${fmt(endTime)}`;
  if (startTime) return `From ${fmt(startTime)}`;
  return `Until ${fmt(endTime!)}`;
};

const initialsOf = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Compute zoom-driven scale factor for markers.
const scaleForZoom = (zoom: number) => {
  const s = 1 + (zoom - BASE_ZOOM) * 0.14;
  return Math.max(0.55, Math.min(1.75, s));
};

// Text labels stay compact: largest around the base zoom and shrinking in
// both directions, so wording doesn't dominate the map when zoomed out and
// stays subtle when you're zoomed right in.
const textScaleForZoom = (zoom: number) => {
  const t = 1.0 - Math.abs(zoom - BASE_ZOOM) * 0.08;
  return Math.max(0.5, Math.min(1.0, t));
};

type Selected =
  | { kind: "friend"; data: any }
  | { kind: "pin"; data: any }
  | { kind: "me"; data: any }
  | { kind: "place"; data: LakePlace }
  | { kind: "boatCluster"; data: { friends: any[]; boatCount: number; lng: number; lat: number; expansionZoom: number } }
  | { kind: "boatGroup"; data: { members: any[]; lng: number; lat: number } }
  | { kind: "pinCluster"; data: { pins: any[]; lng: number; lat: number; expansionZoom: number } }
  | { kind: "dockLabel"; data: any }
  | null;

const el = (tag: string, className?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

// --- Friend (Snap Map style) marker element: profile pic floating above a boat ---
function buildFriendEl(opts: {
  color: string;
  name: string;
  avatarUrl?: string | null;
  online?: boolean;
  isMe?: boolean;
  boatType?: string | null;
  boatNeon?: boolean | null;
  boatFlag?: boolean | null;
  boatAccent?: string | null;
}): { root: HTMLDivElement; scale: HTMLDivElement } {
  const { color, name, avatarUrl, online, boatType, boatNeon, boatFlag, boatAccent } = opts;
  // accent color drives the flag + neon glow; falls back to the boat color
  const accent = boatAccent || color;
  const root = el("div", "snap-marker") as HTMLDivElement;
  const scale = el("div", "snap-scale") as HTMLDivElement;
  // expose the boat color to CSS for accents (neon glow, ripples)
  scale.style.setProperty("--boat", color);

  // water ripple rings at the boat's waterline
  const ring1 = el("div", "snap-ring");
  ring1.style.borderColor = color;
  const ring2 = el("div", "snap-ring snap-ring-delay");
  ring2.style.borderColor = color;

  // soft wake highlight on the water behind the boat
  const wake = el("div", "snap-wake");

  // bob group floats up/down as a whole
  const bob = el("div", "snap-bob");

  // neon underglow accessory (sits just under the hull at the waterline)
  if (boatNeon) {
    const glow = el("div", "snap-underglow");
    glow.style.background = accent;
    bob.appendChild(glow);
  }

  // boat hull, rocking on the water
  const boat = el("div", "snap-boat");
  boat.style.color = color;
  boat.innerHTML = boatSvgFor(boatType); // static markup, no user data
  bob.appendChild(boat);

  // flag accessory: a small pennant flying off the stern
  if (boatFlag) {
    const flag = el("div", "snap-flag");
    flag.style.color = accent;
    flag.innerHTML = FLAG_SVG; // static markup, no user data
    bob.appendChild(flag);
  }

  // profile photo mounted on the boat like a captain at the helm
  const photo = el("div", "snap-photo");
  photo.style.borderColor = color;
  const resolvedAvatar = resolveAvatarUrl(avatarUrl);
  const showInitials = () => {
    const initials = el("div", "snap-initials");
    initials.style.background = color;
    initials.textContent = initialsOf(name);
    photo.appendChild(initials);
  };
  if (resolvedAvatar) {
    const img = el("img") as HTMLImageElement;
    img.src = resolvedAvatar;
    img.alt = "";
    // If the photo fails to load, fall back to the initials circle.
    img.onerror = () => {
      img.remove();
      if (!photo.querySelector(".snap-initials")) showInitials();
    };
    photo.appendChild(img);
  } else {
    showInitials();
  }
  if (online) photo.appendChild(el("div", "snap-online"));
  bob.appendChild(photo);

  scale.appendChild(ring1);
  scale.appendChild(ring2);
  scale.appendChild(wake);
  scale.appendChild(bob);
  root.appendChild(scale);
  return { root, scale };
}

// --- Crew (same-boat) marker element: several friends rafted on one hull ---
// Friends whose live GPS is within SAME_BOAT_METERS share one boat. We fan their
// photos above a single hull and tag it "N aboard". Built to the same
// .snap-marker > .snap-scale structure as buildFriendEl so zoom-scaling and the
// on-land styling keep working.
function buildCrewEl(opts: {
  color: string;
  boatType?: string | null;
  members: Array<{ name: string; avatarUrl?: string | null; color: string; isMe?: boolean }>;
}): { root: HTMLDivElement; scale: HTMLDivElement } {
  const { color, boatType, members } = opts;
  const root = el("div", "snap-marker snap-crew-marker") as HTMLDivElement;
  const scale = el("div", "snap-scale") as HTMLDivElement;
  scale.style.setProperty("--boat", color);

  const ring1 = el("div", "snap-ring");
  ring1.style.borderColor = color;
  const ring2 = el("div", "snap-ring snap-ring-delay");
  ring2.style.borderColor = color;
  const wake = el("div", "snap-wake");

  const bob = el("div", "snap-bob");

  // boat hull, rocking on the water
  const boat = el("div", "snap-boat");
  boat.style.color = color;
  boat.innerHTML = boatSvgFor(boatType); // static markup, no user data
  bob.appendChild(boat);

  // fanned crew photos sitting above the hull like passengers at the helm
  const crew = el("div", "snap-crew");
  for (const m of members.slice(0, 3)) {
    const photo = el("div", `snap-photo snap-photo-mini${m.isMe ? " is-me" : ""}`);
    photo.style.borderColor = m.color || color;
    const resolved = resolveAvatarUrl(m.avatarUrl);
    const showInitials = () => {
      const initials = el("div", "snap-initials");
      initials.style.background = m.color || color;
      initials.textContent = initialsOf(m.name);
      photo.appendChild(initials);
    };
    if (resolved) {
      const img = el("img") as HTMLImageElement;
      img.src = resolved;
      img.alt = "";
      img.onerror = () => {
        img.remove();
        if (!photo.querySelector(".snap-initials")) showInitials();
      };
      photo.appendChild(img);
    } else {
      showInitials();
    }
    crew.appendChild(photo);
  }
  if (members.length > 3) {
    const more = el("div", "snap-crew-more");
    more.textContent = "+" + (members.length - 3);
    crew.appendChild(more);
  }
  bob.appendChild(crew);

  const label = el("div", "snap-crew-label");
  label.textContent = `${members.length} aboard`;

  scale.appendChild(ring1);
  scale.appendChild(ring2);
  scale.appendChild(wake);
  scale.appendChild(bob);
  scale.appendChild(label);
  root.appendChild(scale);
  return { root, scale };
}

// --- Lake pin (emoji pill) marker element ---
// High-priority pins render as a large labelled pill; low-priority pins render
// as a compact icon-only chip (details appear on tap).
// Dock labels behave like Google/Snap Map labels: a tiny anchor icon when far
// out, the name revealed at medium zoom, and the full wooden sign at close zoom.
const DOCK_FADE_ZOOM = 9.5; // below this the label is hidden entirely
const DOCK_NAME_ZOOM = 12.5; // at/above this the name is revealed (medium zoom)
const DOCK_SIGN_ZOOM = 14; // at/above this the chosen emoji appears (close zoom)

// Emoji palette an admin picks from when placing a dock sign. The chosen one is
// shown above the name pill at the closest zoom (in place of the old wooden sign).
const DOCK_EMOJIS = [
  "🗼", "🌊", "🏮", "🕯️", "⛵️", "🦅", "🪶", "🛟",
  "🏞️", "🌿", "💧", "🍃", "🦋", "🌲", "🍂", "⛰️",
  "🌤️", "💦", "🪨", "🕊️", "🛶", "🌅", "🌞", "🌴",
  "🐺",
];

// Smoothly maps zoom → label scale, clamped so signs never become billboards.
const dockScaleForZoom = (zoom: number) =>
  Math.max(0.7, Math.min(1.12, 0.78 + (zoom - DOCK_NAME_ZOOM) * 0.09));

// --- Admin "dock sign" marker ---
// One element that morphs across zoom tiers: an anchor chip (far) → an icon +
// name pill (medium) → the admin-chosen emoji sitting above that same name pill
// (close). A stem + dot keep it pinned to the exact shoreline location.
function buildDockSignEl(label: string, emoji?: string | null): HTMLDivElement {
  const root = el("div", "dock-sign") as HTMLDivElement;
  const scale = el("div", "dock-scale");
  const bob = el("div", "dock-sign-bob");

  // The chosen emoji — only fades in at the closest tier (replaces the wooden sign).
  const emojiEl = el("div", "dock-emoji");
  emojiEl.textContent = emoji || "⚓";

  // The label pill: anchor icon + name. Clean white pill at every tier.
  const pill = el("div", "dock-pill");
  const ico = el("span", "dock-ico");
  ico.textContent = "⚓";
  const name = el("span", "dock-name");
  name.textContent = label;
  pill.appendChild(ico);
  pill.appendChild(name);

  // Subtle pointer + dot anchoring the label to its location.
  const stem = el("div", "dock-stem");
  const dot = el("div", "dock-dot");

  bob.appendChild(emojiEl);
  bob.appendChild(pill);
  bob.appendChild(stem);
  bob.appendChild(dot);
  scale.appendChild(bob);
  root.appendChild(scale);
  return root;
}

function buildPinEl(opts: {
  emoji: string;
  title: string;
  delay: number;
  tier: "high" | "low";
  color: string;
  category: string;
  showLabel?: boolean;
}): {
  root: HTMLDivElement;
  scale: HTMLDivElement;
} {
  const { emoji, title, delay, tier, color, category, showLabel = true } = opts;
  const root = el("div", "lake-pin") as HTMLDivElement;
  const scale = el("div", "lake-pin-scale") as HTMLDivElement;

  // Inner row gently bobs; the outer scale element handles zoom sizing.
  const row = el("div", "place-row");
  row.style.animationDelay = `${delay}s`;

  // Round emoji badge that marks the spot (Snap Map "thumbnail" style).
  const badge = el("div", `place-badge tier-${tier}`);
  const emojiEl = el("span", "place-badge-emoji");
  emojiEl.textContent = emoji;
  badge.appendChild(emojiEl);
  row.appendChild(badge);

  // High-priority places get a colored text label (no white pill box). The
  // label is suppressed at the far zoom tier so far-out views stay badge-only.
  if (tier === "high" && showLabel) {
    const textWrap = el("div", "place-text");
    const titleEl = el("div", "place-title");
    titleEl.textContent = title;
    titleEl.style.color = color;
    const subEl = el("div", "place-sub");
    subEl.textContent = category;
    subEl.style.color = color;
    textWrap.appendChild(titleEl);
    textWrap.appendChild(subEl);
    row.appendChild(textWrap);
  }

  scale.appendChild(row);
  root.appendChild(scale);
  return { root, scale };
}

// --- Cluster bubble marker element (aggregates nearby boats/pins) ---
// Shows a representative emoji for the group; the bubble grows with the count.
// For multi-point clusters a friendly count label (e.g. "8 boats here") sits to
// the right of the bubble; singletons render as a bare bubble (current look).
function buildClusterEl(count: number, emoji: string, label?: string): { root: HTMLDivElement; scale: HTMLDivElement } {
  const root = el("div", "lake-pin") as HTMLDivElement;
  const scale = el("div", "lake-pin-scale") as HTMLDivElement;
  const row = el("div", "cluster-row");
  // larger bubble for denser clusters
  const sizeClass = count >= 25 ? "cluster-lg" : count >= 10 ? "cluster-md" : "cluster-sm";
  const bubble = el("div", `pin-cluster ${sizeClass}`);
  const emojiEl = el("span", "pin-cluster-emoji");
  emojiEl.textContent = emoji;
  bubble.appendChild(emojiEl);
  row.appendChild(bubble);
  if (label && count > 1) {
    const textWrap = el("div", "place-text");
    const titleEl = el("div", "place-title cluster-label");
    titleEl.textContent = label;
    textWrap.appendChild(titleEl);
    row.appendChild(textWrap);
  }
  scale.appendChild(row);
  root.appendChild(scale);
  return { root, scale };
}

// Pick the most common pin-type among a cluster's leaves (drives both the
// representative emoji and the friendly "N <category>s" label).
function dominantClusterType(index: Supercluster, clusterId: number): string {
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

export function MapPage() {
  const { data: me } = useGetMe();
  const { data: friends } = useGetFriendLocations();
  const { data: pins } = useGetPins({});
  const { data: dockLabels } = useGetDockLabels();
  const createPin = useCreatePin();
  const createDockLabel = useCreateDockLabel();
  const updateLocation = useUpdateMyLocation();
  const queryClient = useQueryClient();

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapLoaded = useRef(false);
  const [styleReady, setStyleReady] = useState(false);
  const search = useSearch();
  const handledFocusRef = useRef<string | null>(null);

  // Track scalable marker elements so we can resize on zoom.
  const scaleEls = useRef<Set<HTMLDivElement>>(new Set());
  // Live individual boat markers, pooled by friend userId so positions can be
  // animated smoothly between polls and only on-screen boats stay instantiated.
  const friendMarkerMap = useRef<Map<number, maplibregl.Marker>>(new Map());
  // Latest friend record per userId, so a marker's click handler always opens the
  // freshest profile data even after the underlying data refreshes.
  const friendDataRef = useRef<Map<number, any>>(new Map());
  // Latest crew rosters keyed by repId, refreshed every poll so a crew's tap
  // sheet shows current member data even when the roster (sig) hasn't changed.
  const crewDataRef = useRef<Map<number, any[]>>(new Map());
  // Transient boat-cluster bubbles (rebuilt on every view change).
  const boatClusterMarkers = useRef<maplibregl.Marker[]>([]);
  // In-flight position tweens per boat (rAF ids), so we can cancel/replace them.
  const boatTweens = useRef<Map<number, number>>(new Map());
  // Supercluster index over boats (friends) for clustering + viewport culling.
  const boatIndex = useRef<Supercluster | null>(null);
  const pinMarkers = useRef<maplibregl.Marker[]>([]);
  // Admin dock-sign markers (rebuilt when the dock-label set changes).
  const dockLabelMarkers = useRef<maplibregl.Marker[]>([]);
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const placeMarker = useRef<maplibregl.Marker | null>(null);
  // Water fill layer ids, used to detect whether a marker sits on water or land.
  const waterLayerIds = useRef<string[]>([]);
  // Supercluster index over low-priority pins + the raw pin list it was built from.
  const clusterIndex = useRef<Supercluster | null>(null);
  const pinsRef = useRef<any[]>([]);

  const [selected, setSelected] = useState<Selected>(null);
  const [mapError, setMapError] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [heatmapOn, setHeatmapOn] = useState(false);
  // Who is geospatially over water (vs. on land), keyed by friend userId.
  // Off-screen markers keep their last known state, so unverified people
  // default to "on water" (shown) rather than being hidden incorrectly.
  const [onLandIds, setOnLandIds] = useState<Set<number>>(new Set());
  const onLandRef = useRef<Set<number>>(new Set());
  // Default to "on land" so we never report a user as on the water (or show
  // them in presence/counts) until the map's geospatial pass actually confirms
  // their coordinates are over water. is_on_water is never cleared server-side,
  // so a premature "true" would leave them stuck "on the lake".
  const [meOnLand, setMeOnLand] = useState(true);
  const meOnLandRef = useRef(true);

  const [pinDialog, setPinDialog] = useState<{ open: boolean; lat?: number; lng?: number }>({ open: false });
  const [pinTitle, setPinTitle] = useState("");
  const [pinDesc, setPinDesc] = useState("");
  const [pinType, setPinType] = useState<PinInputType>("fishing_spot");
  const [pinMode, setPinMode] = useState<"pin" | "landmark" | "dock">("pin");
  const [dockEmoji, setDockEmoji] = useState<string>(DOCK_EMOJIS[0]);
  const [pinVisibility, setPinVisibility] = useState<"friends" | "public" | "community">("friends");
  const [pinStart, setPinStart] = useState("");
  const [pinEnd, setPinEnd] = useState("");
  const [pinSeverity, setPinSeverity] = useState<"low" | "medium" | "high">("medium");
  const [pinExpiresHours, setPinExpiresHours] = useState<string>("24");
  const [pinImageUrl, setPinImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    const res = await uploadFile(file);
    if (res?.objectPath) {
      setPinImageUrl(res.objectPath);
    } else {
      toast.error("Photo upload failed. Try again.");
    }
  };

  const applyZoomScale = useCallback((zoom: number) => {
    const s = scaleForZoom(zoom);
    const t = textScaleForZoom(zoom);
    scaleEls.current.forEach((el) => {
      el.style.transform = `scale(${s})`;
      // Counter-scale the place text so the wording gets smaller as you zoom in.
      const text = el.querySelector(".place-text") as HTMLElement | null;
      if (text) {
        text.style.transformOrigin = "left center";
        text.style.transform = `scale(${(t / s).toFixed(3)})`;
      }
    });
  }, []);

  // Toggle the boat on/off for every person marker: a boat (with profile photo
  // above) when on the water, just the circular profile photo when on land.
  // Land/water is read from the basemap's water fill layers at each marker's
  // pixel. When a point is off-screen or the layers aren't ready we leave the
  // marker's last known state untouched so it never flickers.
  const updateLandStates = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const ids = waterLayerIds.current.filter((id) => map.getLayer(id));
    if (!ids.length) return;
    const canvas = map.getCanvas();
    // Start from last known states so off-screen markers are preserved.
    const nextOnLand = new Set(onLandRef.current);
    let meLand = meOnLandRef.current;
    const apply = (m: maplibregl.Marker, userId: number | null) => {
      const { lng, lat } = m.getLngLat();
      const p = map.project([lng, lat]);
      if (p.x < 0 || p.y < 0 || p.x > canvas.clientWidth || p.y > canvas.clientHeight) {
        return; // off-screen — keep last known state
      }
      let onWater: boolean;
      try {
        onWater = map.queryRenderedFeatures(p, { layers: ids }).length > 0;
      } catch {
        return;
      }
      m.getElement().classList.toggle("on-land", !onWater);
      if (userId == null) {
        meLand = !onWater;
      } else if (onWater) {
        nextOnLand.delete(userId);
      } else {
        nextOnLand.add(userId);
      }
    };
    friendMarkerMap.current.forEach((m) => {
      const raw = m.getElement().dataset.userId;
      const uid = raw != null ? Number(raw) : NaN;
      apply(m, Number.isNaN(uid) ? null : uid);
    });
    if (meMarker.current) apply(meMarker.current, null);

    // Commit to state only when something actually changed (avoids re-render churn
    // from frequent move/render events).
    const prev = onLandRef.current;
    let changed = prev.size !== nextOnLand.size;
    if (!changed) {
      for (const id of nextOnLand) {
        if (!prev.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      onLandRef.current = nextOnLand;
      setOnLandIds(nextOnLand);
    }
    if (meLand !== meOnLandRef.current) {
      meOnLandRef.current = meLand;
      setMeOnLand(meLand);
    }
  }, []);

  // --- Initialize the map once ---
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: LAKE_CENTER,
        zoom: BASE_ZOOM,
        pitch: 0,
        bearing: 0,
        maxPitch: 0,
        // Esri aerial imagery for this rural lake is only sharp up to ~z19;
        // capping the zoom here keeps the deepest view crisp instead of letting
        // the basemap overzoom (stretch) into a blurry placeholder tile.
        maxZoom: 19,
        dragRotate: false,
        attributionControl: { compact: true },
      });
    } catch (e) {
      setMapError(true);
      return;
    }
    mapRef.current = map;


    map.on("error", (e) => {
      // Surface a fatal init/style failure; ignore transient tile errors.
      const msg = (e as any)?.error?.message || "";
      if (/webgl|context|style/i.test(msg)) setMapError(true);
    });

    map.on("load", () => {
      mapLoaded.current = true;

      // --- Satellite / aerial imagery look ---
      applySatelliteStyle(map);

      // Water fill layers stay in the style (hidden beneath the imagery) so the
      // land/water marker logic can still query them via queryRenderedFeatures.
      const allLayers = map.getStyle().layers || [];
      const waterLayers = allLayers
        .filter((l) => /water|lake|river|reservoir|bay/i.test(l.id) && l.type === "fill")
        .map((l) => l.id);
      waterLayerIds.current = waterLayers;

      setStyleReady(true);
      applyZoomScale(map.getZoom());
    });

    map.on("zoom", () => applyZoomScale(map.getZoom()));

    // --- Long-press (touch) / right-click (desktop) to drop a new pin ---
    let lpTimer: number | null = null;
    let lpStart: { x: number; y: number } | null = null;
    const clearLp = () => {
      if (lpTimer != null) {
        clearTimeout(lpTimer);
        lpTimer = null;
      }
      lpStart = null;
    };
    const startLp = (point: { x: number; y: number }, lngLat: maplibregl.LngLat) => {
      clearLp();
      lpStart = { x: point.x, y: point.y };
      lpTimer = window.setTimeout(() => {
        lpTimer = null;
        lpStart = null;
        void hapticTap();
        setPinDialog({ open: true, lat: lngLat.lat, lng: lngLat.lng });
      }, 550);
    };
    map.on("mousedown", (e) => startLp(e.point, e.lngLat));
    map.on("touchstart", (e) => {
      if (e.points.length !== 1) {
        clearLp();
        return;
      }
      startLp(e.point, e.lngLat);
    });
    map.on("mousemove", (e) => {
      if (lpStart && (Math.abs(e.point.x - lpStart.x) > 8 || Math.abs(e.point.y - lpStart.y) > 8)) {
        clearLp();
      }
    });
    map.on("touchmove", clearLp);
    map.on("mouseup", clearLp);
    map.on("touchend", clearLp);
    map.on("dragstart", clearLp);
    map.on("zoomstart", clearLp);
    map.on("contextmenu", (e) => {
      clearLp();
      setPinDialog({ open: true, lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    return () => {
      clearLp();
      map.remove();
      mapRef.current = null;
      mapLoaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Fly to a location passed via ?lat=&lng= (e.g. from a feed post or pin link) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const params = new URLSearchParams(search);
    const latStr = params.get("lat");
    const lngStr = params.get("lng");
    if (latStr == null || lngStr == null) return;
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = `${lat},${lng}`;
    if (handledFocusRef.current === key) return;
    handledFocusRef.current = key;
    map.flyTo({ center: [lng, lat], zoom: 15, essential: true });
  }, [search, styleReady]);

  // --- Open the "Who's on the lake" panel when arriving via ?presence=1 ---
  useEffect(() => {
    if (new URLSearchParams(search).get("presence") === "1") {
      setPresenceOpen(true);
    }
  }, [search]);

  // --- Share my location ---
  // A user only gets a boat once their device has actually reported a GPS fix.
  // The old one-shot getCurrentPosition had no timeout/options and no error
  // handler, so on real devices it could hang or fail silently (permission
  // denied, position unavailable) — leaving share_location on but coordinates
  // null, so the user never appeared on the map. We now grab an immediate fix
  // AND keep a live watch while the map is open, with an error handler so
  // failures are at least visible, so positions (and last_seen freshness) stay
  // current.
  const lastLocSentRef = useRef(0);
  useEffect(() => {
    if (!me || !me.shareLocation) return;
    if (!navigator.geolocation) return;
    const report = (pos: GeolocationPosition) => {
      // watchPosition can fire rapidly while moving; throttle writes so we keep
      // the position fresh without hammering the backend.
      const now = Date.now();
      if (now - lastLocSentRef.current < 15000) return;
      lastLocSentRef.current = now;
      updateLocation.mutate({
        data: {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          onWater: !meOnLandRef.current,
        },
      });
    };
    const onError = (err: GeolocationPositionError) => {
      // Permission denied / unavailable / timeout — nothing to report, but log
      // so this common "my boat never shows up" cause isn't fully silent.
      console.warn("location share failed:", err.code, err.message);
    };
    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    };
    navigator.geolocation.getCurrentPosition(report, onError, opts);
    const watchId = navigator.geolocation.watchPosition(report, onError, opts);
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.shareLocation]);

  // Keep the server's on-the-water status in sync as I cross between water and
  // land. Only the client can tell water from land (via the rendered map), and
  // the feed's "Now on the water" count relies on this signal, so we re-report
  // whenever that determination flips. Mirrors the map's own meOnWater logic.
  useEffect(() => {
    if (!me?.shareLocation || me.currentLat == null || me.currentLng == null) return;
    updateLocation.mutate({
      data: { lat: me.currentLat, lng: me.currentLng, onWater: !meOnLand },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meOnLand]);

  // Smoothly glide a boat marker from its current spot to a new position. Used
  // when a poll reports a friend has moved, so boats slide across the water
  // (keeping the existing wake/ripple effect) instead of teleporting.
  const animateBoatTo = useCallback((id: number, marker: maplibregl.Marker, toLng: number, toLat: number) => {
    const from = marker.getLngLat();
    const dLng = toLng - from.lng;
    const dLat = toLat - from.lat;
    // No meaningful change (e.g. a pure view re-render) — leave it put.
    if (Math.abs(dLng) < 1e-7 && Math.abs(dLat) < 1e-7) return;
    const prev = boatTweens.current.get(id);
    if (prev) cancelAnimationFrame(prev);
    const start = performance.now();
    const dur = 600;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = t * (2 - t); // easeOut
      marker.setLngLat([from.lng + dLng * e, from.lat + dLat * e]);
      if (t < 1) {
        boatTweens.current.set(id, requestAnimationFrame(step));
      } else {
        boatTweens.current.delete(id);
      }
    };
    boatTweens.current.set(id, requestAnimationFrame(step));
  }, []);

  // --- Render the boat layer (clustering + viewport culling) ---
  // Boats run through supercluster like pins do: dense groups collapse into a
  // count bubble, and only on-screen clusters/boats are instantiated so the live
  // DOM-marker count stays bounded even with thousands of points. Individual boat
  // markers are pooled by userId so they can animate between polls.
  const renderBoats = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const zoom = map.getZoom();

    // Clear transient boat-cluster bubbles from the previous view.
    boatClusterMarkers.current.forEach((m) => {
      const el = m.getElement().querySelector(".lake-pin-scale") as HTMLDivElement | null;
      if (el) scaleEls.current.delete(el);
      m.remove();
    });
    boatClusterMarkers.current = [];

    const index = boatIndex.current;
    // userId -> target position/data for boats that should render individually now.
    const target = new Map<number, { lng: number; lat: number; group: any }>();

    if (index) {
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ];
      const clusters = index.getClusters(bbox, Math.floor(zoom));
      clusters.forEach((c: any) => {
        const [lng, lat] = c.geometry.coordinates;
        if (c.properties.cluster) {
          const count = c.properties.point_count as number;
          const { root, scale } = buildClusterEl(count, "🚤", `${count} boats here`);
          if (heatmapOn && isClusterHot(count)) {
            (root.querySelector(".pin-cluster") as HTMLElement | null)?.classList.add("cluster-hot");
          }
          root.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const expZoom = Math.min(index.getClusterExpansionZoom(c.properties.cluster_id), 18);
            const leaves = index.getLeaves(c.properties.cluster_id, Infinity) as any[];
            const groupFriends = leaves
              .flatMap((l) => ((l.properties.members as any[]) ?? [l.properties.friend]))
              .filter(Boolean);
            setSelected({ kind: "boatCluster", data: { friends: groupFriends, boatCount: leaves.length, lng, lat, expansionZoom: expZoom } });
          });
          const marker = new maplibregl.Marker({ element: root, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
          boatClusterMarkers.current.push(marker);
          scaleEls.current.add(scale);
        } else {
          const g = c.properties.group;
          target.set(g.repId, { lng, lat, group: g });
        }
      });
    }

    // Reconcile the pooled individual boat markers against the target set.
    const pool = friendMarkerMap.current;
    // Remove boats that are no longer individually visible (clustered or off-screen).
    for (const [id, marker] of pool) {
      if (!target.has(id)) {
        const el = marker.getElement().querySelector(".snap-scale") as HTMLDivElement | null;
        if (el) scaleEls.current.delete(el);
        const tw = boatTweens.current.get(id);
        if (tw) cancelAnimationFrame(tw);
        boatTweens.current.delete(id);
        friendDataRef.current.delete(id);
        crewDataRef.current.delete(id);
        marker.remove();
        pool.delete(id);
      }
    }
    // Create newcomers, glide existing boats to their fresh position. Markers
    // carry a membership signature; if a crew's roster changes between polls
    // (someone joins/leaves the boat) we rebuild the element so faces stay right.
    for (const [id, info] of target) {
      const g = info.group;
      let marker = pool.get(id);

      // keep the crew roster fresh so the tap sheet shows current member data
      // even on polls where the roster (sig) is unchanged.
      if (g.isCrew) crewDataRef.current.set(id, g.members);
      else crewDataRef.current.delete(id);

      if (marker && marker.getElement().dataset.sig !== g.sig) {
        const prevScale = marker.getElement().querySelector(".snap-scale") as HTMLDivElement | null;
        if (prevScale) scaleEls.current.delete(prevScale);
        const tw = boatTweens.current.get(id);
        if (tw) cancelAnimationFrame(tw);
        boatTweens.current.delete(id);
        marker.remove();
        pool.delete(id);
        marker = undefined;
      }

      if (!marker) {
        const lead = g.members[0];
        const color = lead.boatColor || "#0ea5e9";
        let root: HTMLDivElement;
        let scale: HTMLDivElement;
        if (g.isCrew) {
          const built = buildCrewEl({
            color,
            boatType: lead.boatType,
            members: g.members.map((m: any) => ({
              name: m.displayName || m.username || "Friend",
              avatarUrl: m.avatarUrl,
              color: m.boatColor || color,
              isMe: m.isMe,
            })),
          });
          root = built.root;
          scale = built.scale;
          root.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setSelected({ kind: "boatGroup", data: { members: crewDataRef.current.get(id) ?? g.members, lng: info.lng, lat: info.lat } });
          });
        } else {
          friendDataRef.current.set(id, lead);
          const built = buildFriendEl({
            color,
            name: lead.displayName || lead.username || "Friend",
            avatarUrl: lead.avatarUrl,
            online: lead.isOnline,
            boatType: lead.boatType,
            boatNeon: lead.boatNeon,
            boatFlag: lead.boatFlag,
            boatAccent: lead.boatAccent,
          });
          root = built.root;
          scale = built.scale;
          root.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setSelected({ kind: "friend", data: friendDataRef.current.get(id) ?? lead });
          });
        }
        root.dataset.userId = String(id);
        root.dataset.sig = g.sig;
        marker = new maplibregl.Marker({ element: root, anchor: "bottom", offset: [0, 13] })
          .setLngLat([info.lng, info.lat])
          .addTo(map);
        pool.set(id, marker);
        scaleEls.current.add(scale);
      } else {
        animateBoatTo(id, marker, info.lng, info.lat);
      }
    }

    applyZoomScale(zoom);
    updateLandStates();
  }, [styleReady, applyZoomScale, updateLandStates, animateBoatTo, heatmapOn]);

  // --- Same-boat (rafted crew) grouping ---
  // Before clustering, fold friends (and me) whose live GPS fixes are within
  // SAME_BOAT_METERS into a single "crew". Only fresh/online fixes are grouped
  // so stale "ghost" boats don't get rafted in; stale boats stay solo.
  const boatGroups = useMemo(() => {
    const isFresh = (m: any) =>
      m.isMe ||
      (m.isOnline && (!m.lastSeen || Date.now() - Date.parse(m.lastSeen) < 5 * 60 * 1000));

    const list: any[] = (friends ?? [])
      .filter((f: any) => f.lat != null && f.lng != null)
      .map((f: any) => ({ ...f }));

    // include myself so I can share a boat with friends
    if (me?.shareLocation && me?.currentLat != null && me?.currentLng != null) {
      list.push({
        userId: me.id,
        displayName: me.displayName,
        username: me.username,
        avatarUrl: me.avatarUrl,
        boatName: me.boatName,
        boatColor: me.boatColor,
        boatType: me.boatType,
        boatNeon: me.boatNeon,
        boatFlag: me.boatFlag,
        boatAccent: me.boatAccent,
        isOnline: me.isOnline,
        lastSeen: me.lastSeen,
        lat: me.currentLat,
        lng: me.currentLng,
        isMe: true,
      });
    }

    const groupable = list.filter(isFresh);
    const solo = list.filter((m) => !isFresh(m));
    const rawGroups: any[][] = [
      ...groupByProximity(groupable, (m) => [m.lng, m.lat], SAME_BOAT_METERS),
      ...solo.map((m) => [m]),
    ];

    return rawGroups.map((members) => {
      const lng = members.reduce((s, m) => s + m.lng, 0) / members.length;
      const lat = members.reduce((s, m) => s + m.lat, 0) / members.length;
      const sorted = [...members].sort((a, b) => a.userId - b.userId);
      return {
        repId: sorted[0].userId,
        members: sorted,
        lng,
        lat,
        isCrew: members.length > 1,
        sig: sorted.map((m) => m.userId).join("-"),
      };
    });
  }, [friends, me]);

  // Whether I'm currently rafted into a multi-person crew, so the standalone
  // "me" marker can step aside and let the crew marker show my face instead.
  const meInCrew = useMemo(
    () => boatGroups.some((g) => g.isCrew && g.members.some((m: any) => m.isMe)),
    [boatGroups],
  );

  // Build the boat supercluster index whenever the grouped set changes, then
  // render. A solo "me" group is excluded here — the dedicated me-marker effect
  // draws it — but a crew that includes me IS indexed so my face shows aboard.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const points = boatGroups
      .filter((g) => !(g.members.length === 1 && g.members[0].isMe))
      .map((g) => ({
        type: "Feature" as const,
        properties: {
          group: g,
          members: g.members,
          userId: g.repId,
          isCrew: g.isCrew,
          friend: g.members[0],
        },
        geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] },
      }));

    const index = createBoatIndex();
    index.load(points as any);
    boatIndex.current = index;

    renderBoats();
  }, [boatGroups, styleReady, renderBoats]);

  // --- Render pin markers (with clustering + tiering) ---
  // Re-runs on every map move/zoom so clusters re-form for the current view.
  const renderPins = useCallback(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    // Clear existing pin/cluster markers.
    pinMarkers.current.forEach((m) => {
      const el = m.getElement().querySelector(".lake-pin-scale") as HTMLDivElement | null;
      if (el) scaleEls.current.delete(el);
      m.remove();
    });
    pinMarkers.current = [];

    const zoom = map.getZoom();
    const allPins = pinsRef.current;

    const b = map.getBounds();
    const bbox: [number, number, number, number] = [
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ];
    const inView = (lng: number, lat: number) =>
      lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];

    const addPinMarker = (pin: any, showLabel = true) => {
      const tier = pinTier(pin.type);
      const { root, scale } = buildPinEl({
        emoji: getPinEmoji(pin.type),
        title: pin.title,
        delay: (Math.abs((pin.id ?? 0) * 13) % 30) / 10,
        tier,
        color: getPinColor(pin.type),
        category: getPinCategory(pin.type),
        showLabel,
      });
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({ kind: "pin", data: pin });
      });
      const marker = new maplibregl.Marker({ element: root, anchor: "center" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      pinMarkers.current.push(marker);
      scaleEls.current.add(scale);
    };

    // Layer 3 — landmarks/places (high-priority pins): always individual, but
    // viewport-culled and showing their full text label only from the mid tier
    // in (far-out views keep just the badge so labels don't crowd the map).
    const showPlaceLabels = zoom >= ZOOM_MID;
    allPins.forEach((pin) => {
      if (pin.lat == null || pin.lng == null) return;
      if (pinTier(pin.type) !== "high") return;
      if (!inView(pin.lng, pin.lat)) return;
      addPinMarker(pin, showPlaceLabels);
    });

    // Low-priority pins: clustered via supercluster for the current view.
    const index = clusterIndex.current;
    if (index) {
      const clusters = index.getClusters(bbox, Math.floor(zoom));
      const revealChips = zoom >= SECONDARY_PIN_ZOOM;
      clusters.forEach((c: any) => {
        const [lng, lat] = c.geometry.coordinates;
        if (c.properties.cluster) {
          // A multi-point cluster: bubble shows the dominant emoji + a friendly
          // count label ("3 fishing spots"), and expands on tap.
          const count = c.properties.point_count as number;
          const domType = dominantClusterType(index, c.properties.cluster_id);
          const { root, scale } = buildClusterEl(count, getPinEmoji(domType), clusterPinLabel(domType, count));
          if (heatmapOn && isClusterHot(count)) {
            (root.querySelector(".pin-cluster") as HTMLElement | null)?.classList.add("cluster-hot");
          }
          root.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const expZoom = Math.min(index.getClusterExpansionZoom(c.properties.cluster_id), 18);
            const leaves = index.getLeaves(c.properties.cluster_id, Infinity) as any[];
            const groupPins = leaves.map((l) => l.properties.pin).filter(Boolean);
            setSelected({ kind: "pinCluster", data: { pins: groupPins, lng, lat, expansionZoom: expZoom } });
          });
          const marker = new maplibregl.Marker({ element: root, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
          pinMarkers.current.push(marker);
          scaleEls.current.add(scale);
        } else if (revealChips) {
          // Zoomed in: reveal the individual low-priority pin as an icon chip.
          addPinMarker(c.properties.pin);
        } else {
          // Zoomed out: show even a lone low-priority pin as a single-emoji bubble
          // so nothing silently disappears while still hiding the detail chip.
          const { root, scale } = buildClusterEl(1, getPinEmoji(c.properties.pin?.type));
          root.addEventListener("click", (ev) => {
            ev.stopPropagation();
            map.easeTo({ center: [lng, lat], zoom: SECONDARY_PIN_ZOOM });
          });
          const marker = new maplibregl.Marker({ element: root, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
          pinMarkers.current.push(marker);
          scaleEls.current.add(scale);
        }
      });
    }

    applyZoomScale(zoom);
  }, [styleReady, applyZoomScale, heatmapOn]);

  // Build the supercluster index whenever the pin set changes, then render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    pinsRef.current = pins ?? [];

    const lowPoints = (pins ?? [])
      .filter((p) => p.lat != null && p.lng != null && pinTier(p.type) === "low")
      .map((p) => ({
        type: "Feature" as const,
        properties: { pin: p },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      }));

    const index = createPinIndex();
    index.load(lowPoints as any);
    clusterIndex.current = index;

    renderPins();
  }, [pins, styleReady, renderPins]);

  // Re-cluster on view changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const onMoveEnd = () => {
      renderPins();
      renderBoats();
      updateLandStates();
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [styleReady, renderPins, renderBoats, updateLandStates]);

  // Drive the dock-label zoom tiers (far icon → medium pill → close wooden sign),
  // smooth scaling, and label priority. When several signs would collide at
  // medium zoom, only the first keeps its name; the rest fall back to icon-only
  // so labels never blanket the lake.
  const updateDockLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    const faded = zoom < DOCK_FADE_ZOOM;
    const near = zoom >= DOCK_SIGN_ZOOM;
    const canName = !near && zoom >= DOCK_NAME_ZOOM;
    const s = dockScaleForZoom(zoom).toFixed(3);
    const kept: { x: number; y: number }[] = [];
    dockLabelMarkers.current.forEach((m) => {
      const root = m.getElement();
      root.classList.toggle("is-faded", faded);
      const scaleEl = root.querySelector(".dock-scale") as HTMLElement | null;
      if (scaleEl) scaleEl.style.transform = `scale(${s})`;
      let showName = near || canName;
      if (canName && !faded) {
        const p = map.project(m.getLngLat());
        const clash = kept.some((k) => Math.abs(k.x - p.x) < 116 && Math.abs(k.y - p.y) < 30);
        if (clash) showName = false;
        else kept.push({ x: p.x, y: p.y });
      }
      root.classList.toggle("tier-near", near);
      root.classList.toggle("tier-mid", !near && showName);
      root.classList.toggle("tier-far", !near && !showName);
    });
  }, []);

  // --- Admin dock signs: (re)build markers whenever the dock-label set changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    dockLabelMarkers.current.forEach((m) => m.remove());
    dockLabelMarkers.current = [];
    (dockLabels ?? []).forEach((dl) => {
      if (dl.lat == null || dl.lng == null) return;
      const root = buildDockSignEl(dl.label, dl.emoji);
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({ kind: "dockLabel", data: dl });
      });
      const marker = new maplibregl.Marker({ element: root, anchor: "bottom" })
        .setLngLat([dl.lng, dl.lat])
        .addTo(map);
      dockLabelMarkers.current.push(marker);
    });
    updateDockLabels();
    return () => {
      dockLabelMarkers.current.forEach((m) => m.remove());
      dockLabelMarkers.current = [];
    };
  }, [dockLabels, styleReady, updateDockLabels]);

  // Re-evaluate dock-label tiers/scale/priority as the user zooms.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    map.on("zoom", updateDockLabels);
    return () => {
      map.off("zoom", updateDockLabels);
    };
  }, [styleReady, updateDockLabels]);

  // --- Live activity heatmap ---
  // Turns the lake into a heatmap of where people are: low density reads blue
  // (quiet), rising through green (moderate) and yellow (busy) up to red
  // (a packed "party spot"). Built from live friend + self locations.
  const HEAT_SOURCE = "activity-heat";
  const HEAT_LAYER = "activity-heat-layer";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    if (!heatmapOn) {
      if (map.getLayer(HEAT_LAYER)) map.removeLayer(HEAT_LAYER);
      if (map.getSource(HEAT_SOURCE)) map.removeSource(HEAT_SOURCE);
      return;
    }

    const features: any[] = [];
    (friends ?? []).forEach((f: any) => {
      if (f.lat != null && f.lng != null && !f.isBusiness) {
        features.push({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [f.lng, f.lat] },
        });
      }
    });
    if (me?.currentLat != null && me?.currentLng != null) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [me.currentLng, me.currentLat] },
      });
    }
    const data = { type: "FeatureCollection" as const, features };

    // Add the source + heatmap layer if missing, otherwise just refresh the data.
    // Wrapped so we can also re-run it if the basemap style reloads (which drops
    // any custom sources/layers).
    const ensureHeat = () => {
      const existing = map.getSource(HEAT_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data as any);
        return;
      }
      map.addSource(HEAT_SOURCE, { type: "geojson", data: data as any });
      map.addLayer({
        id: HEAT_LAYER,
        type: "heatmap",
        source: HEAT_SOURCE,
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 16, 3],
          // Density ramp: blue (quiet) -> green (moderate) -> yellow (busy) -> red (party).
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(37,99,235,0)",
            0.15, "rgba(37,99,235,0.7)",
            0.4, "rgba(34,197,94,0.75)",
            0.65, "rgba(234,179,8,0.85)",
            1, "rgba(239,68,68,0.95)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 24, 16, 70],
          "heatmap-opacity": 0.8,
        },
      });
    };

    ensureHeat();
    // Re-add after any style reload while heatmap mode stays on.
    const onStyleData = () => {
      if (!map.getLayer(HEAT_LAYER)) ensureHeat();
    };
    map.on("styledata", onStyleData);
    return () => {
      map.off("styledata", onStyleData);
    };
  }, [heatmapOn, friends, me, styleReady]);

  // --- Animated water shimmer ---
  // Gently drift the lake fill between two blues (and breathe its opacity) so the
  // flat vector water reads as living water instead of a static polygon. Throttled
  // to ~16fps — the motion is slow, so this stays light on battery, and opacity
  // never reaches 0 so the land/water hit-testing keeps working.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const COLOR_A = "#4f93cf";
    const COLOR_B = "#7cc0ef";
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 60) return;
      last = now;
      // Re-derive live water layer ids each frame so the shimmer survives style
      // reloads (layers may be dropped/recreated underneath us).
      const ids = waterLayerIds.current.filter((id) => map.getLayer(id));
      if (!ids.length) return;
      const t = (now - start) / 1000;
      const wave = (Math.sin(t * 0.6) + 1) / 2;
      const color = lerpHex(COLOR_A, COLOR_B, wave);
      const opacity = 0.85 + 0.1 * Math.sin(t * 0.9);
      for (const id of ids) {
        try {
          map.setPaintProperty(id, "fill-color", color);
          map.setPaintProperty(id, "fill-opacity", opacity);
        } catch {
          // layer may have been removed during a style reload — ignore
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [styleReady]);

  // --- Render my own marker ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    if (meMarker.current) {
      const el = meMarker.current.getElement().querySelector(".snap-scale") as HTMLDivElement | null;
      if (el) scaleEls.current.delete(el);
      meMarker.current.remove();
      meMarker.current = null;
    }

    // When I'm rafted into a crew, the crew marker shows my face — skip the
    // standalone me-marker so I'm not drawn twice.
    if (!meInCrew && me?.shareLocation && me?.currentLat != null && me?.currentLng != null) {
      const color = me.boatColor || "#0284c7";
      const { root, scale } = buildFriendEl({
        color,
        name: me.displayName || "You",
        avatarUrl: me.avatarUrl,
        online: me.isOnline,
        isMe: true,
        boatType: me.boatType,
        boatNeon: me.boatNeon,
        boatFlag: me.boatFlag,
        boatAccent: me.boatAccent,
      });
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({ kind: "me", data: me });
      });
      const marker = new maplibregl.Marker({ element: root, anchor: "bottom", offset: [0, 13] })
        .setLngLat([me.currentLng, me.currentLat])
        .addTo(map);
      meMarker.current = marker;
      scaleEls.current.add(scale);
      applyZoomScale(map.getZoom());
      updateLandStates();
    }
  }, [me, meInCrew, styleReady, applyZoomScale, updateLandStates]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  };

  const flyToMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (me?.currentLat != null && me?.currentLng != null) {
      map.flyTo({ center: [me.currentLng, me.currentLat], zoom: 14, essential: true });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, essential: true });
      });
    }
  };

  const flyToLocation = (lng: number, lat: number, sel: Selected) => {
    const map = mapRef.current;
    if (map) map.flyTo({ center: [lng, lat], zoom: 15, essential: true });
    setSelected(sel);
    setSearchOpen(false);
    setSearchQuery("");
    setPresenceOpen(false);
  };

  const flyToPlace = (place: LakePlace) => {
    const map = mapRef.current;
    if (map) map.flyTo({ center: [place.lng, place.lat], zoom: 14, essential: true });
    setSelected({ kind: "place", data: place });
    setSearchOpen(false);
    setSearchQuery("");
    setPresenceOpen(false);
  };

  // --- Temporary marker for a searched place (no permanent pin exists) ---
  useEffect(() => {
    const map = mapRef.current;
    if (placeMarker.current) {
      placeMarker.current.remove();
      placeMarker.current = null;
    }
    if (!map || !styleReady) return;
    if (selected?.kind !== "place") return;
    const place = selected.data;
    const root = el("div");
    root.style.cssText =
      "width:40px;height:40px;border-radius:9999px;background:#fff;border:3px solid #0284c7;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,.3);";
    root.textContent = placeEmoji(place.category);
    placeMarker.current = new maplibregl.Marker({ element: root, anchor: "center" })
      .setLngLat([place.lng, place.lat])
      .addTo(map);
    return () => {
      if (placeMarker.current) {
        placeMarker.current.remove();
        placeMarker.current = null;
      }
    };
  }, [selected, styleReady]);

  // Only people currently on the water (not on land at marinas, restaurants, etc.)
  // belong in the "Who's on the lake" presence list and its count. Businesses
  // (marinas, restaurants, shops) are fixed land places and are always excluded;
  // regular people are additionally hidden when the map detects them over land.
  // A friend counts as "on the water" only when their OWN device has reported
  // is_on_water (the only client that can tell water from land) and they've been
  // seen recently. is_on_water is never cleared server-side, so the freshness
  // window drops people who have since left. We do NOT default unknown friends to
  // "on water": the viewer's client-side onLandIds only classifies markers that
  // are currently on-screen, so off-screen friends used to wrongly show as on the
  // lake. onLandIds remains a secondary guard for friends the viewer can see.
  const PRESENCE_WINDOW_MS = 10 * 60 * 1000;
  const isFreshlySeen = (f: any) =>
    f.lastSeen != null && Date.now() - new Date(f.lastSeen).getTime() < PRESENCE_WINDOW_MS;
  const onWaterFriends = (friends ?? []).filter(
    (f: any) =>
      f.lat != null &&
      f.lng != null &&
      !f.isBusiness &&
      f.isOnWater === true &&
      isFreshlySeen(f) &&
      !onLandIds.has(f.userId)
  );
  const onlineFriends = onWaterFriends.filter((f: any) => f.isOnline);
  const meOnWater = me?.currentLat != null && me?.currentLng != null && !meOnLand;
  const onlineCount = onlineFriends.length + (meOnWater ? 1 : 0);

  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ key: string; icon: string; title: string; subtitle: string; onSelect: () => void }>;
    const results: Array<{ key: string; icon: string; title: string; subtitle: string; onSelect: () => void }> = [];
    for (const p of pins ?? []) {
      if (
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q)
      ) {
        results.push({
          key: `pin-${p.id}`,
          icon: getPinEmoji(p.type),
          title: p.title,
          subtitle: (p.type || "").replace(/_/g, " "),
          onSelect: () => flyToLocation(p.lng, p.lat, { kind: "pin", data: p }),
        });
      }
    }
    for (const pl of LAKE_PLACES) {
      const hay = [pl.name, pl.category, ...(pl.aliases ?? [])].join(" ").toLowerCase();
      if (hay.includes(q)) {
        results.push({
          key: `place-${pl.name}`,
          icon: placeEmoji(pl.category),
          title: pl.name,
          subtitle: pl.category,
          onSelect: () => flyToPlace(pl),
        });
      }
    }
    for (const dl of dockLabels ?? []) {
      if (dl.lat == null || dl.lng == null) continue;
      if (dl.label?.toLowerCase().includes(q)) {
        results.push({
          key: `dock-${dl.id}`,
          icon: "⚓",
          title: dl.label,
          subtitle: "Dock",
          onSelect: () => flyToLocation(dl.lng!, dl.lat!, { kind: "dockLabel", data: dl }),
        });
      }
    }
    for (const f of friends ?? []) {
      if (f.displayName?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q) || f.boatName?.toLowerCase().includes(q)) {
        results.push({
          key: `friend-${f.userId}`,
          icon: "🧑",
          title: f.displayName,
          subtitle: f.boatName ? `🚤 ${f.boatName}` : f.isOnline ? "Online now" : "On the lake",
          onSelect: () => flyToLocation(f.lng, f.lat, { kind: "friend", data: f }),
        });
      }
    }
    return results.slice(0, 20);
  })();

  const handleFabClick = () => {
    let lat = LAKE_CENTER[1];
    let lng = LAKE_CENTER[0];
    if (me?.currentLat != null && me?.currentLng != null) {
      lat = me.currentLat;
      lng = me.currentLng;
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPinDialog({ open: true, lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
      return;
    }
    setPinDialog({ open: true, lat, lng });
  };

  const closePinDialog = () => {
    setPinDialog({ open: false });
    setPinMode("pin");
    setDockEmoji(DOCK_EMOJIS[0]);
    setPinType("fishing_spot");
    setPinTitle("");
    setPinDesc("");
    setPinVisibility("friends");
    setPinStart("");
    setPinEnd("");
    setPinSeverity("medium");
    setPinExpiresHours("24");
    setPinImageUrl(null);
  };

  const submitDockLabel = () => {
    if (pinDialog.lat == null || pinDialog.lng == null) return;
    createDockLabel.mutate(
      { data: { label: pinTitle.trim() || "Dock", emoji: dockEmoji, lat: pinDialog.lat, lng: pinDialog.lng } },
      {
        onSuccess: () => {
          toast.success("Dock sign placed!");
          closePinDialog();
          queryClient.invalidateQueries({ queryKey: getGetDockLabelsQueryKey() });
        },
      },
    );
  };

  const submitPin = () => {
    if (pinDialog.lat == null || pinDialog.lng == null) return;
    const isLandmark = pinMode === "landmark";
    createPin.mutate(
      {
        data: {
          title: pinTitle || (isLandmark ? "New Landmark" : "New Spot"),
          description: pinDesc,
          type: isLandmark ? "landmark" : pinType,
          lat: pinDialog.lat,
          lng: pinDialog.lng,
          visibility: pinVisibility,
          imageUrl: pinImageUrl || undefined,
          // Landmarks are permanent places, not time-bound events.
          startTime: !isLandmark && pinStart ? new Date(pinStart).toISOString() : null,
          endTime: !isLandmark && pinEnd ? new Date(pinEnd).toISOString() : null,
          severity: !isLandmark && pinType === "hazard" ? pinSeverity : undefined,
          expiresAt:
            !isLandmark && pinType === "hazard" && pinExpiresHours !== "0"
              ? new Date(Date.now() + parseInt(pinExpiresHours, 10) * 3600 * 1000).toISOString()
              : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            pinNeedsApproval
              ? isLandmark
                ? "Landmark submitted for approval."
                : "Pin submitted for approval."
              : isLandmark
              ? "Landmark added!"
              : "Pin dropped successfully!"
          );
          closePinDialog();
          queryClient.invalidateQueries({ queryKey: getGetPinsQueryKey({}) });
        },
      }
    );
  };

  // Mirrors the server approval rules: public/community pins need approval
  // unless they are timed; landmarks always need approval for public/community.
  const pinIsTimed = !!(pinStart || pinEnd);
  const pinNeedsApproval =
    (pinVisibility === "public" || pinVisibility === "community") &&
    (pinMode === "landmark" || !pinIsTimed);

  return (
    <div className="h-full w-full relative bg-blue-50">
      <style dangerouslySetInnerHTML={{ __html: MAP_CSS }} />

      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {mapError && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-blue-50 p-6 text-center">
          <div className="max-w-xs">
            <Droplet className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="font-semibold">Map needs WebGL</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your browser couldn't start 3D graphics. Try enabling hardware acceleration or a different browser.
            </p>
          </div>
        </div>
      )}

      {/* Heatmap legend */}
      {heatmapOn && (
        <div className="absolute bottom-4 left-4 z-[400] rounded-2xl bg-card/95 backdrop-blur shadow-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Flame className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-semibold">Lake Activity</span>
          </div>
          <div
            className="h-2 w-36 rounded-full"
            style={{ background: "linear-gradient(to right, #2563eb, #22c55e, #eab308, #ef4444)" }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Quiet</span>
            <span>Busy</span>
            <span>Party</span>
          </div>
        </div>
      )}

      {/* Search bar */}
      {!pinDialog.open && (
      <div className="absolute top-3 left-4 right-20 z-[400]">
        {searchOpen ? (
          <div className="rounded-2xl bg-card shadow-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search places, docks, pins, and people..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                aria-label="Close search"
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {searchQuery.trim() && (
              <div className="max-h-72 overflow-y-auto border-t border-border">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No matches found.</p>
                ) : (
                  searchResults.map((r) => (
                    <button
                      key={r.key}
                      onClick={r.onSelect}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-left transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">{r.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-full bg-card shadow-md border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4" /> Search the lake
          </button>
        )}
      </div>
      )}

      {/* Floating map controls */}
      <div className="absolute top-[80px] right-4 z-[400] flex flex-col items-center gap-3">
        {/* Who's on the lake */}
        <Button
          size="icon"
          className="h-10 w-10 rounded-full shadow-md bg-card text-foreground border border-border hover:bg-muted relative"
          onClick={() => setPresenceOpen(true)}
          aria-label="Who's on the lake"
        >
          <span className="text-lg leading-none">⚓</span>
          {onlineCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
              {onlineCount}
            </span>
          )}
        </Button>

        {/* Heatmap mode toggle */}
        <Button
          size="icon"
          className={`h-10 w-10 rounded-full shadow-md border relative ${
            heatmapOn
              ? "bg-gradient-to-br from-red-500 via-amber-400 to-emerald-500 text-white border-transparent"
              : "bg-card text-foreground border-border hover:bg-muted"
          }`}
          onClick={() => setHeatmapOn((v) => !v)}
          aria-label="Heatmap mode"
          aria-pressed={heatmapOn}
        >
          <Flame className="h-5 w-5" />
        </Button>

        {/* Add-pin FAB: smaller and softer so it doesn't dominate */}
        <Button
          size="icon"
          className="h-10 w-10 rounded-full shadow-md bg-[hsl(40,68%,58%)] text-accent-foreground hover:bg-[hsl(40,68%,52%)]"
          onClick={handleFabClick}
        >
          <Plus className="h-5 w-5" />
        </Button>

        {/* Combined zoom + locate stack in one clean pill */}
        <div className="flex flex-col rounded-full bg-card shadow-md border border-border overflow-hidden">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(1)}
            className="h-10 w-10 flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-px bg-border mx-2" />
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(-1)}
            className="h-10 w-10 flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="h-px bg-border mx-2" />
          <button
            type="button"
            aria-label="Center on me"
            onClick={flyToMe}
            className="h-10 w-10 flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Crosshair className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Who's on the lake panel */}
      <AnimatePresence>
        {presenceOpen && (
          <>
            <motion.div
              key="presence-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[650] bg-black/30"
              onClick={() => setPresenceOpen(false)}
            />
            <motion.div
              key="presence-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute top-0 right-0 bottom-0 z-[660] w-[85%] max-w-sm bg-card shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="font-bold text-lg">Who's on the lake</h2>
                  <p className="text-xs text-muted-foreground">{onlineCount} {onlineCount === 1 ? "person" : "people"} out right now</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setPresenceOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {meOnWater && (
                  <button
                    onClick={() => flyToLocation(me!.currentLng!, me!.currentLat!, { kind: "me", data: me })}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left transition-colors"
                  >
                    <UserAvatar name={me!.displayName} username={me!.username} avatarUrl={me!.avatarUrl} online className="w-11 h-11" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">You</p>
                      <p className="text-xs text-muted-foreground truncate">{me!.boatName ? `🚤 ${me!.boatName}` : "On the lake"}</p>
                    </div>
                  </button>
                )}
                {onWaterFriends.length === 0 ? (
                  <div className="text-center py-12 px-6 flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-2xl">⚓</div>
                    <p className="font-semibold text-sm mb-1">Quiet waters</p>
                    <p className="text-xs text-muted-foreground max-w-[200px]">No one's out on the water right now.</p>
                  </div>
                ) : (
                  [...onWaterFriends]
                    .sort((a: any, b: any) => Number(b.isOnline) - Number(a.isOnline))
                    .map((f: any) => (
                      <button
                        key={f.userId}
                        onClick={() => flyToLocation(f.lng, f.lat, { kind: "friend", data: f })}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left transition-colors"
                      >
                        <UserAvatar name={f.displayName} username={f.username} avatarUrl={f.avatarUrl} online={f.isOnline} className="w-11 h-11" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{f.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{f.boatName ? `🚤 ${f.boatName}` : f.isOnline ? "Online now" : "On the lake"}</p>
                        </div>
                        {f.isOnline && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />}
                      </button>
                    ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-up detail card */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="detail-card"
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="absolute bottom-0 left-0 right-0 z-[600] px-3 pb-3"
          >
            <DetailCard
              selected={selected}
              onClose={() => setSelected(null)}
              onSelect={(sel) => setSelected(sel)}
              onZoom={(lng, lat, zoom) => {
                mapRef.current?.easeTo({ center: [lng, lat], zoom });
                setSelected(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin Creation Dialog */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{pinMode === "dock" ? "Place a Dock Sign" : pinMode === "landmark" ? "Name a Landmark" : "Drop a Pin"}</DialogTitle>
            <DialogDescription>
              {pinMode === "dock"
                ? "Add a wooden sign that labels a dock or shoreline spot for everyone."
                : pinMode === "landmark"
                ? "Give a place on the lake a name everyone can find."
                : "Mark a spot on the lake for others to see."}
            </DialogDescription>
          </DialogHeader>

          {/* Choose what you're adding */}
          <div className={`grid ${me?.isAdmin ? "grid-cols-3" : "grid-cols-2"} gap-2 rounded-xl bg-muted p-1`}>
            <button
              type="button"
              onClick={() => setPinMode("pin")}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                pinMode === "pin" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📌 Drop a Pin
            </button>
            <button
              type="button"
              onClick={() => setPinMode("landmark")}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                pinMode === "landmark" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📍 Landmark
            </button>
            {me?.isAdmin && (
              <button
                type="button"
                onClick={() => setPinMode("dock")}
                className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                  pinMode === "dock" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🪧 Dock Sign
              </button>
            )}
          </div>

          <div className="grid gap-4 py-4">
            {pinMode === "pin" && (
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={pinType} onValueChange={(v: PinInputType) => setPinType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fishing_spot">🎣 Fishing Spot</SelectItem>
                    <SelectItem value="cliff">🏔️ Cliff Jumping</SelectItem>
                    <SelectItem value="waterfall">💧 Waterfall</SelectItem>
                    <SelectItem value="rope_swing">🪢 Rope Swing</SelectItem>
                    <SelectItem value="shallow_water">🏖️ Shallow Water</SelectItem>
                    <SelectItem value="tubing">🛟 Tubing</SelectItem>
                    <SelectItem value="skiing">🎿 Skiing</SelectItem>
                    <SelectItem value="houseboat">🛥️ Houseboat</SelectItem>
                    <SelectItem value="campsite">🏕️ Campsite</SelectItem>
                    <SelectItem value="marina">⛵ Marina</SelectItem>
                    <SelectItem value="hazard">⚠️ Hazard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {pinMode === "pin" && pinType === "hazard" && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                <div className="grid gap-2">
                  <Label>Severity</Label>
                  <Select value={pinSeverity} onValueChange={(v: "low" | "medium" | "high") => setPinSeverity(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟡 Low — heads up</SelectItem>
                      <SelectItem value="medium">🟠 Medium — caution</SelectItem>
                      <SelectItem value="high">🔴 High — danger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Clears after</Label>
                  <Select value={pinExpiresHours} onValueChange={(v) => setPinExpiresHours(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">1 day</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="0">Until removed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  High-severity hazards alert everyone on the lake right away.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="title">{pinMode === "dock" ? "Sign text" : pinMode === "landmark" ? "Landmark name" : "Title"}</Label>
              <Input
                id="title"
                placeholder={pinMode === "dock" ? "e.g. Sunset Marina" : pinMode === "landmark" ? "e.g. Eagle Point" : "e.g. Great Bass Spot"}
                value={pinTitle}
                onChange={(e) => setPinTitle(e.target.value)}
              />
            </div>

            {pinMode === "dock" && (
              <div className="grid gap-2">
                <Label>Dock emoji</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {DOCK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setDockEmoji(em)}
                      className={`flex h-9 items-center justify-center rounded-lg text-xl transition-colors ${
                        dockEmoji === em
                          ? "bg-primary/15 ring-2 ring-primary"
                          : "bg-muted hover:bg-muted/70"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Shown above the sign when zoomed in close.</p>
              </div>
            )}

            {pinMode !== "dock" && (
            <>
            <div className="grid gap-2">
              <Label htmlFor="desc">Description (Optional)</Label>
              <Textarea id="desc" placeholder="Any tips or warnings?" value={pinDesc} onChange={(e) => setPinDesc(e.target.value)} className="resize-none" />
            </div>

            <div className="grid gap-2">
              <Label>Photo (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {pinImageUrl ? (
                <div className="relative overflow-hidden rounded-xl border border-border">
                  <img src={`/api/storage${pinImageUrl}`} alt="Pin" className="h-40 w-full object-cover" />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-7 w-7 rounded-full"
                    onClick={() => setPinImageUrl(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {isUploading ? "Uploading…" : "Add a photo"}
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Who can see this?</Label>
              <Select value={pinVisibility} onValueChange={(v: "friends" | "public" | "community") => setPinVisibility(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friends">Friends only</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                </SelectContent>
              </Select>
              {pinVisibility === "friends" && (
                <p className="text-xs text-muted-foreground">Only your friends and people viewing your profile will see this pin.</p>
              )}
              {pinVisibility === "public" && !pinNeedsApproval && (
                <p className="text-xs text-muted-foreground">Everyone on the lake can see this pin.</p>
              )}
              {pinVisibility === "community" && !pinNeedsApproval && (
                <p className="text-xs text-muted-foreground">Goes live for everyone on the lake.</p>
              )}
              {pinNeedsApproval && (
                <p className="text-xs text-muted-foreground">
                  {pinMode === "landmark"
                    ? "Landmarks go live for everyone once an admin approves them."
                    : "Goes live for everyone once an admin approves it. Add a start or end time to skip approval."}
                </p>
              )}
            </div>
            </>
            )}

            {pinMode === "pin" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="start">Starts (Optional)</Label>
                  <Input id="start" type="datetime-local" value={pinStart} onChange={(e) => setPinStart(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end">Ends (Optional)</Label>
                  <Input id="end" type="datetime-local" value={pinEnd} onChange={(e) => setPinEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePinDialog}>Cancel</Button>
            <Button
              onClick={pinMode === "dock" ? submitDockLabel : submitPin}
              disabled={!pinTitle || (pinMode === "dock" ? createDockLabel.isPending : createPin.isPending)}
            >
              {pinMode === "dock"
                ? "Place Dock Sign"
                : pinNeedsApproval
                ? pinMode === "landmark"
                  ? "Submit Landmark"
                  : "Submit Pin"
                : pinMode === "landmark"
                ? "Add Landmark"
                : "Drop Pin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Slide-up social-style detail card ---
function DetailCard({
  selected,
  onClose,
  onSelect,
  onZoom,
}: {
  selected: NonNullable<Selected>;
  onClose: () => void;
  onSelect?: (sel: Selected) => void;
  onZoom?: (lng: number, lat: number, zoom: number) => void;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const likePin = useLikePin();
  const favoritePin = useToggleFavoritePin();
  const deletePin = useDeletePin();
  const deleteDockLabel = useDeleteDockLabel();
  const { data: freshPins } = useGetPins({});

  if (selected.kind === "boatCluster") {
    const { friends, boatCount, lng, lat, expansionZoom } = selected.data;
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl shrink-0">🚤</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{boatCount} boats here</h3>
            <p className="text-xs text-muted-foreground">Tap someone to see their boat</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1 -mt-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto px-2">
          {friends.map((f) => (
            <button
              key={f.userId}
              onClick={() => onSelect?.({ kind: "friend", data: f })}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left transition-colors"
            >
              <UserAvatar name={f.displayName} username={f.username} avatarUrl={f.avatarUrl} online={f.isOnline} className="w-11 h-11" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{f.displayName || f.username || "Friend"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {f.boatName ? `🚤 ${f.boatName}` : f.isOnline ? "Online now" : "On the lake"}
                </p>
              </div>
              {f.isOnline && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={() => onZoom?.(lng, lat, expansionZoom)}>
            <Search className="w-4 h-4 mr-2" /> Zoom in to spread out
          </Button>
        </div>
      </div>
    );
  }

  if (selected.kind === "boatGroup") {
    const { members } = selected.data;
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl shrink-0">🚤</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{members.length} aboard</h3>
            <p className="text-xs text-muted-foreground">On one boat together</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1 -mt-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto px-2 pb-3">
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => onSelect?.(m.isMe ? { kind: "me", data: me } : { kind: "friend", data: m })}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left transition-colors"
            >
              <UserAvatar name={m.displayName} username={m.username} avatarUrl={m.avatarUrl} online={m.isOnline} className="w-11 h-11" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {m.displayName || m.username || "Friend"}
                  {m.isMe && <span className="text-muted-foreground font-normal"> (You)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.boatName ? `🚤 ${m.boatName}` : m.isOnline ? "Online now" : "On the lake"}
                </p>
              </div>
              {m.isOnline && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selected.kind === "pinCluster") {
    const { pins, lng, lat, expansionZoom } = selected.data;
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl shrink-0">📍</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{pins.length} spots here</h3>
            <p className="text-xs text-muted-foreground">Tap one to see details</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1 -mt-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto px-2">
          {pins.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect?.({ kind: "pin", data: p })}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
                {getPinEmoji(p.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground truncate">{getPinCategory(p.type)}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={() => onZoom?.(lng, lat, expansionZoom)}>
            <Plus className="w-4 h-4 mr-2" /> Zoom in
          </Button>
        </div>
      </div>
    );
  }

  if (selected.kind === "dockLabel") {
    const d = selected.data;
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl shrink-0">🪧</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{d.label}</h3>
            <p className="text-xs text-muted-foreground">Dock sign</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1 -mt-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {me?.isAdmin && (
          <div className="p-4 pt-0">
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteDockLabel.isPending}
              onClick={() =>
                deleteDockLabel.mutate(
                  { labelId: d.id },
                  {
                    onSuccess: () => {
                      toast.success("Dock sign removed");
                      queryClient.invalidateQueries({ queryKey: getGetDockLabelsQueryKey() });
                      onClose();
                    },
                  },
                )
              }
            >
              <Trash2 className="w-4 h-4 mr-2" /> Remove sign
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (selected.kind === "place") {
    const place = selected.data;
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl shrink-0">
            {placeEmoji(place.category)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{place.name}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{place.category}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1 -mt-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 p-4 pt-0">
          <Button className="flex-1 bg-primary hover:bg-primary/90" asChild>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">
              <Navigation className="w-4 h-4 mr-2" /> Navigate here
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (selected.kind === "pin") {
    const pin = freshPins?.find((p) => p.id === selected.data.id) ?? selected.data;
    const isOwner = me != null && (pin.userId === me.id || me.isAdmin);
    const isLandmark = pin.type === "landmark";
    const refreshPins = () => {
      queryClient.invalidateQueries({ queryKey: getGetPinsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetFavoritePinsQueryKey() });
    };
    const handleDelete = () => {
      deletePin.mutate(
        { pinId: pin.id },
        {
          onSuccess: () => {
            toast.success(`${isLandmark ? "Landmark" : "Pin"} deleted.`);
            refreshPins();
            onClose();
          },
          onError: () => toast.error("Couldn't delete that. Please try again."),
        }
      );
    };
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-2xl shrink-0">
            {getPinEmoji(pin.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight truncate">{pin.title}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              By {pin.user?.displayName || "Unknown"}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1 -mt-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        {pin.description && <p className="px-4 -mt-1 text-sm text-muted-foreground">{pin.description}</p>}
        {pin.imageUrl && (
          <ClickableImage src={`/api/storage${pin.imageUrl}`} alt={pin.title} className="mt-3 w-full max-h-60 object-cover" />
        )}
        {(pin.startTime || pin.endTime) && (
          <p className="px-4 mt-2 text-xs text-primary font-medium">{formatPinWindow(pin.startTime, pin.endTime)}</p>
        )}
        <div className="flex items-center gap-2 px-4 pt-3">
          <Button
            variant={pin.likedByMe ? "default" : "outline"}
            size="sm"
            className={pin.likedByMe ? "bg-destructive hover:bg-destructive/90" : ""}
            onClick={() => {
              likePin.mutate({ pinId: pin.id }, { onSuccess: refreshPins, onError: () => toast.error("Couldn't like that pin.") });
            }}
          >
            <Heart className={`w-4 h-4 mr-1.5 ${pin.likedByMe ? "fill-current" : ""}`} /> {pin.likeCount ?? 0}
          </Button>
          <Button
            variant={pin.favoritedByMe ? "default" : "outline"}
            size="sm"
            className={pin.favoritedByMe ? "bg-amber-500 hover:bg-amber-500/90 text-white" : ""}
            onClick={() => {
              favoritePin.mutate({ pinId: pin.id }, { onSuccess: refreshPins, onError: () => toast.error("Couldn't update favorites.") });
            }}
          >
            <Star className={`w-4 h-4 mr-1.5 ${pin.favoritedByMe ? "fill-current" : ""}`} /> {pin.favoritedByMe ? "Saved" : "Save"}
          </Button>
        </div>
        <div className="flex items-center gap-2 p-4 pt-3">
          <Button className="flex-1 bg-primary hover:bg-primary/90" asChild>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer">
              <Navigation className="w-4 h-4 mr-2" /> Navigate here
            </a>
          </Button>
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${isLandmark ? "landmark" : "pin"}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this {isLandmark ? "landmark" : "pin"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{pin.title}" will be permanently removed from the map. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deletePin.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }

  const u = selected.data;
  const isMe = selected.kind === "me";
  const userId = isMe ? "me" : u.userId;
  const lat = isMe ? u.currentLat : u.lat;
  const lng = isMe ? u.currentLng : u.lng;

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Link href={`/profile/${userId}`} className="no-underline text-inherit">
          <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl} online={u.isOnline} className="w-14 h-14" />
        </Link>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg leading-tight truncate">
            {isMe ? "You are here" : u.displayName}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {u.boatName ? `🚤 ${u.boatName}` : u.isOnline ? "Online now" : "On the lake"}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 -mr-1" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex gap-2 p-4 pt-0">
        <Button className="flex-1 bg-primary hover:bg-primary/90" asChild>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer">
            <Navigation className="w-4 h-4 mr-2" /> Nav
          </a>
        </Button>
        {!isMe && (
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/messages?user=${u.userId}`}>
              <MessageSquare className="w-4 h-4 mr-2" /> Chat
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

const MAP_CSS = `
  .maplibregl-map { height: 100%; width: 100%; font-family: inherit; }
  .maplibregl-ctrl-top-right { margin-top: 140px; }

  /* iOS hardening: a stationary press-and-hold on the map (Safari + the
   * Capacitor webview) otherwise triggers the native selection callout /
   * magnifier, which swallows or fights the long-press-to-drop-a-pin gesture.
   * Scoped to the map canvas + markers only, so the selectable overlay UI
   * (search, panels) is unaffected. maplibre's canvas already sets
   * touch-action: none; this adds the callout/selection suppression. */
  .maplibregl-canvas-container,
  .maplibregl-canvas,
  .maplibregl-marker,
  .ln {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* ================= Friend marker: profile pic above a boat ================= */
  .snap-marker { cursor: pointer; will-change: transform; }
  .snap-scale {
    position: relative;
    width: 72px;
    height: 116px;
    transform-origin: bottom center;
    transition: transform 0.18s ease-out;
  }
  /* whole group bobs up and down on the water */
  .snap-bob {
    position: absolute;
    left: 50%;
    bottom: 16px;
    width: 64px;
    height: 84px;
    transform: translateX(-50%);
    animation: snapBob 3.4s ease-in-out infinite;
  }
  @keyframes snapBob {
    0%, 100% { transform: translateX(-50%) translateY(0) scale(1); }
    30% { transform: translateX(-50%) translateY(-5px) scale(1.01); }
    50% { transform: translateX(-50%) translateY(-8px) scale(1.02); }
    70% { transform: translateX(-50%) translateY(-4px) scale(1.01); }
  }
  /* profile photo mounted on the boat like a captain at the helm */
  .snap-photo {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid;
    background: #fff;
    box-shadow: 0 4px 9px rgba(0,0,0,0.32), 0 0 0 3px rgba(255,255,255,0.9);
    overflow: hidden;
    z-index: 4;
  }
  .snap-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .snap-initials {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 16px;
  }
  .snap-online {
    position: absolute;
    bottom: 1px; right: 1px;
    width: 11px; height: 11px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
    animation: snapPulse 1.8s ease-in-out infinite;
  }
  @keyframes snapPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
    50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
  }
  /* boat hull rocks gently side to side at the waterline */
  .snap-boat {
    position: absolute;
    left: 50%;
    bottom: 0;
    line-height: 0;
    z-index: 2;
    filter: drop-shadow(0 5px 5px rgba(11,58,91,0.30));
    transform-origin: 50% 85%;
    animation: snapRock 2.9s ease-in-out infinite;
  }
  @keyframes snapRock {
    0%, 100% { transform: translateX(-50%) rotate(-7deg); }
    28% { transform: translateX(-50%) rotate(6deg); }
    50% { transform: translateX(-50%) rotate(-2deg); }
    72% { transform: translateX(-50%) rotate(7deg); }
  }
  /* neon underglow accessory: glowing colored halo under the hull */
  .snap-underglow {
    position: absolute;
    left: 50%;
    bottom: 4px;
    width: 50px;
    height: 13px;
    margin-left: -25px;
    border-radius: 50%;
    filter: blur(6px);
    opacity: 0.85;
    z-index: 1;
    animation: snapNeon 1.8s ease-in-out infinite;
  }
  @keyframes snapNeon {
    0%, 100% { opacity: 0.55; transform: scaleX(0.92); }
    50% { opacity: 0.95; transform: scaleX(1.05); }
  }
  /* pennant flag accessory flying off the stern */
  .snap-flag {
    position: absolute;
    left: 6px;
    bottom: 30px;
    line-height: 0;
    z-index: 3;
    transform-origin: bottom left;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
    animation: snapFlag 2.4s ease-in-out infinite;
  }
  @keyframes snapFlag {
    0%, 100% { transform: rotate(-4deg); }
    50% { transform: rotate(4deg); }
  }
  /* soft foamy wake highlight on the water under the boat */
  .snap-wake {
    position: absolute;
    left: 50%;
    bottom: 12px;
    width: 54px;
    height: 14px;
    margin-left: -27px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%);
    opacity: 0.7;
    pointer-events: none;
    animation: snapWake 3.2s ease-in-out infinite;
  }
  @keyframes snapWake {
    0%, 100% { transform: scaleX(0.9); opacity: 0.5; }
    50% { transform: scaleX(1.08); opacity: 0.8; }
  }
  /* expanding water ripple rings at the boat's waterline */
  .snap-ring {
    position: absolute;
    left: 50%;
    bottom: 16px;
    width: 40px; height: 16px;
    margin-left: -20px;
    border-radius: 50%;
    border: 2px solid;
    opacity: 0;
    animation: snapRipple 2.8s ease-out infinite;
    pointer-events: none;
  }
  .snap-ring-delay { animation-delay: 1.4s; }
  @keyframes snapRipple {
    0% { transform: scale(0.5); opacity: 0.6; }
    100% { transform: scale(2.6); opacity: 0; }
  }

  /* ---- Crew (same-boat) marker: fanned photos sitting above one shared hull ---- */
  .snap-crew {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: row;
    align-items: center;
    z-index: 4;
  }
  /* override the single-captain absolute photo so faces sit side-by-side */
  .snap-photo-mini {
    position: relative;
    left: auto; bottom: auto;
    transform: none;
    width: 30px; height: 30px;
    border-width: 2px;
    margin-left: -10px;
  }
  .snap-photo-mini:first-child { margin-left: 0; }
  .snap-photo-mini.is-me {
    box-shadow: 0 4px 9px rgba(0,0,0,0.32), 0 0 0 3px #38bdf8;
  }
  .snap-crew-more {
    margin-left: -8px;
    min-width: 26px; height: 28px;
    padding: 0 7px;
    border-radius: 999px;
    background: #0f2942;
    color: #fff;
    font-size: 12px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
    box-shadow: 0 4px 9px rgba(0,0,0,0.3);
  }
  .snap-crew-label {
    position: absolute;
    left: 50%; bottom: 2px;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 11px; font-weight: 800;
    color: #fff;
    background: rgba(8,25,40,0.85);
    padding: 1px 8px;
    border-radius: 999px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    z-index: 5;
  }
  .snap-marker.on-land .snap-crew { bottom: 0; }

  /* ---- On land: hide the boat + all water effects, show only the profile photo ---- */
  .snap-marker.on-land .snap-boat,
  .snap-marker.on-land .snap-wake,
  .snap-marker.on-land .snap-ring,
  .snap-marker.on-land .snap-underglow,
  .snap-marker.on-land .snap-flag {
    display: none !important;
  }
  /* drop the floating "captain above the boat" offset and stop the water bob so
     the circular photo sits centered right on the person's spot on shore */
  .snap-marker.on-land .snap-bob {
    bottom: -7px;
    animation: none;
  }
  .snap-marker.on-land .snap-photo {
    bottom: 0;
  }

  /* ================= Lake place label (Snap Map style) ================= */
  .lake-pin { cursor: pointer; will-change: transform; }
  .lake-pin-scale {
    position: relative;
    transform-origin: center center;
    transition: transform 0.18s ease-out;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  /* Floating row: round emoji badge + colored text label */
  .place-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 7px;
    animation: pinFloat 4s ease-in-out infinite;
  }
  .place-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    background: #ffffff;
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,0.95);
  }
  .place-badge.tier-high {
    width: 34px; height: 34px;
    box-shadow: 0 5px 13px rgba(0,0,0,0.28);
  }
  .place-badge.tier-low {
    width: 26px; height: 26px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.24);
  }
  .place-badge-emoji { line-height: 1; }
  .place-badge.tier-high .place-badge-emoji { font-size: 17px; }
  .place-badge.tier-low .place-badge-emoji { font-size: 13px; }
  .place-text {
    display: flex;
    flex-direction: column;
    line-height: 1.08;
  }
  .place-title {
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(255,255,255,0.95), 0 0 4px rgba(255,255,255,0.85);
  }
  .place-sub {
    font-size: 10px;
    font-weight: 700;
    opacity: 0.82;
    text-shadow: 0 1px 2px rgba(255,255,255,0.95);
  }
  @keyframes pinFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  /* ================= Pin cluster bubble ================= */
  .pin-cluster {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: linear-gradient(180deg, #ffffff 0%, #eaf6ff 100%);
    border: 2px solid #38bdf8;
    box-shadow: 0 6px 16px rgba(2,132,199,0.35);
    color: #0369a1;
    font-weight: 800;
  }
  .pin-cluster .pin-cluster-emoji { line-height: 1; }
  .pin-cluster.cluster-sm { width: 36px; height: 36px; }
  .pin-cluster.cluster-md { width: 44px; height: 44px; }
  .pin-cluster.cluster-lg { width: 54px; height: 54px; }
  .pin-cluster.cluster-sm .pin-cluster-emoji { font-size: 18px; }
  .pin-cluster.cluster-md .pin-cluster-emoji { font-size: 22px; }
  .pin-cluster.cluster-lg .pin-cluster-emoji { font-size: 26px; }
  /* Bubble + friendly count label sit on a single row (no bobbing). */
  .cluster-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 7px;
  }
  .cluster-label { color: #0369a1; }
  .pin-cluster { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
  /* Activity-mode emphasis: dense clusters glow amber while the heatmap is on. */
  .pin-cluster.cluster-hot {
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245,158,11,0.28), 0 6px 18px rgba(245,158,11,0.45);
  }

  /* ================= MapLibre controls polish ================= */
  .maplibregl-ctrl-group {
    border-radius: 12px !important;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18) !important;
  }

  /* ================= Admin dock signs ================= */
  /* Snap/Google-Maps-style labels that morph across zoom tiers:
     far = anchor icon chip, medium = icon + name pill, close = wooden sign. */
  .dock-sign { cursor: pointer; opacity: 1; transition: opacity 0.4s ease; will-change: opacity; }
  .dock-sign.is-faded { opacity: 0; pointer-events: none; }
  /* Smooth zoom scaling lives on this wrapper so it never fights MapLibre's
     positioning transform on the marker root, nor the bob animation below. */
  .dock-scale { transform-origin: bottom center; transition: transform 0.25s ease; }
  .dock-sign-bob {
    position: relative; display: flex; flex-direction: column; align-items: center;
    animation: dockBob 4s ease-in-out infinite;
  }
  @keyframes dockBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2.5px); } }

  /* The pill — clean white label by default (medium tier). */
  .dock-pill {
    position: relative; display: flex; align-items: center; gap: 5px;
    max-width: min(180px, 46vw); padding: 4px 9px; border-radius: 999px;
    background: rgba(255,255,255,0.97);
    border: 1.5px solid rgba(2,132,199,0.30);
    box-shadow: 0 3px 10px rgba(2,40,70,0.22);
    transition: max-width 0.35s ease, padding 0.3s ease, gap 0.3s ease,
      background 0.35s ease, border-color 0.35s ease, border-radius 0.35s ease;
  }
  .dock-ico { font-size: 14px; line-height: 1; flex: none; }

  /* The admin-chosen emoji — collapsed until the close tier, then sits above the pill. */
  .dock-emoji {
    font-size: 0; line-height: 1; opacity: 0; margin-bottom: 0; user-select: none;
    filter: drop-shadow(0 3px 4px rgba(2,40,70,0.35));
    transition: font-size 0.3s ease, opacity 0.3s ease, margin-bottom 0.3s ease;
  }
  .dock-sign.tier-near .dock-emoji { font-size: 34px; opacity: 1; margin-bottom: 3px; }
  .dock-name {
    font-size: 12.5px; font-weight: 700; letter-spacing: 0.1px; color: #0b3a55;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: min(140px, 38vw); opacity: 1;
    transition: max-width 0.35s ease, opacity 0.3s ease;
  }

  /* Far tier — collapse to an icon-only chip. */
  .dock-sign.tier-far .dock-pill { gap: 0; padding: 5px; max-width: 30px; }
  .dock-sign.tier-far .dock-name { max-width: 0; opacity: 0; }

  /* Pointer + dot keep the label pinned to the exact location. */
  .dock-stem {
    width: 0; height: 0; margin-top: -1px;
    border-left: 5px solid transparent; border-right: 5px solid transparent;
    border-top: 6px solid rgba(255,255,255,0.97);
    filter: drop-shadow(0 2px 2px rgba(2,40,70,0.22));
    transition: border-top-color 0.35s ease;
  }
  .dock-dot {
    width: 7px; height: 7px; margin-top: 1px; border-radius: 50%;
    background: #0284c7; box-shadow: 0 0 0 2px rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.4);
  }

`;
