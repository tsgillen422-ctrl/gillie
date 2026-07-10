import React from "react";
import {
  Anchor,
  Coffee,
  Fuel,
  Music,
  Tent,
  Utensils,
  Wifi,
  Waves,
  Wrench,
  Droplets,
  IceCream,
  ShoppingCart,
  Fish,
  Sun,
  Camera,
  Users,
  GlassWater,
  Building,
  Ship,
  BedDouble,
  Info
} from "lucide-react";

// Keys must match BUSINESS_AMENITY_KEYS on the server (routes/businesses.ts).
export const AMENITY_ICONS: Record<string, React.ElementType> = {
  fuel: Fuel,
  restaurant: Utensils,
  bar: GlassWater,
  boat_ramp: Waves,
  dock_slips: Ship,
  campground: Tent,
  rentals: Anchor,
  bait_shop: Fish,
  store: ShoppingCart,
  live_music: Music,
  swimming: Waves,
  fishing: Fish,
  wifi: Wifi,
  showers: Droplets,
  pump_out: Droplets,
  boat_service: Wrench,
  lodging: BedDouble,
  events: Users,
};

export const AMENITY_LABELS: Record<string, string> = {
  fuel: "Fuel Dock",
  restaurant: "Restaurant",
  bar: "Bar",
  boat_ramp: "Boat Ramp",
  dock_slips: "Dock Slips",
  campground: "Campground",
  rentals: "Rentals",
  bait_shop: "Bait Shop",
  store: "Store",
  live_music: "Live Music",
  swimming: "Swimming",
  fishing: "Fishing",
  wifi: "WiFi",
  showers: "Showers",
  pump_out: "Pump Out",
  boat_service: "Boat Service",
  lodging: "Lodging",
  events: "Events",
};

export const HIGHLIGHT_ICONS: Record<string, React.ElementType> = {
  food: Utensils,
  dock: Anchor,
  live_music: Music,
  fishing: Fish,
  fuel: Fuel,
  events: Users,
  campground: Tent,
  store: ShoppingCart,
  boats: Ship,
  sunset: Sun,
  drinks: GlassWater,
  swimming: Waves,
  specials: Coffee,
  rentals: Anchor,
  photos: Camera,
  team: Users,
};

export const HIGHLIGHT_LABELS: Record<string, string> = {
  food: "Food",
  dock: "Dock",
  live_music: "Live Music",
  fishing: "Fishing",
  fuel: "Fuel",
  events: "Events",
  campground: "Camping",
  store: "Store",
  boats: "Boats",
  sunset: "Sunset",
  drinks: "Drinks",
  swimming: "Swimming",
  specials: "Specials",
  rentals: "Rentals",
  photos: "Photos",
  team: "Team",
};

export function getAmenityIcon(key: string) {
  return AMENITY_ICONS[key] || Info;
}

export function getAmenityLabel(key: string) {
  return AMENITY_LABELS[key] || key.replace(/_/g, " ");
}

export function getHighlightIcon(key: string) {
  return HIGHLIGHT_ICONS[key] || Info;
}

export function getHighlightLabel(key: string) {
  return HIGHLIGHT_LABELS[key] || key.replace(/_/g, " ");
}
