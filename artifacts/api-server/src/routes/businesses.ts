import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  businessProfilesTable,
  businessFollowsTable,
  businessReviewsTable,
  postsTable,
  blocksTable,
} from "@workspace/db";
import { eq, and, or, desc, count, avg, inArray } from "drizzle-orm";
import { moderateContent } from "../lib/moderation";
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

// Follower/review aggregates + viewer follow state for a set of businesses.
async function businessSocialStats(bizIds: number[], viewerId: number) {
  if (!bizIds.length) {
    return { followers: new Map<number, number>(), ratings: new Map<number, { avg: number; count: number }>(), followedByMe: new Set<number>() };
  }
  const [followerRows, ratingRows, myFollows] = await Promise.all([
    db
      .select({ businessId: businessFollowsTable.businessId, value: count() })
      .from(businessFollowsTable)
      .where(inArray(businessFollowsTable.businessId, bizIds))
      .groupBy(businessFollowsTable.businessId),
    db
      .select({ businessId: businessReviewsTable.businessId, avgRating: avg(businessReviewsTable.rating), value: count() })
      .from(businessReviewsTable)
      .where(inArray(businessReviewsTable.businessId, bizIds))
      .groupBy(businessReviewsTable.businessId),
    db.query.businessFollowsTable.findMany({
      where: and(eq(businessFollowsTable.userId, viewerId), inArray(businessFollowsTable.businessId, bizIds)),
    }),
  ]);
  const followers = new Map(followerRows.map((r) => [r.businessId, r.value]));
  const ratings = new Map(
    ratingRows.map((r) => [r.businessId, { avg: r.avgRating ? Math.round(Number(r.avgRating) * 10) / 10 : 0, count: r.value }]),
  );
  const followedByMe = new Set(myFollows.map((r) => r.businessId));
  return { followers, ratings, followedByMe };
}

type BizStats = Awaited<ReturnType<typeof businessSocialStats>>;

function formatBusiness(b: typeof businessProfilesTable.$inferSelect, stats?: BizStats) {
  return {
    id: b.id,
    userId: b.userId,
    lakeId: b.lakeId,
    businessName: b.businessName,
    businessType: b.businessType,
    description: b.description ?? null,
    logoUrl: b.logoUrl ?? null,
    coverUrl: b.coverUrl ?? null,
    followerCount: stats?.followers.get(b.id) ?? 0,
    avgRating: stats?.ratings.get(b.id)?.avg ?? 0,
    reviewCount: stats?.ratings.get(b.id)?.count ?? 0,
    followedByMe: stats?.followedByMe.has(b.id) ?? false,
    // Approved businesses are the "verified" ones in the UI.
    verified: b.status === "approved",
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
  const logoUrl = str(body?.logoUrl, 500);
  const coverUrl = str(body?.coverUrl, 500);
  const lat = typeof body?.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body?.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
  const photos = Array.isArray(body?.photos)
    ? body.photos.filter((p: unknown) => typeof p === "string" && p.length < 500).slice(0, 10)
    : [];
  return { businessName, businessType, description, phone, website, hours, serviceArea, lat, lng, photos, logoUrl, coverUrl };
}

// Blocks are symmetric: a blocked viewer must not reach a business owned by
// the other party (and vice versa) on any business surface.
async function isBlockedBetween(viewerId: number, ownerId: number): Promise<boolean> {
  if (viewerId === ownerId) return false;
  const row = await db.query.blocksTable.findFirst({
    where: or(
      and(eq(blocksTable.blockerId, viewerId), eq(blocksTable.blockedId, ownerId)),
      and(eq(blocksTable.blockerId, ownerId), eq(blocksTable.blockedId, viewerId)),
    ),
  });
  return !!row;
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

// A user may own multiple businesses, but keep a sane cap.
const MAX_BUSINESSES_PER_USER = 10;

// GET /businesses/mine — ALL businesses owned by the caller (any status).
router.get("/mine", async (req, res) => {
  const uid = currentUserId(req);
  const rows = await db.query.businessProfilesTable.findMany({
    where: eq(businessProfilesTable.userId, uid),
    orderBy: businessProfilesTable.createdAt,
  });
  const stats = await businessSocialStats(rows.map((b) => b.id), uid);
  res.json(rows.map((b) => formatBusiness(b, stats)));
});

// GET /businesses/me — legacy single-business endpoint (old clients).
// Returns the caller's OLDEST business.
router.get("/me", async (req, res) => {
  const uid = currentUserId(req);
  const row = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.userId, uid),
    orderBy: businessProfilesTable.createdAt,
  });
  if (!row) return res.status(404).json({ error: "No business profile" });
  const stats = await businessSocialStats([row.id], uid);
  res.json(formatBusiness(row, stats));
});

// POST /businesses — create an additional business owned by the caller.
router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const input = sanitizeInput(req.body);
  if (!input.businessName || !input.businessType) {
    return res.status(400).json({ error: "businessName and businessType are required" });
  }
  const owned = await db.query.businessProfilesTable.findMany({
    where: eq(businessProfilesTable.userId, uid),
  });
  if (owned.length >= MAX_BUSINESSES_PER_USER) {
    return res.status(400).json({ error: `You can own at most ${MAX_BUSINESSES_PER_USER} businesses` });
  }
  const lakeId = isValidLakeId(req.body?.lakeId) ? req.body.lakeId : DEFAULT_LAKE_ID;
  const [row] = await db
    .insert(businessProfilesTable)
    .values({
      userId: uid,
      lakeId,
      businessName: input.businessName,
      businessType: input.businessType,
      description: input.description,
      logoUrl: input.logoUrl,
      coverUrl: input.coverUrl,
      photos: input.photos,
      phone: input.phone,
      website: input.website,
      hours: input.hours,
      lat: input.lat,
      lng: input.lng,
      serviceArea: input.serviceArea,
      status: "pending",
    })
    .returning();
  await db.update(usersTable).set({ isBusiness: true }).where(eq(usersTable.id, uid));
  res.status(201).json(formatBusiness(row));
});

// PUT /businesses/me — legacy create-or-update endpoint (old clients).
// Updates the caller's OLDEST business, or creates one if they have none.
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
    orderBy: businessProfilesTable.createdAt,
  });
  const values = {
    lakeId,
    businessName: input.businessName,
    businessType: input.businessType,
    description: input.description,
    logoUrl: input.logoUrl,
    coverUrl: input.coverUrl,
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
      .where(eq(businessProfilesTable.id, existing.id))
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

// Shared removal: clear child rows, detach (not delete) business posts so
// they survive as regular posts by the owner, then delete the business.
// users.isBusiness is only cleared once the user owns no businesses at all.
async function removeBusiness(biz: typeof businessProfilesTable.$inferSelect) {
  await db.delete(businessFollowsTable).where(eq(businessFollowsTable.businessId, biz.id));
  await db.delete(businessReviewsTable).where(eq(businessReviewsTable.businessId, biz.id));
  await db.update(postsTable).set({ businessId: null }).where(eq(postsTable.businessId, biz.id));
  await db.delete(businessProfilesTable).where(eq(businessProfilesTable.id, biz.id));
  const remaining = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.userId, biz.userId),
  });
  if (!remaining) {
    await db.update(usersTable).set({ isBusiness: false }).where(eq(usersTable.id, biz.userId));
  }
}

// DELETE /businesses/me — legacy: remove the caller's OLDEST business.
router.delete("/me", async (req, res) => {
  const uid = currentUserId(req);
  const existing = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.userId, uid),
    orderBy: businessProfilesTable.createdAt,
  });
  if (!existing) return res.status(404).json({ error: "No business profile" });
  await removeBusiness(existing);
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
  const stats = await businessSocialStats(filtered.map((b) => b.id), currentUserId(req));
  res.json(filtered.map((b) => formatBusiness(b, stats)));
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
  if (await isBlockedBetween(uid, row.userId)) {
    return res.status(404).json({ error: "Business not found" });
  }
  const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, row.userId) });
  const stats = await businessSocialStats([row.id], uid);
  res.json({
    ...formatBusiness(row, stats),
    owner: owner
      ? { id: owner.id, username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl }
      : null,
  });
});

// PUT /businesses/:businessId — update a business you own (resets to pending).
router.put("/:businessId", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const existing = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.id, id),
  });
  if (!existing || existing.userId !== uid) {
    return res.status(404).json({ error: "Business not found" });
  }
  const input = sanitizeInput(req.body);
  if (!input.businessName || !input.businessType) {
    return res.status(400).json({ error: "businessName and businessType are required" });
  }
  const lakeId = isValidLakeId(req.body?.lakeId) ? req.body.lakeId : DEFAULT_LAKE_ID;
  const [row] = await db
    .update(businessProfilesTable)
    .set({
      lakeId,
      businessName: input.businessName,
      businessType: input.businessType,
      description: input.description,
      logoUrl: input.logoUrl,
      coverUrl: input.coverUrl,
      photos: input.photos,
      phone: input.phone,
      website: input.website,
      hours: input.hours,
      lat: input.lat,
      lng: input.lng,
      serviceArea: input.serviceArea,
      status: "pending",
      updatedAt: new Date(),
    })
    .where(eq(businessProfilesTable.id, id))
    .returning();
  res.json(formatBusiness(row));
});

// DELETE /businesses/:businessId — delete a business you own.
router.delete("/:businessId", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const existing = await db.query.businessProfilesTable.findFirst({
    where: eq(businessProfilesTable.id, id),
  });
  if (!existing || existing.userId !== uid) {
    return res.status(404).json({ error: "Business not found" });
  }
  await removeBusiness(existing);
  res.json({ ok: true });
});

// POST /businesses/:businessId/follow — follow an approved business.
router.post("/:businessId/follow", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const row = await db.query.businessProfilesTable.findFirst({ where: eq(businessProfilesTable.id, id) });
  if (!row || row.status !== "approved") return res.status(404).json({ error: "Business not found" });
  if (row.userId === uid) return res.status(400).json({ error: "You can't follow your own business" });
  if (await isBlockedBetween(uid, row.userId)) {
    return res.status(404).json({ error: "Business not found" });
  }
  await db
    .insert(businessFollowsTable)
    .values({ businessId: id, userId: uid })
    .onConflictDoNothing();
  res.status(201).json({ ok: true });
});

// DELETE /businesses/:businessId/follow — unfollow.
router.delete("/:businessId/follow", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  await db
    .delete(businessFollowsTable)
    .where(and(eq(businessFollowsTable.businessId, id), eq(businessFollowsTable.userId, uid)));
  res.json({ ok: true });
});

// GET /businesses/:businessId/reviews — reviews for an approved business.
router.get("/:businessId/reviews", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const row = await db.query.businessProfilesTable.findFirst({ where: eq(businessProfilesTable.id, id) });
  if (!row || (row.status !== "approved" && row.userId !== uid && !(await isAdmin(uid)))) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (await isBlockedBetween(uid, row.userId)) {
    return res.status(404).json({ error: "Business not found" });
  }
  const reviews = await db.query.businessReviewsTable.findMany({
    where: eq(businessReviewsTable.businessId, id),
    orderBy: desc(businessReviewsTable.updatedAt),
  });
  const authorIds = [...new Set(reviews.map((r) => r.userId))];
  const authors = authorIds.length
    ? await db.query.usersTable.findMany({ where: inArray(usersTable.id, authorIds) })
    : [];
  const authorMap = new Map(authors.map((u) => [u.id, u]));
  res.json(
    reviews.map((r) => {
      const u = authorMap.get(r.userId);
      return {
        id: r.id,
        businessId: r.businessId,
        userId: r.userId,
        rating: r.rating,
        content: r.content ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        user: u ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl } : null,
      };
    }),
  );
});

// PUT /businesses/:businessId/reviews — create or update the caller's review.
router.put("/:businessId/reviews", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const row = await db.query.businessProfilesTable.findFirst({ where: eq(businessProfilesTable.id, id) });
  if (!row || row.status !== "approved") return res.status(404).json({ error: "Business not found" });
  if (row.userId === uid) return res.status(400).json({ error: "You can't review your own business" });
  if (await isBlockedBetween(uid, row.userId)) {
    return res.status(404).json({ error: "Business not found" });
  }
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "rating must be an integer 1-5" });
  }
  const rawContent =
    typeof req.body?.content === "string" && req.body.content.trim()
      ? req.body.content.trim().slice(0, 2000)
      : null;
  // Reviews have no isMature flag/gating surface, so flagged text is rejected outright.
  if (rawContent && (await moderateContent({ texts: [rawContent] }))) {
    return res.status(400).json({ error: "Review text was flagged by moderation. Please rephrase." });
  }
  const content = rawContent;
  const existing = await db.query.businessReviewsTable.findFirst({
    where: and(eq(businessReviewsTable.businessId, id), eq(businessReviewsTable.userId, uid)),
  });
  let review;
  if (existing) {
    [review] = await db
      .update(businessReviewsTable)
      .set({ rating, content, updatedAt: new Date() })
      .where(eq(businessReviewsTable.id, existing.id))
      .returning();
  } else {
    [review] = await db
      .insert(businessReviewsTable)
      .values({ businessId: id, userId: uid, rating, content })
      .returning();
  }
  res.status(existing ? 200 : 201).json({
    id: review.id,
    businessId: review.businessId,
    userId: review.userId,
    rating: review.rating,
    content: review.content ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  });
});

// DELETE /businesses/:businessId/reviews — remove the caller's own review.
router.delete("/:businessId/reviews", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  await db
    .delete(businessReviewsTable)
    .where(and(eq(businessReviewsTable.businessId, id), eq(businessReviewsTable.userId, uid)));
  res.json({ ok: true });
});

// GET /businesses/:businessId/posts — a business's own updates/events (public
// for approved businesses; owner/admin can see their own while pending).
router.get("/:businessId/posts", async (req, res) => {
  const uid = currentUserId(req);
  const id = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid business id" });
  const row = await db.query.businessProfilesTable.findFirst({ where: eq(businessProfilesTable.id, id) });
  if (!row || (row.status !== "approved" && row.userId !== uid && !(await isAdmin(uid)))) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (await isBlockedBetween(uid, row.userId)) {
    return res.status(404).json({ error: "Business not found" });
  }
  const posts = await db.query.postsTable.findMany({
    where: eq(postsTable.businessId, id),
    orderBy: desc(postsTable.createdAt),
  });
  const { formatPost } = await import("./posts");
  res.json(await Promise.all(posts.map((p) => formatPost(p, uid))));
});

// POST /businesses/me/posts — publish an update or event as the business.
// Business posts are community-visible and also surface in followers' feeds.
router.post("/me/posts", async (req, res) => {
  const uid = currentUserId(req);
  // Legacy endpoint: posts as the caller's OLDEST business. An explicit
  // businessId (owned by the caller) selects a specific business.
  const requestedId = Number(req.body?.businessId);
  const biz = Number.isFinite(requestedId)
    ? await db.query.businessProfilesTable.findFirst({
        where: and(eq(businessProfilesTable.id, requestedId), eq(businessProfilesTable.userId, uid)),
      })
    : await db.query.businessProfilesTable.findFirst({
        where: eq(businessProfilesTable.userId, uid),
        orderBy: businessProfilesTable.createdAt,
      });
  if (!biz) return res.status(404).json({ error: "No business profile" });
  if (biz.status !== "approved") {
    return res.status(403).json({ error: "Your business must be approved before posting" });
  }
  const content = typeof req.body?.content === "string" ? req.body.content.trim().slice(0, 5000) : "";
  if (!content) return res.status(400).json({ error: "content is required" });
  const title = typeof req.body?.title === "string" && req.body.title.trim()
    ? req.body.title.trim().slice(0, 120)
    : "";
  const postType = req.body?.postType === "event" ? "event" : "post";
  const eventDate =
    postType === "event" && req.body?.eventDate && !Number.isNaN(Date.parse(req.body.eventDate))
      ? new Date(req.body.eventDate)
      : null;
  if (postType === "event" && !eventDate) {
    return res.status(400).json({ error: "eventDate is required for events" });
  }
  const photos = Array.isArray(req.body?.photos)
    ? req.body.photos.filter((p: unknown) => typeof p === "string" && (p as string).length < 500).slice(0, 6)
    : [];
  const isMature = await moderateContent({ texts: [title, content], imagePaths: photos });
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      lakeId: biz.lakeId,
      title,
      content,
      postType,
      eventDate,
      photos: photos.length ? photos : null,
      businessId: biz.id,
      visibility: "community",
      isMature,
    })
    .returning();
  const { formatPost } = await import("./posts");
  res.status(201).json(await formatPost(post, uid));
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
