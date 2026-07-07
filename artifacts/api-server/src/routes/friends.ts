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
import { eq, or, and, inArray, desc, gt } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { createNotification } from "../lib/notify";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { getActiveStoryAuthorIds } from "./stories";
import { isValidLakeId, DEFAULT_LAKE_ID } from "@workspace/lake-config";

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

// Apple 5.1.2: a user's live position is shown to OTHERS only while their manual
// check-in is active (non-expired) AND their position was refreshed recently.
// When someone closes or leaves the app their client stops reporting, so a stale
// fix drops off other people's maps within this window instead of lingering as a
// "ghost boat" until the check-in expires (up to 6h). This makes "sharing ends
// when you close the app" true. Self-state (/me, served by users.ts formatUser)
// is intentionally NOT freshness-gated, so a returning user resumes reporting and
// reappears for the remainder of their check-in.
const LIVE_LOCATION_FRESH_MS = 10 * 60 * 1000;
function isLocationLive(u: typeof usersTable.$inferSelect): boolean {
  const active =
    !!u.locationSharingExpiresAt && u.locationSharingExpiresAt.getTime() > Date.now();
  const fresh = !!u.lastSeen && Date.now() - u.lastSeen.getTime() < LIVE_LOCATION_FRESH_MS;
  return active && fresh;
}

// One-way follow model: an accepted row means followerId follows followeeId in
// that single direction. "following" = people I follow; "followers" = people who
// follow me; "mutual" = both rows exist.
async function getFollowingIds(userId: number): Promise<number[]> {
  const rows = await db.query.friendRequestsTable.findMany({
    where: and(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.status, "accepted")),
  });
  return [...new Set(rows.map((r) => r.followeeId).filter((id) => id !== userId))];
}

async function getFollowerIds(userId: number): Promise<number[]> {
  const rows = await db.query.friendRequestsTable.findMany({
    where: and(eq(friendRequestsTable.followeeId, userId), eq(friendRequestsTable.status, "accepted")),
  });
  return [...new Set(rows.map((r) => r.followerId).filter((id) => id !== userId))];
}

async function getFollowCounts(userId: number): Promise<{ followerCount: number; followingCount: number }> {
  const [followers, following] = await Promise.all([getFollowerIds(userId), getFollowingIds(userId)]);
  return { followerCount: followers.length, followingCount: following.length };
}

function formatUser(u: typeof usersTable.$inferSelect) {
  // Apple 5.1.2: coordinates are only exposed while a manual check-in is active
  // (non-expired) AND the position is fresh (see isLocationLive). shareLocation
  // alone is NOT sufficient, and a stale fix from a closed app is not published.
  const sharing = isLocationLive(u);
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    currentLat: sharing ? u.currentLat : null,
    currentLng: sharing ? u.currentLng : null,
    isSharingLocation: sharing,
    lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
    lakeStatus: u.lakeStatus,
    boatName: u.boatName,
    boatColor: u.boatColor,
    boatType: u.boatType,
    boatPhotoUrl: u.showBoat === false ? null : u.boatPhotoUrl,
    showBoat: u.showBoat,
    boatNeon: u.boatNeon,
    boatFlag: u.boatFlag,
    boatAccent: u.boatAccent,
    shareLocation: u.shareLocation,
    requireFollowApproval: u.requireFollowApproval,
    followerSeeLocation: u.followerSeeLocation,
    followerSeePosts: u.followerSeePosts,
    followerSendMessages: u.followerSendMessages,
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

// The set of people the current user has a relationship with for a given
// direction, with the requester's blocked users removed.
async function getDirectionalIds(
  ids: number[],
  requesterId: number
): Promise<number[]> {
  const blockedIds = await getBlockedUserIds(requesterId);
  return ids.filter((id) => !blockedIds.includes(id));
}

router.get("/", async (req, res) => {
  const me = currentUserId(req);
  const hidden = await getHiddenDemoUserIds(me);
  const friendIds = (await getDirectionalIds(await getFollowingIds(me), me)).filter(
    (id) => !hidden.includes(id)
  );
  if (!friendIds.length) return res.json([]);
  const friends = await Promise.all(
    friendIds.map((id) =>
      db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
    )
  );
  res.json(await Promise.all(friends.filter(Boolean).map((u) => formatUserWithCounts(u!))));
});

router.get("/locations", async (req, res) => {
  const me = currentUserId(req);
  const rawLakeId = req.query.lakeId != null ? Number(req.query.lakeId) : undefined;
  const filterLakeId =
    rawLakeId !== undefined ? (isValidLakeId(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID) : undefined;
  const hidden = await getHiddenDemoUserIds(me);
  // The map shows people I follow. A non-mutual followee can hide their live
  // location from followers they don't follow back via followerSeeLocation.
  const [followingIdsRaw, myFollowerIds] = await Promise.all([
    getDirectionalIds(await getFollowingIds(me), me),
    getFollowerIds(me),
  ]);
  const followingIds = followingIdsRaw.filter((id) => !hidden.includes(id));
  if (!followingIds.length) return res.json([]);
  const mutualSet = new Set(myFollowerIds);
  const friends = await Promise.all(
    followingIds.map((id) =>
      db.query.usersTable.findFirst({ where: eq(usersTable.id, id) })
    )
  );
  const visibleFriends = friends
    .filter(Boolean)
    .filter((u) => mutualSet.has(u!.id) || u!.followerSeeLocation)
    // Lake filter: a checked-in friend belongs to the lake they checked in at
    // (older clients without a lake default to the catalog default).
    .filter((u) => filterLakeId === undefined || (u!.currentLakeId ?? DEFAULT_LAKE_ID) === filterLakeId);
  const activeStoryIds = await getActiveStoryAuthorIds(visibleFriends.map((u) => u!.id));
  const locations = visibleFriends
    .map((u) => {
      // Apple 5.1.2: only publish coordinates while the friend is actively
      // checked in (non-expired manual check-in) AND their position is fresh, so
      // a closed/left app drops off the map instead of lingering as a ghost boat.
      const sharing = isLocationLive(u!);
      return {
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
        lat: sharing ? u!.currentLat : null,
        lng: sharing ? u!.currentLng : null,
        lakeId: u!.currentLakeId ?? DEFAULT_LAKE_ID,
        isSharingLocation: sharing,
        isBusiness: u!.isBusiness,
        isOnline: u!.isOnline,
        isOnWater: u!.isOnWater,
        lastSeen: u!.lastSeen ? u!.lastSeen.toISOString() : null,
        lakeStatus: u!.lakeStatus,
        hasActiveStory: activeStoryIds.has(u!.id),
      };
    });
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
  // Never suggest demo accounts to anyone not in Demo Mode (empty for reviewer).
  const hiddenDemoIds = await getHiddenDemoUserIds(me);
  const exclude = new Set<number>([
    me,
    ...myFriendIds,
    ...pendingPeerIds,
    ...blockedIds,
    ...hiddenDemoIds,
  ]);

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

  // 5. Nearby boaters (actively checked in, within ~40km of me).
  if (meUser?.currentLat != null && meUser?.currentLng != null) {
    const located = await db.query.usersTable.findMany({
      where: gt(usersTable.locationSharingExpiresAt, new Date()),
    });
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
  const hidden = await getHiddenDemoUserIds(currentUserId(req));
  const blockedIds = rows.map((r) => r.blockedId).filter((id) => !hidden.includes(id));
  if (!blockedIds.length) return res.json([]);
  const users = await db.query.usersTable.findMany({
    where: inArray(usersTable.id, blockedIds),
  });
  res.json(await Promise.all(users.map((u) => formatUserWithCounts(u))));
});

router.get("/:userId/followers", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  const hidden = await getHiddenDemoUserIds(currentUserId(req));
  if (hidden.includes(targetId)) return res.status(404).json({ error: "User not found" });
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
  const ids = (await getDirectionalIds(await getFollowerIds(targetId), currentUserId(req))).filter(
    (id) => !hidden.includes(id)
  );
  if (!ids.length) return res.json([]);
  const users = await db.query.usersTable.findMany({ where: inArray(usersTable.id, ids) });
  res.json(await Promise.all(users.map(formatUserWithCounts)));
});

router.get("/:userId/friends", async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  const hidden = await getHiddenDemoUserIds(currentUserId(req));
  if (hidden.includes(targetId)) return res.status(404).json({ error: "User not found" });
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
  // "Friends" in the one-way model = mutual follows (both directions exist).
  const [tFollowers, tFollowing] = await Promise.all([
    getFollowerIds(targetId),
    getFollowingIds(targetId),
  ]);
  const followingSet = new Set(tFollowing);
  const friendIds = (
    await getDirectionalIds(
      tFollowers.filter((id) => followingSet.has(id)),
      currentUserId(req)
    )
  ).filter((id) => !hidden.includes(id));
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
  const hidden = await getHiddenDemoUserIds(me);
  if (hidden.includes(targetId)) return res.json({ count: 0, users: [] });
  const [mine, theirs, blockedIds] = await Promise.all([
    acceptedFor(me),
    acceptedFor(targetId),
    getBlockedUserIds(me),
  ]);
  const mutualIds = [...mine].filter(
    (id) =>
      theirs.has(id) &&
      id !== me &&
      id !== targetId &&
      !blockedIds.includes(id) &&
      !hidden.includes(id)
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
  const hidden = await getHiddenDemoUserIds(currentUserId(req));
  if (hidden.includes(targetId)) return res.status(404).json({ error: "User not found" });
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
  const ids = (await getDirectionalIds(await getFollowingIds(targetId), currentUserId(req))).filter(
    (id) => !hidden.includes(id)
  );
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
  // Demo accounts are invisible to non-demo users, so they can't be followed by
  // ID (which would otherwise auto-accept and unlock demo friends-only content).
  const hiddenDemoIds = await getHiddenDemoUserIds(currentUserId(req));
  if (hiddenDemoIds.includes(targetId)) return res.status(404).json({ error: "User not found" });
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) });

  const outgoing = await db.query.friendRequestsTable.findFirst({
    where: and(
      eq(friendRequestsTable.followerId, currentUserId(req)),
      eq(friendRequestsTable.followeeId, targetId)
    ),
  });
  if (outgoing) return res.json(serializeRequest(outgoing));

  // One-way follow: this only creates my -> target. If the target already
  // follows me, that's their separate row; following them does not auto-accept
  // it (the relationship only becomes mutual when both rows exist).
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
      and(
        eq(friendRequestsTable.followerId, currentUserId(req)),
        eq(friendRequestsTable.followeeId, targetId)
      )
    );
  res.json({ success: true });
});

router.get("/mutes", async (req, res) => {
  const rows = await db.query.mutesTable.findMany({
    where: eq(mutesTable.muterId, currentUserId(req)),
  });
  const hidden = await getHiddenDemoUserIds(currentUserId(req));
  const mutedIds = rows.map((r) => r.mutedId).filter((id) => !hidden.includes(id));
  if (!mutedIds.length) return res.json([]);
  const users = await db.query.usersTable.findMany({
    where: inArray(usersTable.id, mutedIds),
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
  const hiddenDemoIds = await getHiddenDemoUserIds(currentUserId(req));
  if (hiddenDemoIds.includes(targetId)) return res.status(404).json({ error: "User not found" });
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
  const hiddenDemoIds = await getHiddenDemoUserIds(currentUserId(req));
  if (hiddenDemoIds.includes(targetId)) return res.status(404).json({ error: "User not found" });
  const me = currentUserId(req);
  // Atomically sever the follow relationship (both directions) and record the
  // block, so a blocked user immediately loses location/message/interaction
  // access without either side logging out (Apple 5.1.2).
  await db.transaction(async (tx) => {
    await tx
      .delete(friendRequestsTable)
      .where(
        or(
          and(eq(friendRequestsTable.followerId, me), eq(friendRequestsTable.followeeId, targetId)),
          and(eq(friendRequestsTable.followerId, targetId), eq(friendRequestsTable.followeeId, me))
        )
      );
    const existing = await tx.query.blocksTable.findFirst({
      where: and(eq(blocksTable.blockerId, me), eq(blocksTable.blockedId, targetId)),
    });
    if (!existing) {
      await tx.insert(blocksTable).values({ blockerId: me, blockedId: targetId });
    }
  });
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
