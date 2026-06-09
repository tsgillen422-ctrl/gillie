import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  friendRequestsTable,
  blocksTable,
  postsTable,
  pinsTable,
  catchesTable,
  postLikesTable,
  postCommentsTable,
  commentLikesTable,
  eventRsvpsTable,
  savedPostsTable,
  mutesTable,
  reportsTable,
  pinLikesTable,
  pinFavoritesTable,
  galleryItemsTable,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  notificationsTable,
  pushSubscriptionsTable,
  nativePushTokensTable,
} from "@workspace/db";
import { eq, ilike, or, and, count, notInArray, inArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { createNotifications } from "../lib/notify";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const VALID_INTERESTS = [
  "fishing",
  "boating",
  "camping",
  "hiking",
  "swimming",
  "photography",
  "sunsets",
  "wildlife",
  "bonfires",
];

// Permanently delete a user and every record that references them.
async function deleteUserAndData(tx: Tx, userId: number): Promise<void> {
  const postIds = (
    await tx.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.userId, userId))
  ).map((r) => r.id);
  const pinIds = (
    await tx.select({ id: pinsTable.id }).from(pinsTable).where(eq(pinsTable.userId, userId))
  ).map((r) => r.id);
  const convIds = [
    ...new Set(
      (
        await tx
          .select({ conversationId: conversationParticipantsTable.conversationId })
          .from(conversationParticipantsTable)
          .where(eq(conversationParticipantsTable.userId, userId))
      ).map((r) => r.conversationId)
    ),
  ];

  // Comments authored by the user or left on the user's posts.
  const commentConds = [eq(postCommentsTable.userId, userId)];
  if (postIds.length) commentConds.push(inArray(postCommentsTable.postId, postIds));
  const commentIds = (
    await tx.select({ id: postCommentsTable.id }).from(postCommentsTable).where(or(...commentConds))
  ).map((r) => r.id);

  // Comment likes by the user or on those comments.
  const commentLikeConds = [eq(commentLikesTable.userId, userId)];
  if (commentIds.length) commentLikeConds.push(inArray(commentLikesTable.commentId, commentIds));
  await tx.delete(commentLikesTable).where(or(...commentLikeConds));

  if (commentIds.length) {
    await tx.delete(postCommentsTable).where(inArray(postCommentsTable.id, commentIds));
  }

  // Post engagement by the user or on the user's posts.
  const postLikeConds = [eq(postLikesTable.userId, userId)];
  if (postIds.length) postLikeConds.push(inArray(postLikesTable.postId, postIds));
  await tx.delete(postLikesTable).where(or(...postLikeConds));

  const savedConds = [eq(savedPostsTable.userId, userId)];
  if (postIds.length) savedConds.push(inArray(savedPostsTable.postId, postIds));
  await tx.delete(savedPostsTable).where(or(...savedConds));

  const rsvpConds = [eq(eventRsvpsTable.userId, userId)];
  if (postIds.length) rsvpConds.push(inArray(eventRsvpsTable.postId, postIds));
  await tx.delete(eventRsvpsTable).where(or(...rsvpConds));

  await tx.delete(postsTable).where(eq(postsTable.userId, userId));

  // Pin engagement by the user or on the user's pins.
  const pinLikeConds = [eq(pinLikesTable.userId, userId)];
  if (pinIds.length) pinLikeConds.push(inArray(pinLikesTable.pinId, pinIds));
  await tx.delete(pinLikesTable).where(or(...pinLikeConds));

  const pinFavConds = [eq(pinFavoritesTable.userId, userId)];
  if (pinIds.length) pinFavConds.push(inArray(pinFavoritesTable.pinId, pinIds));
  await tx.delete(pinFavoritesTable).where(or(...pinFavConds));

  await tx.delete(pinsTable).where(eq(pinsTable.userId, userId));

  await tx.delete(catchesTable).where(eq(catchesTable.userId, userId));
  await tx.delete(galleryItemsTable).where(eq(galleryItemsTable.userId, userId));

  // Remove the user's own messages and their participation, but preserve
  // conversations (and other users' messages) that still have participants.
  await tx.delete(messagesTable).where(eq(messagesTable.senderId, userId));
  await tx.delete(conversationParticipantsTable).where(eq(conversationParticipantsTable.userId, userId));

  // Drop any conversation the user was in that now has no participants left.
  for (const convId of convIds) {
    const [remaining] = await tx
      .select({ value: count() })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, convId));
    if ((remaining?.value ?? 0) === 0) {
      await tx.delete(messagesTable).where(eq(messagesTable.conversationId, convId));
      await tx.delete(conversationsTable).where(eq(conversationsTable.id, convId));
    }
  }

  await tx.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
  await tx
    .delete(friendRequestsTable)
    .where(or(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.followeeId, userId)));
  await tx
    .delete(blocksTable)
    .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)));
  await tx.delete(mutesTable).where(or(eq(mutesTable.muterId, userId), eq(mutesTable.mutedId, userId)));
  await tx
    .delete(reportsTable)
    .where(
      or(
        eq(reportsTable.reporterId, userId),
        and(eq(reportsTable.targetType, "user"), eq(reportsTable.targetId, userId))
      )
    );
  await tx.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  await tx.delete(nativePushTokensTable).where(eq(nativePushTokensTable.userId, userId));

  await tx.delete(usersTable).where(eq(usersTable.id, userId));
}

const router = Router();

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

type BadgeOut = { key: string; label: string; description: string; earned: boolean };

// Single source of truth for every badge and its earning threshold.
// Earned status is computed live from real activity on each request.
async function computeBadges(userId: number): Promise<BadgeOut[]> {
  const [postRes] = await db.select({ value: count() }).from(postsTable).where(eq(postsTable.userId, userId));
  const [pinRes] = await db.select({ value: count() }).from(pinsTable).where(eq(pinsTable.userId, userId));
  const [catchRes] = await db.select({ value: count() }).from(catchesTable).where(eq(catchesTable.userId, userId));
  const [galleryRes] = await db.select({ value: count() }).from(galleryItemsTable).where(eq(galleryItemsTable.userId, userId));
  const [campRes] = await db
    .select({ value: count() })
    .from(pinsTable)
    .where(and(eq(pinsTable.userId, userId), eq(pinsTable.type, "campsite")));
  const [publicPinRes] = await db
    .select({ value: count() })
    .from(pinsTable)
    .where(and(eq(pinsTable.userId, userId), eq(pinsTable.visibility, "public")));
  const { followerCount } = await getFollowCounts(userId);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });

  const posts = postRes?.value ?? 0;
  const pins = pinRes?.value ?? 0;
  const catches = catchRes?.value ?? 0;
  const photos = galleryRes?.value ?? 0;
  const campsitePins = campRes?.value ?? 0;
  const publicPins = publicPinRes?.value ?? 0;
  const isBusiness = !!user?.isBusiness;
  const hasBoat = !!user?.boatName;

  return [
    { key: "explorer", label: "Lake Explorer", description: "Welcome to the Dale Hollow Lake community.", earned: true },
    { key: "first_post", label: "First Post", description: "Share your first post.", earned: posts >= 1 },
    { key: "frequent_poster", label: "Frequent Poster", description: "Share 10 posts.", earned: posts >= 10 },
    { key: "first_catch", label: "First Catch", description: "Log your first catch.", earned: catches >= 1 },
    { key: "angler", label: "Master Angler", description: "Log 10 catches.", earned: catches >= 10 },
    { key: "pathfinder", label: "Pathfinder", description: "Drop your first map pin.", earned: pins >= 1 },
    { key: "trailblazer", label: "Trailblazer", description: "Drop 5 map pins.", earned: pins >= 5 },
    { key: "shutterbug", label: "Shutterbug", description: "Add 3 photos to your gallery.", earned: photos >= 3 },
    { key: "popular", label: "Crowd Favorite", description: "Reach 5 followers.", earned: followerCount >= 5 },
    { key: "camper", label: "Camper", description: "Pin a campsite.", earned: campsitePins >= 1 },
    { key: "boater", label: "Boater", description: "Add your boat to your profile.", earned: hasBoat },
    { key: "local_guide", label: "Local Guide", description: "Share 3 public pins or run a verified business.", earned: isBusiness || publicPins >= 3 },
    { key: "verified_business", label: "Verified Business", description: "A verified Dale Hollow Lake business.", earned: isBusiness },
  ];
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    location: u.location,
    hometown: u.hometown,
    birthday: u.birthday,
    relationshipStatus: u.relationshipStatus,
    gender: u.gender,
    work: u.work,
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
    interests: u.interests ?? [],
    shareLocation: u.shareLocation,
    requireFollowApproval: u.requireFollowApproval,
    showFollowers: u.showFollowers,
    isAdmin: u.isAdmin,
    isSuspended: u.isSuspended,
    warningCount: u.warningCount,
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

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

router.get("/me", async (req, res) => {
  const uid = currentUserId(req);
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, uid),
  });
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ ...formatUser(user), ...(await getFollowCounts(user.id)), badges: await computeBadges(user.id) });
});

router.post("/me/sos", async (req, res) => {
  const uid = currentUserId(req);
  const { message } = req.body;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
  if (!user) return res.status(401).json({ error: "Not logged in" });
  const friendIds = await getFriendIds(uid);
  const text =
    (message && String(message).trim()) ||
    `${user.displayName} needs help on the water!`;
  const locationNote =
    user.currentLat != null && user.currentLng != null
      ? ` Last known location: ${user.currentLat.toFixed(4)}, ${user.currentLng.toFixed(4)}.`
      : "";
  if (friendIds.length > 0) {
    await createNotifications(
      friendIds.map((fid) => ({
        userId: fid,
        type: "sos",
        message: `🚨 ${text}${locationNote}`,
        relatedId: uid,
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
  const uid = currentUserId(req);
  const { displayName, bio, location, hometown, birthday, relationshipStatus, gender, work, avatarUrl, coverUrl, boatName, boatColor, boatType, boatNeon, boatFlag, boatAccent, interests, isBusiness, shareLocation } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (bio !== undefined) updates.bio = bio;
  if (location !== undefined) updates.location = location;
  if (hometown !== undefined) updates.hometown = hometown;
  if (birthday !== undefined) updates.birthday = birthday;
  if (relationshipStatus !== undefined) updates.relationshipStatus = relationshipStatus;
  if (gender !== undefined) updates.gender = gender;
  if (work !== undefined) updates.work = work;
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
  if (interests !== undefined) {
    if (!Array.isArray(interests) || interests.some((i) => typeof i !== "string")) {
      return res.status(400).json({ error: "interests must be an array of strings" });
    }
    if (interests.some((i) => !VALID_INTERESTS.includes(i))) {
      return res.status(400).json({ error: "interests contains an unknown value" });
    }
    updates.interests = Array.from(new Set(interests as string[]));
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
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, uid)).returning();
  res.json(formatUser(updated));
});

router.patch("/me/location", async (req, res) => {
  const uid = currentUserId(req);
  const { lat, lng } = req.body;
  const [updated] = await db
    .update(usersTable)
    .set({ currentLat: lat, currentLng: lng, isOnline: true, lastSeen: new Date() })
    .where(eq(usersTable.id, uid))
    .returning();
  res.json(formatUser(updated));
});

router.get("/search", async (req, res) => {
  const uid = currentUserId(req);
  const q = String(req.query.q || "");
  if (!q) return res.json([]);
  const blockedIds = await getBlockedUserIds(uid);
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

router.get("/admins", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const admins = await db.select().from(usersTable).where(eq(usersTable.isAdmin, true));
  const withCounts = await Promise.all(
    admins.map(async (u) => ({ ...formatUser(u), ...(await getFollowCounts(u.id)) }))
  );
  res.json(withCounts);
});

router.patch("/:userId/admin", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const userId = parseInt(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });
  const { isAdmin: makeAdmin } = req.body ?? {};
  if (typeof makeAdmin !== "boolean") {
    return res.status(400).json({ error: "isAdmin must be a boolean" });
  }
  if (userId === uid && !makeAdmin) {
    return res.status(400).json({ error: "You can't remove your own admin access" });
  }
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  const [updated] = await db
    .update(usersTable)
    .set({ isAdmin: makeAdmin })
    .where(eq(usersTable.id, userId))
    .returning();
  res.json({ ...formatUser(updated), ...(await getFollowCounts(updated.id)) });
});

router.delete("/:userId", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const userId = parseInt(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });
  if (userId === uid) return res.status(400).json({ error: "You can't delete your own account" });
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.isAdmin) {
    return res.status(400).json({ error: "Remove this user's admin access before deleting them" });
  }
  await db.transaction(async (tx) => {
    await deleteUserAndData(tx, userId);
  });
  res.json({ success: true });
});

router.get("/:userId", async (req, res) => {
  const uid = currentUserId(req);
  const userId = parseInt(req.params.userId);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });

  let friendStatus = "none";
  if (userId === uid) {
    friendStatus = "self";
  } else {
    const blockedByMe = await db.query.blocksTable.findFirst({
      where: and(eq(blocksTable.blockerId, uid), eq(blocksTable.blockedId, userId)),
    });
    const blockedMe = await db.query.blocksTable.findFirst({
      where: and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, uid)),
    });
    if (blockedByMe) {
      friendStatus = "blocked";
    } else if (blockedMe) {
      friendStatus = "blocked_by";
    } else {
      const rel = await db.query.friendRequestsTable.findFirst({
        where: or(
          and(eq(friendRequestsTable.followerId, uid), eq(friendRequestsTable.followeeId, userId)),
          and(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.followeeId, uid))
        ),
      });
      if (rel) {
        if (rel.status === "accepted") friendStatus = "accepted";
        else if (rel.status === "pending") friendStatus = rel.followerId === uid ? "pending_out" : "pending_in";
      }
    }
  }

  const counts = await getFollowCounts(user.id);
  res.json({ ...formatUser(user), ...counts, badges: await computeBadges(user.id), friendStatus });
});

export default router;
