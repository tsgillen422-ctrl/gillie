import { Router } from "express";
import { LAKES } from "@workspace/lake-config";
import { db, usersTable, postsTable, storiesTable } from "@workspace/db";
import { and, eq, gt, gte, notInArray, sql } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";

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

export default router;
