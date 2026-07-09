import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, businessProfilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { isValidLakeId, DEFAULT_LAKE_ID } from "@workspace/lake-config";

const router = Router();

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

// Common lake-business type suggestions surfaced in the UI autocomplete.
// Business type itself is free text — users can enter anything.
export const BUSINESS_TYPE_SUGGESTIONS = [
  "Marina",
  "Campground",
  "Restaurant",
  "Fuel Dock",
  "Fishing Guide",
  "Boat Rental",
  "Boat Mechanic",
  "Marine Detailing",
  "Dock Builder",
  "Grocery / Lake Delivery",
  "DoorDash on the Lake",
  "Dive Finder",
  "Underwater Recovery",
  "Vacation Rental",
  "Bait & Tackle Shop",
  "Boat Storage",
  "Watersports Lessons",
  "Boat Charter",
];

function formatBusiness(b: typeof businessProfilesTable.$inferSelect) {
  return {
    id: b.id,
    userId: b.userId,
    lakeId: b.lakeId,
    businessName: b.businessName,
    businessType: b.businessType,
    description: b.description ?? null,
    photos: Array.isArray(b.photos) ? b.photos : [],
    phone: b.phone ?? null,
    website: b.website ?? null,
    hours: b.hours ?? null,
    lat: b.lat ?? null,
    lng: b.lng ?? null,
    serviceArea: b.serviceArea ?? null,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function sanitizeInput(body: any) {
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const businessName = str(body?.businessName, 80);
  const businessType = str(body?.businessType, 60);
  const description = str(body?.description, 2000);
  const phone = str(body?.phone, 30);
  const website = str(body?.website, 200);
  const hours = str(body?.hours, 500);
  const serviceArea = str(body?.serviceArea, 200);
  const lat = typeof body?.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body?.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const photos = Array.isArray(body?.photos)
    ? body.photos.filter((p: unknown) => typeof p === "string" && p.length < 500).slice(0, 10)
    : [];
  return { businessName, businessType, description, phone, website, hours, serviceArea, lat, lng, photos };
}

// GET /businesses/types — autocomplete suggestions (static + types already in use).
router.get("/types", async (_req, res) => {
  const rows = await db
    .selectDistinct({ businessType: businessProfilesTable.businessType })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.status, "approved"));
  const inUse = rows.map((r) => r.businessType).filter(Boolean);
  const merged = Array.from(new Set([...BUSINESS_TYPE_SUGGESTIONS, ...inUse]));
  res.json(merged);
});

// GET /businesses/me — the caller's own business profile (any status).
router.get("/me", async (req, res) => {
  const uid = currentUserId(req);
  const row = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.userId, uid),
  });
  if (!row) return res.status(404).json({ error: "No business profile" });
  res.json(formatBusiness(row));
});

// PUT /businesses/me — create or update the caller's business profile.
// Any change puts the profile back into "pending" until an admin re-approves.
router.put("/me", async (req, res) => {
  const uid = currentUserId(req);
  const input = sanitizeInput(req.body);
  if (!input.businessName || !input.businessType) {
    return res.status(400).json({ error: "businessName and businessType are required" });
  }
  const lakeId = isValidLakeId(req.body?.lakeId) ? req.body.lakeId : DEFAULT_LAKE_ID;
  const existing = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.userId, uid),
  });
  const values = {
    lakeId,
    businessName: input.businessName,
    businessType: input.businessType,
    description: input.description,
    photos: input.photos,
    phone: input.phone,
    website: input.website,
    hours: input.hours,
    lat: input.lat,
    lng: input.lng,
    serviceArea: input.serviceArea,
    status: "pending" as const,
    updatedAt: new Date(),
  };
  let row;
  if (existing) {
    [row] = await db
      .update(businessProfilesTable)
      .set(values)
      .where(eq(businessProfilesTable.userId, uid))
      .returning();
  } else {
    [row] = await db
      .insert(businessProfilesTable)
      .values({ userId: uid, ...values })
      .returning();
  }
  await db.update(usersTable).set({ isBusiness: true }).where(eq(usersTable.id, uid));
  res.status(existing ? 200 : 201).json(formatBusiness(row));
});

// DELETE /businesses/me — remove the caller's business profile.
router.delete("/me", async (req, res) => {
  const uid = currentUserId(req);
  const existing = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.userId, uid),
  });
  if (!existing) return res.status(404).json({ error: "No business profile" });
  await db.delete(businessProfilesTable).where(eq(businessProfilesTable.userId, uid));
  await db.update(usersTable).set({ isBusiness: false }).where(eq(usersTable.id, uid));
  res.json({ ok: true });
});

// GET /businesses — approved businesses, optional free-text search + lake filter.
// Search matches name, type, description and service area (client also filters).
router.get("/", async (req, res) => {
  const rawLakeId = req.query.lakeId != null ? Number(req.query.lakeId) : undefined;
  const conditions = [eq(businessProfilesTable.status, "approved")];
  if (rawLakeId !== undefined) {
    conditions.push(
      eq(businessProfilesTable.lakeId, isValidLakeId(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID),
    );
  }
  const rows = await db.query.businessProfilesTable.findMany({
    where: and(...conditions),
    orderBy: desc(businessProfilesTable.updatedAt),
  });
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const filtered = q
    ? rows.filter((b) =>
        [b.businessName, b.businessType, b.description, b.serviceArea]
          .filter(Boolean)
          .some((f) => (f as string).toLowerCase().includes(q)),
      )
    : rows;
  res.json(filtered.map(formatBusiness));
});

// GET /businesses/pending — admin: approval queue (pending + rejected for context).
router.get("/pending", async (req, res) => {
  if (!(await isAdmin(currentUserId(req)))) {
    return res.status(403).json({ error: "Admin access required" });
  }
  const rows = await db.query.businessProfilesTable.findMany({
    where: eq(businessProfilesTable.status, "pending"),
    orderBy: desc(businessProfilesTable.updatedAt),
  });
  const enriched = await Promise.all(
    rows.map(async (b) => {
      const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, b.userId) });
      return {
        ...formatBusiness(b),
        owner: owner
          ? { id: owner.id, username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl }
          : null,
      };
    }),
  );
  res.json(enriched);
});

// GET /businesses/:id — approved profiles are public; owners and admins can
// always see their own (pending/rejected) profile.
router.get("/:businessId", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const row = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.id, id),
  });
  if (!row) return res.status(404).json({ error: "Business not found" });
  if (row.status !== "approved" && row.userId !== uid && !(await isAdmin(uid))) {
    return res.status(404).json({ error: "Business not found" });
  }
  const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, row.userId) });
  res.json({
    ...formatBusiness(row),
    owner: owner
      ? { id: owner.id, username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl }
      : null,
  });
});

// PATCH /businesses/:id/status — admin: approve or reject a submission.
router.patch("/:businessId/status", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const { status } = req.body ?? {};
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "status must be approved or rejected" });
  }
  const row = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.id, id),
  });
  if (!row) return res.status(404).json({ error: "Business not found" });
  const [updated] = await db
    .update(businessProfilesTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(businessProfilesTable.id, id))
    .returning();
  res.json(formatBusiness(updated));
});

export default router;
