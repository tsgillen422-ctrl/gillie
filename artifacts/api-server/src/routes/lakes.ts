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
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [photoPosts, heroCandidates, activeStories, weekPosts, eventPosts, checkedIn] = await Promise.all([
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
    // Hero candidates: real community photos from the last 48h, best-liked
    // first. Only genuine user content — never the generated lake artwork.
    db
      .select({
        id: postsTable.id,
        userId: postsTable.userId,
        imageUrl: postsTable.imageUrl,
        photos: postsTable.photos,
        likeCount: postsTable.likeCount,
      })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.lakeId, lake.id),
          gte(postsTable.createdAt, twoDaysAgo),
          postAudience,
          eq(postsTable.isMature, false),
          or(sql`${postsTable.imageUrl} is not null`, sql`cardinality(${postsTable.photos}) > 0`),
          notExcludedPosts,
        ),
      )
      .orderBy(desc(postsTable.likeCount), desc(postsTable.createdAt))
      .limit(1),
    // Live stories the viewer may see: today's stories + trending places.
    db
      .select({
        id: storiesTable.id,
        userId: storiesTable.userId,
        mediaType: storiesTable.mediaType,
        mediaUrl: storiesTable.mediaUrl,
        placeName: storiesTable.placeName,
        visibility: storiesTable.visibility,
        lat: storiesTable.lat,
        lng: storiesTable.lng,
        createdAt: storiesTable.createdAt,
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

  // Featured hero: the best-liked real community photo from the last 48h
  // (falls back to the freshest live community story photo). Never generated
  // or stock imagery — the client only uses its static artwork when this is
  // null because the lake has no recent community photos at all.
  let heroPhoto: {
    url: string;
    likeCount: number;
    authorName: string | null;
    authorAvatarUrl: string | null;
  } | null = null;
  const heroPost = heroCandidates[0];
  const heroUrl = heroPost ? (heroPost.imageUrl ?? heroPost.photos?.[0] ?? null) : null;
  if (heroPost && heroUrl) {
    const [author] = await db
      .select({ displayName: usersTable.displayName, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, heroPost.userId))
      .limit(1);
    heroPhoto = {
      url: heroUrl,
      likeCount: heroPost.likeCount,
      authorName: author ? author.displayName || author.username : null,
      authorAvatarUrl: author?.avatarUrl ?? null,
    };
  } else {
    const heroStory = activeStories.find(
      (s) => s.mediaType === "photo" && s.mediaUrl && s.visibility === "community",
    );
    if (heroStory?.mediaUrl) {
      const [author] = await db
        .select({ displayName: usersTable.displayName, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, heroStory.userId))
        .limit(1);
      heroPhoto = {
        url: heroStory.mediaUrl,
        likeCount: 0,
        authorName: author ? author.displayName || author.username : null,
        authorAvatarUrl: author?.avatarUrl ?? null,
      };
    }
  }

  // Trending places: most-storied named places right now, with a photo thumb
  // and how many people are posting there. activeStories is already
  // viewer-scoped, so thumbnails never leak anything the viewer can't see.
  type PlaceAgg = {
    placeName: string;
    storyCount: number;
    authorIds: Set<number>;
    thumbnailUrl: string | null;
    lat: number | null;
    lng: number | null;
  };
  const placeAggs = new Map<string, PlaceAgg>();
  for (const s of activeStories) {
    if (!s.placeName) continue;
    const key = s.placeName.toLowerCase();
    let agg = placeAggs.get(key);
    if (!agg) {
      agg = { placeName: s.placeName, storyCount: 0, authorIds: new Set(), thumbnailUrl: null, lat: null, lng: null };
      placeAggs.set(key, agg);
    }
    agg.storyCount += 1;
    agg.authorIds.add(s.userId);
    // Stories arrive newest-first, so the first photo becomes the thumbnail.
    if (!agg.thumbnailUrl && s.mediaType === "photo" && s.mediaUrl) agg.thumbnailUrl = s.mediaUrl;
    if (agg.lat == null && s.lat != null) {
      agg.lat = s.lat;
      agg.lng = s.lng;
    }
  }
  const trendingPlaces = [...placeAggs.values()]
    .map((p) => ({
      placeName: p.placeName,
      storyCount: p.storyCount,
      activeUsers: p.authorIds.size,
      thumbnailUrl: p.thumbnailUrl,
      lat: p.lat,
      lng: p.lng,
    }))
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
    heroPhoto,
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

/** Rough distance in km between two coordinates (haversine). */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Viewer-scoped detail for one named place on a lake: its live stories'
 * photos, who's posting there, upcoming events pinned nearby, and where it
 * sits on the map. 404s when the lake is invalid or the place has no live
 * stories the viewer may see (places only exist through stories).
 */
router.get("/:lakeId/places/:placeName", async (req, res) => {
  const uid = currentUserId(req);
  const rawLakeId = Number(req.params.lakeId);
  if (!isValidLakeId(rawLakeId)) {
    return res.status(404).json({ message: "Lake not found" });
  }
  const lake = lakeById(rawLakeId);
  const placeName = String(req.params.placeName ?? "").trim();
  if (!placeName) return res.status(404).json({ message: "Place not found" });

  const [friendIds, excluded] = await Promise.all([
    getStoryFriendIds(uid),
    getExcludedAuthorIds(uid),
  ]);
  const notExcludedStories = excluded.length ? notInArray(storiesTable.userId, excluded) : undefined;
  const notExcludedPosts = excluded.length ? notInArray(postsTable.userId, excluded) : undefined;
  const storyAudience = or(
    eq(storiesTable.visibility, "community"),
    inArray(storiesTable.userId, [uid, ...friendIds]),
  );
  const postAudience = or(
    eq(postsTable.visibility, "community"),
    inArray(postsTable.userId, [uid, ...friendIds]),
  );

  const stories = await db
    .select({
      id: storiesTable.id,
      userId: storiesTable.userId,
      mediaType: storiesTable.mediaType,
      mediaUrl: storiesTable.mediaUrl,
      placeName: storiesTable.placeName,
      lat: storiesTable.lat,
      lng: storiesTable.lng,
      createdAt: storiesTable.createdAt,
    })
    .from(storiesTable)
    .where(
      and(
        eq(storiesTable.lakeId, lake.id),
        gt(storiesTable.expiresAt, sql`now()`),
        sql`lower(${storiesTable.placeName}) = ${placeName.toLowerCase()}`,
        storyAudience,
        notExcludedStories,
      ),
    )
    .orderBy(desc(storiesTable.createdAt));

  if (!stories.length) {
    return res.status(404).json({ message: "Place not found" });
  }

  // Canonical casing from the stories themselves; coords from the first
  // story that has them.
  const canonicalName = stories[0].placeName ?? placeName;
  const located = stories.find((s) => s.lat != null && s.lng != null);
  const lat = located?.lat ?? null;
  const lng = located?.lng ?? null;

  const authorIds = [...new Set(stories.map((s) => s.userId))];
  const authors = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, authorIds))
    .limit(12);
  const authorById = new Map(authors.map((a) => [a.id, a]));

  // Photo wall: live story photos at this place (viewer-scoped already).
  const photos = stories
    .filter((s) => s.mediaType === "photo" && s.mediaUrl)
    .slice(0, 24)
    .map((s) => ({
      storyId: s.id,
      url: s.mediaUrl!,
      authorId: s.userId,
      authorName: authorById.get(s.userId)?.displayName ?? null,
      createdAt: s.createdAt.toISOString(),
    }));

  // Upcoming events pinned near this place (within ~3km), viewer-scoped.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let nearbyEvents: { id: number; title: string | null; eventDate: string | null; imageUrl: string | null }[] = [];
  if (lat != null && lng != null) {
    const events = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        eventDate: postsTable.eventDate,
        imageUrl: postsTable.imageUrl,
        isMature: postsTable.isMature,
        pinLat: postsTable.pinLat,
        pinLng: postsTable.pinLng,
      })
      .from(postsTable)
      .where(
        and(
          eq(postsTable.lakeId, lake.id),
          eq(postsTable.postType, "event"),
          gte(postsTable.eventDate, todayStart),
          sql`${postsTable.pinLat} is not null`,
          postAudience,
          notExcludedPosts,
        ),
      )
      .orderBy(postsTable.eventDate);
    nearbyEvents = events
      .filter((e) => e.pinLat != null && e.pinLng != null && distanceKm(lat, lng, e.pinLat, e.pinLng) <= 3)
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title,
        eventDate: e.eventDate ? e.eventDate.toISOString() : null,
        imageUrl: e.isMature ? null : e.imageUrl,
      }));
  }

  return res.json({
    lakeId: lake.id,
    lakeName: lake.name,
    placeName: canonicalName,
    lat,
    lng,
    storyCount: stories.length,
    activeUsers: authorIds.length,
    authors,
    photos,
    nearbyEvents,
  });
});

export default router;
