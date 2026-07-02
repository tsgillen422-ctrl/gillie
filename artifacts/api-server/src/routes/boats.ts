import { Router } from "express";
import { db } from "@workspace/db";
import { boatsTable, usersTable, galleryItemsTable, type Boat } from "@workspace/db";
import { and, asc, eq, ne } from "drizzle-orm";
import { BOAT_TYPE_VALUES } from "@workspace/boat-config";
import { currentUserId } from "../middlewares/auth";

// Mounted at /boats — operations on a single boat.
const router = Router();
// Mounted at /users/me/boats — list + create within the authenticated fleet.
export const fleetRouter: ReturnType<typeof Router> = Router();

export function formatBoat(b: Boat) {
  return {
    id: b.id,
    userId: b.userId,
    name: b.name,
    boatType: b.boatType,
    color: b.color,
    brand: b.brand,
    model: b.model,
    year: b.year,
    photoUrl: b.photoUrl,
    neon: b.neon,
    flag: b.flag,
    accent: b.accent,
    notes: b.notes,
    horsepower: b.horsepower,
    engineInfo: b.engineInfo,
    lengthFt: b.lengthFt,
    favoriteMarina: b.favoriteMarina,
    favoriteCove: b.favoriteCove,
    favoriteActivity: b.favoriteActivity,
    mods: b.mods,
    isPrimary: b.isPrimary,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function getFleet(userId: number): Promise<Boat[]> {
  return db
    .select()
    .from(boatsTable)
    .where(eq(boatsTable.userId, userId))
    .orderBy(asc(boatsTable.createdAt));
}

/**
 * Copy a boat's appearance onto the legacy users.boat* columns. Those columns
 * are the denormalized "active boat" every existing surface (map markers, feed
 * chips, friends list) reads, so the rest of the app needs no changes.
 * Passing null clears them (user has no boats left).
 */
export async function syncActiveBoat(userId: number, boat: Boat | null): Promise<void> {
  await db
    .update(usersTable)
    .set(
      boat
        ? {
            boatName: boat.name,
            boatType: boat.boatType,
            boatColor: boat.color,
            boatBrand: boat.brand,
            boatModel: boat.model,
            boatYear: boat.year,
            boatPhotoUrl: boat.photoUrl,
            boatNeon: boat.neon,
            boatFlag: boat.flag,
            boatAccent: boat.accent,
          }
        : {
            boatName: null,
            boatBrand: null,
            boatModel: null,
            boatYear: null,
            boatPhotoUrl: null,
            boatNeon: false,
            boatFlag: false,
            boatAccent: null,
          }
    )
    .where(eq(usersTable.id, userId));
}

type BoatFieldErrors = { error: string } | null;

function validateBoatFields(body: any, { requireName }: { requireName: boolean }): BoatFieldErrors {
  const { name, boatType, color, brand, model, year, photoUrl, neon, flag, accent, notes } = body;
  if (requireName || name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return { error: "name is required" };
    if (name.trim().length > 60) return { error: "name must be 60 characters or less" };
  }
  if (boatType !== undefined) {
    if (typeof boatType !== "string" || !BOAT_TYPE_VALUES.includes(boatType)) {
      return { error: "boatType is not a recognized watercraft type" };
    }
  }
  if (color !== undefined && (typeof color !== "string" || color.length > 30)) {
    return { error: "color must be a string" };
  }
  if (brand !== undefined && brand !== null && (typeof brand !== "string" || brand.length > 60)) {
    return { error: "brand must be 60 characters or less" };
  }
  if (model !== undefined && model !== null && (typeof model !== "string" || model.length > 60)) {
    return { error: "model must be 60 characters or less" };
  }
  if (year !== undefined && year !== null) {
    const maxYear = new Date().getFullYear() + 1;
    if (typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > maxYear) {
      return { error: `year must be between 1900 and ${maxYear}` };
    }
  }
  if (photoUrl !== undefined && photoUrl !== null && typeof photoUrl !== "string") {
    return { error: "photoUrl must be a string or null" };
  }
  if (neon !== undefined && typeof neon !== "boolean") return { error: "neon must be a boolean" };
  if (flag !== undefined && typeof flag !== "boolean") return { error: "flag must be a boolean" };
  if (accent !== undefined && accent !== null && (typeof accent !== "string" || accent.length > 30)) {
    return { error: "accent must be a string or null" };
  }
  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 500)) {
    return { error: "notes must be 500 characters or less" };
  }
  const { horsepower, engineInfo, lengthFt, favoriteMarina, favoriteCove, favoriteActivity, mods } = body;
  if (horsepower !== undefined && horsepower !== null) {
    if (typeof horsepower !== "number" || !Number.isInteger(horsepower) || horsepower < 1 || horsepower > 20000) {
      return { error: "horsepower must be between 1 and 20000" };
    }
  }
  if (lengthFt !== undefined && lengthFt !== null) {
    if (typeof lengthFt !== "number" || !Number.isInteger(lengthFt) || lengthFt < 1 || lengthFt > 500) {
      return { error: "length must be between 1 and 500 feet" };
    }
  }
  for (const [key, val, max] of [
    ["engineInfo", engineInfo, 100],
    ["favoriteMarina", favoriteMarina, 80],
    ["favoriteCove", favoriteCove, 80],
    ["favoriteActivity", favoriteActivity, 80],
    ["mods", mods, 500],
  ] as const) {
    if (val !== undefined && val !== null && (typeof val !== "string" || val.length > max)) {
      return { error: `${key} must be ${max} characters or less` };
    }
  }
  return null;
}

const MAX_FLEET_SIZE = 12;

fleetRouter.get("/", async (req, res) => {
  const fleet = await getFleet(currentUserId(req));
  res.json(fleet.map(formatBoat));
});

fleetRouter.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const invalid = validateBoatFields(req.body, { requireName: true });
  if (invalid) return res.status(400).json(invalid);

  const fleet = await getFleet(uid);
  if (fleet.length >= MAX_FLEET_SIZE) {
    return res.status(400).json({ error: `Fleet is full (max ${MAX_FLEET_SIZE} boats)` });
  }

  // First boat in the fleet is always primary; otherwise honor the flag.
  const makePrimary = fleet.length === 0 || req.body.isPrimary === true;

  const [row] = await db
    .insert(boatsTable)
    .values({
      userId: uid,
      name: String(req.body.name).trim(),
      boatType: req.body.boatType ?? "speedboat",
      color: req.body.color ?? "#3b82f6",
      brand: req.body.brand?.trim() || null,
      model: req.body.model?.trim() || null,
      year: req.body.year ?? null,
      photoUrl: req.body.photoUrl || null,
      neon: req.body.neon ?? false,
      flag: req.body.flag ?? false,
      accent: req.body.accent ?? null,
      notes: req.body.notes?.trim() || null,
      horsepower: req.body.horsepower ?? null,
      engineInfo: req.body.engineInfo?.trim() || null,
      lengthFt: req.body.lengthFt ?? null,
      favoriteMarina: req.body.favoriteMarina?.trim() || null,
      favoriteCove: req.body.favoriteCove?.trim() || null,
      favoriteActivity: req.body.favoriteActivity?.trim() || null,
      mods: req.body.mods?.trim() || null,
      isPrimary: makePrimary,
    })
    .returning();

  if (makePrimary) {
    await db
      .update(boatsTable)
      .set({ isPrimary: false })
      .where(and(eq(boatsTable.userId, uid), ne(boatsTable.id, row.id)));
    await syncActiveBoat(uid, row);
  }
  res.status(201).json(formatBoat(row));
});

router.patch("/:boatId", async (req, res) => {
  const uid = currentUserId(req);
  const boatId = parseInt(req.params.boatId);
  const boat = await db.query.boatsTable.findFirst({ where: eq(boatsTable.id, boatId) });
  if (!boat || boat.userId !== uid) return res.status(404).json({ error: "Boat not found" });

  const invalid = validateBoatFields(req.body, { requireName: false });
  if (invalid) return res.status(400).json(invalid);

  const updates: Partial<typeof boatsTable.$inferInsert> = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.boatType !== undefined) updates.boatType = req.body.boatType;
  if (req.body.color !== undefined) updates.color = req.body.color;
  if (req.body.brand !== undefined) updates.brand = req.body.brand?.trim() || null;
  if (req.body.model !== undefined) updates.model = req.body.model?.trim() || null;
  if (req.body.year !== undefined) updates.year = req.body.year ?? null;
  if (req.body.photoUrl !== undefined) updates.photoUrl = req.body.photoUrl || null;
  if (req.body.neon !== undefined) updates.neon = req.body.neon;
  if (req.body.flag !== undefined) updates.flag = req.body.flag;
  if (req.body.accent !== undefined) updates.accent = req.body.accent ?? null;
  if (req.body.notes !== undefined) updates.notes = req.body.notes?.trim() || null;
  if (req.body.horsepower !== undefined) updates.horsepower = req.body.horsepower ?? null;
  if (req.body.engineInfo !== undefined) updates.engineInfo = req.body.engineInfo?.trim() || null;
  if (req.body.lengthFt !== undefined) updates.lengthFt = req.body.lengthFt ?? null;
  if (req.body.favoriteMarina !== undefined) updates.favoriteMarina = req.body.favoriteMarina?.trim() || null;
  if (req.body.favoriteCove !== undefined) updates.favoriteCove = req.body.favoriteCove?.trim() || null;
  if (req.body.favoriteActivity !== undefined) updates.favoriteActivity = req.body.favoriteActivity?.trim() || null;
  if (req.body.mods !== undefined) updates.mods = req.body.mods?.trim() || null;

  const [updated] = await db.update(boatsTable).set(updates).where(eq(boatsTable.id, boatId)).returning();

  // Keep the denormalized active-boat columns fresh if this is the boat the
  // user is currently showing on the map/profile.
  if (updated.isPrimary) await syncActiveBoat(uid, updated);
  res.json(formatBoat(updated));
});

router.delete("/:boatId", async (req, res) => {
  const uid = currentUserId(req);
  const boatId = parseInt(req.params.boatId);
  const boat = await db.query.boatsTable.findFirst({ where: eq(boatsTable.id, boatId) });
  if (!boat || boat.userId !== uid) return res.status(404).json({ error: "Boat not found" });

  // Detach this boat's memories (keep the photos, drop the boat link).
  await db.update(galleryItemsTable).set({ boatId: null }).where(eq(galleryItemsTable.boatId, boatId));
  await db.delete(boatsTable).where(eq(boatsTable.id, boatId));

  if (boat.isPrimary) {
    // Promote the oldest remaining boat, or clear the active boat entirely.
    const remaining = await getFleet(uid);
    const next = remaining[0] ?? null;
    if (next) {
      await db.update(boatsTable).set({ isPrimary: true }).where(eq(boatsTable.id, next.id));
      await syncActiveBoat(uid, { ...next, isPrimary: true });
    } else {
      await syncActiveBoat(uid, null);
    }
  } else {
    // The deleted boat may have been the checked-in "active" boat living in the
    // denormalized users.boat* columns. Deterministically fall back to the
    // current primary so the map/feed never show a boat that no longer exists.
    const primary = await db.query.boatsTable.findFirst({
      where: and(eq(boatsTable.userId, uid), eq(boatsTable.isPrimary, true)),
    });
    await syncActiveBoat(uid, primary ?? null);
  }
  res.status(204).end();
});

router.post("/:boatId/primary", async (req, res) => {
  const uid = currentUserId(req);
  const boatId = parseInt(req.params.boatId);
  const boat = await db.query.boatsTable.findFirst({ where: eq(boatsTable.id, boatId) });
  if (!boat || boat.userId !== uid) return res.status(404).json({ error: "Boat not found" });

  await db.update(boatsTable).set({ isPrimary: false }).where(eq(boatsTable.userId, uid));
  await db.update(boatsTable).set({ isPrimary: true }).where(eq(boatsTable.id, boatId));
  await syncActiveBoat(uid, { ...boat, isPrimary: true });

  const fleet = await getFleet(uid);
  res.json(fleet.map(formatBoat));
});

export default router;
