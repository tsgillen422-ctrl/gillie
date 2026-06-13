import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, catchesTable } from "@workspace/db";
import { eq, and, desc, or, notInArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { moderateContent } from "../lib/moderation";
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
    currentLat: null,
    currentLng: null,
    lastSeen: null,
    boatName: u.boatName,
    boatColor: u.boatColor,
    shareLocation: u.shareLocation,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

async function formatCatch(c: typeof catchesTable.$inferSelect) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, c.userId) });
  return {
    id: c.id,
    userId: c.userId,
    user: user ? formatUser(user) : null,
    species: c.species,
    weight: c.weight,
    length: c.length,
    notes: c.notes,
    imageUrl: c.imageUrl,
    lat: c.lat,
    lng: c.lng,
    isPrivate: c.isPrivate,
    isMature: c.isMature,
    caughtAt: c.caughtAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const profileUserId = req.query.profileUserId
    ? parseInt(req.query.profileUserId as string)
    : undefined;
  let rows;
  if (profileUserId !== undefined) {
    // A demo user's catches are invisible to anyone not in Demo Mode.
    if (profileUserId !== currentUserId(req)) {
      const hidden = await getHiddenDemoUserIds(currentUserId(req));
      if (hidden.includes(profileUserId)) return res.json([]);
    }
    rows = await db
      .select()
      .from(catchesTable)
      .where(
        profileUserId === currentUserId(req)
          ? eq(catchesTable.userId, profileUserId)
          : and(eq(catchesTable.userId, profileUserId), eq(catchesTable.isPrivate, false))
      )
      .orderBy(desc(catchesTable.caughtAt));
  } else {
    // Global feed: hide demo authors' catches from anyone not in Demo Mode.
    const hidden = await getHiddenDemoUserIds(currentUserId(req));
    const visibility = or(
      eq(catchesTable.isPrivate, false),
      eq(catchesTable.userId, currentUserId(req)),
    );
    rows = await db
      .select()
      .from(catchesTable)
      .where(hidden.length ? and(visibility, notInArray(catchesTable.userId, hidden)) : visibility)
      .orderBy(desc(catchesTable.caughtAt));
  }
  res.json(await Promise.all(rows.map(formatCatch)));
});

router.post("/", async (req, res) => {
  const { species, weight, length, notes, imageUrl, lat, lng, isPrivate, caughtAt } = req.body;
  if (!species || !String(species).trim()) {
    return res.status(400).json({ error: "Species is required" });
  }
  const caught = caughtAt ? new Date(caughtAt) : new Date();
  if (isNaN(caught.getTime())) {
    return res.status(400).json({ error: "Invalid catch date" });
  }
  const isMature = await moderateContent({
    texts: [species, notes],
    imagePaths: [imageUrl],
  });
  const [row] = await db
    .insert(catchesTable)
    .values({
      userId: currentUserId(req),
      species: String(species).trim(),
      weight: weight ?? null,
      length: length ?? null,
      notes: notes ?? null,
      imageUrl: imageUrl ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      isPrivate: !!isPrivate,
      isMature,
      caughtAt: caught,
    })
    .returning();
  res.status(201).json(await formatCatch(row));
});

router.delete("/:catchId", async (req, res) => {
  const catchId = parseInt(req.params.catchId);
  const row = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, catchId) });
  if (!row) return res.status(404).json({ error: "Catch not found" });
  if (row.userId !== currentUserId(req)) {
    return res.status(403).json({ error: "You can only delete your own catches" });
  }
  await db.delete(catchesTable).where(eq(catchesTable.id, catchId));
  res.json({ success: true });
});

export default router;
