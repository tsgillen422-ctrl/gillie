import React, { useEffect, useState, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import { useGetMe, useGetFriendLocations, useGetPins, useUpdateMyLocation, useCreatePin, useLikePin, useToggleFavoritePin, useDeletePin, getGetPinsQueryKey, getGetFavoritePinsQueryKey } from "@workspace/api-client-react";
import { PinInputType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Navigation, MessageSquare, Plus, Minus, Crosshair, Droplet, X, ImagePlus, Heart, Star, Search, Trash2 } from "lucide-react";
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
import { UserAvatar } from "@/components/UserAvatar";
import { AnimatePresence, motion } from "framer-motion";
import { useUpload } from "@workspace/object-storage-web";
import { boatSvgFor, FLAG_SVG } from "../boats";

const LAKE_CENTER: [number, number] = [-85.37, 36.53]; // [lng, lat]
const BASE_ZOOM = 12;
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Pin priority tiers control visual weight and clustering behavior.
// High-priority places are always visible, large, and never clustered.
// Low-priority (user-generated) pins are smaller, icon-only, and cluster
// together when zoomed out so the map stays uncluttered near the marina.
const HIGH_PRIORITY_PINS = new Set(["marina", "campsite", "hazard"]);
const pinTier = (type: string): "high" | "low" =>
  HIGH_PRIORITY_PINS.has(type) ? "high" : "low";

// Below this zoom, low-priority pins only appear aggregated inside clusters.
const SECONDARY_PIN_ZOOM = 13.5;

// --- Snap Map style palette ---
const SNAP = {
  land: "#dde6d4",
  green: "#cdddbb",
  greenDeep: "#bdd3a8",
  sand: "#e6dfcd",
  water: "#74c2e8",
  shoreline: "#4f9fcf",
  road: "#ffffff",
  roadCasing: "#e2e8dd",
  label: "#6f7f67",
  labelHalo: "#ffffff",
};

// Recolor the OpenMapTiles "liberty" style into a clean pastel Snap Map look.
function applySnapStyle(map: maplibregl.Map) {
  const layers = map.getStyle().layers || [];
  for (const layer of layers) {
    const id = layer.id;
    const type = layer.type;
    try {
      if (type === "background") {
        map.setPaintProperty(id, "background-color", SNAP.land);
        continue;
      }
      if (type === "fill") {
        if (/water|ocean|lake|river|reservoir|bay/i.test(id)) {
          map.setPaintProperty(id, "fill-color", SNAP.water);
          map.setPaintProperty(id, "fill-opacity", 1);
          // thin shoreline stroke to separate water from land
          map.setPaintProperty(id, "fill-outline-color", SNAP.shoreline);
        } else if (/wood|forest|park|grass|wetland|scrub|nature|landcover_/i.test(id)) {
          map.setPaintProperty(id, "fill-color", SNAP.green);
          map.setPaintProperty(id, "fill-opacity", 0.9);
        } else if (/sand|beach|desert/i.test(id)) {
          map.setPaintProperty(id, "fill-color", SNAP.sand);
        } else if (/building/i.test(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        } else if (/landuse|residential|industrial|commercial|pitch|cemetery/i.test(id)) {
          map.setPaintProperty(id, "fill-color", SNAP.greenDeep);
          map.setPaintProperty(id, "fill-opacity", 0.5);
        } else {
          map.setPaintProperty(id, "fill-color", SNAP.land);
        }
        continue;
      }
      if (type === "fill-extrusion") {
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }
      if (type === "line") {
        if (/water|river|stream|canal|waterway/i.test(id)) {
          map.setPaintProperty(id, "line-color", SNAP.water);
        } else if (/bridge|tunnel|road|street|highway|motorway|trunk|primary|secondary|tertiary|path|transit|rail|service/i.test(id)) {
          if (/casing|outline/i.test(id)) {
            map.setPaintProperty(id, "line-color", SNAP.roadCasing);
          } else {
            map.setPaintProperty(id, "line-color", SNAP.road);
          }
        } else if (/admin|boundary|border/i.test(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        }
        continue;
      }
      if (type === "symbol") {
        if (/poi|building|housenumber|continent|aerodrome|airport|transit/i.test(id)) {
          map.setLayoutProperty(id, "visibility", "none");
        } else {
          if (layer.layout && (layer.layout as any)["text-field"]) {
            map.setPaintProperty(id, "text-color", SNAP.label);
            map.setPaintProperty(id, "text-halo-color", SNAP.labelHalo);
            map.setPaintProperty(id, "text-halo-width", 1.4);
          }
        }
        continue;
      }
    } catch {
      // some layers may not accept a given property — ignore
    }
  }
}

const getPinEmoji = (type: string) => {
  switch (type) {
    case "fishing_spot": return "🎣";
    case "cliff": return "🏔️";
    case "waterfall": return "💧";
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
  if (avatarUrl) {
    const img = el("img") as HTMLImageElement;
    img.src = avatarUrl;
    img.alt = "";
    photo.appendChild(img);
  } else {
    const initials = el("div", "snap-initials");
    initials.style.background = color;
    initials.textContent = initialsOf(name);
    photo.appendChild(initials);
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

// --- Lake pin (emoji pill) marker element ---
// High-priority pins render as a large labelled pill; low-priority pins render
// as a compact icon-only chip (details appear on tap).
function buildPinEl(opts: {
  emoji: string;
  title: string;
  delay: number;
  tier: "high" | "low";
  color: string;
  category: string;
}): {
  root: HTMLDivElement;
  scale: HTMLDivElement;
} {
  const { emoji, title, delay, tier, color, category } = opts;
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

  // High-priority places get a colored text label (no white pill box).
  if (tier === "high") {
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

// --- Cluster bubble marker element (aggregates nearby low-priority pins) ---
// Shows a representative emoji for the group; the bubble grows with the count.
function buildClusterEl(count: number, emoji: string): { root: HTMLDivElement; scale: HTMLDivElement } {
  const root = el("div", "lake-pin") as HTMLDivElement;
  const scale = el("div", "lake-pin-scale") as HTMLDivElement;
  // larger bubble for denser clusters
  const sizeClass = count >= 25 ? "cluster-lg" : count >= 10 ? "cluster-md" : "cluster-sm";
  const bubble = el("div", `pin-cluster ${sizeClass}`);
  const emojiEl = el("span", "pin-cluster-emoji");
  emojiEl.textContent = emoji;
  bubble.appendChild(emojiEl);
  scale.appendChild(bubble);
  root.appendChild(scale);
  return { root, scale };
}

// Pick the most common pin-type emoji among a cluster's leaves.
function dominantClusterEmoji(index: Supercluster, clusterId: number): string {
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
    return getPinEmoji(best);
  } catch {
    return getPinEmoji("");
  }
}

export function MapPage() {
  const { data: me } = useGetMe();
  const { data: friends } = useGetFriendLocations();
  const { data: pins } = useGetPins({});
  const createPin = useCreatePin();
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
  const friendMarkers = useRef<maplibregl.Marker[]>([]);
  const pinMarkers = useRef<maplibregl.Marker[]>([]);
  const meMarker = useRef<maplibregl.Marker | null>(null);
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
  // Who is geospatially over water (vs. on land), keyed by friend userId.
  // Off-screen markers keep their last known state, so unverified people
  // default to "on water" (shown) rather than being hidden incorrectly.
  const [onLandIds, setOnLandIds] = useState<Set<number>>(new Set());
  const onLandRef = useRef<Set<number>>(new Set());
  const [meOnLand, setMeOnLand] = useState(false);
  const meOnLandRef = useRef(false);

  const [pinDialog, setPinDialog] = useState<{ open: boolean; lat?: number; lng?: number }>({ open: false });
  const [pinTitle, setPinTitle] = useState("");
  const [pinDesc, setPinDesc] = useState("");
  const [pinType, setPinType] = useState<PinInputType>("fishing_spot");
  const [pinMode, setPinMode] = useState<"pin" | "landmark">("pin");
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
    friendMarkers.current.forEach((m) => {
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

    let waterRaf = 0;

    map.on("load", () => {
      mapLoaded.current = true;

      // --- Clean pastel Snap Map look ---
      applySnapStyle(map);

      // --- Animated shimmering water + breathing land ---
      const allLayers = map.getStyle().layers || [];
      const waterLayers = allLayers
        .filter((l) => /water|lake|river|reservoir|bay/i.test(l.id) && l.type === "fill")
        .map((l) => l.id);
      waterLayerIds.current = waterLayers;
      const landLayers = allLayers
        .filter(
          (l) =>
            l.type === "fill" &&
            /wood|forest|park|grass|wetland|scrub|nature|landcover_|landuse/i.test(l.id)
        )
        .map((l) => l.id);

      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let lastTick = 0;
      const animateScene = (now: number) => {
        // pause when tab is hidden to save resources
        if (document.visibilityState === "hidden") {
          waterRaf = requestAnimationFrame(animateScene);
          return;
        }
        // throttle to ~15fps — plenty for a slow ambient shimmer, easy on the GPU
        if (now - lastTick > 66) {
          lastTick = now;
          const t = now / 1000;

          // water: livelier shimmer around the Snap pastel blue (a touch darker)
          const wHue = 200 + Math.sin(t * 0.6) * 10;
          const wLight = 69 + Math.sin(t * 1.1 + 1) * 6;
          const wSat = 78 + Math.sin(t * 0.8) * 9;
          const waterColor = `hsl(${wHue.toFixed(1)}, ${wSat.toFixed(1)}%, ${wLight.toFixed(1)}%)`;
          waterLayers.forEach((id) => {
            if (map.getLayer(id)) {
              try {
                map.setPaintProperty(id, "fill-color", waterColor);
              } catch {}
            }
          });

          // land: gentle "breathing" green, more muted so it reads below water
          const lHue = 96 + Math.sin(t * 0.35 + 0.5) * 8;
          const lLight = 75 + Math.sin(t * 0.5) * 4;
          const lSat = 36 + Math.sin(t * 0.4 + 2) * 7;
          const landColor = `hsl(${lHue.toFixed(1)}, ${lSat.toFixed(1)}%, ${lLight.toFixed(1)}%)`;
          landLayers.forEach((id) => {
            if (map.getLayer(id)) {
              try {
                map.setPaintProperty(id, "fill-color", landColor);
              } catch {}
            }
          });
        }
        waterRaf = requestAnimationFrame(animateScene);
      };
      if (!reducedMotion && (waterLayers.length || landLayers.length)) {
        waterRaf = requestAnimationFrame(animateScene);
      }

      setStyleReady(true);
      applyZoomScale(map.getZoom());
    });

    map.on("zoom", () => applyZoomScale(map.getZoom()));

    return () => {
      cancelAnimationFrame(waterRaf);
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

  // --- Share my location ---
  useEffect(() => {
    if (!me || !me.shareLocation) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        updateLocation.mutate({
          data: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.shareLocation]);

  // --- Render friend markers ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    friendMarkers.current.forEach((m) => {
      const el = m.getElement().querySelector(".snap-scale") as HTMLDivElement | null;
      if (el) scaleEls.current.delete(el);
      m.remove();
    });
    friendMarkers.current = [];

    friends?.forEach((friend) => {
      if (friend.lat == null || friend.lng == null) return;
      const color = friend.boatColor || "#0ea5e9";
      const { root, scale } = buildFriendEl({
        color,
        name: friend.displayName || friend.username || "Friend",
        avatarUrl: friend.avatarUrl,
        online: friend.isOnline,
        boatType: friend.boatType,
        boatNeon: friend.boatNeon,
        boatFlag: friend.boatFlag,
        boatAccent: friend.boatAccent,
      });
      root.dataset.userId = String(friend.userId);
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({ kind: "friend", data: friend });
      });
      const marker = new maplibregl.Marker({ element: root, anchor: "bottom", offset: [0, 13] })
        .setLngLat([friend.lng, friend.lat])
        .addTo(map);
      friendMarkers.current.push(marker);
      scaleEls.current.add(scale);
    });

    applyZoomScale(map.getZoom());
    updateLandStates();
  }, [friends, styleReady, applyZoomScale, updateLandStates]);

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

    const addPinMarker = (pin: any) => {
      const tier = pinTier(pin.type);
      const { root, scale } = buildPinEl({
        emoji: getPinEmoji(pin.type),
        title: pin.title,
        delay: (Math.abs((pin.id ?? 0) * 13) % 30) / 10,
        tier,
        color: getPinColor(pin.type),
        category: getPinCategory(pin.type),
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

    // High-priority places: always visible, never clustered.
    allPins.forEach((pin) => {
      if (pin.lat == null || pin.lng == null) return;
      if (pinTier(pin.type) === "high") addPinMarker(pin);
    });

    // Low-priority pins: clustered via supercluster for the current view.
    const index = clusterIndex.current;
    if (index) {
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ];
      const clusters = index.getClusters(bbox, Math.floor(zoom));
      const revealChips = zoom >= SECONDARY_PIN_ZOOM;
      clusters.forEach((c: any) => {
        const [lng, lat] = c.geometry.coordinates;
        if (c.properties.cluster) {
          // A multi-point cluster: bubble shows the dominant emoji, expands on tap.
          const count = c.properties.point_count as number;
          const emoji = dominantClusterEmoji(index, c.properties.cluster_id);
          const { root, scale } = buildClusterEl(count, emoji);
          root.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const expZoom = Math.min(index.getClusterExpansionZoom(c.properties.cluster_id), 18);
            map.easeTo({ center: [lng, lat], zoom: expZoom });
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
  }, [styleReady, applyZoomScale]);

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

    const index = new Supercluster({ radius: 70, maxZoom: 16 });
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
      updateLandStates();
    };
    map.on("moveend", onMoveEnd);
    return () => {
      map.off("moveend", onMoveEnd);
    };
  }, [styleReady, renderPins, updateLandStates]);

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

    if (me?.shareLocation && me?.currentLat != null && me?.currentLng != null) {
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
  }, [me, styleReady, applyZoomScale, updateLandStates]);

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

  // Only people currently on the water (not on land at marinas, restaurants, etc.)
  // belong in the "Who's on the lake" presence list and its count. Businesses
  // (marinas, restaurants, shops) are fixed land places and are always excluded;
  // regular people are additionally hidden when the map detects them over land.
  const onWaterFriends = (friends ?? []).filter(
    (f: any) => f.lat != null && f.lng != null && !f.isBusiness && !onLandIds.has(f.userId)
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
                placeholder="Search pins and people..."
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
            <DetailCard selected={selected} onClose={() => setSelected(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin Creation Dialog */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{pinMode === "landmark" ? "Name a Landmark" : "Drop a Pin"}</DialogTitle>
            <DialogDescription>
              {pinMode === "landmark"
                ? "Give a place on the lake a name everyone can find."
                : "Mark a spot on the lake for others to see."}
            </DialogDescription>
          </DialogHeader>

          {/* Choose what you're adding */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
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
              <Label htmlFor="title">{pinMode === "landmark" ? "Landmark name" : "Title"}</Label>
              <Input
                id="title"
                placeholder={pinMode === "landmark" ? "e.g. Eagle Point" : "e.g. Great Bass Spot"}
                value={pinTitle}
                onChange={(e) => setPinTitle(e.target.value)}
              />
            </div>

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
            <Button onClick={submitPin} disabled={!pinTitle || createPin.isPending}>
              {pinNeedsApproval
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
function DetailCard({ selected, onClose }: { selected: NonNullable<Selected>; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const likePin = useLikePin();
  const favoritePin = useToggleFavoritePin();
  const deletePin = useDeletePin();
  const { data: freshPins } = useGetPins({});

  if (selected.kind === "pin") {
    const pin = freshPins?.find((p) => p.id === selected.data.id) ?? selected.data;
    const isOwner = me != null && pin.userId === me.id;
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
          <img src={`/api/storage${pin.imageUrl}`} alt={pin.title} className="mt-3 w-full max-h-60 object-cover" />
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
    animation: snapBob 3.2s ease-in-out infinite;
  }
  @keyframes snapBob {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-6px); }
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
    transform-origin: 50% 80%;
    animation: snapRock 3.6s ease-in-out infinite;
  }
  @keyframes snapRock {
    0%, 100% { transform: translateX(-50%) rotate(-5deg); }
    50% { transform: translateX(-50%) rotate(5deg); }
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

  /* ================= MapLibre controls polish ================= */
  .maplibregl-ctrl-group {
    border-radius: 12px !important;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18) !important;
  }
`;
