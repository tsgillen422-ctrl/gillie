import { Fish, Anchor, Tent, Mountain, Waves, Camera, Sunset, Bird, Flame, Wind, LifeBuoy, Sailboat, PersonStanding, ArrowDownToLine, Ship, Zap } from "lucide-react";

export type InterestDef = { key: string; label: string; Icon: any };

// Keep in sync with VALID_INTERESTS in api-server routes/users.ts.
export const INTEREST_DEFS: InterestDef[] = [
  { key: "boating", label: "Boating", Icon: Anchor },
  { key: "fishing", label: "Fishing", Icon: Fish },
  { key: "wakeboarding", label: "Wakeboarding", Icon: Wind },
  { key: "tubing", label: "Tubing", Icon: LifeBuoy },
  { key: "kayaking", label: "Kayaking", Icon: Sailboat },
  { key: "paddleboarding", label: "Paddle Boarding", Icon: PersonStanding },
  { key: "swimming", label: "Swimming", Icon: Waves },
  { key: "cliffjumping", label: "Cliff Jumping", Icon: ArrowDownToLine },
  { key: "waterskiing", label: "Water Skiing", Icon: Zap },
  { key: "sunsetcruises", label: "Sunset Cruises", Icon: Ship },
  { key: "camping", label: "Camping", Icon: Tent },
  { key: "hiking", label: "Hiking", Icon: Mountain },
  { key: "photography", label: "Photography", Icon: Camera },
  { key: "sunsets", label: "Sunsets", Icon: Sunset },
  { key: "wildlife", label: "Wildlife", Icon: Bird },
  { key: "bonfires", label: "Bonfires", Icon: Flame },
];

export const INTEREST_MAP: Record<string, InterestDef> = Object.fromEntries(
  INTEREST_DEFS.map((d) => [d.key, d]),
);
