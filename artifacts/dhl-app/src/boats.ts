// Boat types + artwork come from the shared @workspace/boat-config package —
// the single source of truth also used by the API server and mobile app.
// Re-exported here so existing imports (`@/boats`) keep working.
export {
  BOAT_TYPES,
  BOAT_TYPE_VALUES,
  BOAT_SVGS,
  boatSvgFor,
  boatLabelFor,
  FLAG_SVG,
  SPEEDBOAT_SVG,
  type BoatTypeDef,
} from "@workspace/boat-config";
