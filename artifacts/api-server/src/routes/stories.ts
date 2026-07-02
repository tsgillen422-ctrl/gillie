import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  storiesTable,
  storyViewsTable,
  friendRequestsTable,
  blocksTable,
  mutesTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, gt, gte, sql, desc, asc, inArray, notInArray, or } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { createNotifications } from "../lib/notify";
import { isLocationLive } from "./users";

const router = Router();

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_TYPES = ["photo", "video", "text"];

// Authors whose friends-only stories this viewer may see. Mirrors the posts
// audience model: people the viewer follows where the author follows back
// (mutual) OR the author lets non-mutual followers see their posts.
async function getStoryFriendIds(userId: number): Promise<number[]> {
  const [iFollow, followMe] = await Promise.all([
    db.query.friendRequestsTable.findMany({
      where: and(eq(friendRequestsTable.followerId, userId), eq(friendRequestsTable.status, "accepted")),
    }),
    db.query.friendRequestsTable.findMany({
      where: and(eq(friendRequestsTable.followeeId, userId), eq(friendRequestsTable.status, "accepted")),
    }),
  ]);
  const followeeIds = [...new Set(iFollow.map((r) => r.followeeId).filter((id) => id !== userId))];
  if (!followeeIds.length) return [];
  const mutual = new Set(followMe.map((r) => r.followerId));
  const blockedIds = new Set(await getBlockedIds(userId));
  const authors = await db.query.usersTable.findMany({ where: inArray(usersTable.id, followeeIds) });
  return authors
    .filter((a) => !blockedIds.has(a.id) && (mutual.has(a.id) || a.followerSeePosts))
    .map((a) => a.id);
}

async function getBlockedIds(userId: number): Promise<number[]> {
  const blocks = await db.query.blocksTable.findMany({
    where: or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)),
  });
  return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
}

async function getMutedIds(userId: number): Promise<number[]> {
  const rows = await db.query.mutesTable.findMany({ where: eq(mutesTable.muterId, userId) });
  return rows.map((r) => r.mutedId);
}

// Everyone the viewer must never see stories from: blocked (both directions),
// muted, and hidden demo accounts.
async function getExcludedAuthorIds(userId: number): Promise<number[]> {
  const [blocked, muted, hidden] = await Promise.all([
    getBlockedIds(userId),
    getMutedIds(userId),
    getHiddenDemoUserIds(userId),
  ]);
  return [...new Set([...blocked, ...muted, ...hidden])];
}

// Single authorization check for one story: enforces blocked/muted/hidden-demo
// exclusions for ALL visibilities, plus the friends audience for friends-only
// stories. Use this everywhere a single story is accessed directly.
async function canViewerAccessStory(
  viewerId: number,
  story: typeof storiesTable.$inferSelect,
): Promise<boolean> {
  if (story.userId === viewerId) return true;
  const excluded = await getExcludedAuthorIds(viewerId);
  if (excluded.includes(story.userId)) return false;
  if (story.visibility === "friends") {
    const friendIds = await getStoryFriendIds(viewerId);
    if (!friendIds.includes(story.userId)) return false;
  }
  return true;
}

// Drizzle condition matching every active story the viewer is allowed to see.
async function visibleStoriesWhere(uid: number) {
  const friendIds = await getStoryFriendIds(uid);
  const excluded = await getExcludedAuthorIds(uid);
  const conds: any[] = [
    gt(storiesTable.expiresAt, sql`now()`),
    or(eq(storiesTable.visibility, "community"), inArray(storiesTable.userId, [uid, ...friendIds])),
  ];
  if (excluded.length) conds.push(notInArray(storiesTable.userId, excluded));
  return { where: and(...conds), friendIds };
}

function formatStory(s: typeof storiesTable.$inferSelect, viewedIds: Set<number>, viewCount?: number) {
  return {
    id: s.id,
    userId: s.userId,
    mediaType: s.mediaType,
    mediaUrl: s.mediaUrl,
    text: s.text,
    bgColor: s.bgColor,
    caption: s.caption,
    lat: s.lat,
    lng: s.lng,
    placeName: s.placeName,
    visibility: s.visibility,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    viewedByMe: viewedIds.has(s.id),
    viewCount: viewCount ?? null,
  };
}

function formatAuthor(u: typeof usersTable.$inferSelect, hasActiveStory: boolean) {
  return {
    id: u.id,
    displayName: u.displayName,
    username: u.username,
    avatarUrl: u.avatarUrl,
    // LIVE = actively checked in on the water AND posting stories right now.
    isLive: hasActiveStory && isLocationLive(u),
  };
}

async function getViewedIds(uid: number, storyIds: number[]): Promise<Set<number>> {
  if (!storyIds.length) return new Set();
  const rows = await db.query.storyViewsTable.findMany({
    where: and(eq(storyViewsTable.userId, uid), inArray(storyViewsTable.storyId, storyIds)),
  });
  return new Set(rows.map((r) => r.storyId));
}

// Group a list of stories by author, own group first, then unviewed groups
// (newest activity first), then fully-viewed groups.
async function groupStories(uid: number, stories: (typeof storiesTable.$inferSelect)[]) {
  const viewedIds = await getViewedIds(uid, stories.map((s) => s.id));
  const byUser = new Map<number, (typeof storiesTable.$inferSelect)[]>();
  for (const s of stories) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId)!.push(s);
  }
  const authors = byUser.size
    ? await db.query.usersTable.findMany({ where: inArray(usersTable.id, [...byUser.keys()]) })
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  // View counts only matter for the viewer's own stories.
  const ownStories = byUser.get(uid) ?? [];
  const viewCounts = new Map<number, number>();
  if (ownStories.length) {
    const rows = await db
      .select({ storyId: storyViewsTable.storyId, value: sql<number>`count(*)::int` })
      .from(storyViewsTable)
      .where(inArray(storyViewsTable.storyId, ownStories.map((s) => s.id)))
      .groupBy(storyViewsTable.storyId);
    for (const r of rows) viewCounts.set(r.storyId, r.value);
  }

  const groups = [...byUser.entries()]
    .map(([userId, list]) => {
      const author = authorMap.get(userId);
      if (!author) return null;
      const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        user: formatAuthor(author, true),
        stories: sorted.map((s) => formatStory(s, viewedIds, userId === uid ? (viewCounts.get(s.id) ?? 0) : undefined)),
        allViewed: sorted.every((s) => viewedIds.has(s.id)),
        _latest: sorted[sorted.length - 1].createdAt.getTime(),
        _own: userId === uid,
      };
    })
    .filter(Boolean) as any[];

  groups.sort((a, b) => {
    if (a._own !== b._own) return a._own ? -1 : 1;
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    return b._latest - a._latest;
  });
  return groups.map(({ _latest, _own, ...g }) => g);
}

router.get("/", async (req, res) => {
  const uid = currentUserId(req);
  const { where } = await visibleStoriesWhere(uid);
  const stories = await db.select().from(storiesTable).where(where).orderBy(asc(storiesTable.createdAt));
  res.json(await groupStories(uid, stories));
});

router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const { mediaType, mediaUrl, text, bgColor, caption, lat, lng, placeName, visibility } = req.body ?? {};

  if (!MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({ error: "mediaType must be photo, video, or text" });
  }
  if (mediaType === "text") {
    if (typeof text !== "string" || !text.trim() || text.length > 500) {
      return res.status(400).json({ error: "Text stories need text (max 500 characters)" });
    }
  } else {
    if (typeof mediaUrl !== "string" || !mediaUrl.trim() || mediaUrl.length > 1000) {
      return res.status(400).json({ error: "Photo and video stories need a mediaUrl" });
    }
  }
  if (caption != null && (typeof caption !== "string" || caption.length > 200)) {
    return res.status(400).json({ error: "Caption too long (max 200 characters)" });
  }
  if (bgColor != null && (typeof bgColor !== "string" || bgColor.length > 30)) {
    return res.status(400).json({ error: "Invalid background color" });
  }
  if (placeName != null && (typeof placeName !== "string" || placeName.length > 80)) {
    return res.status(400).json({ error: "Place name too long" });
  }
  const hasLat = lat != null;
  const hasLng = lng != null;
  if (hasLat !== hasLng) return res.status(400).json({ error: "lat and lng must be provided together" });
  if (hasLat && (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }
  const vis = visibility == null ? "friends" : visibility;
  if (!["friends", "community"].includes(vis)) {
    return res.status(400).json({ error: "visibility must be friends or community" });
  }

  const [story] = await db
    .insert(storiesTable)
    .values({
      userId: uid,
      mediaType,
      mediaUrl: mediaType === "text" ? null : mediaUrl.trim(),
      text: mediaType === "text" ? text.trim() : null,
      bgColor: mediaType === "text" ? (bgColor ?? null) : null,
      caption: caption?.trim() || null,
      lat: hasLat ? lat : null,
      lng: hasLat ? lng : null,
      placeName: placeName?.trim() || null,
      visibility: vis,
      expiresAt: new Date(Date.now() + STORY_TTL_MS),
    })
    .returning();

  // Let followers know a friend just posted — at most one notification per
  // author per 6 hours so back-to-back stories don't spam anyone.
  notifyFollowersOfStory(uid, story).catch(() => {});

  res.status(201).json(formatStory(story, new Set(), 0));
});

async function notifyFollowersOfStory(uid: number, story: typeof storiesTable.$inferSelect) {
  const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
  if (!author || author.isDemo) return;
  const followers = await db.query.friendRequestsTable.findMany({
    where: and(eq(friendRequestsTable.followeeId, uid), eq(friendRequestsTable.status, "accepted")),
  });
  if (!followers.length) return;
  const blocked = new Set(await getBlockedIds(uid));
  let candidateIds = [...new Set(followers.map((f) => f.followerId))].filter((id) => id !== uid && !blocked.has(id));
  if (!candidateIds.length) return;

  // Friends-only stories: only notify followers who can actually view them —
  // mutual follows, or any follower when the author allows non-mutuals to see
  // their posts. Mirrors getStoryFriendIds from each recipient's perspective.
  if (story.visibility === "friends" && !author.followerSeePosts) {
    const iFollow = await db.query.friendRequestsTable.findMany({
      where: and(eq(friendRequestsTable.followerId, uid), eq(friendRequestsTable.status, "accepted")),
    });
    const mutual = new Set(iFollow.map((r) => r.followeeId));
    candidateIds = candidateIds.filter((id) => mutual.has(id));
    if (!candidateIds.length) return;
  }

  // Never notify people who muted the author.
  const muters = await db.query.mutesTable.findMany({
    where: and(eq(mutesTable.mutedId, uid), inArray(mutesTable.muterId, candidateIds)),
  });
  const mutedBy = new Set(muters.map((m) => m.muterId));
  candidateIds = candidateIds.filter((id) => !mutedBy.has(id));
  if (!candidateIds.length) return;
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recent = await db.query.notificationsTable.findMany({
    where: and(
      inArray(notificationsTable.userId, candidateIds),
      eq(notificationsTable.type, "story"),
      eq(notificationsTable.relatedId, uid),
      gte(notificationsTable.createdAt, since),
    ),
  });
  const alreadyNotified = new Set(recent.map((n) => n.userId));
  const recipients = candidateIds.filter((id) => !alreadyNotified.has(id));
  if (!recipients.length) return;
  const where = story.placeName ? ` from ${story.placeName}` : "";
  await createNotifications(
    recipients.map((userId) => ({
      userId,
      type: "story",
      message: `${author.displayName} just posted a story${where} 🌊`,
      relatedId: uid,
    })),
  );
}

router.get("/places", async (req, res) => {
  const uid = currentUserId(req);
  const { where } = await visibleStoriesWhere(uid);
  const stories = await db
    .select()
    .from(storiesTable)
    .where(and(where, sql`${storiesTable.placeName} is not null`));
  const byPlace = new Map<string, { placeName: string; lat: number | null; lng: number | null; storyCount: number; latestAt: Date }>();
  for (const s of stories) {
    const key = s.placeName!.toLowerCase();
    const existing = byPlace.get(key);
    if (existing) {
      existing.storyCount += 1;
      if (s.createdAt > existing.latestAt) existing.latestAt = s.createdAt;
      if (existing.lat == null && s.lat != null) {
        existing.lat = s.lat;
        existing.lng = s.lng;
      }
    } else {
      byPlace.set(key, { placeName: s.placeName!, lat: s.lat, lng: s.lng, storyCount: 1, latestAt: s.createdAt });
    }
  }
  const places = [...byPlace.values()]
    .sort((a, b) => b.storyCount - a.storyCount)
    .map((p) => ({ ...p, latestAt: p.latestAt.toISOString() }));
  res.json(places);
});

router.get("/place/:placeName", async (req, res) => {
  const uid = currentUserId(req);
  const placeName = String(req.params.placeName ?? "").trim();
  if (!placeName) return res.status(400).json({ error: "placeName required" });
  const { where } = await visibleStoriesWhere(uid);
  const stories = await db
    .select()
    .from(storiesTable)
    .where(and(where, sql`lower(${storiesTable.placeName}) = ${placeName.toLowerCase()}`))
    .orderBy(asc(storiesTable.createdAt));
  res.json(await groupStories(uid, stories));
});

router.delete("/:storyId", async (req, res) => {
  const uid = currentUserId(req);
  const storyId = parseInt(req.params.storyId);
  if (isNaN(storyId)) return res.status(400).json({ error: "Invalid story id" });
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (story.userId !== uid) return res.status(403).json({ error: "You can only delete your own stories" });
  // No FK cascades in this schema — remove child view rows first.
  await db.delete(storyViewsTable).where(eq(storyViewsTable.storyId, storyId));
  await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
  res.status(204).end();
});

router.post("/:storyId/view", async (req, res) => {
  const uid = currentUserId(req);
  const storyId = parseInt(req.params.storyId);
  if (isNaN(storyId)) return res.status(400).json({ error: "Invalid story id" });
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
  if (!story || story.expiresAt <= new Date()) return res.status(404).json({ error: "Story not found" });
  if (story.userId !== uid) {
    if (!(await canViewerAccessStory(uid, story))) {
      return res.status(404).json({ error: "Story not found" });
    }
  }
  await db
    .insert(storyViewsTable)
    .values({ storyId, userId: uid })
    .onConflictDoNothing();
  res.status(204).end();
});

// A single user's active stories, for the profile Stories tab.
export async function getUserActiveStoriesForViewer(viewerId: number, targetId: number) {
  const excluded = await getExcludedAuthorIds(viewerId);
  if (targetId !== viewerId && excluded.includes(targetId)) return null;
  const conds: any[] = [eq(storiesTable.userId, targetId), gt(storiesTable.expiresAt, sql`now()`)];
  if (targetId !== viewerId) {
    const friendIds = await getStoryFriendIds(viewerId);
    if (!friendIds.includes(targetId)) conds.push(eq(storiesTable.visibility, "community"));
  }
  const stories = await db.select().from(storiesTable).where(and(...conds)).orderBy(asc(storiesTable.createdAt));
  const viewedIds = await getViewedIds(viewerId, stories.map((s) => s.id));
  const viewCounts = new Map<number, number>();
  if (targetId === viewerId && stories.length) {
    const rows = await db
      .select({ storyId: storyViewsTable.storyId, value: sql<number>`count(*)::int` })
      .from(storyViewsTable)
      .where(inArray(storyViewsTable.storyId, stories.map((s) => s.id)))
      .groupBy(storyViewsTable.storyId);
    for (const r of rows) viewCounts.set(r.storyId, r.value);
  }
  return stories.map((s) => formatStory(s, viewedIds, targetId === viewerId ? (viewCounts.get(s.id) ?? 0) : undefined));
}

// Author ids (among the given ids) that currently have at least one active story.
export async function getActiveStoryAuthorIds(userIds: number[]): Promise<Set<number>> {
  if (!userIds.length) return new Set();
  const rows = await db
    .select({ userId: storiesTable.userId })
    .from(storiesTable)
    .where(and(inArray(storiesTable.userId, userIds), gt(storiesTable.expiresAt, sql`now()`)))
    .groupBy(storiesTable.userId);
  return new Set(rows.map((r) => r.userId));
}

export default router;
