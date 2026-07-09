import { Router } from "express";
import { BOAT_TYPE_VALUES, BOAT_BRAND_MAX_LENGTH } from "@workspace/boat-config";
import { isValidLakeId } from "@workspace/lake-config";
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
  pollOptionsTable,
  pollVotesTable,
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
  waiverAcceptancesTable,
  termsAcceptancesTable,
  boatsTable,
  storiesTable,
  storyViewsTable,
  storyReactionsTable,
  storyPollVotesTable,
  highlightsTable,
  highlightStoriesTable,
} from "@workspace/db";
import { getFleet, formatBoat, syncActiveBoat } from "./boats";
import { eq, ilike, or, and, count, notInArray, inArray, desc, gt } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { currentUserId } from "../middlewares/auth";
import { createNotifications, createNotification } from "../lib/notify";
import { logger } from "../lib/logger";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { getUserActiveStoriesForViewer } from "./stories";
import { getUserHighlightsForViewer } from "./highlights";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Keep in sync with INTEREST_DEFS in dhl-app src/lib/interests.ts.
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
  "wakeboarding",
  "tubing",
  "kayaking",
  "paddleboarding",
  "cliffjumping",
  "waterskiing",
  "sunsetcruises",
];

// Permanently delete a user and every record that references them.
export async function deleteUserAndData(tx: Tx, userId: number): Promise<void> {
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

  // Poll votes by the user or on the user's poll posts, then the poll options on
  // those posts (votes reference options, options reference posts).
  const voteConds = [eq(pollVotesTable.userId, userId)];
  if (postIds.length) voteConds.push(inArray(pollVotesTable.postId, postIds));
  await tx.delete(pollVotesTable).where(or(...voteConds));
  if (postIds.length) {
    await tx.delete(pollOptionsTable).where(inArray(pollOptionsTable.postId, postIds));
  }

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
  await tx.delete(boatsTable).where(eq(boatsTable.userId, userId));

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

  // Stories: views/reactions/votes by the user or on the user's stories, then
  // the stories themselves, then highlights and their snapshots.
  const storyIds = (
    await tx.select({ id: storiesTable.id }).from(storiesTable).where(eq(storiesTable.userId, userId))
  ).map((r) => r.id);
  const storyViewConds = [eq(storyViewsTable.userId, userId)];
  const storyReactConds = [eq(storyReactionsTable.userId, userId)];
  const storyVoteConds = [eq(storyPollVotesTable.userId, userId)];
  if (storyIds.length) {
    storyViewConds.push(inArray(storyViewsTable.storyId, storyIds));
    storyReactConds.push(inArray(storyReactionsTable.storyId, storyIds));
    storyVoteConds.push(inArray(storyPollVotesTable.storyId, storyIds));
  }
  await tx.delete(storyViewsTable).where(or(...storyViewConds));
  await tx.delete(storyReactionsTable).where(or(...storyReactConds));
  await tx.delete(storyPollVotesTable).where(or(...storyVoteConds));
  await tx.delete(storiesTable).where(eq(storiesTable.userId, userId));

  const highlightIds = (
    await tx.select({ id: highlightsTable.id }).from(highlightsTable).where(eq(highlightsTable.userId, userId))
  ).map((r) => r.id);
  if (highlightIds.length) {
    await tx.delete(highlightStoriesTable).where(inArray(highlightStoriesTable.highlightId, highlightIds));
    await tx.delete(highlightsTable).where(eq(highlightsTable.userId, userId));
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
  await tx.delete(waiverAcceptancesTable).where(eq(waiverAcceptancesTable.userId, userId));
  await tx.delete(termsAcceptancesTable).where(eq(termsAcceptancesTable.userId, userId));

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
    { key: "explorer", label: "Lake Explorer", description: "Welcome to the Gillie community.", earned: true },
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
    { key: "verified_business", label: "Verified Business", description: "A verified local lake business.", earned: isBusiness },
  ];
}

const RANK_TIERS = [
  { key: "newcomer", title: "Newcomer", min: 1 },
  { key: "explorer", title: "Lake Explorer", min: 3 },
  { key: "weekender", title: "Weekend Warrior", min: 5 },
  { key: "adventurer", title: "Lake Adventurer", min: 8 },
  { key: "legend", title: "Lake Legend", min: 11 },
];

function computeRank(badges: BadgeOut[]) {
  const earnedCount = badges.filter((b) => b.earned).length;
  const totalCount = badges.length;
  let current = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (earnedCount >= t.min) current = t;
  }
  const next = RANK_TIERS.find((t) => t.min > earnedCount) ?? null;
  return {
    key: current.key,
    title: current.title,
    tier: RANK_TIERS.indexOf(current) + 1,
    earnedCount,
    totalCount,
    nextTitle: next ? next.title : null,
    nextNeeded: next ? next.min - earnedCount : null,
  };
}

// Apple 5.1.2: a user's live location may only be published while they have a
// non-expired manual check-in. This is the single source of truth used at every
// surface that exposes coordinates.
export function isActivelySharing(u: typeof usersTable.$inferSelect): boolean {
  return !!u.locationSharingExpiresAt && u.locationSharingExpiresAt.getTime() > Date.now();
}

// Apple 5.1.2: coordinates are published to OTHER users only while a check-in is
// active AND the position is fresh (recently refreshed). This drops a closed/left
// app off other people's views instead of leaving stale coordinates readable.
// NOT used for self (/me): isActivelySharing (no freshness) governs self-state so
// a returning user can resume reporting via PATCH /me/location and reappear.
const LIVE_LOCATION_FRESH_MS = 10 * 60 * 1000;
export function isLocationLive(u: typeof usersTable.$inferSelect): boolean {
  const fresh = !!u.lastSeen && Date.now() - u.lastSeen.getTime() < LIVE_LOCATION_FRESH_MS;
  return isActivelySharing(u) && fresh;
}

// Apple 5.1.2 — location is DENY BY DEFAULT. Coordinates (and the sharing
// window) are only serialized when the caller explicitly passes
// `includeLiveLocation: true`, which is limited to (a) self endpoints (/me and
// its mutations) and (b) the profile route after its viewer audience check
// (canSeeLive). Every other surface (search, admin lists, moderation actions)
// gets nulls so a non-friend can never read someone's position.
// When `redactHiddenBoat` is set and the user has showBoat=false, the boat
// showcase details (model/year/photo/marina) are withheld from other viewers.
// boatName/color/type stay visible because the map's boat markers depend on them.
function formatUser(u: typeof usersTable.$inferSelect, opts: { includeLiveLocation?: boolean; redactHiddenBoat?: boolean } = {}) {
  const sharing = opts.includeLiveLocation ? isActivelySharing(u) : false;
  const hideBoat = !!opts.redactHiddenBoat && u.showBoat === false;
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
    primaryLakeId: u.primaryLakeId,
    currentLakeId: u.currentLakeId,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    currentLat: sharing ? u.currentLat : null,
    currentLng: sharing ? u.currentLng : null,
    lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
    lakeStatus: u.lakeStatus,
    boatName: u.boatName,
    boatColor: u.boatColor,
    boatType: u.boatType,
    boatBrand: hideBoat ? null : u.boatBrand,
    boatModel: hideBoat ? null : u.boatModel,
    boatYear: hideBoat ? null : u.boatYear,
    boatPhotoUrl: hideBoat ? null : u.boatPhotoUrl,
    homeMarina: hideBoat ? null : u.homeMarina,
    showBoat: u.showBoat,
    boatNeon: u.boatNeon,
    boatFlag: u.boatFlag,
    boatAccent: u.boatAccent,
    interests: u.interests ?? [],
    favoriteThings: u.favoriteThings ?? [],
    shareLocation: u.shareLocation,
    locationSharingExpiresAt: opts.includeLiveLocation && u.locationSharingExpiresAt ? u.locationSharingExpiresAt.toISOString() : null,
    isSharingLocation: sharing,
    requireFollowApproval: u.requireFollowApproval,
    showFollowers: u.showFollowers,
    showFriends: u.showFriends,
    followerSeeLocation: u.followerSeeLocation,
    followerSeePosts: u.followerSeePosts,
    followerSendMessages: u.followerSendMessages,
    allowReposts: u.allowReposts,
    showMatureContent: u.showMatureContent,
    isAdmin: u.isAdmin,
    demoMode: u.demoMode,
    isSuspended: u.isSuspended,
    warningCount: u.warningCount,
    waiverAcceptedAt: u.waiverAcceptedAt ? u.waiverAcceptedAt.toISOString() : null,
    waiverVersion: u.waiverVersion,
    termsAcceptedAt: u.termsAcceptedAt ? u.termsAcceptedAt.toISOString() : null,
    termsVersion: u.termsVersion,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

async function getFollowCounts(userId: number): Promise<{ followerCount: number; followingCount: number }> {
  // One-way follow model: followers (people who follow me) and following (people
  // I follow) are independent sets, so the two counts can differ.
  const rows = await db.query.friendRequestsTable.findMany({
    where: and(
      or(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.followeeId, userId)),
      eq(friendRequestsTable.status, "accepted")
    ),
  });
  const followers = new Set<number>();
  const following = new Set<number>();
  for (const r of rows) {
    if (r.followeeId === userId && r.followerId !== userId) followers.add(r.followerId);
    if (r.followerId === userId && r.followeeId !== userId) following.add(r.followeeId);
  }
  return { followerCount: followers.size, followingCount: following.size };
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
  const meBadges = await computeBadges(user.id);
  const fleet = (await getFleet(user.id)).map(formatBoat);
  res.json({ ...formatUser(user, { includeLiveLocation: true }), fleet, ...(await getFollowCounts(user.id)), badges: meBadges, rank: computeRank(meBadges) });
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
  const { displayName, bio, location, hometown, birthday, relationshipStatus, gender, work, avatarUrl, coverUrl, boatName, boatColor, boatType, boatBrand, boatModel, boatYear, boatPhotoUrl, homeMarina, showBoat, boatNeon, boatFlag, boatAccent, interests, favoriteThings, isBusiness, primaryLakeId } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (primaryLakeId !== undefined) {
    if (!isValidLakeId(primaryLakeId)) {
      return res.status(400).json({ error: "Invalid primaryLakeId" });
    }
    updates.primaryLakeId = primaryLakeId;
  }
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
    if (!BOAT_TYPE_VALUES.includes(boatType)) {
      return res.status(400).json({ error: "Invalid boatType" });
    }
    updates.boatType = boatType;
  }
  if (boatBrand !== undefined) {
    if (boatBrand !== null && typeof boatBrand !== "string") {
      return res.status(400).json({ error: "boatBrand must be a string or null" });
    }
    const trimmed = typeof boatBrand === "string" ? boatBrand.trim() : null;
    if (trimmed && trimmed.length > BOAT_BRAND_MAX_LENGTH) {
      return res.status(400).json({ error: `boatBrand must be at most ${BOAT_BRAND_MAX_LENGTH} characters` });
    }
    updates.boatBrand = trimmed || null;
  }
  if (boatModel !== undefined) {
    if (boatModel !== null && typeof boatModel !== "string") {
      return res.status(400).json({ error: "boatModel must be a string or null" });
    }
    const trimmed = typeof boatModel === "string" ? boatModel.trim() : null;
    if (trimmed && trimmed.length > 60) {
      return res.status(400).json({ error: "boatModel must be at most 60 characters" });
    }
    updates.boatModel = trimmed || null;
  }
  if (boatYear !== undefined) {
    if (boatYear !== null) {
      const year = Number(boatYear);
      if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
        return res.status(400).json({ error: "boatYear must be a valid year" });
      }
      updates.boatYear = year;
    } else {
      updates.boatYear = null;
    }
  }
  if (boatPhotoUrl !== undefined) {
    if (boatPhotoUrl !== null && typeof boatPhotoUrl !== "string") {
      return res.status(400).json({ error: "boatPhotoUrl must be a string or null" });
    }
    updates.boatPhotoUrl = boatPhotoUrl || null;
  }
  if (homeMarina !== undefined) {
    if (homeMarina !== null && typeof homeMarina !== "string") {
      return res.status(400).json({ error: "homeMarina must be a string or null" });
    }
    const trimmed = typeof homeMarina === "string" ? homeMarina.trim() : null;
    if (trimmed && trimmed.length > 80) {
      return res.status(400).json({ error: "homeMarina must be at most 80 characters" });
    }
    updates.homeMarina = trimmed || null;
  }
  if (showBoat !== undefined) {
    if (typeof showBoat !== "boolean") {
      return res.status(400).json({ error: "showBoat must be a boolean" });
    }
    updates.showBoat = showBoat;
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
  if (favoriteThings !== undefined) {
    if (!Array.isArray(favoriteThings) || favoriteThings.length > 12) {
      return res.status(400).json({ error: "favoriteThings must be an array of at most 12 items" });
    }
    for (const f of favoriteThings) {
      if (
        !f ||
        typeof f !== "object" ||
        typeof f.label !== "string" ||
        !f.label.trim() ||
        f.label.length > 40 ||
        typeof f.value !== "string" ||
        !f.value.trim() ||
        f.value.length > 80
      ) {
        return res.status(400).json({ error: "each favorite needs a label (≤40 chars) and value (≤80 chars)" });
      }
    }
    updates.favoriteThings = favoriteThings.map((f: any) => ({
      label: String(f.label).trim(),
      value: String(f.value).trim(),
    }));
  }
  if (isBusiness !== undefined) updates.isBusiness = isBusiness;
  // Apple 5.1.2: shareLocation is no longer a persistent toggle. Live location
  // is only published via an explicit, expiring check-in (POST /me/checkin), so
  // this endpoint intentionally ignores any shareLocation in the body.
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
  if (req.body.showFriends !== undefined) {
    if (typeof req.body.showFriends !== "boolean") {
      return res.status(400).json({ error: "showFriends must be a boolean" });
    }
    updates.showFriends = req.body.showFriends;
  }
  if (req.body.followerSeeLocation !== undefined) {
    if (typeof req.body.followerSeeLocation !== "boolean") {
      return res.status(400).json({ error: "followerSeeLocation must be a boolean" });
    }
    updates.followerSeeLocation = req.body.followerSeeLocation;
  }
  if (req.body.followerSeePosts !== undefined) {
    if (typeof req.body.followerSeePosts !== "boolean") {
      return res.status(400).json({ error: "followerSeePosts must be a boolean" });
    }
    updates.followerSeePosts = req.body.followerSeePosts;
  }
  if (req.body.followerSendMessages !== undefined) {
    if (typeof req.body.followerSendMessages !== "boolean") {
      return res.status(400).json({ error: "followerSendMessages must be a boolean" });
    }
    updates.followerSendMessages = req.body.followerSendMessages;
  }
  if (req.body.allowReposts !== undefined) {
    if (typeof req.body.allowReposts !== "boolean") {
      return res.status(400).json({ error: "allowReposts must be a boolean" });
    }
    updates.allowReposts = req.body.allowReposts;
  }
  if (req.body.showMatureContent !== undefined) {
    if (typeof req.body.showMatureContent !== "boolean") {
      return res.status(400).json({ error: "showMatureContent must be a boolean" });
    }
    updates.showMatureContent = req.body.showMatureContent;
  }
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, uid)).returning();
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

router.post("/me/waiver", async (req, res) => {
  const uid = currentUserId(req);
  const { version } = req.body;
  if (typeof version !== "string" || !version.trim()) {
    return res.status(400).json({ error: "version must be a non-empty string" });
  }
  const acceptedAt = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(usersTable)
      .set({ waiverAcceptedAt: acceptedAt, waiverVersion: version })
      .where(eq(usersTable.id, uid))
      .returning();
    if (!row) return null;
    await tx.insert(waiverAcceptancesTable).values({ userId: uid, version, acceptedAt });
    return row;
  });
  if (!updated) return res.status(401).json({ error: "Not logged in" });
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

// App Store / EULA: record acceptance of the Terms of Service, Privacy Policy,
// and Community Guidelines. Mirrors the waiver flow — stamps the user row for a
// quick gate check and appends an immutable history row for the audit trail.
router.post("/me/terms", async (req, res) => {
  const uid = currentUserId(req);
  const { version } = req.body;
  if (typeof version !== "string" || !version.trim()) {
    return res.status(400).json({ error: "version must be a non-empty string" });
  }
  const acceptedAt = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(usersTable)
      .set({ termsAcceptedAt: acceptedAt, termsVersion: version })
      .where(eq(usersTable.id, uid))
      .returning();
    if (!row) return null;
    await tx.insert(termsAcceptancesTable).values({ userId: uid, version, acceptedAt });
    return row;
  });
  if (!updated) return res.status(401).json({ error: "Not logged in" });
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

// Passive sharing model (Snapchat-style, still 5.1.2-safe): sharing starts with
// an explicit opt-in (POST /me/checkin from the consent dialog) and each location
// report while the app is OPEN slides the expiry forward, so sharing continues
// seamlessly across sessions for active users. If the user simply stops opening
// the app, the window lapses and they auto-ghost — sharing can never become
// permanent without continued app use. Ghost Mode (POST /me/checkout) stops it
// instantly. Old app builds that request short manual check-ins keep working.
const CHECKIN_DEFAULT_HOURS = 6;
const CHECKIN_MAX_HOURS = 24;
const PASSIVE_WINDOW_HOURS = 24;

router.patch("/me/location", async (req, res) => {
  const uid = currentUserId(req);
  const { lat, lng, onWater } = req.body;
  // Only refresh coordinates while the user is actively sharing. iOS location
  // permission alone (or a stale client) must never publish a position.
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
  if (!me) return res.status(401).json({ error: "Not logged in" });
  if (!isActivelySharing(me)) {
    return res.json(formatUser(me, { includeLiveLocation: true }));
  }
  // Slide the auto-ghost window: using the app while sharing keeps sharing
  // alive; not opening the app lets it lapse within PASSIVE_WINDOW_HOURS.
  const slidTo = new Date(Date.now() + PASSIVE_WINDOW_HOURS * 60 * 60 * 1000);
  const [updated] = await db
    .update(usersTable)
    .set({
      currentLat: lat,
      currentLng: lng,
      isOnline: true,
      // Only the map client can tell water from land; a report that omits
      // onWater (e.g. the app-level keep-alive heartbeat) must not clobber the
      // last known determination.
      ...(onWater === undefined ? {} : { isOnWater: onWater === true }),
      lastSeen: new Date(),
      locationSharingExpiresAt: slidTo,
    })
    .where(eq(usersTable.id, uid))
    .returning();
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

// Apple 5.1.2: explicit manual check-in. Starts publishing the user's location
// for an expiring window. Requires fresh coordinates so a check-in always
// corresponds to a real, user-initiated position.
router.post("/me/checkin", async (req, res) => {
  const uid = currentUserId(req);
  const { lat, lng, onWater, durationHours, boatId, lakeId } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng are required numbers" });
  }
  if (lakeId !== undefined && lakeId !== null && !isValidLakeId(lakeId)) {
    return res.status(400).json({ error: "Invalid lakeId" });
  }
  let hours = CHECKIN_DEFAULT_HOURS;
  if (durationHours !== undefined) {
    if (typeof durationHours !== "number" || !Number.isFinite(durationHours)) {
      return res.status(400).json({ error: "durationHours must be a number" });
    }
    hours = Math.min(CHECKIN_MAX_HOURS, Math.max(1, durationHours));
  }
  // "Which boat are you taking today?" — copy the chosen boat's look onto the
  // denormalized users.boat* columns so it is what appears on the map.
  if (boatId !== undefined && boatId !== null) {
    if (typeof boatId !== "number" || !Number.isInteger(boatId)) {
      return res.status(400).json({ error: "boatId must be an integer" });
    }
    const boat = await db.query.boatsTable.findFirst({ where: eq(boatsTable.id, boatId) });
    if (!boat || boat.userId !== uid) return res.status(404).json({ error: "Boat not found in your fleet" });
    await syncActiveBoat(uid, boat);
  }
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const [updated] = await db
    .update(usersTable)
    .set({
      currentLat: lat,
      currentLng: lng,
      isOnline: true,
      // Preserve the last water/land determination when the client doesn't
      // supply one (e.g. the silent auto-resume on app launch).
      ...(onWater === undefined ? {} : { isOnWater: onWater === true }),
      shareLocation: true,
      locationSharingExpiresAt: expiresAt,
      lastSeen: new Date(),
      // Which lake the user checked in at — used to place their boat on the
      // right lake's map. Defaults to the catalog default for older clients.
      ...(lakeId != null ? { currentLakeId: lakeId } : {}),
    })
    .where(eq(usersTable.id, uid))
    .returning();
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

// Apple 5.1.2: stop sharing. Clears the check-in so the user immediately drops
// off the map for everyone. Also used on logout / cold launch.
router.post("/me/checkout", async (req, res) => {
  const uid = currentUserId(req);
  const [updated] = await db
    .update(usersTable)
    .set({
      shareLocation: false,
      locationSharingExpiresAt: null,
      isOnline: false,
      isOnWater: false,
      lakeStatus: null,
      lakeStatusUpdatedAt: null,
    })
    .where(eq(usersTable.id, uid))
    .returning();
  if (!updated) return res.status(401).json({ error: "Not logged in" });
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

// Richer live status ("Out on the Water", "At Sunset Marina", ...). Null or an
// empty string clears it.
router.put("/me/lake-status", async (req, res) => {
  const uid = currentUserId(req);
  const { lakeStatus } = req.body ?? {};
  if (lakeStatus != null && (typeof lakeStatus !== "string" || lakeStatus.trim().length > 60)) {
    return res.status(400).json({ error: "Status too long (max 60 characters)" });
  }
  const clean = typeof lakeStatus === "string" && lakeStatus.trim() ? lakeStatus.trim() : null;
  const [updated] = await db
    .update(usersTable)
    .set({ lakeStatus: clean, lakeStatusUpdatedAt: clean ? new Date() : null })
    .where(eq(usersTable.id, uid))
    .returning();
  if (!updated) return res.status(401).json({ error: "Not logged in" });
  res.json(formatUser(updated, { includeLiveLocation: true }));
});

router.get("/search", async (req, res) => {
  const uid = currentUserId(req);
  const q = String(req.query.q || "");
  if (!q) return res.json([]);
  const blockedIds = await getBlockedUserIds(uid);
  // Hide demo users from anyone not in Demo Mode (keeps demo world reviewer-only).
  const hiddenDemoIds = await getHiddenDemoUserIds(uid);
  const excludeIds = [...blockedIds, ...hiddenDemoIds];
  const matchClause = or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`));
  const where = excludeIds.length
    ? and(matchClause, notInArray(usersTable.id, excludeIds))
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

router.get("/suspended", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const suspended = await db.select().from(usersTable).where(eq(usersTable.isSuspended, true));
  const withCounts = await Promise.all(
    suspended.map(async (u) => ({ ...formatUser(u), ...(await getFollowCounts(u.id)) }))
  );
  res.json(withCounts);
});

router.get("/waiver-acceptances", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const rows = await db
    .select({
      id: waiverAcceptancesTable.id,
      version: waiverAcceptancesTable.version,
      acceptedAt: waiverAcceptancesTable.acceptedAt,
      userId: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(waiverAcceptancesTable)
    .innerJoin(usersTable, eq(waiverAcceptancesTable.userId, usersTable.id))
    .orderBy(desc(waiverAcceptancesTable.acceptedAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      version: r.version,
      acceptedAt: r.acceptedAt.toISOString(),
      user: {
        id: r.userId,
        displayName: r.displayName,
        username: r.username,
        avatarUrl: r.avatarUrl ?? null,
      },
    }))
  );
});

// Self-serve account deletion. Removes the user's Clerk identity FIRST so a
// re-login can't resurrect a ghost account, then deletes all of their data.
// If the Clerk delete fails we abort before touching any data and report an
// error, so the client never reports a "successful" deletion that can be undone.
router.delete("/me", async (req, res) => {
  const uid = currentUserId(req);
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
  if (!me) return res.status(404).json({ error: "User not found" });

  if (me.clerkId) {
    try {
      await clerkClient.users.deleteUser(me.clerkId);
    } catch (err) {
      logger.error({ err, userId: uid }, "Failed to delete Clerk user; aborting account deletion");
      return res.status(502).json({ error: "Failed to delete your account. Please try again." });
    }
  }

  await db.transaction(async (tx) => {
    await deleteUserAndData(tx, uid);
  });

  return res.json({ success: true });
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

// Suspend (ban) or restore a user account. Suspension is enforced globally in
// requireAuth, which ejects suspended users from the app. Reversible so a
// mistaken suspension can be undone.
router.patch("/:userId/suspension", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const userId = parseInt(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });
  const { suspended } = req.body ?? {};
  if (typeof suspended !== "boolean") {
    return res.status(400).json({ error: "suspended must be a boolean" });
  }
  if (userId === uid) {
    return res.status(400).json({ error: "You can't change your own suspension status" });
  }
  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!target) return res.status(404).json({ error: "User not found" });
  const [updated] = await db
    .update(usersTable)
    .set({ isSuspended: suspended })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!suspended && target.isSuspended) {
    // Best-effort: the authoritative result is the suspension state change, so a
    // failed notification insert must not fail the restore request.
    try {
      await createNotification({
        userId,
        type: "warning",
        message: "Your account has been restored by a moderator.",
        relatedId: null,
      });
    } catch (err) {
      logger.error({ err, userId }, "Failed to send account-restored notification");
    }
  }
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

router.get("/:userId/stories", async (req, res) => {
  const uid = currentUserId(req);
  const userId = req.params.userId === "me" ? uid : parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });
  const stories = await getUserActiveStoriesForViewer(uid, userId);
  if (stories === null) return res.status(404).json({ error: "User not found" });
  res.json(stories);
});

router.get("/:userId/highlights", async (req, res) => {
  const uid = currentUserId(req);
  const userId = req.params.userId === "me" ? uid : parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });
  const highlights = await getUserHighlightsForViewer(uid, userId);
  if (highlights === null) return res.status(404).json({ error: "User not found" });
  res.json(highlights);
});

router.get("/:userId", async (req, res) => {
  const uid = currentUserId(req);
  const userId = parseInt(req.params.userId);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });
  // Demo profiles are invisible (404) to anyone not in Demo Mode.
  if (userId !== uid) {
    const hiddenDemoIds = await getHiddenDemoUserIds(uid);
    if (hiddenDemoIds.includes(userId)) return res.status(404).json({ error: "User not found" });
  }

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

  // Apple 5.1.2 + follower privacy: expose another user's location only while
  // their sharing window is active, I follow them, and either they follow me back
  // (mutual) or they let followers see their location. Mirrors GET
  // /friends/locations so a non-follower can't read a sharing user's coordinates
  // from their profile. Stale-but-active positions stay visible ("last seen").
  let canSeeLive = friendStatus === "self";
  if (!canSeeLive && friendStatus !== "blocked" && friendStatus !== "blocked_by" && isActivelySharing(user)) {
    const [iFollow, followsMe] = await Promise.all([
      db.query.friendRequestsTable.findFirst({
        where: and(
          eq(friendRequestsTable.followerId, uid),
          eq(friendRequestsTable.followeeId, userId),
          eq(friendRequestsTable.status, "accepted")
        ),
      }),
      db.query.friendRequestsTable.findFirst({
        where: and(
          eq(friendRequestsTable.followerId, userId),
          eq(friendRequestsTable.followeeId, uid),
          eq(friendRequestsTable.status, "accepted")
        ),
      }),
    ]);
    canSeeLive = !!iFollow && (!!followsMe || user.followerSeeLocation);
  }

  const counts = await getFollowCounts(user.id);
  const userBadges = await computeBadges(user.id);
  // Fleet follows the same privacy rule as the boat card: hidden from other
  // viewers when showBoat=false.
  const hideFleet = friendStatus !== "self" && user.showBoat === false;
  const fleet = hideFleet ? [] : (await getFleet(user.id)).map(formatBoat);
  res.json({ ...formatUser(user, { includeLiveLocation: canSeeLive, redactHiddenBoat: friendStatus !== "self" }), fleet, ...counts, badges: userBadges, rank: computeRank(userBadges), friendStatus });
});

export default router;
