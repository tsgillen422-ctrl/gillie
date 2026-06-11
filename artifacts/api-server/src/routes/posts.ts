import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, postsTable, postLikesTable, postCommentsTable, commentLikesTable, pinsTable, eventRsvpsTable, mutesTable, savedPostsTable, catchesTable, pollOptionsTable, pollVotesTable, friendRequestsTable, blocksTable } from "@workspace/db";
import { eq, and, gte, sql, desc, count, inArray, notInArray, or, asc } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { canViewPin, getFriendIds as getPinFriendIds } from "./pins";
import { moderateContent } from "../lib/moderation";

const router = Router();
const ALLOWED_REACTIONS = ["thumbsup", "thumbsdown", "heart", "laugh", "sad", "angry"];

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    currentLat: null,
    currentLng: null,
    lastSeen: null,
    boatName: u.boatName,
    boatColor: u.boatColor,
    shareLocation: u.shareLocation,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

async function formatPost(post: typeof postsTable.$inferSelect, viewerId: number, embedShared = true): Promise<any> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, post.userId) });
  const like = await db.query.postLikesTable.findFirst({
    where: and(eq(postLikesTable.postId, post.id), eq(postLikesTable.userId, viewerId)),
  });
  const saved = await db.query.savedPostsTable.findFirst({
    where: and(eq(savedPostsTable.postId, post.id), eq(savedPostsTable.userId, viewerId)),
  });
  const reactionRows = await db
    .select({ reaction: postLikesTable.reaction, value: count() })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, post.id))
    .groupBy(postLikesTable.reaction);
  const reactionCounts: Record<string, number> = {};
  for (const row of reactionRows) reactionCounts[row.reaction] = row.value;
  let rsvpCount = 0;
  let rsvpByMe = false;
  if (post.postType === "event" || post.postType === "tie_up") {
    const [rsvpResult] = await db
      .select({ value: count() })
      .from(eventRsvpsTable)
      .where(and(eq(eventRsvpsTable.postId, post.id), eq(eventRsvpsTable.status, "going")));
    rsvpCount = rsvpResult?.value ?? 0;
    const mine = await db.query.eventRsvpsTable.findFirst({
      where: and(eq(eventRsvpsTable.postId, post.id), eq(eventRsvpsTable.userId, viewerId)),
    });
    rsvpByMe = mine?.status === "going";
  }
  const pollOptionRows = await db
    .select()
    .from(pollOptionsTable)
    .where(eq(pollOptionsTable.postId, post.id))
    .orderBy(asc(pollOptionsTable.position), asc(pollOptionsTable.id));
  let poll = null;
  if (pollOptionRows.length) {
    const voteRows = await db
      .select({ optionId: pollVotesTable.optionId, value: count() })
      .from(pollVotesTable)
      .where(eq(pollVotesTable.postId, post.id))
      .groupBy(pollVotesTable.optionId);
    const voteMap = new Map<number, number>();
    for (const v of voteRows) voteMap.set(v.optionId, v.value);
    const myVoteRow = await db.query.pollVotesTable.findFirst({
      where: and(eq(pollVotesTable.postId, post.id), eq(pollVotesTable.userId, viewerId)),
    });
    let totalVotes = 0;
    const options = pollOptionRows.map((o) => {
      const voteCount = voteMap.get(o.id) ?? 0;
      totalVotes += voteCount;
      return { id: o.id, text: o.text, voteCount };
    });
    poll = { options, totalVotes, myVote: myVoteRow?.optionId ?? null };
  }
  let sharedPost = null;
  if (post.sharedPostId && embedShared) {
    const orig = await db.query.postsTable.findFirst({ where: eq(postsTable.id, post.sharedPostId) });
    if (orig) {
      const muted = await db.query.mutesTable.findFirst({
        where: and(eq(mutesTable.muterId, viewerId), eq(mutesTable.mutedId, orig.userId)),
      });
      if (!muted) sharedPost = await formatPost(orig, viewerId, false);
    }
  }
  return {
    id: post.id,
    userId: post.userId,
    user: user ? formatUser(user) : null,
    title: post.title,
    content: post.content,
    postType: post.postType,
    eventDate: post.eventDate ? post.eventDate.toISOString() : null,
    imageUrl: post.imageUrl,
    videoUrl: post.videoUrl,
    photos: post.photos ?? null,
    engineSetup: post.engineSetup ?? null,
    horsepower: post.horsepower ?? null,
    topSpeed: post.topSpeed ?? null,
    mods: post.mods ?? null,
    pinLat: post.pinLat,
    pinLng: post.pinLng,
    likeCount: post.likeCount,
    isMature: post.isMature,
    likedByMe: !!like,
    myReaction: like?.reaction ?? null,
    reactionCounts,
    rsvpCount,
    rsvpByMe,
    savedByMe: !!saved,
    sharedPostId: post.sharedPostId ?? null,
    sharedPost,
    visibility: post.visibility,
    poll,
    createdAt: post.createdAt.toISOString(),
  };
}

// Authors whose friends-only posts this viewer may see: people the viewer
// follows, where the author follows back (mutual) OR the author lets non-mutual
// followers see their posts (followerSeePosts). Blocked users are excluded.
async function getFriendIds(userId: number): Promise<number[]> {
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
  const blocks = await db.query.blocksTable.findMany({
    where: or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)),
  });
  const blockedIds = new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
  const authors = await db.query.usersTable.findMany({ where: inArray(usersTable.id, followeeIds) });
  return authors
    .filter((a) => !blockedIds.has(a.id) && (mutual.has(a.id) || a.followerSeePosts))
    .map((a) => a.id);
}

// A post is visible to a viewer when it is shared with the whole community, or
// the viewer is the author, or the author is an accepted friend of the viewer.
function visibilityCondition(uid: number, friendIds: number[]) {
  return or(
    eq(postsTable.visibility, "community"),
    inArray(postsTable.userId, [uid, ...friendIds])
  );
}

// True when the viewer is allowed to see/interact with a post given its audience.
async function canViewPost(uid: number, post: { userId: number; visibility: string }): Promise<boolean> {
  if (post.visibility !== "friends" || post.userId === uid) return true;
  const friendIds = await getFriendIds(uid);
  return friendIds.includes(post.userId);
}

async function getMutedUserIds(userId: number): Promise<number[]> {
  const rows = await db.query.mutesTable.findMany({ where: eq(mutesTable.muterId, userId) });
  return rows.map((r) => r.mutedId);
}

router.get("/", async (req, res) => {
  const uid = currentUserId(req);
  const type = req.query.type as string | undefined;
  const audience = req.query.audience as string | undefined;
  const mutedIds = await getMutedUserIds(uid);
  const friendIds = await getFriendIds(uid);
  const conditions: any[] = [visibilityCondition(uid, friendIds)];
  if (type) conditions.push(eq(postsTable.postType, type));
  if (audience === "friends") {
    conditions.push(friendIds.length ? inArray(postsTable.userId, friendIds) : sql`false`);
  } else if (audience === "community") {
    conditions.push(notInArray(postsTable.userId, [uid, ...friendIds]));
  }
  if (mutedIds.length) conditions.push(notInArray(postsTable.userId, mutedIds));
  const where = and(...conditions);
  const posts = await db.select().from(postsTable).where(where).orderBy(desc(postsTable.createdAt));
  res.json(await Promise.all(posts.map((p) => formatPost(p, uid))));
});

router.get("/saved", async (req, res) => {
  const uid = currentUserId(req);
  const rows = await db.query.savedPostsTable.findMany({
    where: eq(savedPostsTable.userId, uid),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  if (!rows.length) return res.json([]);
  const posts = await db.query.postsTable.findMany({
    where: inArray(postsTable.id, rows.map((r) => r.postId)),
  });
  const orderMap = new Map(rows.map((r, i) => [r.postId, i]));
  posts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  res.json(await Promise.all(posts.map((p) => formatPost(p, uid))));
});

router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const { title, content, postType, eventDate, imageUrl, videoUrl, photos, engineSetup, horsepower, topSpeed, mods, pinLat, pinLng, visibility, pollOptions } = req.body;
  const photoList = Array.isArray(photos) ? photos.filter((p: unknown) => typeof p === "string") : null;
  const pollChoices = Array.isArray(pollOptions)
    ? pollOptions.map((p: unknown) => (typeof p === "string" ? p.trim() : "")).filter((p) => p.length > 0).slice(0, 10)
    : [];
  const isMature = await moderateContent({
    texts: [title, content, ...pollChoices],
    imagePaths: [imageUrl, ...(photoList ?? [])],
  });
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      title,
      content,
      postType: postType || "post",
      eventDate: eventDate ? new Date(eventDate) : null,
      imageUrl: imageUrl ?? (photoList && photoList.length ? photoList[0] : null),
      videoUrl,
      photos: photoList && photoList.length ? photoList : null,
      engineSetup: typeof engineSetup === "string" ? engineSetup : null,
      horsepower: Number.isInteger(horsepower) ? horsepower : null,
      topSpeed: typeof topSpeed === "number" && Number.isFinite(topSpeed) ? topSpeed : null,
      mods: typeof mods === "string" ? mods : null,
      pinLat,
      pinLng,
      visibility: visibility === "friends" ? "friends" : "community",
      isMature,
    })
    .returning();
  if (pollChoices.length >= 2) {
    await db.insert(pollOptionsTable).values(
      pollChoices.map((text, i) => ({ postId: post.id, text, position: i }))
    );
  }
  res.status(201).json(await formatPost(post, uid));
});

router.post("/:postId/share", async (req, res) => {
  const uid = currentUserId(req);
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  const original = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!original) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, original))) return res.status(404).json({ error: "Post not found" });
  const sourceId = original.sharedPostId ?? original.id;
  if (sourceId !== original.id) {
    const source = await db.query.postsTable.findFirst({ where: eq(postsTable.id, sourceId) });
    if (!source) return res.status(404).json({ error: "Original post is no longer available" });
    if (!(await canViewPost(uid, source))) return res.status(404).json({ error: "Original post is no longer available" });
  }
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const isMature = await moderateContent({ texts: [content] });
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      title: "",
      content,
      postType: "post",
      sharedPostId: sourceId,
      isMature,
    })
    .returning();
  res.status(201).json(await formatPost(post, uid));
});

router.get("/summary", async (req, res) => {
  const uid = currentUserId(req);
  const [postCountResult] = await db.select({ value: count() }).from(postsTable);
  const [eventCountResult] = await db.select({ value: count() }).from(postsTable).where(eq(postsTable.postType, "event"));
  // "Pins" must match exactly what the viewer sees via GET /pins (and on the
  // map): filtered by canViewPin (own, approved public/community, or
  // friends-only from a friend). A raw count() of every row over-counts
  // unapproved pins and other people's friends-only pins. We reuse pins.ts's
  // own canViewPin + getFriendIds so the count never drifts from the list.
  const pinFriendIds = await getPinFriendIds(uid);
  const allPins = await db.select().from(pinsTable);
  const visiblePins = allPins.filter((pin) => canViewPin(pin, uid, pinFriendIds));
  // "Now on the water" = users the map has detected as geospatially over water
  // (not on land at marinas/homes), still sharing location, and seen recently.
  // is_on_water is reported by the client (only it can tell water from land) and
  // is never cleared, so we also require a fresh last_seen to drop people who
  // have left, and respect share_location so privacy is honored.
  const ONLINE_WINDOW_MINUTES = 10;
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000);
  const [userCountResult] = await db
    .select({ value: count() })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isOnWater, true),
        eq(usersTable.shareLocation, true),
        gte(usersTable.lastSeen, onlineSince)
      )
    );

  const upcomingEvents = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.postType, "event"))
    .orderBy(desc(postsTable.createdAt))
    .limit(3);

  const recentPins = [...visiblePins]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const formattedPins = await Promise.all(
    recentPins.map(async (pin) => {
      const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pin.userId) });
      return {
        id: pin.id,
        userId: pin.userId,
        user: user ? formatUser(user) : null,
        lat: pin.lat,
        lng: pin.lng,
        type: pin.type,
        title: pin.title,
        description: pin.description,
        likeCount: pin.likeCount,
        likedByMe: false,
        createdAt: pin.createdAt.toISOString(),
      };
    })
  );

  const [fishingReportsResult] = await db
    .select({ value: count() })
    .from(catchesTable)
    .where(eq(catchesTable.isPrivate, false));

  res.json({
    totalPosts: postCountResult.value,
    totalEvents: eventCountResult.value,
    totalPins: visiblePins.length,
    activeUsersToday: userCountResult.value,
    fishingReports: fishingReportsResult.value,
    upcomingEvents: await Promise.all(upcomingEvents.map((p) => formatPost(p, uid))),
    recentPins: formattedPins,
  });
});

router.get("/:postId", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.visibility === "friends" && post.userId !== uid) {
    const friendIds = await getFriendIds(uid);
    if (!friendIds.includes(post.userId)) return res.status(404).json({ error: "Post not found" });
  }
  res.json(await formatPost(post, uid));
});

router.delete("/:postId", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, uid) });
  if (post.userId !== uid && !me?.isAdmin) {
    return res.status(403).json({ error: "You can only delete your own posts" });
  }
  await db.delete(postLikesTable).where(eq(postLikesTable.postId, postId));
  const postComments = await db
    .select({ id: postCommentsTable.id })
    .from(postCommentsTable)
    .where(eq(postCommentsTable.postId, postId));
  if (postComments.length > 0) {
    await db.delete(commentLikesTable).where(inArray(commentLikesTable.commentId, postComments.map((c) => c.id)));
  }
  await db.delete(postCommentsTable).where(eq(postCommentsTable.postId, postId));
  await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.postId, postId));
  await db.delete(savedPostsTable).where(eq(savedPostsTable.postId, postId));
  await db.delete(pollVotesTable).where(eq(pollVotesTable.postId, postId));
  await db.delete(pollOptionsTable).where(eq(pollOptionsTable.postId, postId));
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true });
});

router.post("/:postId/save", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  const existing = await db.query.savedPostsTable.findFirst({
    where: and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, uid)),
  });
  if (!existing) {
    await db.insert(savedPostsTable).values({ postId, userId: uid });
  }
  res.json({ success: true });
});

router.delete("/:postId/save", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  await db
    .delete(savedPostsTable)
    .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, uid)));
  res.json({ success: true });
});

router.post("/:postId/react", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  if (Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });
  const reaction = String(req.body?.reaction || "");
  if (!ALLOWED_REACTIONS.includes(reaction)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });

  const existing = await db.query.postLikesTable.findFirst({
    where: and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, uid)),
  });
  let delta = 0;
  if (existing && existing.reaction === reaction) {
    await db.delete(postLikesTable).where(eq(postLikesTable.id, existing.id));
    delta = -1;
  } else if (existing) {
    await db.update(postLikesTable).set({ reaction }).where(eq(postLikesTable.id, existing.id));
  } else {
    await db
      .insert(postLikesTable)
      .values({ postId, userId: uid, reaction })
      .onConflictDoUpdate({ target: [postLikesTable.postId, postLikesTable.userId], set: { reaction } });
    delta = 1;
  }
  if (delta !== 0) {
    await db
      .update(postsTable)
      .set({ likeCount: sql`GREATEST(${postsTable.likeCount} + ${delta}, 0)` })
      .where(eq(postsTable.id, postId));
  }

  const updated = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  res.json(await formatPost(updated!, uid));
});

router.post("/:postId/poll/vote", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  if (Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });
  const optionId = Number(req.body?.optionId);
  if (!Number.isInteger(optionId)) return res.status(400).json({ error: "Invalid option" });
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  const option = await db.query.pollOptionsTable.findFirst({ where: eq(pollOptionsTable.id, optionId) });
  if (!option || option.postId !== postId) return res.status(404).json({ error: "Poll option not found" });

  const existing = await db.query.pollVotesTable.findFirst({
    where: and(eq(pollVotesTable.postId, postId), eq(pollVotesTable.userId, uid)),
  });
  if (existing && existing.optionId === optionId) {
    await db.delete(pollVotesTable).where(eq(pollVotesTable.id, existing.id));
  } else if (existing) {
    await db.update(pollVotesTable).set({ optionId }).where(eq(pollVotesTable.id, existing.id));
  } else {
    await db
      .insert(pollVotesTable)
      .values({ postId, optionId, userId: uid })
      .onConflictDoUpdate({ target: [pollVotesTable.postId, pollVotesTable.userId], set: { optionId } });
  }
  res.json(await formatPost(post, uid));
});

router.post("/:postId/rsvp", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  if (post.postType !== "event" && post.postType !== "tie_up") {
    return res.status(400).json({ error: "You can only RSVP to events or tie-ups" });
  }
  const existing = await db.query.eventRsvpsTable.findFirst({
    where: and(eq(eventRsvpsTable.postId, postId), eq(eventRsvpsTable.userId, uid)),
  });
  if (existing) {
    await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.id, existing.id));
  } else {
    await db.insert(eventRsvpsTable).values({ postId, userId: uid, status: "going" });
  }
  res.json(await formatPost(post, uid));
});

router.get("/:postId/rsvps", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  const rsvps = await db
    .select()
    .from(eventRsvpsTable)
    .where(and(eq(eventRsvpsTable.postId, postId), eq(eventRsvpsTable.status, "going")))
    .orderBy(eventRsvpsTable.createdAt);
  const formatted = await Promise.all(
    rsvps.map(async (r) => {
      const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, r.userId) });
      return { userId: r.userId, user: user ? formatUser(user) : null };
    })
  );
  res.json(formatted);
});

router.get("/:postId/likes", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  const likes = await db
    .select()
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, postId))
    .orderBy(postLikesTable.createdAt);
  const formatted = await Promise.all(
    likes.map(async (l) => {
      const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, l.userId) });
      return { userId: l.userId, reaction: l.reaction, user: user ? formatUser(user) : null };
    })
  );
  res.json(formatted);
});

async function formatComment(c: typeof postCommentsTable.$inferSelect, viewerId: number): Promise<any> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, c.userId) });
  const like = await db.query.commentLikesTable.findFirst({
    where: and(eq(commentLikesTable.commentId, c.id), eq(commentLikesTable.userId, viewerId)),
  });
  const reactionRows = await db
    .select({ reaction: commentLikesTable.reaction, value: count() })
    .from(commentLikesTable)
    .where(eq(commentLikesTable.commentId, c.id))
    .groupBy(commentLikesTable.reaction);
  const reactionCounts: Record<string, number> = {};
  for (const row of reactionRows) reactionCounts[row.reaction] = row.value;
  return {
    id: c.id,
    postId: c.postId,
    userId: c.userId,
    user: user ? formatUser(user) : null,
    content: c.content,
    imageUrl: c.imageUrl,
    videoUrl: c.videoUrl,
    likeCount: c.likeCount,
    isMature: c.isMature,
    likedByMe: !!like,
    myReaction: like?.reaction ?? null,
    reactionCounts,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/:postId/comments", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  const comments = await db
    .select()
    .from(postCommentsTable)
    .where(eq(postCommentsTable.postId, postId))
    .orderBy(postCommentsTable.createdAt);
  const formatted = await Promise.all(comments.map((c) => formatComment(c, uid)));
  res.json(formatted);
});

router.post("/:postId/comments", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const { content, imageUrl, videoUrl } = req.body;
  const trimmedContent = content ? String(content).trim() : "";
  const trimmedImageUrl = imageUrl ? String(imageUrl).trim() : "";
  const trimmedVideoUrl = videoUrl ? String(videoUrl).trim() : "";
  if (!trimmedContent && !trimmedImageUrl && !trimmedVideoUrl) {
    return res.status(400).json({ error: "Add a message, photo, or video to comment" });
  }
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (!(await canViewPost(uid, post))) return res.status(404).json({ error: "Post not found" });
  const isMature = await moderateContent({
    texts: [trimmedContent],
    imagePaths: [trimmedImageUrl],
  });
  const [comment] = await db
    .insert(postCommentsTable)
    .values({ postId, userId: uid, content: trimmedContent, imageUrl: trimmedImageUrl || null, videoUrl: trimmedVideoUrl || null, isMature })
    .returning();
  res.status(201).json(await formatComment(comment, uid));
});

router.post("/:postId/comments/:commentId/react", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const commentId = parseInt(req.params.commentId);
  if (Number.isNaN(postId) || Number.isNaN(commentId)) return res.status(400).json({ error: "Invalid id" });
  const reaction = String(req.body?.reaction || "");
  if (!ALLOWED_REACTIONS.includes(reaction)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  const comment = await db.query.postCommentsTable.findFirst({ where: eq(postCommentsTable.id, commentId) });
  if (!comment || comment.postId !== postId) return res.status(404).json({ error: "Comment not found" });
  const parentPost = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!parentPost || !(await canViewPost(uid, parentPost))) return res.status(404).json({ error: "Post not found" });

  const existing = await db.query.commentLikesTable.findFirst({
    where: and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, uid)),
  });
  let delta = 0;
  if (existing && existing.reaction === reaction) {
    await db.delete(commentLikesTable).where(eq(commentLikesTable.id, existing.id));
    delta = -1;
  } else if (existing) {
    await db.update(commentLikesTable).set({ reaction }).where(eq(commentLikesTable.id, existing.id));
  } else {
    await db
      .insert(commentLikesTable)
      .values({ commentId, userId: uid, reaction })
      .onConflictDoUpdate({ target: [commentLikesTable.commentId, commentLikesTable.userId], set: { reaction } });
    delta = 1;
  }
  if (delta !== 0) {
    await db
      .update(postCommentsTable)
      .set({ likeCount: sql`GREATEST(${postCommentsTable.likeCount} + ${delta}, 0)` })
      .where(eq(postCommentsTable.id, commentId));
  }
  const updated = await db.query.postCommentsTable.findFirst({ where: eq(postCommentsTable.id, commentId) });
  res.json(await formatComment(updated!, uid));
});

router.delete("/:postId/comments/:commentId", async (req, res) => {
  const uid = currentUserId(req);
  const commentId = parseInt(req.params.commentId);
  const comment = await db.query.postCommentsTable.findFirst({ where: eq(postCommentsTable.id, commentId) });
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== uid) {
    return res.status(403).json({ error: "You can only delete your own comments" });
  }
  await db.delete(commentLikesTable).where(eq(commentLikesTable.commentId, commentId));
  await db.delete(postCommentsTable).where(eq(postCommentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
