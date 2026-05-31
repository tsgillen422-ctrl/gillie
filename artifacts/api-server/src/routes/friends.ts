import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, friendRequestsTable, blocksTable, notificationsTable, mutesTable } from "@workspace/db";
import { eq, or, and, inArray, count } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";

const router = Router();

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

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
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
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

async function formatUserWithCounts(u: typeof usersTable.$inferSelect) {
  return { ...formatUser(u), ...(await getFollowCounts(u.id)) };
}

function serializeRequest(r: typeof friendRequestsTable.$inferSelect) {
  return {
    id: r.id,
    followerId: r.followerId,
    followeeId: r.followeeId,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

async function getBlockedUserIds(userId: number): Promise<number[]> {
  const rows = await db.query.blocksTable.findMany({
    where: or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)),
  });
  return rows.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
}

router.get("/", async (req, res) => {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(
        eq(friendRequestsTable.followerId, currentUserId(req)),
        eq(friendRequestsTable.followeeId, currentUserId(req))
      ),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const blockedIds = await getBlockedUserIds(currentUserId(req));
  const friendIds = accepted
    .map((r) => (r.followerId === currentUserId(req) ? r.followeeId : r.followerId))
    .filter((id) => !blockedIds.includes(id));
  if (!friendIds.length) return res.json([]);
  const friends = await Promise.all(
    friendIds.map((id) =>
      db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
    )
  );
  res.json(await Promise.all(friends.filter(Boolean).map((u) => formatUserWithCounts(u!))));
});

router.get("/locations", async (req, res) => {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(
        eq(friendRequestsTable.followerId, currentUserId(req)),
        eq(friendRequestsTable.followeeId, currentUserId(req))
      ),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const blockedIds = await getBlockedUserIds(currentUserId(req));
  const friendIds = accepted
    .map((r) => (r.followerId === currentUserId(req) ? r.followeeId : r.followerId))
    .filter((id) => !blockedIds.includes(id));
  if (!friendIds.length) return res.json([]);
  const friends = await Promise.all(
    friendIds.map((id) =>
      db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
    )
  );
  const locations = friends
    .filter(Boolean)
    .map((u) => ({
      userId: u!.id,
      displayName: u!.displayName,
      username: u!.username,
      avatarUrl: u!.avatarUrl,
      boatName: u!.boatName,
      boatColor: u!.boatColor,
      boatType: u!.boatType,
      boatNeon: u!.boatNeon,
      boatFlag: u!.boatFlag,
      boatAccent: u!.boatAccent,
      lat: u!.shareLocation ? u!.currentLat : null,
      lng: u!.shareLocation ? u!.currentLng : null,
      isBusiness: u!.isBusiness,
      isOnline: u!.isOnline,
      lastSeen: u!.lastSeen ? u!.lastSeen.toISOString() : null,
    }));
  res.json(locations);
});

router.get("/requests", async (req, res) => {
  const blockedIds = await getBlockedUserIds(currentUserId(req));
  const requests = await db.query.friendRequestsTable.findMany({
    where: and(
      eq(friendRequestsTable.followeeId, currentUserId(req)),
      eq(friendRequestsTable.status, "pending")
    ),
  });
  const visible = requests.filter((r) => !blockedIds.includes(r.followerId));
  const formatted = await Promise.all(
    visible.map(async (r) => {
      const follower = await db.query.usersTable.findFirst({ where: eq(usersTable.id, r.followerId) });
      const followee = await db.query.usersTable.findFirst({ where: eq(usersTable.id, r.followeeId) });
      return {
        id: r.id,
        followerId: r.followerId,
        followeeId: r.followeeId,
        status: r.status,
        follower: follower ? formatUser(follower) : null,
        followee: followee ? formatUser(followee) : null,
        createdAt: r.createdAt.toISOString(),
      };
    })
  );
  res.json(formatted);
});

router.get("/blocks", async (req, res) => {
  const rows = await db.query.blocksTable.findMany({
    where: eq(blocksTable.blockerId, currentUserId(req)),
  });
  if (!rows.length) return res.json([]);
  const users = await db.query.usersTable.findMany({
    where: inArray(usersTable.id, rows.map((r) => r.blockedId)),
  });
  res.json(await Promise.all(users.map((u) => formatUserWithCounts(u))));
});

router.get("/:userId/followers", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId !== currentUserId(req)) {
    const blocked = await db.query.blocksTable.findFirst({
      where: or(
        and(eq(blocksTable.blockerId, currentUserId(req)), eq(blocksTable.blockedId, targetId)),
        and(eq(blocksTable.blockerId, targetId), eq(blocksTable.blockedId, currentUserId(req)))
      ),
    });
    if (blocked) return res.status(403).json({ error: "This user has hidden their followers" });
    if (!target.showFollowers) {
      return res.status(403).json({ error: "This user has hidden their followers" });
    }
  }
  const rows = await db.query.friendRequestsTable.findMany({
    where: and(eq(friendRequestsTable.followeeId, targetId), eq(friendRequestsTable.status, "accepted")),
  });
  const blockedIds = await getBlockedUserIds(currentUserId(req));
  const ids = rows.map((r) => r.followerId).filter((id) => !blockedIds.includes(id));
  if (!ids.length) return res.json([]);
  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, ids) });
  res.json(await Promise.all(users.map(formatUserWithCounts)));
});

router.get("/:userId/following", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId !== currentUserId(req)) {
    const blocked = await db.query.blocksTable.findFirst({
      where: or(
        and(eq(blocksTable.blockerId, currentUserId(req)), eq(blocksTable.blockedId, targetId)),
        and(eq(blocksTable.blockerId, targetId), eq(blocksTable.blockedId, currentUserId(req)))
      ),
    });
    if (blocked) return res.status(403).json({ error: "This user has hidden who they follow" });
    if (!target.showFollowers) {
      return res.status(403).json({ error: "This user has hidden who they follow" });
    }
  }
  const rows = await db.query.friendRequestsTable.findMany({
    where: and(eq(friendRequestsTable.followerId, targetId), eq(friendRequestsTable.status, "accepted")),
  });
  const blockedIds = await getBlockedUserIds(currentUserId(req));
  const ids = rows.map((r) => r.followeeId).filter((id) => !blockedIds.includes(id));
  if (!ids.length) return res.json([]);
  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, ids) });
  res.json(await Promise.all(users.map(formatUserWithCounts)));
});

router.post("/:userId/follow", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (targetId === currentUserId(req)) {
    return res.status(400).json({ error: "You can't follow yourself" });
  }
  const block = await db.query.blocksTable.findFirst({
    where: or(
      and(eq(blocksTable.blockerId, currentUserId(req)), eq(blocksTable.blockedId, targetId)),
      and(eq(blocksTable.blockerId, targetId), eq(blocksTable.blockedId, currentUserId(req)))
    ),
  });
  if (block) return res.status(403).json({ error: "You can't follow this user" });

  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) });

  const outgoing = await db.query.friendRequestsTable.findFirst({
    where: and(
      eq(friendRequestsTable.followerId, currentUserId(req)),
      eq(friendRequestsTable.followeeId, targetId)
    ),
  });
  if (outgoing) return res.json(serializeRequest(outgoing));

  const incoming = await db.query.friendRequestsTable.findFirst({
    where: and(
      eq(friendRequestsTable.followerId, targetId),
      eq(friendRequestsTable.followeeId, currentUserId(req)),
      eq(friendRequestsTable.status, "pending")
    ),
  });
  if (incoming) {
    const [updated] = await db
      .update(friendRequestsTable)
      .set({ status: "accepted" })
      .where(eq(friendRequestsTable.id, incoming.id))
      .returning();
    await db.insert(notificationsTable).values({
      userId: targetId,
      type: "friend_request",
      message: `${me?.displayName ?? "Someone"} accepted your follow request`,
      relatedId: currentUserId(req),
    });
    return res.json(serializeRequest(updated));
  }

  const status = target.requireFollowApproval ? "pending" : "accepted";
  const [request] = await db
    .insert(friendRequestsTable)
    .values({ followerId: currentUserId(req), followeeId: targetId, status })
    .returning();
  await db.insert(notificationsTable).values({
    userId: targetId,
    type: "friend_request",
    message:
      status === "pending"
        ? `${me?.displayName ?? "Someone"} wants to follow you`
        : `${me?.displayName ?? "Someone"} started following you`,
    relatedId: currentUserId(req),
  });
  res.json(serializeRequest(request));
});

router.delete("/:userId/unfollow", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  await db
    .delete(friendRequestsTable)
    .where(
      or(
        and(eq(friendRequestsTable.followerId, currentUserId(req)), eq(friendRequestsTable.followeeId, targetId)),
        and(eq(friendRequestsTable.followerId, targetId), eq(friendRequestsTable.followeeId, currentUserId(req)))
      )
    );
  res.json({ success: true });
});

router.get("/mutes", async (req, res) => {
  const rows = await db.query.mutesTable.findMany({
    where: eq(mutesTable.muterId, currentUserId(req)),
  });
  if (!rows.length) return res.json([]);
  const users = await db.query.usersTable.findMany({
    where: inArray(usersTable.id, rows.map((r) => r.mutedId)),
  });
  res.json(await Promise.all(users.map((u) => formatUserWithCounts(u))));
});

router.post("/:userId/mute", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (targetId === currentUserId(req)) {
    return res.status(400).json({ error: "You can't mute yourself" });
  }
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  const existing = await db.query.mutesTable.findFirst({
    where: and(eq(mutesTable.muterId, currentUserId(req)), eq(mutesTable.mutedId, targetId)),
  });
  if (!existing) {
    await db.insert(mutesTable).values({ muterId: currentUserId(req), mutedId: targetId });
  }
  res.json({ success: true });
});

router.delete("/:userId/mute", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  await db
    .delete(mutesTable)
    .where(and(eq(mutesTable.muterId, currentUserId(req)), eq(mutesTable.mutedId, targetId)));
  res.json({ success: true });
});

router.post("/:userId/block", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (targetId === currentUserId(req)) {
    return res.status(400).json({ error: "You can't block yourself" });
  }
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  await db
    .delete(friendRequestsTable)
    .where(
      or(
        and(eq(friendRequestsTable.followerId, currentUserId(req)), eq(friendRequestsTable.followeeId, targetId)),
        and(eq(friendRequestsTable.followerId, targetId), eq(friendRequestsTable.followeeId, currentUserId(req)))
      )
    );
  const existing = await db.query.blocksTable.findFirst({
    where: and(eq(blocksTable.blockerId, currentUserId(req)), eq(blocksTable.blockedId, targetId)),
  });
  if (!existing) {
    await db.insert(blocksTable).values({ blockerId: currentUserId(req), blockedId: targetId });
  }
  res.json({ success: true });
});

router.delete("/:userId/block", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  await db
    .delete(blocksTable)
    .where(and(eq(blocksTable.blockerId, currentUserId(req)), eq(blocksTable.blockedId, targetId)));
  res.json({ success: true });
});

router.post("/:requestId/accept", async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const status = req.body?.status === "rejected" ? "rejected" : "accepted";
  const existing = await db.query.friendRequestsTable.findFirst({
    where: eq(friendRequestsTable.id, requestId),
  });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (existing.followeeId !== currentUserId(req)) {
    return res.status(403).json({ error: "You can't respond to this request" });
  }

  if (status === "rejected") {
    await db.delete(friendRequestsTable).where(eq(friendRequestsTable.id, requestId));
    return res.json({
      id: existing.id,
      followerId: existing.followerId,
      followeeId: existing.followeeId,
      status: "rejected",
      createdAt: existing.createdAt.toISOString(),
    });
  }

  const [updated] = await db
    .update(friendRequestsTable)
    .set({ status: "accepted" })
    .where(eq(friendRequestsTable.id, requestId))
    .returning();
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) });
  await db.insert(notificationsTable).values({
    userId: updated.followerId,
    type: "friend_request",
    message: `${me?.displayName ?? "Someone"} accepted your follow request`,
    relatedId: currentUserId(req),
  });
  res.json(serializeRequest(updated));
});

export default router;
