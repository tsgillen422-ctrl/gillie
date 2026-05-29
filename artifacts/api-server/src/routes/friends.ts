import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, friendRequestsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";

const router = Router();
const SESSION_USER_ID = 1;

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
    shareLocation: u.shareLocation,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(
        eq(friendRequestsTable.followerId, SESSION_USER_ID),
        eq(friendRequestsTable.followeeId, SESSION_USER_ID)
      ),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const friendIds = accepted.map((r) =>
    r.followerId === SESSION_USER_ID ? r.followeeId : r.followerId
  );
  if (!friendIds.length) return res.json([]);
  const friends = await Promise.all(
    friendIds.map((id) =>
      db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
    )
  );
  res.json(friends.filter(Boolean).map((u) => formatUser(u!)));
});

router.get("/locations", async (_req, res) => {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(
        eq(friendRequestsTable.followerId, SESSION_USER_ID),
        eq(friendRequestsTable.followeeId, SESSION_USER_ID)
      ),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const friendIds = accepted.map((r) =>
    r.followerId === SESSION_USER_ID ? r.followeeId : r.followerId
  );
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
      lat: u!.shareLocation ? u!.currentLat : null,
      lng: u!.shareLocation ? u!.currentLng : null,
      isOnline: u!.isOnline,
      lastSeen: u!.lastSeen ? u!.lastSeen.toISOString() : null,
    }));
  res.json(locations);
});

router.get("/requests", async (_req, res) => {
  const requests = await db.query.friendRequestsTable.findMany({
    where: and(
      eq(friendRequestsTable.followeeId, SESSION_USER_ID),
      eq(friendRequestsTable.status, "pending")
    ),
  });
  const formatted = await Promise.all(
    requests.map(async (r) => {
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

router.post("/:userId/follow", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const existing = await db.query.friendRequestsTable.findFirst({
    where: and(
      eq(friendRequestsTable.followerId, SESSION_USER_ID),
      eq(friendRequestsTable.followeeId, targetId)
    ),
  });
  if (existing) return res.json({ id: existing.id, followerId: existing.followerId, followeeId: existing.followeeId, status: existing.status, createdAt: existing.createdAt.toISOString() });
  const [request] = await db
    .insert(friendRequestsTable)
    .values({ followerId: SESSION_USER_ID, followeeId: targetId, status: "pending" })
    .returning();
  res.json({ id: request.id, followerId: request.followerId, followeeId: request.followeeId, status: request.status, createdAt: request.createdAt.toISOString() });
});

router.delete("/:userId/unfollow", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  await db
    .delete(friendRequestsTable)
    .where(
      or(
        and(eq(friendRequestsTable.followerId, SESSION_USER_ID), eq(friendRequestsTable.followeeId, targetId)),
        and(eq(friendRequestsTable.followerId, targetId), eq(friendRequestsTable.followeeId, SESSION_USER_ID))
      )
    );
  res.json({ success: true });
});

router.post("/:requestId/accept", async (req, res) => {
  const requestId = parseInt(req.params.requestId);
  const [updated] = await db
    .update(friendRequestsTable)
    .set({ status: "accepted" })
    .where(eq(friendRequestsTable.id, requestId))
    .returning();
  res.json({ id: updated.id, followerId: updated.followerId, followeeId: updated.followeeId, status: updated.status, createdAt: updated.createdAt.toISOString() });
});

export default router;
