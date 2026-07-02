// Well-known named places around Dale Hollow Lake (marinas, resorts, recreation
// areas, towns, and landmarks) shared by the map search and story tagging.
// Coordinates are approximate, placed within each area.
export type LakePlace = { name: string; category: string; lat: number; lng: number; aliases?: string[] };

export const LAKE_PLACES: LakePlace[] = [
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

export const placeEmoji = (category: string) => {
  switch (category.toLowerCase()) {
    case "marina": return "⚓";
    case "dam": return "🌊";
    case "recreation area": return "🏕️";
    case "state park": return "🌲";
    case "town": return "🏘️";
    default: return "📍";
  }
};
