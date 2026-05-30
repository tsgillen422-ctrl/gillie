import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, friendRequestsTable, blocksTable, notificationsTable, postsTable, pinsTable, catchesTable } from "@workspace/db";
import { eq, ilike, or, and, count, notInArray } from "drizzle-orm";

const router = Router();

const SESSION_USER_ID = 1;

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
  return accepted.map((r) => (r.followerId === userId ? r.followeeId : r.followerId));
}

async function computeBadges(userId: number): Promise<string[]> {
  const badges: string[] = [];
  const [postRes] = await db.select({ value: count() }).from(postsTable).where(eq(postsTable.userId, userId));
  const [pinRes] = await db.select({ value: count() }).from(pinsTable).where(eq(pinsTable.userId, userId));
  const [catchRes] = await db.select({ value: count() }).from(catchesTable).where(eq(catchesTable.userId, userId));
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (user?.isBusiness) badges.push("verified_business");
  if ((postRes?.value ?? 0) >= 10) badges.push("frequent_poster");
  if ((pinRes?.value ?? 0) >= 5) badges.push("trailblazer");
  if ((catchRes?.value ?? 0) >= 10) badges.push("angler");
  else if ((catchRes?.value ?? 0) >= 1) badges.push("first_catch");
  return badges;
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    currentLat: u.shareLocation ? u.currentLat : null,
    currentLng: u.shareLocation ? u.currentLng : null,
    lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
    boatName: u.boatName,
    boatColor: u.boatColor,
    boatType: u.boatType,
    boatNeon: u.boatNeon,
    boatFlag: u.boatFlag,
    boatAccent: u.boatAccent,
    shareLocation: u.shareLocation,
    requireFollowApproval: u.requireFollowApproval,
    showFollowers: u.showFollowers,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

async function getFollowCounts(userId: number): Promise<{ followerCount: number; followingCount: number }> {
  const [followers] = await db
    .select({ value: count() })
    .from(friendRequestsTable)
    .where(and(eq(friendRequestsTable.followeeId, userId), eq(friendRequestsTable.status, "accepted")));
  const [following] = await db
    .select({ value: count() })
    .from(friendRequestsTable)
    .where(and(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.status, "accepted")));
  return { followerCount: followers?.value ?? 0, followingCount: following?.value ?? 0 };
}

async function getBlockedUserIds(userId: number): Promise<number[]> {
  const rows = await db.query.blocksTable.findMany({
    where: or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)),
  });
  return rows.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
}

router.get("/me", async (req, res) => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, SESSION_USER_ID),
  });
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ ...formatUser(user), ...(await getFollowCounts(user.id)), badges: await computeBadges(user.id) });
});

router.post("/me/sos", async (req, res) => {
  const { message } = req.body;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, SESSION_USER_ID) });
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const friendIds = await getFriendIds(SESSION_USER_ID);
  const text =
    (message && String(message).trim()) ||
    `${user.displayName} needs help on the water!`;
  const locationNote =
    user.currentLat != null && user.currentLng != null
      ? ` Last known location: ${user.currentLat.toFixed(4)}, ${user.currentLng.toFixed(4)}.`
      : "";
  if (friendIds.length > 0) {
    await db.insert(notificationsTable).values(
      friendIds.map((fid) => ({
        userId: fid,
        type: "sos",
        message: `🚨 ${text}${locationNote}`,
        relatedId: SESSION_USER_ID,
      }))
    );
  }
  res.json({
    success: true,
    notified: friendIds.length,
    lat: user.currentLat,
    lng: user.currentLng,
  });
});

router.patch("/me", async (req, res) => {
  const { displayName, bio, avatarUrl, coverUrl, boatName, boatColor, boatType, boatNeon, boatFlag, boatAccent, isBusiness, shareLocation } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (coverUrl !== undefined) updates.coverUrl = coverUrl;
  if (boatName !== undefined) updates.boatName = boatName;
  if (boatColor !== undefined) updates.boatColor = boatColor;
  if (boatType !== undefined) {
    const validBoatTypes = ["speedboat", "pontoon", "sailboat", "kayak", "jetski", "yacht"];
    if (!validBoatTypes.includes(boatType)) {
      return res.status(400).json({ error: "Invalid boatType" });
    }
    updates.boatType = boatType;
  }
  if (boatNeon !== undefined) {
    if (typeof boatNeon !== "boolean") {
      return res.status(400).json({ error: "boatNeon must be a boolean" });
    }
    updates.boatNeon = boatNeon;
  }
  if (boatFlag !== undefined) {
    if (typeof boatFlag !== "boolean") {
      return res.status(400).json({ error: "boatFlag must be a boolean" });
    }
    updates.boatFlag = boatFlag;
  }
  if (boatAccent !== undefined) {
    if (boatAccent !== null && typeof boatAccent !== "string") {
      return res.status(400).json({ error: "boatAccent must be a string or null" });
    }
    updates.boatAccent = boatAccent;
  }
  if (isBusiness !== undefined) updates.isBusiness = isBusiness;
  if (shareLocation !== undefined) updates.shareLocation = shareLocation;
  if (req.body.requireFollowApproval !== undefined) {
    if (typeof req.body.requireFollowApproval !== "boolean") {
      return res.status(400).json({ error: "requireFollowApproval must be a boolean" });
    }
    updates.requireFollowApproval = req.body.requireFollowApproval;
  }
  if (req.body.showFollowers !== undefined) {
    if (typeof req.body.showFollowers !== "boolean") {
      return res.status(400).json({ error: "showFollowers must be a boolean" });
    }
    updates.showFollowers = req.body.showFollowers;
  }
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, SESSION_USER_ID)).returning();
  res.json(formatUser(updated));
});

router.patch("/me/location", async (req, res) => {
  const { lat, lng } = req.body;
  const [updated] = await db
    .update(usersTable)
    .set({ currentLat: lat, currentLng: lng, isOnline: true, lastSeen: new Date() })
    .where(eq(usersTable.id, SESSION_USER_ID))
    .returning();
  res.json(formatUser(updated));
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "");
  if (!q) return res.json([]);
  const blockedIds = await getBlockedUserIds(SESSION_USER_ID);
  const matchClause = or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`));
  const where = blockedIds.length
    ? and(matchClause, notInArray(usersTable.id, blockedIds))
    : matchClause;
  const users = await db.select().from(usersTable).where(where).limit(20);
  const withCounts = await Promise.all(
    users.map(async (u) => ({ ...formatUser(u), ...(await getFollowCounts(u.id)) }))
  );
  res.json(withCounts);
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });

  let friendStatus = "none";
  if (userId === SESSION_USER_ID) {
    friendStatus = "self";
  } else {
    const blockedByMe = await db.query.blocksTable.findFirst({
      where: and(eq(blocksTable.blockerId, SESSION_USER_ID), eq(blocksTable.blockedId, userId)),
    });
    const blockedMe = await db.query.blocksTable.findFirst({
      where: and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, SESSION_USER_ID)),
    });
    if (blockedByMe) {
      friendStatus = "blocked";
    } else if (blockedMe) {
      friendStatus = "blocked_by";
    } else {
      const rel = await db.query.friendRequestsTable.findFirst({
        where: or(
          and(eq(friendRequestsTable.followerId, SESSION_USER_ID), eq(friendRequestsTable.followeeId, userId)),
          and(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.followeeId, SESSION_USER_ID))
        ),
      });
      if (rel) {
        if (rel.status === "accepted") friendStatus = "accepted";
        else if (rel.status === "pending") friendStatus = rel.followerId === SESSION_USER_ID ? "pending_out" : "pending_in";
      }
    }
  }

  const counts = await getFollowCounts(user.id);
  res.json({ ...formatUser(user), ...counts, badges: await computeBadges(user.id), friendStatus });
});

export default router;
