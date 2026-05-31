import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, postsTable, postLikesTable, postCommentsTable, commentLikesTable, pinsTable, eventRsvpsTable, mutesTable, savedPostsTable } from "@workspace/db";
import { eq, and, sql, desc, count, inArray, notInArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";

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
  if (post.postType === "event") {
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
    pinLat: post.pinLat,
    pinLng: post.pinLng,
    likeCount: post.likeCount,
    likedByMe: !!like,
    myReaction: like?.reaction ?? null,
    reactionCounts,
    rsvpCount,
    rsvpByMe,
    savedByMe: !!saved,
    sharedPostId: post.sharedPostId ?? null,
    sharedPost,
    createdAt: post.createdAt.toISOString(),
  };
}

async function getMutedUserIds(userId: number): Promise<number[]> {
  const rows = await db.query.mutesTable.findMany({ where: eq(mutesTable.muterId, userId) });
  return rows.map((r) => r.mutedId);
}

router.get("/", async (req, res) => {
  const uid = currentUserId(req);
  const type = req.query.type as string | undefined;
  const mutedIds = await getMutedUserIds(uid);
  const conditions = [];
  if (type) conditions.push(eq(postsTable.postType, type));
  if (mutedIds.length) conditions.push(notInArray(postsTable.userId, mutedIds));
  const where = conditions.length ? and(...conditions) : undefined;
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
  const { title, content, postType, eventDate, imageUrl, videoUrl, pinLat, pinLng } = req.body;
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      title,
      content,
      postType: postType || "post",
      eventDate: eventDate ? new Date(eventDate) : null,
      imageUrl,
      videoUrl,
      pinLat,
      pinLng,
    })
    .returning();
  res.status(201).json(await formatPost(post, uid));
});

router.post("/:postId/share", async (req, res) => {
  const uid = currentUserId(req);
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) return res.status(400).json({ error: "Invalid post id" });
  const original = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!original) return res.status(404).json({ error: "Post not found" });
  const sourceId = original.sharedPostId ?? original.id;
  if (sourceId !== original.id) {
    const source = await db.query.postsTable.findFirst({ where: eq(postsTable.id, sourceId) });
    if (!source) return res.status(404).json({ error: "Original post is no longer available" });
  }
  const content = typeof req.body?.content === "string" ? req.body.content : "";
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      title: "",
      content,
      postType: "post",
      sharedPostId: sourceId,
    })
    .returning();
  res.status(201).json(await formatPost(post, uid));
});

router.get("/summary", async (req, res) => {
  const uid = currentUserId(req);
  const [postCountResult] = await db.select({ value: count() }).from(postsTable);
  const [eventCountResult] = await db.select({ value: count() }).from(postsTable).where(eq(postsTable.postType, "event"));
  const [pinCountResult] = await db.select({ value: count() }).from(pinsTable);
  const [userCountResult] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.isOnline, true));

  const upcomingEvents = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.postType, "event"))
    .orderBy(desc(postsTable.createdAt))
    .limit(3);

  const recentPins = await db
    .select()
    .from(pinsTable)
    .orderBy(desc(pinsTable.createdAt))
    .limit(5);

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

  res.json({
    totalPosts: postCountResult.value,
    totalEvents: eventCountResult.value,
    totalPins: pinCountResult.value,
    activeUsersToday: userCountResult.value,
    upcomingEvents: await Promise.all(upcomingEvents.map((p) => formatPost(p, uid))),
    recentPins: formattedPins,
  });
});

router.get("/:postId", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(await formatPost(post, uid));
});

router.delete("/:postId", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.userId !== uid) {
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
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true });
});

router.post("/:postId/save", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
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

router.post("/:postId/rsvp", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.postType !== "event") {
    return res.status(400).json({ error: "You can only RSVP to events" });
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
  const postId = parseInt(req.params.postId);
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
  const postId = parseInt(req.params.postId);
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
    likedByMe: !!like,
    myReaction: like?.reaction ?? null,
    reactionCounts,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/:postId/comments", async (req, res) => {
  const uid = currentUserId(req);
  const postId = parseInt(req.params.postId);
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
  const [comment] = await db
    .insert(postCommentsTable)
    .values({ postId, userId: uid, content: trimmedContent, imageUrl: trimmedImageUrl || null, videoUrl: trimmedVideoUrl || null })
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
