import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pinsTable, pinLikesTable, pinFavoritesTable, friendRequestsTable } from "@workspace/db";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";

const router = Router();

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

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

export async function getFriendIds(userId: number): Promise<number[]> {
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

export function canViewPin(
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

async function formatPin(pin: typeof pinsTable.$inferSelect, viewerId: number) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pin.userId) });
  const like = await db.query.pinLikesTable.findFirst({
    where: and(eq(pinLikesTable.pinId, pin.id), eq(pinLikesTable.userId, viewerId)),
  });
  const favorite = await db.query.pinFavoritesTable.findFirst({
    where: and(eq(pinFavoritesTable.pinId, pin.id), eq(pinFavoritesTable.userId, viewerId)),
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
    severity: pin.severity,
    expiresAt: pin.expiresAt ? pin.expiresAt.toISOString() : null,
    startTime: pin.startTime ? pin.startTime.toISOString() : null,
    endTime: pin.endTime ? pin.endTime.toISOString() : null,
    likeCount: pin.likeCount,
    likedByMe: !!like,
    favoritedByMe: !!favorite,
    createdAt: pin.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const uid = currentUserId(req);
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

  const friendIds = await getFriendIds(uid);

  let visiblePins;
  if (profileUserId !== undefined) {
    // Pins shown on a user's profile: their friends-only pins are visible to
    // anyone viewing the profile, plus their approved public/community pins.
    // Unapproved public/community pins are only shown to the creator themselves.
    visiblePins = pins.filter((pin) => {
      if (pin.userId !== profileUserId) return false;
      if (pin.userId === uid) return true;
      if (pin.visibility === "friends") return true;
      return pin.approved;
    });
  } else {
    visiblePins = pins.filter((pin) => canViewPin(pin, uid, friendIds));
  }

  res.json(await Promise.all(visiblePins.map((p) => formatPin(p, uid))));
});

router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const { lat, lng, type, title, description, visibility, imageUrl, startTime, endTime, severity, expiresAt } = req.body;
  const vis = visibility === "public" || visibility === "community" ? visibility : "friends";
  const expires = expiresAt ? new Date(expiresAt) : null;
  if (expires && isNaN(expires.getTime())) {
    return res.status(400).json({ error: "Invalid expiry time" });
  }
  const validSeverity = severity === "low" || severity === "medium" || severity === "high" ? severity : null;

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
      userId: uid,
      lat,
      lng,
      type,
      title,
      description,
      visibility: vis,
      imageUrl: imageUrl || null,
      approved,
      severity: validSeverity,
      expiresAt: expires,
      startTime: start,
      endTime: end,
    })
    .returning();
  res.status(201).json(await formatPin(pin, uid));
});

router.get("/hazards/active", async (req, res) => {
  const uid = currentUserId(req);
  const now = new Date();
  const friendIds = await getFriendIds(uid);
  const hazards = await db.select().from(pinsTable).where(eq(pinsTable.type, "hazard"));
  const active = hazards.filter((pin) => {
    if (!canViewPin(pin, uid, friendIds)) return false;
    if (pin.expiresAt && pin.expiresAt.getTime() < now.getTime()) return false;
    return true;
  });
  active.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  res.json(await Promise.all(active.map((p) => formatPin(p, uid))));
});

router.get("/pending/approval", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) {
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
  res.json(await Promise.all(pending.map((p) => formatPin(p, uid))));
});

router.get("/favorites", async (req, res) => {
  const uid = currentUserId(req);
  const favorites = await db
    .select()
    .from(pinFavoritesTable)
    .where(eq(pinFavoritesTable.userId, uid));
  const friendIds = await getFriendIds(uid);
  const pins = await Promise.all(
    favorites.map((f) => db.query.pinsTable.findFirst({ where: eq(pinsTable.id, f.pinId) }))
  );
  const visible = pins.filter(
    (pin): pin is typeof pinsTable.$inferSelect =>
      !!pin && canViewPin(pin, uid, friendIds)
  );
  res.json(await Promise.all(visible.map((p) => formatPin(p, uid))));
});

router.get("/:pinId", async (req, res) => {
  const uid = currentUserId(req);
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  const friendIds = await getFriendIds(uid);
  if (!canViewPin(pin, uid, friendIds)) {
    return res.status(404).json({ error: "Pin not found" });
  }
  res.json(await formatPin(pin, uid));
});

router.delete("/:pinId", async (req, res) => {
  const uid = currentUserId(req);
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  if (pin.userId !== uid && !(await isAdmin(uid))) {
    return res.status(403).json({ error: "You can only delete your own pins" });
  }
  await db.delete(pinLikesTable).where(eq(pinLikesTable.pinId, pinId));
  await db.delete(pinFavoritesTable).where(eq(pinFavoritesTable.pinId, pinId));
  await db.delete(pinsTable).where(eq(pinsTable.id, pinId));
  res.json({ success: true });
});

router.post("/:pinId/approve", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) {
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
  res.json(await formatPin(updated, uid));
});

router.post("/:pinId/like", async (req, res) => {
  const uid = currentUserId(req);
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  const friendIds = await getFriendIds(uid);
  if (!canViewPin(pin, uid, friendIds)) {
    return res.status(404).json({ error: "Pin not found" });
  }
  const existing = await db.query.pinLikesTable.findFirst({
    where: and(eq(pinLikesTable.pinId, pinId), eq(pinLikesTable.userId, uid)),
  });
  if (existing) {
    await db.delete(pinLikesTable).where(eq(pinLikesTable.id, existing.id));
    await db.update(pinsTable).set({ likeCount: sql`${pinsTable.likeCount} - 1` }).where(eq(pinsTable.id, pinId));
  } else {
    await db.insert(pinLikesTable).values({ pinId, userId: uid });
    await db.update(pinsTable).set({ likeCount: sql`${pinsTable.likeCount} + 1` }).where(eq(pinsTable.id, pinId));
  }
  const updated = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  res.json(await formatPin(updated!, uid));
});

router.post("/:pinId/favorite", async (req, res) => {
  const uid = currentUserId(req);
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  const friendIds = await getFriendIds(uid);
  if (!canViewPin(pin, uid, friendIds)) {
    return res.status(404).json({ error: "Pin not found" });
  }
  const existing = await db.query.pinFavoritesTable.findFirst({
    where: and(eq(pinFavoritesTable.pinId, pinId), eq(pinFavoritesTable.userId, uid)),
  });
  if (existing) {
    await db.delete(pinFavoritesTable).where(eq(pinFavoritesTable.id, existing.id));
  } else {
    await db.insert(pinFavoritesTable).values({ pinId, userId: uid });
  }
  res.json(await formatPin(pin, uid));
});

export default router;
