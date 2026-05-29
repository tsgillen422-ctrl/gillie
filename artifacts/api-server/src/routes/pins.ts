import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pinsTable, pinLikesTable, pinFavoritesTable, friendRequestsTable } from "@workspace/db";
import { eq, and, or, sql, inArray } from "drizzle-orm";

const router = Router();
const SESSION_USER_ID = 1;
const OWNER_ID = 1;

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

async function getFriendIds(userId: number): Promise<number[]> {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(
        eq(friendRequestsTable.followerId, userId),
        eq(friendRequestsTable.followeeId, userId)
      ),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  return accepted.map((r) =>
    r.followerId === userId ? r.followeeId : r.followerId
  );
}

function canViewPin(
  pin: typeof pinsTable.$inferSelect,
  viewerId: number,
  friendIds: number[]
): boolean {
  if (pin.userId === viewerId) return true;
  if (pin.visibility === "public") return pin.approved;
  if (pin.visibility === "community") return pin.approved;
  if (pin.visibility === "friends") return friendIds.includes(pin.userId);
  return false;
}

async function formatPin(pin: typeof pinsTable.$inferSelect) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pin.userId) });
  const like = await db.query.pinLikesTable.findFirst({
    where: and(eq(pinLikesTable.pinId, pin.id), eq(pinLikesTable.userId, SESSION_USER_ID)),
  });
  const favorite = await db.query.pinFavoritesTable.findFirst({
    where: and(eq(pinFavoritesTable.pinId, pin.id), eq(pinFavoritesTable.userId, SESSION_USER_ID)),
  });
  return {
    id: pin.id,
    userId: pin.userId,
    user: user ? formatUser(user) : null,
    lat: pin.lat,
    lng: pin.lng,
    type: pin.type,
    title: pin.title,
    description: pin.description,
    visibility: pin.visibility,
    imageUrl: pin.imageUrl,
    approved: pin.approved,
    startTime: pin.startTime ? pin.startTime.toISOString() : null,
    endTime: pin.endTime ? pin.endTime.toISOString() : null,
    likeCount: pin.likeCount,
    likedByMe: !!like,
    favoritedByMe: !!favorite,
    createdAt: pin.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  const profileUserId = req.query.profileUserId
    ? parseInt(req.query.profileUserId as string)
    : undefined;
  let pins;
  if (type) {
    pins = await db.select().from(pinsTable).where(eq(pinsTable.type, type));
  } else {
    pins = await db.select().from(pinsTable);
  }

  const friendIds = await getFriendIds(SESSION_USER_ID);

  let visiblePins;
  if (profileUserId !== undefined) {
    // Pins shown on a user's profile: their friends-only pins are visible to
    // anyone viewing the profile, plus their approved public/community pins.
    // Unapproved public/community pins are only shown to the creator themselves.
    visiblePins = pins.filter((pin) => {
      if (pin.userId !== profileUserId) return false;
      if (pin.userId === SESSION_USER_ID) return true;
      if (pin.visibility === "friends") return true;
      return pin.approved;
    });
  } else {
    visiblePins = pins.filter((pin) => canViewPin(pin, SESSION_USER_ID, friendIds));
  }

  res.json(await Promise.all(visiblePins.map(formatPin)));
});

router.post("/", async (req, res) => {
  const { lat, lng, type, title, description, visibility, imageUrl, startTime, endTime } = req.body;
  const vis = visibility === "public" || visibility === "community" ? visibility : "friends";

  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;
  if (start && isNaN(start.getTime())) {
    return res.status(400).json({ error: "Invalid start time" });
  }
  if (end && isNaN(end.getTime())) {
    return res.status(400).json({ error: "Invalid end time" });
  }
  if (start && end && end.getTime() < start.getTime()) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  // Approval rules:
  // - Friends-only pins are always auto-approved.
  // - For public/community: timed pins (with a start/end window) skip approval,
  //   while untimed pins and landmarks require approval.
  const isTimed = !!(start || end);
  const isLandmark = type === "landmark";
  const needsApproval = (vis === "public" || vis === "community") && (!isTimed || isLandmark);
  const approved = !needsApproval;

  const [pin] = await db
    .insert(pinsTable)
    .values({
      userId: SESSION_USER_ID,
      lat,
      lng,
      type,
      title,
      description,
      visibility: vis,
      imageUrl: imageUrl || null,
      approved,
      startTime: start,
      endTime: end,
    })
    .returning();
  res.status(201).json(await formatPin(pin));
});

router.get("/pending/approval", async (_req, res) => {
  if (SESSION_USER_ID !== OWNER_ID) {
    return res.status(403).json({ error: "Only the app owner can view pending pins" });
  }
  const pending = await db
    .select()
    .from(pinsTable)
    .where(
      and(
        inArray(pinsTable.visibility, ["community", "public"]),
        eq(pinsTable.approved, false)
      )
    );
  res.json(await Promise.all(pending.map(formatPin)));
});

router.get("/favorites", async (_req, res) => {
  const favorites = await db
    .select()
    .from(pinFavoritesTable)
    .where(eq(pinFavoritesTable.userId, SESSION_USER_ID));
  const friendIds = await getFriendIds(SESSION_USER_ID);
  const pins = await Promise.all(
    favorites.map((f) => db.query.pinsTable.findFirst({ where: eq(pinsTable.id, f.pinId) }))
  );
  const visible = pins.filter(
    (pin): pin is typeof pinsTable.$inferSelect =>
      !!pin && canViewPin(pin, SESSION_USER_ID, friendIds)
  );
  res.json(await Promise.all(visible.map(formatPin)));
});

router.get("/:pinId", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  const friendIds = await getFriendIds(SESSION_USER_ID);
  if (!canViewPin(pin, SESSION_USER_ID, friendIds)) {
    return res.status(404).json({ error: "Pin not found" });
  }
  res.json(await formatPin(pin));
});

router.delete("/:pinId", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  if (pin.userId !== SESSION_USER_ID && SESSION_USER_ID !== OWNER_ID) {
    return res.status(403).json({ error: "You can only delete your own pins" });
  }
  await db.delete(pinLikesTable).where(eq(pinLikesTable.pinId, pinId));
  await db.delete(pinFavoritesTable).where(eq(pinFavoritesTable.pinId, pinId));
  await db.delete(pinsTable).where(eq(pinsTable.id, pinId));
  res.json({ success: true });
});

router.post("/:pinId/approve", async (req, res) => {
  if (SESSION_USER_ID !== OWNER_ID) {
    return res.status(403).json({ error: "Only the app owner can approve pins" });
  }
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  if (pin.visibility !== "community" && pin.visibility !== "public") {
    return res.status(400).json({ error: "Only public and community pins require approval" });
  }
  const [updated] = await db
    .update(pinsTable)
    .set({ approved: true })
    .where(eq(pinsTable.id, pinId))
    .returning();
  res.json(await formatPin(updated));
});

router.post("/:pinId/like", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  const friendIds = await getFriendIds(SESSION_USER_ID);
  if (!canViewPin(pin, SESSION_USER_ID, friendIds)) {
    return res.status(404).json({ error: "Pin not found" });
  }
  const existing = await db.query.pinLikesTable.findFirst({
    where: and(eq(pinLikesTable.pinId, pinId), eq(pinLikesTable.userId, SESSION_USER_ID)),
  });
  if (existing) {
    await db.delete(pinLikesTable).where(eq(pinLikesTable.id, existing.id));
    await db.update(pinsTable).set({ likeCount: sql`${pinsTable.likeCount} - 1` }).where(eq(pinsTable.id, pinId));
  } else {
    await db.insert(pinLikesTable).values({ pinId, userId: SESSION_USER_ID });
    await db.update(pinsTable).set({ likeCount: sql`${pinsTable.likeCount} + 1` }).where(eq(pinsTable.id, pinId));
  }
  const updated = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  res.json(await formatPin(updated!));
});

router.post("/:pinId/favorite", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  const friendIds = await getFriendIds(SESSION_USER_ID);
  if (!canViewPin(pin, SESSION_USER_ID, friendIds)) {
    return res.status(404).json({ error: "Pin not found" });
  }
  const existing = await db.query.pinFavoritesTable.findFirst({
    where: and(eq(pinFavoritesTable.pinId, pinId), eq(pinFavoritesTable.userId, SESSION_USER_ID)),
  });
  if (existing) {
    await db.delete(pinFavoritesTable).where(eq(pinFavoritesTable.id, existing.id));
  } else {
    await db.insert(pinFavoritesTable).values({ pinId, userId: SESSION_USER_ID });
  }
  res.json(await formatPin(pin));
});

export default router;
