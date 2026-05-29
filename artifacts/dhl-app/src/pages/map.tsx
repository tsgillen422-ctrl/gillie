import React, { useEffect, useState, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGetMe, useGetFriendLocations, useGetPins, useUpdateMyLocation, useCreatePin, getGetPinsQueryKey } from "@workspace/api-client-react";
import { PinInputType } from "@workspace/api-client-react/src/generated/api.schemas";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Navigation, MessageSquare, Plus, Crosshair, ChevronUp, Droplet, X } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedPage } from "./feed";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { AnimatePresence, motion } from "framer-motion";

const LAKE_CENTER: [number, number] = [-85.37, 36.53]; // [lng, lat]
const BASE_ZOOM = 12;
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// --- Snap Map style palette ---
const SNAP = {
  land: "#e8f0e2",
  green: "#d4e7c4",
  greenDeep: "#c6e0b3",
  sand: "#ece6d6",
  water: "#9ed5f0",
  road: "#ffffff",
  roadCasing: "#e2e8dd",
  label: "#7a8a72",
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

// Static boat SVGs — use currentColor so no user data is injected into HTML.
// Sporty speedboat: pointed bow, swept windshield, racing stripe.
const SPEEDBOAT_SVG = `<svg width="56" height="30" viewBox="0 0 56 30" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 13 H44 C50 13 53 15 53.5 17 L48 25 C47 27 45 28 42 28 H14 C11 28 9 27 8 25 Z" fill="currentColor" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M29 6.5 C30.5 6.5 31.5 7 32.5 8 L39 13 H27 V9 C27 7.5 27.5 6.5 29 6.5 Z" fill="#ffffff" opacity="0.92"/>
  <rect x="10" y="14.5" width="33" height="3" rx="1.5" fill="#ffffff" opacity="0.55"/>
</svg>`;

// Pontoon: flat deck on two tubes with a sun canopy.
const PONTOON_SVG = `<svg width="56" height="32" viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="7" y="22.5" width="42" height="5.5" rx="2.75" fill="currentColor" stroke="#ffffff" stroke-width="2"/>
  <rect x="5" y="16" width="46" height="6" rx="2" fill="currentColor" stroke="#ffffff" stroke-width="2"/>
  <rect x="12" y="4.5" width="32" height="4" rx="2" fill="#ffffff" opacity="0.92"/>
  <rect x="13" y="8" width="2.2" height="8" rx="1" fill="#ffffff" opacity="0.7"/>
  <rect x="40.8" y="8" width="2.2" height="8" rx="1" fill="#ffffff" opacity="0.7"/>
</svg>`;

// Sailboat: hull with a tall mainsail and jib.
const SAILBOAT_SVG = `<svg width="56" height="32" viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 22 H48 L43 28 C42 29.5 40 30 38 30 H18 C16 30 14 29.5 13 28 Z" fill="currentColor" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <rect x="27" y="3" width="2" height="19" fill="#ffffff" opacity="0.85"/>
  <path d="M30 4 L30 20 L42 20 Z" fill="#ffffff" opacity="0.92"/>
  <path d="M26 7 L26 20 L17 20 Z" fill="#ffffff" opacity="0.7"/>
</svg>`;

// Kayak: slim hull pointed at both ends with a paddle.
const KAYAK_SVG = `<svg width="56" height="32" viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 19 C12 15 44 15 52 19 C44 23 12 23 4 19 Z" fill="currentColor" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="28" cy="19" rx="4.5" ry="2" fill="#ffffff" opacity="0.6"/>
  <rect x="18" y="10" width="20" height="2.4" rx="1.2" fill="#ffffff" opacity="0.8"/>
</svg>`;

// Jet ski: small sporty personal watercraft with handlebars.
const JETSKI_SVG = `<svg width="56" height="32" viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 20 C10 16 20 15 30 15 C42 15 50 17 52 20 C50 24 44 26 34 26 H16 C11 26 7 23 6 20 Z" fill="currentColor" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <path d="M22 15 C24 12 30 12 33 14 L33 16 H22 Z" fill="#ffffff" opacity="0.85"/>
  <rect x="13" y="11" width="9" height="2" rx="1" fill="#ffffff" opacity="0.8"/>
  <rect x="20" y="12" width="2" height="4" rx="1" fill="#ffffff" opacity="0.7"/>
</svg>`;

// Yacht: larger cruiser with a two-level cabin and windows.
const YACHT_SVG = `<svg width="56" height="32" viewBox="0 0 56 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 19 H50 L45 27 C44 29 42 29.5 39 29.5 H15 C12 29.5 10 29 9 27 Z" fill="currentColor" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <rect x="12" y="12" width="30" height="7" rx="1.5" fill="#ffffff" opacity="0.92"/>
  <rect x="18" y="6" width="16" height="6" rx="1.5" fill="currentColor" stroke="#ffffff" stroke-width="1.5"/>
  <rect x="15" y="14" width="3" height="3" rx="0.6" fill="currentColor" opacity="0.6"/>
  <rect x="21" y="14" width="3" height="3" rx="0.6" fill="currentColor" opacity="0.6"/>
  <rect x="27" y="14" width="3" height="3" rx="0.6" fill="currentColor" opacity="0.6"/>
  <rect x="33" y="14" width="3" height="3" rx="0.6" fill="currentColor" opacity="0.6"/>
</svg>`;

const BOAT_SVGS: Record<string, string> = {
  speedboat: SPEEDBOAT_SVG,
  pontoon: PONTOON_SVG,
  sailboat: SAILBOAT_SVG,
  kayak: KAYAK_SVG,
  jetski: JETSKI_SVG,
  yacht: YACHT_SVG,
};

function boatSvgFor(type?: string | null): string {
  return (type && BOAT_SVGS[type]) || SPEEDBOAT_SVG;
}

// --- Friend (Snap Map style) marker element: profile pic floating above a boat ---
function buildFriendEl(opts: {
  color: string;
  name: string;
  avatarUrl?: string | null;
  online?: boolean;
  isMe?: boolean;
  boatType?: string | null;
}): { root: HTMLDivElement; scale: HTMLDivElement } {
  const { color, name, avatarUrl, online, isMe, boatType } = opts;
  const root = el("div", "snap-marker") as HTMLDivElement;
  const scale = el("div", "snap-scale") as HTMLDivElement;

  // water ripple rings at the boat's waterline
  const ring1 = el("div", "snap-ring");
  ring1.style.borderColor = color;
  const ring2 = el("div", "snap-ring snap-ring-delay");
  ring2.style.borderColor = color;

  // bob group floats up/down as a whole
  const bob = el("div", "snap-bob");

  // profile photo on top
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

  // little stem connecting photo to boat
  const stem = el("div", "snap-stem");
  stem.style.background = color;

  // boat beneath the photo, rocking on the water
  const boat = el("div", "snap-boat");
  boat.style.color = color;
  boat.innerHTML = boatSvgFor(boatType); // static markup, no user data

  bob.appendChild(photo);
  bob.appendChild(stem);
  bob.appendChild(boat);

  const chip = el("div", "snap-chip");
  chip.textContent = isMe ? "You" : name;

  scale.appendChild(ring1);
  scale.appendChild(ring2);
  scale.appendChild(bob);
  scale.appendChild(chip);
  root.appendChild(scale);
  return { root, scale };
}

// --- Lake pin (emoji pill) marker element ---
function buildPinEl(opts: { emoji: string; title: string; delay: number }): {
  root: HTMLDivElement;
  scale: HTMLDivElement;
} {
  const { emoji, title, delay } = opts;
  const root = el("div", "lake-pin") as HTMLDivElement;
  const scale = el("div", "lake-pin-scale") as HTMLDivElement;

  const pill = el("div", "pin-pill");
  pill.style.animationDelay = `${delay}s`;

  const emojiEl = el("span", "pin-pill-emoji");
  emojiEl.textContent = emoji;
  const label = el("span", "pin-pill-label");
  label.textContent = title;

  pill.appendChild(emojiEl);
  pill.appendChild(label);

  scale.appendChild(pill);
  scale.appendChild(el("div", "pin-pill-stem"));
  root.appendChild(scale);
  return { root, scale };
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

  // Track scalable marker elements so we can resize on zoom.
  const scaleEls = useRef<Set<HTMLDivElement>>(new Set());
  const friendMarkers = useRef<maplibregl.Marker[]>([]);
  const pinMarkers = useRef<maplibregl.Marker[]>([]);
  const meMarker = useRef<maplibregl.Marker | null>(null);

  const [selected, setSelected] = useState<Selected>(null);
  const [mapError, setMapError] = useState(false);

  const [pinDialog, setPinDialog] = useState<{ open: boolean; lat?: number; lng?: number }>({ open: false });
  const [pinTitle, setPinTitle] = useState("");
  const [pinDesc, setPinDesc] = useState("");
  const [pinType, setPinType] = useState<PinInputType>("fishing_spot");
  const [pinVisibility, setPinVisibility] = useState<"friends" | "public" | "community">("friends");
  const [pinStart, setPinStart] = useState("");
  const [pinEnd, setPinEnd] = useState("");

  const applyZoomScale = useCallback((zoom: number) => {
    const s = scaleForZoom(zoom);
    scaleEls.current.forEach((el) => {
      el.style.transform = `scale(${s})`;
    });
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

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

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

          // water: livelier shimmer around the Snap pastel blue
          const wHue = 200 + Math.sin(t * 0.6) * 10;
          const wLight = 77 + Math.sin(t * 1.1 + 1) * 7;
          const wSat = 80 + Math.sin(t * 0.8) * 9;
          const waterColor = `hsl(${wHue.toFixed(1)}, ${wSat.toFixed(1)}%, ${wLight.toFixed(1)}%)`;
          waterLayers.forEach((id) => {
            if (map.getLayer(id)) {
              try {
                map.setPaintProperty(id, "fill-color", waterColor);
              } catch {}
            }
          });

          // land: gentle "breathing" green that drifts in hue and brightness
          const lHue = 96 + Math.sin(t * 0.35 + 0.5) * 8;
          const lLight = 80 + Math.sin(t * 0.5) * 4;
          const lSat = 45 + Math.sin(t * 0.4 + 2) * 8;
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
      });
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
  }, [friends, styleReady, applyZoomScale]);

  // --- Render pin markers ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    pinMarkers.current.forEach((m) => {
      const el = m.getElement().querySelector(".lake-pin-scale") as HTMLDivElement | null;
      if (el) scaleEls.current.delete(el);
      m.remove();
    });
    pinMarkers.current = [];

    pins?.forEach((pin, i) => {
      const { root, scale } = buildPinEl({
        emoji: getPinEmoji(pin.type),
        title: pin.title,
        delay: (i * 0.15) % 3,
      });
      root.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelected({ kind: "pin", data: pin });
      });
      const marker = new maplibregl.Marker({ element: root, anchor: "bottom" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      pinMarkers.current.push(marker);
      scaleEls.current.add(scale);
    });

    applyZoomScale(map.getZoom());
  }, [pins, styleReady, applyZoomScale]);

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
    }
  }, [me, styleReady, applyZoomScale]);

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

  const submitPin = () => {
    if (pinDialog.lat == null || pinDialog.lng == null) return;
    createPin.mutate(
      {
        data: {
          title: pinTitle || "New Spot",
          description: pinDesc,
          type: pinType,
          lat: pinDialog.lat,
          lng: pinDialog.lng,
          visibility: pinVisibility,
          startTime: pinStart ? new Date(pinStart).toISOString() : null,
          endTime: pinEnd ? new Date(pinEnd).toISOString() : null,
        },
      },
      {
        onSuccess: () => {
          toast.success(
            pinVisibility === "community"
              ? "Community pin submitted for approval."
              : "Pin dropped successfully!"
          );
          setPinDialog({ open: false });
          setPinTitle("");
          setPinDesc("");
          setPinVisibility("friends");
          setPinStart("");
          setPinEnd("");
          queryClient.invalidateQueries({ queryKey: getGetPinsQueryKey({}) });
        },
      }
    );
  };

  return (
    <div className="h-full w-full relative bg-blue-50">
      <style dangerouslySetInnerHTML={{ __html: MAP_CSS }} />

      {me && (
        <Link
          href="/profile/me"
          className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border rounded-full pl-1.5 pr-3.5 py-1.5 shadow-lg hover:bg-card transition-colors no-underline text-inherit"
        >
          <UserAvatar name={me.displayName} username={me.username} avatarUrl={me.avatarUrl} online={me.isOnline} className="w-8 h-8" />
          <div className="leading-tight">
            <div className="text-xs font-bold">{me.displayName}</div>
            <div className="text-[10px] text-muted-foreground">View profile</div>
          </div>
        </Link>
      )}

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

      {/* Floating Action Button for Pins */}
      <div className="absolute top-[80px] right-4 z-[400] flex flex-col gap-3">
        <Button size="icon" className="h-12 w-12 rounded-full shadow-lg bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleFabClick}>
          <Plus className="h-6 w-6" />
        </Button>
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-card text-foreground hover:bg-muted"
          onClick={flyToMe}
        >
          <Crosshair className="h-5 w-5" />
        </Button>
      </div>

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

      {/* Floating Bottom Drawer / Panel */}
      <Sheet>
        <SheetTrigger asChild>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-sm">
            <Button variant="outline" className="w-full rounded-full shadow-lg bg-card/90 backdrop-blur-sm border-border h-12 flex items-center justify-between px-6 hover:bg-card">
              <span className="font-semibold flex items-center gap-2">
                <Droplet className="w-4 h-4 text-primary fill-primary" /> Lake Feed
              </span>
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-3xl overflow-hidden flex flex-col bg-background border-border">
          <div className="w-12 h-1.5 bg-muted mx-auto rounded-full mt-3 mb-2 shrink-0" />
          <SheetHeader className="px-4 text-left shrink-0 pb-2">
            <SheetTitle className="sr-only">Lake Feed</SheetTitle>
            <SheetDescription className="sr-only">Community activity on the lake</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto w-full relative">
            <div className="absolute inset-0">
              <FeedPage />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Pin Creation Dialog */}
      <Dialog open={pinDialog.open} onOpenChange={(open) => !open && setPinDialog({ open: false })}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Drop a Pin</DialogTitle>
            <DialogDescription>Mark a spot on the lake for others to see.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
                  <SelectItem value="landmark">📍 Landmark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="e.g. Great Bass Spot" value={pinTitle} onChange={(e) => setPinTitle(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="desc">Description (Optional)</Label>
              <Textarea id="desc" placeholder="Any tips or warnings?" value={pinDesc} onChange={(e) => setPinDesc(e.target.value)} className="resize-none" />
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
                  <SelectItem value="community">Community (needs approval)</SelectItem>
                </SelectContent>
              </Select>
              {pinVisibility === "friends" && (
                <p className="text-xs text-muted-foreground">Only your friends and people viewing your profile will see this pin.</p>
              )}
              {pinVisibility === "public" && (
                <p className="text-xs text-muted-foreground">Everyone on the lake can see this pin.</p>
              )}
              {pinVisibility === "community" && (
                <p className="text-xs text-muted-foreground">Goes live for everyone once an admin approves it.</p>
              )}
            </div>

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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialog({ open: false })}>Cancel</Button>
            <Button onClick={submitPin} disabled={!pinTitle || createPin.isPending}>
              {pinVisibility === "community" ? "Submit Pin" : "Drop Pin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Slide-up social-style detail card ---
function DetailCard({ selected, onClose }: { selected: NonNullable<Selected>; onClose: () => void }) {
  if (selected.kind === "pin") {
    const pin = selected.data;
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
        {(pin.startTime || pin.endTime) && (
          <p className="px-4 mt-2 text-xs text-primary font-medium">{formatPinWindow(pin.startTime, pin.endTime)}</p>
        )}
        <div className="p-4 pt-3">
          <Button className="w-full bg-primary hover:bg-primary/90" asChild>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer">
              <Navigation className="w-4 h-4 mr-2" /> Navigate here
            </a>
          </Button>
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
    width: 64px;
    height: 104px;
    transform-origin: bottom center;
    transition: transform 0.18s ease-out;
  }
  /* whole group bobs up and down on the water */
  .snap-bob {
    position: absolute;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: snapBob 3.2s ease-in-out infinite;
  }
  @keyframes snapBob {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-6px); }
  }
  .snap-photo {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 3px solid;
    background: #fff;
    box-shadow: 0 5px 12px rgba(0,0,0,0.30);
    overflow: hidden;
    z-index: 3;
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
  .snap-stem {
    width: 3px;
    height: 6px;
    margin-top: -1px;
    border-radius: 2px;
    z-index: 1;
  }
  /* boat rocks side to side */
  .snap-boat {
    margin-top: -2px;
    line-height: 0;
    z-index: 2;
    filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));
    transform-origin: 50% 40%;
    animation: snapRock 3.6s ease-in-out infinite;
  }
  @keyframes snapRock {
    0%, 100% { transform: rotate(-7deg); }
    50% { transform: rotate(7deg); }
  }
  .snap-chip {
    position: absolute;
    left: 50%;
    bottom: -2px;
    transform: translateX(-50%);
    background: rgba(255,255,255,0.96);
    color: #0f172a;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    pointer-events: none;
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

  /* ================= Lake pin (emoji pill) ================= */
  .lake-pin { cursor: pointer; will-change: transform; }
  .lake-pin-scale {
    position: relative;
    transform-origin: bottom center;
    transition: transform 0.18s ease-out;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pin-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 160px;
    padding: 5px 11px 5px 7px;
    background: rgba(255,255,255,0.97);
    border-radius: 999px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.28);
    border: 1px solid rgba(0,0,0,0.06);
    animation: pinFloat 4s ease-in-out infinite;
  }
  .pin-pill-emoji { font-size: 16px; line-height: 1; }
  .pin-pill-label {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pin-pill-stem {
    width: 2px;
    height: 9px;
    background: rgba(255,255,255,0.97);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  @keyframes pinFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  /* ================= MapLibre controls polish ================= */
  .maplibregl-ctrl-group {
    border-radius: 12px !important;
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(0,0,0,0.18) !important;
  }
`;
