import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  storiesTable,
  storyViewsTable,
  storyReactionsTable,
  storyPollVotesTable,
  friendRequestsTable,
  blocksTable,
  mutesTable,
  notificationsTable,
  boatsTable,
  type StorySticker,
} from "@workspace/db";
import { eq, and, gt, gte, sql, desc, asc, inArray, notInArray, or } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { createNotifications } from "../lib/notify";
import { isLocationLive } from "./users";
import { isValidLakeId, DEFAULT_LAKE_ID } from "@workspace/lake-config";

const router = Router();

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_TYPES = ["photo", "video", "text"];
export const REACTION_EMOJIS = ["❤️", "🔥", "🚤", "🌊", "😂", "👏", "😍", "😮", "👍"];
const STICKER_TYPES = ["location", "weather", "boat", "emoji", "giphy", "text"];
// Only allow giphy CDN media so sticker URLs can't point anywhere else.
const GIPHY_URL_RE = /^https:\/\/(media\d*|i)\.giphy\.com\//;
// CSS filter strings are rendered into style attributes on the client, so only
// allow the characters real filter functions need.
const FILTER_CSS_RE = /^[a-z0-9().,%\s-]*$/i;

export function validateStickers(input: unknown): StorySticker[] | { error: string } {
  if (!Array.isArray(input)) return { error: "stickers must be an array" };
  if (input.length > 12) return { error: "Too many stickers (max 12)" };
  if (JSON.stringify(input).length > 8000) return { error: "Stickers payload too large" };
  const out: StorySticker[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Invalid sticker" };
    const { type, x, y, scale, rotation, data } = raw as Record<string, unknown>;
    if (typeof type !== "string" || !STICKER_TYPES.includes(type)) return { error: "Invalid sticker type" };
    if (typeof x !== "number" || typeof y !== "number" || !isFinite(x) || !isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
      return { error: "Sticker position must be between 0 and 1" };
    }
    let cleanScale: number | null = null;
    if (scale != null) {
      if (typeof scale !== "number" || !isFinite(scale) || scale < 0.2 || scale > 5) return { error: "Invalid sticker scale" };
      cleanScale = scale;
    }
    let cleanRotation: number | null = null;
    if (rotation != null) {
      if (typeof rotation !== "number" || !isFinite(rotation) || rotation < -360 || rotation > 360) return { error: "Invalid sticker rotation" };
      cleanRotation = rotation;
    }
    const cleanData: Record<string, string | number | null> = {};
    if (data != null) {
      if (typeof data !== "object" || Array.isArray(data)) return { error: "Invalid sticker data" };
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length > 10) return { error: "Sticker data too large" };
      for (const [k, v] of entries) {
        if (k.length > 40) return { error: "Sticker data key too long" };
        if (v === null || typeof v === "number") cleanData[k] = v as number | null;
        else if (typeof v === "string") {
          if (v.length > 300) return { error: "Sticker data value too long" };
          cleanData[k] = v;
        } else return { error: "Sticker data values must be strings or numbers" };
      }
    }
    if (type === "giphy") {
      const url = cleanData.url;
      if (typeof url !== "string" || !GIPHY_URL_RE.test(url)) return { error: "Invalid sticker image" };
    }
    if (type === "text") {
      const textVal = cleanData.text;
      if (typeof textVal !== "string" || !textVal.trim() || textVal.length > 200) return { error: "Invalid text sticker" };
    }
    out.push({
      type: type as StorySticker["type"],
      x,
      y,
      ...(cleanScale != null ? { scale: cleanScale } : {}),
      ...(cleanRotation != null ? { rotation: cleanRotation } : {}),
      data: cleanData,
    });
  }
  return out;
}

// Authors whose friends-only stories this viewer may see. Mirrors the posts
// audience model: people the viewer follows where the author follows back
// (mutual) OR the author lets non-mutual followers see their posts.
export async function getStoryFriendIds(userId: number): Promise<number[]> {
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
export async function getExcludedAuthorIds(userId: number): Promise<number[]> {
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

type StoryExtras = {
  boatNames: Map<number, string>;
  reactionCounts: Map<number, Record<string, number>>;
  myReactions: Map<number, string>;
  pollVotes: Map<number, number[]>;
  myVotes: Map<number, number>;
};

// Per-story derived data (boat tag names, reaction tallies, poll results) for
// a batch of stories, from the given viewer's perspective.
async function getStoryExtras(uid: number, stories: (typeof storiesTable.$inferSelect)[]): Promise<StoryExtras> {
  const extras: StoryExtras = {
    boatNames: new Map(),
    reactionCounts: new Map(),
    myReactions: new Map(),
    pollVotes: new Map(),
    myVotes: new Map(),
  };
  if (!stories.length) return extras;
  const storyIds = stories.map((s) => s.id);
  const boatIds = [...new Set(stories.map((s) => s.boatId).filter((id): id is number => id != null))];
  const pollStoryIds = stories.filter((s) => s.pollOptions?.length).map((s) => s.id);

  const [boats, reactions, votes] = await Promise.all([
    boatIds.length ? db.query.boatsTable.findMany({ where: inArray(boatsTable.id, boatIds) }) : [],
    db.query.storyReactionsTable.findMany({ where: inArray(storyReactionsTable.storyId, storyIds) }),
    pollStoryIds.length
      ? db.query.storyPollVotesTable.findMany({ where: inArray(storyPollVotesTable.storyId, pollStoryIds) })
      : [],
  ]);

  const boatNameById = new Map(boats.map((b) => [b.id, b.name]));
  for (const s of stories) {
    if (s.boatId != null && boatNameById.has(s.boatId)) extras.boatNames.set(s.id, boatNameById.get(s.boatId)!);
  }
  for (const r of reactions) {
    const counts = extras.reactionCounts.get(r.storyId) ?? {};
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    extras.reactionCounts.set(r.storyId, counts);
    if (r.userId === uid) extras.myReactions.set(r.storyId, r.emoji);
  }
  const storyById = new Map(stories.map((s) => [s.id, s]));
  for (const v of votes) {
    const story = storyById.get(v.storyId);
    const optionCount = story?.pollOptions?.length ?? 0;
    if (v.optionIndex < 0 || v.optionIndex >= optionCount) continue;
    const tally = extras.pollVotes.get(v.storyId) ?? new Array(optionCount).fill(0);
    tally[v.optionIndex] += 1;
    extras.pollVotes.set(v.storyId, tally);
    if (v.userId === uid) extras.myVotes.set(v.storyId, v.optionIndex);
  }
  return extras;
}

function formatStory(
  s: typeof storiesTable.$inferSelect,
  viewedIds: Set<number>,
  viewCount?: number,
  extras?: StoryExtras,
  uid?: number,
) {
  const hasPoll = !!s.pollOptions?.length;
  const myVote = extras?.myVotes.get(s.id) ?? null;
  const isOwn = uid != null && s.userId === uid;
  // Poll tallies are only revealed to the author or after the viewer votes.
  const showResults = hasPoll && (isOwn || myVote != null);
  return {
    id: s.id,
    userId: s.userId,
    lakeId: s.lakeId,
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
    boatName: extras?.boatNames.get(s.id) ?? null,
    filterName: s.filterName,
    filterCss: s.filterCss,
    stickers: s.stickers ?? null,
    pollQuestion: hasPoll ? s.pollQuestion : null,
    pollOptions: hasPoll ? s.pollOptions : null,
    pollVotes: showResults
      ? (extras?.pollVotes.get(s.id) ?? new Array(s.pollOptions!.length).fill(0))
      : null,
    myPollVote: myVote,
    reactionCounts: extras?.reactionCounts.get(s.id) ?? null,
    myReaction: extras?.myReactions.get(s.id) ?? null,
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
  const [viewedIds, extras] = await Promise.all([
    getViewedIds(uid, stories.map((s) => s.id)),
    getStoryExtras(uid, stories),
  ]);
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
        stories: sorted.map((s) => formatStory(s, viewedIds, userId === uid ? (viewCounts.get(s.id) ?? 0) : undefined, extras, uid)),
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
  const rawLakeId = req.query.lakeId != null ? Number(req.query.lakeId) : undefined;
  const { where } = await visibleStoriesWhere(uid);
  const fullWhere =
    rawLakeId !== undefined
      ? and(where, eq(storiesTable.lakeId, isValidLakeId(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID))
      : where;
  const stories = await db.select().from(storiesTable).where(fullWhere).orderBy(asc(storiesTable.createdAt));
  res.json(await groupStories(uid, stories));
});

router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const {
    mediaType, mediaUrl, text, bgColor, caption, lat, lng, placeName, visibility,
    boatId, filterName, filterCss, stickers, pollQuestion, pollOptions, lakeId,
  } = req.body ?? {};

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

  // "Posted from" boat tag — must be one of the author's own boats.
  if (boatId != null) {
    if (typeof boatId !== "number" || !Number.isInteger(boatId)) {
      return res.status(400).json({ error: "Invalid boatId" });
    }
    const boat = await db.query.boatsTable.findFirst({ where: eq(boatsTable.id, boatId) });
    if (!boat || boat.userId !== uid) return res.status(400).json({ error: "That's not one of your boats" });
  }

  if (filterName != null && (typeof filterName !== "string" || filterName.length > 40)) {
    return res.status(400).json({ error: "Invalid filter name" });
  }
  if (filterCss != null && (typeof filterCss !== "string" || filterCss.length > 250 || !FILTER_CSS_RE.test(filterCss))) {
    return res.status(400).json({ error: "Invalid filter" });
  }

  let cleanStickers: StorySticker[] | null = null;
  if (stickers != null) {
    const result = validateStickers(stickers);
    if (!Array.isArray(result)) return res.status(400).json({ error: result.error });
    cleanStickers = result.length ? result : null;
  }

  const hasPollQ = pollQuestion != null && String(pollQuestion).trim() !== "";
  const hasPollOpts = Array.isArray(pollOptions) && pollOptions.length > 0;
  if (hasPollQ !== hasPollOpts) {
    return res.status(400).json({ error: "Polls need both a question and options" });
  }
  let cleanPollQuestion: string | null = null;
  let cleanPollOptions: string[] | null = null;
  if (hasPollQ) {
    if (typeof pollQuestion !== "string" || pollQuestion.trim().length > 150) {
      return res.status(400).json({ error: "Poll question too long (max 150 characters)" });
    }
    if (!Array.isArray(pollOptions) || pollOptions.length < 2 || pollOptions.length > 4) {
      return res.status(400).json({ error: "Polls need 2-4 options" });
    }
    for (const opt of pollOptions) {
      if (typeof opt !== "string" || !opt.trim() || opt.length > 80) {
        return res.status(400).json({ error: "Poll options must be 1-80 characters" });
      }
    }
    cleanPollQuestion = pollQuestion.trim();
    cleanPollOptions = pollOptions.map((o: string) => o.trim());
  }

  const [story] = await db
    .insert(storiesTable)
    .values({
      userId: uid,
      lakeId: isValidLakeId(lakeId) ? lakeId : DEFAULT_LAKE_ID,
      mediaType,
      mediaUrl: mediaType === "text" ? null : mediaUrl.trim(),
      text: mediaType === "text" ? text.trim() : null,
      bgColor: mediaType === "text" ? (bgColor ?? null) : null,
      caption: caption?.trim() || null,
      lat: hasLat ? lat : null,
      lng: hasLat ? lng : null,
      placeName: placeName?.trim() || null,
      visibility: vis,
      boatId: boatId ?? null,
      filterName: filterName?.trim() || null,
      filterCss: mediaType === "text" ? null : (filterCss?.trim() || null),
      stickers: cleanStickers,
      pollQuestion: cleanPollQuestion,
      pollOptions: cleanPollOptions,
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
    .where(and(where, sql`${storiesTable.placeName} is not null`))
    .orderBy(desc(storiesTable.createdAt));

  // Author info + my viewed state for every story so the map can render
  // thumbnail markers and the tap-preview carousel without extra requests.
  const authorIds = [...new Set(stories.map((s) => s.userId))];
  const authors = authorIds.length
    ? await db.query.usersTable.findMany({ where: inArray(usersTable.id, authorIds) })
    : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const viewedIds = await getViewedIds(uid, stories.map((s) => s.id));

  type PlaceAgg = {
    placeName: string;
    lat: number | null;
    lng: number | null;
    storyCount: number;
    latestAt: Date;
    thumbUrl: string | null;
    thumbType: string | null;
    allViewed: boolean;
    previews: any[];
  };
  const byPlace = new Map<string, PlaceAgg>();
  for (const s of stories) {
    const key = s.placeName!.toLowerCase();
    let agg = byPlace.get(key);
    if (!agg) {
      agg = {
        placeName: s.placeName!,
        lat: s.lat,
        lng: s.lng,
        storyCount: 0,
        latestAt: s.createdAt,
        thumbUrl: null,
        thumbType: null,
        allViewed: true,
        previews: [],
      };
      byPlace.set(key, agg);
    }
    agg.storyCount += 1;
    if (s.createdAt > agg.latestAt) agg.latestAt = s.createdAt;
    if (agg.lat == null && s.lat != null) {
      agg.lat = s.lat;
      agg.lng = s.lng;
    }
    const viewed = s.userId === uid || viewedIds.has(s.id);
    if (!viewed) agg.allViewed = false;
    // Stories arrive newest-first, so the first photo/video becomes the thumb.
    if (!agg.thumbUrl && s.mediaUrl && (s.mediaType === "photo" || s.mediaType === "video")) {
      agg.thumbUrl = s.mediaUrl;
      agg.thumbType = s.mediaType;
    }
    const author = authorById.get(s.userId);
    agg.previews.push({
      storyId: s.id,
      userId: s.userId,
      displayName: author?.displayName ?? author?.username ?? "Someone",
      username: author?.username ?? "",
      avatarUrl: author?.avatarUrl ?? null,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      caption: s.caption,
      text: s.text,
      bgColor: s.bgColor,
      createdAt: s.createdAt.toISOString(),
      viewedByMe: viewed,
    });
  }
  const places = [...byPlace.values()]
    .sort((a, b) => b.storyCount - a.storyCount)
    // Cap the preview carousel payload; the fullscreen viewer fetches the
    // complete set for a place separately.
    .map((p) => ({ ...p, latestAt: p.latestAt.toISOString(), previews: p.previews.slice(0, 10) }));
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
  // No FK cascades in this schema — remove child rows first.
  await db.delete(storyViewsTable).where(eq(storyViewsTable.storyId, storyId));
  await db.delete(storyReactionsTable).where(eq(storyReactionsTable.storyId, storyId));
  await db.delete(storyPollVotesTable).where(eq(storyPollVotesTable.storyId, storyId));
  await db.delete(storiesTable).where(eq(storiesTable.id, storyId));
  res.status(204).end();
});

// Load a story and enforce viewer access; shared by react + vote endpoints.
type LoadStoryResult =
  | { ok: true; story: typeof storiesTable.$inferSelect }
  | { ok: false; status: number; message: string };

async function loadAccessibleStory(uid: number, rawId: string): Promise<LoadStoryResult> {
  const storyId = parseInt(rawId);
  if (isNaN(storyId)) return { ok: false, status: 400, message: "Invalid story id" };
  const story = await db.query.storiesTable.findFirst({ where: eq(storiesTable.id, storyId) });
  if (!story || story.expiresAt <= new Date()) return { ok: false, status: 404, message: "Story not found" };
  if (!(await canViewerAccessStory(uid, story))) {
    return { ok: false, status: 404, message: "Story not found" };
  }
  return { ok: true, story };
}

router.post("/:storyId/react", async (req, res) => {
  const uid = currentUserId(req);
  const { emoji } = req.body ?? {};
  if (typeof emoji !== "string" || !REACTION_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  const result = await loadAccessibleStory(uid, req.params.storyId);
  if (!result.ok) return res.status(result.status).json({ error: result.message });
  const { story } = result;

  const existing = await db.query.storyReactionsTable.findFirst({
    where: and(eq(storyReactionsTable.storyId, story.id), eq(storyReactionsTable.userId, uid)),
  });
  await db
    .insert(storyReactionsTable)
    .values({ storyId: story.id, userId: uid, emoji })
    .onConflictDoUpdate({
      target: [storyReactionsTable.storyId, storyReactionsTable.userId],
      set: { emoji, createdAt: new Date() },
    });

  // Tell the author about the first reaction from this person (not swaps, not
  // self-reactions).
  if (!existing && story.userId !== uid) {
    const reactor = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
    if (reactor) {
      createNotifications([
        {
          userId: story.userId,
          type: "story_reaction",
          message: `${reactor.displayName} reacted ${emoji} to your story`,
          relatedId: uid,
        },
      ]).catch(() => {});
    }
  }
  res.status(204).end();
});

router.delete("/:storyId/react", async (req, res) => {
  const uid = currentUserId(req);
  const storyId = parseInt(req.params.storyId);
  if (isNaN(storyId)) return res.status(400).json({ error: "Invalid story id" });
  await db
    .delete(storyReactionsTable)
    .where(and(eq(storyReactionsTable.storyId, storyId), eq(storyReactionsTable.userId, uid)));
  res.status(204).end();
});

router.post("/:storyId/vote", async (req, res) => {
  const uid = currentUserId(req);
  const { optionIndex } = req.body ?? {};
  const result = await loadAccessibleStory(uid, req.params.storyId);
  if (!result.ok) return res.status(result.status).json({ error: result.message });
  const { story } = result;

  const optionCount = story.pollOptions?.length ?? 0;
  if (!optionCount) return res.status(400).json({ error: "This story has no poll" });
  if (typeof optionIndex !== "number" || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= optionCount) {
    return res.status(400).json({ error: "Invalid poll option" });
  }
  await db
    .insert(storyPollVotesTable)
    .values({ storyId: story.id, userId: uid, optionIndex })
    .onConflictDoUpdate({
      target: [storyPollVotesTable.storyId, storyPollVotesTable.userId],
      set: { optionIndex, createdAt: new Date() },
    });

  const [viewedIds, extras] = await Promise.all([
    getViewedIds(uid, [story.id]),
    getStoryExtras(uid, [story]),
  ]);
  res.json(formatStory(story, viewedIds, undefined, extras, uid));
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
  const [viewedIds, extras] = await Promise.all([
    getViewedIds(viewerId, stories.map((s) => s.id)),
    getStoryExtras(viewerId, stories),
  ]);
  const viewCounts = new Map<number, number>();
  if (targetId === viewerId && stories.length) {
    const rows = await db
      .select({ storyId: storyViewsTable.storyId, value: sql<number>`count(*)::int` })
      .from(storyViewsTable)
      .where(inArray(storyViewsTable.storyId, stories.map((s) => s.id)))
      .groupBy(storyViewsTable.storyId);
    for (const r of rows) viewCounts.set(r.storyId, r.value);
  }
  return stories.map((s) => formatStory(s, viewedIds, targetId === viewerId ? (viewCounts.get(s.id) ?? 0) : undefined, extras, viewerId));
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
