import { Fish, Anchor, Tent, Mountain, Waves, Camera, Sunset, Bird, Flame } from "lucide-react";

export type InterestDef = { key: string; label: string; Icon: any };

export const INTEREST_DEFS: InterestDef[] = [
  { key: "fishing", label: "Fishing", Icon: Fish },
  { key: "boating", label: "Boating", Icon: Anchor },
  { key: "camping", label: "Camping", Icon: Tent },
  { key: "hiking", label: "Hiking", Icon: Mountain },
  { key: "swimming", label: "Swimming", Icon: Waves },
  { key: "photography", label: "Photography", Icon: Camera },
  { key: "sunsets", label: "Sunsets", Icon: Sunset },
  { key: "wildlife", label: "Wildlife", Icon: Bird },
  { key: "bonfires", label: "Bonfires", Icon: Flame },
];

export const INTEREST_MAP: Record<string, InterestDef> = Object.fromEntries(
  INTEREST_DEFS.map((d) => [d.key, d]),
);
