import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  friendRequestsTable,
  blocksTable,
  mutesTable,
  eventRsvpsTable,
  pinFavoritesTable,
  pinsTable,
  postLikesTable,
  postCommentsTable,
  postsTable,
} from "@workspace/db";
import { eq, or, and, inArray, desc } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { createNotification } from "../lib/notify";

const router = Router();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function getFollowCounts(userId: number): Promise<{ followerCount: number; followingCount: number }> {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.followeeId, userId)),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const ids = new Set(accepted.map((r) => (r.followerId === userId ? r.followeeId : r.followerId)));
  ids.delete(userId);
  return { followerCount: ids.size, followingCount: ids.size };
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

// Friendships are mutual: an accepted friend_request links two users in both
// directions, so followers, following, and friends all resolve to the same set.
async function getAcceptedConnectionIds(targetId: number, requesterId: number): Promise<number[]> {
  const accepted = await db.query.friendRequestsTable.findMany({
    where: and(
      or(eq(friendRequestsTable.followerId, targetId), eq(friendRequestsTable.followeeId, targetId)),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const blockedIds = await getBlockedUserIds(requesterId);
  return [
    ...new Set(
      accepted
        .map((r) => (r.followerId === targetId ? r.followeeId : r.followerId))
        .filter((id) => id !== targetId && !blockedIds.includes(id))
    ),
  ];
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
      isOnWater: u!.isOnWater,
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

// Recommend people to connect with, scored across community-relevant signals:
// mutual friends, frequent interactions, shared favorite spots, common marinas,
// nearby boaters, and same-event attendees. Falls back to recent joiners so new
// members of the Dale Hollow community always surface.
router.get("/suggestions", async (req, res) => {
  const me = currentUserId(req);
  const meUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, me) });

  // Existing relationships we must never suggest.
  const myRequests = await db.query.friendRequestsTable.findMany({
    where: or(eq(friendRequestsTable.followerId, me), eq(friendRequestsTable.followeeId, me)),
  });
  const myFriendIds = new Set<number>();
  const pendingPeerIds = new Set<number>();
  for (const r of myRequests) {
    const other = r.followerId === me ? r.followeeId : r.followerId;
    if (r.status === "accepted") myFriendIds.add(other);
    else pendingPeerIds.add(other);
  }
  const blockedIds = new Set(await getBlockedUserIds(me));
  const exclude = new Set<number>([me, ...myFriendIds, ...pendingPeerIds, ...blockedIds]);

  const scores = new Map<number, number>();
  const mutualCounts = new Map<number, number>();
  const reasons = new Map<number, string>();
  const bestSignalWeight = new Map<number, number>();

  const addSignal = (uid: number, weight: number, label: string) => {
    if (exclude.has(uid)) return;
    scores.set(uid, (scores.get(uid) ?? 0) + weight);
    if (weight > (bestSignalWeight.get(uid) ?? 0)) {
      bestSignalWeight.set(uid, weight);
      reasons.set(uid, label);
    }
  };

  // 1. Mutual friends (friends-of-friends).
  if (myFriendIds.size) {
    const friendArr = [...myFriendIds];
    const fofRows = await db.query.friendRequestsTable.findMany({
      where: and(
        or(
          inArray(friendRequestsTable.followerId, friendArr),
          inArray(friendRequestsTable.followeeId, friendArr)
        ),
        eq(friendRequestsTable.status, "accepted")
      ),
    });
    for (const r of fofRows) {
      const { followerId: a, followeeId: b } = r;
      if (myFriendIds.has(a) && !myFriendIds.has(b) && !exclude.has(b)) {
        mutualCounts.set(b, (mutualCounts.get(b) ?? 0) + 1);
      }
      if (myFriendIds.has(b) && !myFriendIds.has(a) && !exclude.has(a)) {
        mutualCounts.set(a, (mutualCounts.get(a) ?? 0) + 1);
      }
    }
    for (const [c, count] of mutualCounts) {
      addSignal(c, 3 * count, `${count} mutual friend${count > 1 ? "s" : ""}`);
    }
  }

  // 2. Same events (shared RSVPs).
  const myRsvps = await db.query.eventRsvpsTable.findMany({ where: eq(eventRsvpsTable.userId, me) });
  const myEventPostIds = [...new Set(myRsvps.map((r) => r.postId))];
  if (myEventPostIds.length) {
    const coRsvps = await db.query.eventRsvpsTable.findMany({
      where: inArray(eventRsvpsTable.postId, myEventPostIds),
    });
    for (const r of coRsvps) addSignal(r.userId, 2, "Going to the same event");
  }

  // 3. Shared favorite locations + common marinas.
  const myFavs = await db.query.pinFavoritesTable.findMany({ where: eq(pinFavoritesTable.userId, me) });
  const myFavPinIds = [...new Set(myFavs.map((f) => f.pinId))];
  if (myFavPinIds.length) {
    const favPins = await db.query.pinsTable.findMany({ where: inArray(pinsTable.id, myFavPinIds) });
    const marinaPinIds = new Set(favPins.filter((p) => p.type === "marina").map((p) => p.id));
    const coFavs = await db.query.pinFavoritesTable.findMany({
      where: inArray(pinFavoritesTable.pinId, myFavPinIds),
    });
    for (const f of coFavs) {
      if (marinaPinIds.has(f.pinId)) addSignal(f.userId, 2.5, "Keeps a boat at the same marina");
      else addSignal(f.userId, 1.5, "Likes the same spots");
    }
  }

  // 4. Frequent interactions (posts I liked or commented on -> their authors).
  const [myLikes, myComments] = await Promise.all([
    db.query.postLikesTable.findMany({ where: eq(postLikesTable.userId, me) }),
    db.query.postCommentsTable.findMany({ where: eq(postCommentsTable.userId, me) }),
  ]);
  const interactedPostIds = [...new Set([...myLikes.map((l) => l.postId), ...myComments.map((c) => c.postId)])];
  if (interactedPostIds.length) {
    const posts = await db.query.postsTable.findMany({ where: inArray(postsTable.id, interactedPostIds) });
    const authorCounts = new Map<number, number>();
    for (const p of posts) authorCounts.set(p.userId, (authorCounts.get(p.userId) ?? 0) + 1);
    for (const [author, count] of authorCounts) {
      addSignal(author, Math.min(count, 5), "You interact with their posts");
    }
  }

  // 5. Nearby boaters (sharing location, within ~40km of me).
  if (meUser?.currentLat != null && meUser?.currentLng != null) {
    const located = await db.query.usersTable.findMany({ where: eq(usersTable.shareLocation, true) });
    for (const u of located) {
      if (u.currentLat == null || u.currentLng == null) continue;
      const d = haversineKm(meUser.currentLat, meUser.currentLng, u.currentLat, u.currentLng);
      if (d <= 40) addSignal(u.id, 1.5, "Boating nearby");
    }
  }

  // 6. Community fallback: surface recent joiners so new members are discoverable.
  if (scores.size < 10) {
    const recent = await db.query.usersTable.findMany({
      orderBy: [desc(usersTable.createdAt)],
      limit: 30,
    });
    for (const u of recent) addSignal(u.id, 0.5, "New to Dale Hollow");
  }

  const rankedIds = [...scores.keys()].sort((a, b) => {
    const sd = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    if (sd !== 0) return sd;
    return (mutualCounts.get(b) ?? 0) - (mutualCounts.get(a) ?? 0);
  });
  if (!rankedIds.length) return res.json([]);

  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, rankedIds) });
  const byId = new Map(users.map((u) => [u.id, u]));
  // Minimal payload by design: never expose a non-friend's live location or
  // last-seen. The suggestion UI only needs identity, boat, mutual count, reason.
  const formatted = rankedIds
    .map((id) => byId.get(id))
    .filter((u): u is typeof usersTable.$inferSelect => !!u && !u.isSuspended)
    .slice(0, 20)
    .map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isOnline: u.isOnline,
      boatType: u.boatType,
      boatName: u.boatName,
      mutualFriendCount: mutualCounts.get(u.id) ?? 0,
      reason: reasons.get(u.id) ?? "Suggested for you",
    }));
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
  const ids = await getAcceptedConnectionIds(targetId, currentUserId(req));
  if (!ids.length) return res.json([]);
  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, ids) });
  res.json(await Promise.all(users.map(formatUserWithCounts)));
});

router.get("/:userId/friends", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId !== currentUserId(req)) {
    const blocked = await db.query.blocksTable.findFirst({
      where: or(
        and(eq(blocksTable.blockerId, currentUserId(req)), eq(blocksTable.blockedId, targetId)),
        and(eq(blocksTable.blockerId, targetId), eq(blocksTable.blockedId, currentUserId(req)))
      ),
    });
    if (blocked) return res.status(403).json({ error: "This user has hidden their friends" });
    if (!target.showFriends) {
      return res.status(403).json({ error: "This user has hidden their friends" });
    }
  }
  const friendIds = await getAcceptedConnectionIds(targetId, currentUserId(req));
  if (!friendIds.length) return res.json([]);
  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, friendIds) });
  res.json(await Promise.all(users.map(formatUserWithCounts)));
});

router.get("/:userId/mutual", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  const me = currentUserId(req);
  const acceptedFor = async (uid: number) => {
    const rows = await db.query.friendRequestsTable.findMany({
      where: and(
        or(eq(friendRequestsTable.followerId, uid), eq(friendRequestsTable.followeeId, uid)),
        eq(friendRequestsTable.status, "accepted")
      ),
    });
    return new Set(rows.map((r) => (r.followerId === uid ? r.followeeId : r.followerId)));
  };
  const [mine, theirs, blockedIds] = await Promise.all([
    acceptedFor(me),
    acceptedFor(targetId),
    getBlockedUserIds(me),
  ]);
  const mutualIds = [...mine].filter(
    (id) => theirs.has(id) && id !== me && id !== targetId && !blockedIds.includes(id)
  );
  if (!mutualIds.length) return res.json({ count: 0, users: [] });
  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, mutualIds) });
  const preview = await Promise.all(users.slice(0, 6).map(formatUserWithCounts));
  res.json({ count: mutualIds.length, users: preview });
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
  const ids = await getAcceptedConnectionIds(targetId, currentUserId(req));
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
    await createNotification({
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
  await createNotification({
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
  await createNotification({
    userId: updated.followerId,
    type: "friend_request",
    message: `${me?.displayName ?? "Someone"} accepted your follow request`,
    relatedId: currentUserId(req),
  });
  res.json(serializeRequest(updated));
});

export default router;
