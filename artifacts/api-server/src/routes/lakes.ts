import { Router } from "express";
import { LAKES, isValidLakeId, lakeById } from "@workspace/lake-config";
import { db, usersTable, postsTable, storiesTable } from "@workspace/db";
import { and, desc, eq, gt, gte, inArray, notInArray, or, sql } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { getStoryFriendIds, getExcludedAuthorIds } from "./stories";

const router = Router();

// The static lake catalog. IDs are stable and referenced by users/posts/pins.
router.get("/", (_req, res) => {
  res.json(LAKES);
});

/**
 * Per-lake community stats for the Explore Lakes screen. One row per lake in
 * the catalog (even quiet ones) so every community is discoverable:
 *   - activeUsers: people active this week — checked in right now, or posted
 *     a post/story on that lake in the last 7 days.
 *   - storyCount: live (non-expired) stories.
 *   - liveEvents: events happening today or later.
 *   - recentPosts: posts in the last 7 days.
 *   - trendingScore: weighted blend of the above, used to rank lakes.
 *
 * Policy: these are anonymous lake-level aggregates (no identities, no
 * content), so they intentionally count all activity regardless of audience —
 * only hidden demo accounts are excluded. Viewer-scoped previews live in
 * GET /lakes/:lakeId/detail instead.
 */
router.get("/overview", async (req, res) => {
  const uid = currentUserId(req);
  const hidden = await getHiddenDemoUserIds(uid);
  const notHiddenPosts = hidden.length ? notInArray(postsTable.userId, hidden) : undefined;
  const notHiddenStories = hidden.length ? notInArray(storiesTable.userId, hidden) : undefined;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Live (non-expired) stories: count + distinct authors per lake.
  const activeStories = await db
    .select({ lakeId: storiesTable.lakeId, userId: storiesTable.userId })
    .from(storiesTable)
    .where(and(gt(storiesTable.expiresAt, sql`now()`), notHiddenStories));

  // Posts this week: distinct authors per lake (recency = community activity).
  const recentPosts = await db
    .select({ lakeId: postsTable.lakeId, userId: postsTable.userId })
    .from(postsTable)
    .where(and(gte(postsTable.createdAt, weekAgo), notHiddenPosts));

  // Events happening today or in the future.
  const liveEvents = await db
    .select({ lakeId: postsTable.lakeId })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.postType, "event"),
        gte(postsTable.eventDate, todayStart),
        notHiddenPosts,
      ),
    );

  // Users checked in right now (active, non-expired check-in). currentLakeId
  // predates multi-lake for old rows, so null means the default lake (1).
  const checkedIn = await db
    .select({ id: usersTable.id, currentLakeId: usersTable.currentLakeId })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.shareLocation, true),
        gt(usersTable.locationSharingExpiresAt, now),
        hidden.length ? notInArray(usersTable.id, hidden) : undefined,
      ),
    );

  type Agg = { activeUserIds: Set<number>; storyCount: number; liveEvents: number; recentPosts: number };
  const byLake = new Map<number, Agg>(
    LAKES.map((l) => [l.id, { activeUserIds: new Set<number>(), storyCount: 0, liveEvents: 0, recentPosts: 0 }]),
  );
  const aggFor = (lakeId: number | null | undefined) => byLake.get(lakeId ?? 1);

  for (const s of activeStories) {
    const agg = aggFor(s.lakeId);
    if (!agg) continue;
    agg.storyCount += 1;
    agg.activeUserIds.add(s.userId);
  }
  for (const p of recentPosts) {
    const agg = aggFor(p.lakeId);
    if (!agg) continue;
    agg.recentPosts += 1;
    agg.activeUserIds.add(p.userId);
  }
  for (const e of liveEvents) {
    const agg = aggFor(e.lakeId);
    if (agg) agg.liveEvents += 1;
  }
  for (const u of checkedIn) {
    aggFor(u.currentLakeId)?.activeUserIds.add(u.id);
  }

  const overview = LAKES.map((lake) => {
    const agg = byLake.get(lake.id)!;
    const activeUsers = agg.activeUserIds.size;
    // Blend favors people over raw content so busy-but-small lakes rank fairly.
    const trendingScore =
      activeUsers * 5 + agg.storyCount * 3 + agg.liveEvents * 4 + agg.recentPosts;
    return {
      id: lake.id,
      name: lake.name,
      slug: lake.slug,
      region: lake.region,
      activeUsers,
      storyCount: agg.storyCount,
      liveEvents: agg.liveEvents,
      recentPosts: agg.recentPosts,
      trendingScore,
    };
  }).sort((a, b) => b.trendingScore - a.trendingScore || a.name.localeCompare(b.name));

  res.json(overview);
});

/**
 * Rich preview of a single lake community for the Lake Overview page. All
 * content is viewer-scoped: friends-only posts/stories only appear when the
 * viewer is allowed to see them, blocked/muted/hidden-demo authors are
 * excluded everywhere, and mature-flagged media never appears in previews.
 */
router.get("/:lakeId/detail", async (req, res) => {
  const uid = currentUserId(req);
  const rawLakeId = Number(req.params.lakeId);
  if (!isValidLakeId(rawLakeId)) {
    return res.status(404).json({ message: "Lake not found" });
  }
  const lake = lakeById(rawLakeId);

  const [friendIds, excluded] = await Promise.all([
    getStoryFriendIds(uid),
    getExcludedAuthorIds(uid),
  ]);
  const notExcludedPosts = excluded.length ? notInArray(postsTable.userId, excluded) : undefined;
  const notExcludedStories = excluded.length ? notInArray(storiesTable.userId, excluded) : undefined;
  const postAudience = or(
    eq(postsTable.visibility, "community"),
    inArray(postsTable.userId, [uid, ...friendIds]),
  );
  const storyAudience = or(
    eq(storiesTable.visibility, "community"),
    inArray(storiesTable.userId, [uid, ...friendIds]),
  );

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [photoPosts, activeStories, weekPosts, eventPosts, checkedIn] = await Promise.all([
    // Recent photo posts for the carousel (never mature-flagged media).
    db
      .select({ id: postsTable.id, imageUrl: postsTable.imageUrl, photos: postsTable.photos })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.lakeId, lake.id),
          postAudience,
          eq(postsTable.isMature, false),
          or(sql`${postsTable.imageUrl} is not null`, sql`cardinality(${postsTable.photos}) > 0`),
          notExcludedPosts,
        ),
      )
      .orderBy(desc(postsTable.createdAt))
      .limit(12),
    // Live stories the viewer may see: today's stories + trending places.
    db
      .select({
        id: storiesTable.id,
        userId: storiesTable.userId,
        mediaType: storiesTable.mediaType,
        mediaUrl: storiesTable.mediaUrl,
        placeName: storiesTable.placeName,
        visibility: storiesTable.visibility,
      })
      .from(storiesTable)
      .where(
        and(
          eq(storiesTable.lakeId, lake.id),
          gt(storiesTable.expiresAt, sql`now()`),
          storyAudience,
          notExcludedStories,
        ),
      )
      .orderBy(desc(storiesTable.createdAt)),
    // Post authors this week (for the active-user count). Audience-filtered so
    // friends-only posts the viewer can't see don't leak activity presence.
    db
      .select({ userId: postsTable.userId })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.lakeId, lake.id),
          gte(postsTable.createdAt, weekAgo),
          postAudience,
          notExcludedPosts,
        ),
      ),
    // Upcoming events the viewer may see.
    db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        eventDate: postsTable.eventDate,
        imageUrl: postsTable.imageUrl,
        isMature: postsTable.isMature,
      })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.lakeId, lake.id),
          eq(postsTable.postType, "event"),
          gte(postsTable.eventDate, todayStart),
          postAudience,
          notExcludedPosts,
        ),
      )
      .orderBy(postsTable.eventDate)
      .limit(5),
    // Users with an active (non-expired) check-in on this lake.
    db
      .select({ id: usersTable.id, currentLakeId: usersTable.currentLakeId })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.shareLocation, true),
          gt(usersTable.locationSharingExpiresAt, now),
          excluded.length ? notInArray(usersTable.id, excluded) : undefined,
        ),
      ),
  ]);

  // currentLakeId predates multi-lake; null means the default lake (1).
  const checkedInHere = checkedIn.filter((u) => (u.currentLakeId ?? 1) === lake.id);

  // Active users = checked in here now, or posted a post/story here this week.
  const activeUserIds = new Set<number>();
  for (const u of checkedInHere) activeUserIds.add(u.id);
  for (const p of weekPosts) activeUserIds.add(p.userId);
  for (const s of activeStories) activeUserIds.add(s.userId);

  // Photo carousel: post photos first, then live community story photos.
  const photoUrls: string[] = [];
  for (const p of photoPosts) {
    if (p.imageUrl) photoUrls.push(p.imageUrl);
    for (const url of p.photos ?? []) photoUrls.push(url);
  }
  for (const s of activeStories) {
    if (s.mediaType === "photo" && s.mediaUrl && s.visibility === "community") {
      photoUrls.push(s.mediaUrl);
    }
  }
  const recentPhotos = [...new Set(photoUrls)].slice(0, 10);

  // Today's stories: count + a few author avatars for the preview row.
  const storyAuthorIds = [...new Set(activeStories.map((s) => s.userId))];
  const storyAuthors = storyAuthorIds.length
    ? await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, storyAuthorIds))
        .limit(8)
    : [];

  // Trending places: most-storied named places right now.
  const placeCounts = new Map<string, number>();
  for (const s of activeStories) {
    if (s.placeName) placeCounts.set(s.placeName, (placeCounts.get(s.placeName) ?? 0) + 1);
  }
  const trendingPlaces = [...placeCounts.entries()]
    .map(([placeName, storyCount]) => ({ placeName, storyCount }))
    .sort((a, b) => b.storyCount - a.storyCount)
    .slice(0, 5);

  // Friends (viewer's accepted, non-blocked follows) checked in on this lake.
  // Minimal DTO only — never coordinates (privacy).
  const friendIdSet = new Set(friendIds);
  const friendsHereIds = checkedInHere.map((u) => u.id).filter((id) => friendIdSet.has(id) && id !== uid);
  const friendsHere = friendsHereIds.length
    ? await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, friendsHereIds))
        .limit(12)
    : [];

  return res.json({
    id: lake.id,
    name: lake.name,
    slug: lake.slug,
    region: lake.region,
    lat: lake.lat,
    lng: lake.lng,
    activeUsers: activeUserIds.size,
    recentPhotos,
    stories: { count: activeStories.length, authors: storyAuthors },
    upcomingEvents: eventPosts.map((e) => ({
      id: e.id,
      title: e.title,
      eventDate: e.eventDate ? e.eventDate.toISOString() : null,
      imageUrl: e.isMature ? null : e.imageUrl,
    })),
    trendingPlaces,
    friendsHere,
  });
});

export default router;
