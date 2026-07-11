import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pinsTable, postsTable, businessProfilesTable } from "@workspace/db";
import { eq, and, or, ilike, desc, notInArray } from "drizzle-orm";
import { DEFAULT_LAKE_ID, isValidLakeId } from "@workspace/lake-config";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    boatName: u.boatName,
    boatColor: u.boatColor,
  };
}

router.get("/", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (q.length < 2) {
    return res.json({ users: [], pins: [], posts: [], businesses: [] });
  }
  const term = `%${q}%`;

  // Scope lake-bound content (pins, posts) to the requested lake. People are
  // global. Old app builds don't send lakeId — they get the default lake.
  const rawLakeId = req.query.lakeId != null ? Number(req.query.lakeId) : undefined;
  const lakeId = isValidLakeId(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID;

  // Hide demo users + their posts from anyone not in Demo Mode. Demo pins are
  // friends-only, so they're already excluded by the visibility filter below.
  const hidden = await getHiddenDemoUserIds(currentUserId(req));

  const userMatch = or(ilike(usersTable.displayName, term), ilike(usersTable.username, term));
  const users = await db
    .select()
    .from(usersTable)
    .where(hidden.length ? and(userMatch, notInArray(usersTable.id, hidden)) : userMatch)
    .limit(10);

  const pins = await db
    .select()
    .from(pinsTable)
    .where(
      and(
        eq(pinsTable.approved, true),
        eq(pinsTable.lakeId, lakeId),
        or(ilike(pinsTable.title, term), ilike(pinsTable.description, term))
      )
    )
    .limit(10);

  const businessMatch = and(
    eq(businessProfilesTable.status, "approved"),
    eq(businessProfilesTable.lakeId, lakeId),
    or(
      ilike(businessProfilesTable.businessName, term),
      ilike(businessProfilesTable.businessType, term),
      ilike(businessProfilesTable.description, term),
      ilike(businessProfilesTable.serviceArea, term),
    ),
  );
  const businesses = await db
    .select()
    .from(businessProfilesTable)
    .where(
      // Hide demo-owned listings from non-reviewers (matches the businesses route).
      hidden.length ? and(businessMatch, notInArray(businessProfilesTable.userId, hidden)) : businessMatch,
    )
    .limit(10);

  const postMatch = and(
    eq(postsTable.lakeId, lakeId),
    or(ilike(postsTable.title, term), ilike(postsTable.content, term))
  );
  const posts = await db
    .select()
    .from(postsTable)
    .where(hidden.length ? and(postMatch, notInArray(postsTable.userId, hidden)) : postMatch)
    .orderBy(desc(postsTable.createdAt))
    .limit(10);

  res.json({
    users: users.map(formatUser),
    pins: pins
      .filter((p) => p.visibility !== "friends" || p.userId === currentUserId(req))
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
      })),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      postType: p.postType,
      createdAt: p.createdAt.toISOString(),
    })),
    businesses: businesses.map((b) => ({
      id: b.id,
      businessName: b.businessName,
      businessType: b.businessType,
      logoUrl: b.logoUrl ?? null,
      lat: b.lat ?? null,
      lng: b.lng ?? null,
    })),
  });
});

export default router;
