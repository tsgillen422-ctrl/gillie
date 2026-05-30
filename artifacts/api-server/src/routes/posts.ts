import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, postsTable, postLikesTable, postCommentsTable, pinsTable, eventRsvpsTable, mutesTable, savedPostsTable } from "@workspace/db";
import { eq, and, sql, desc, count, inArray, notInArray } from "drizzle-orm";

const router = Router();
const SESSION_USER_ID = 1;
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

async function formatPost(post: typeof postsTable.$inferSelect, embedShared = true): Promise<any> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, post.userId) });
  const like = await db.query.postLikesTable.findFirst({
    where: and(eq(postLikesTable.postId, post.id), eq(postLikesTable.userId, SESSION_USER_ID)),
  });
  const saved = await db.query.savedPostsTable.findFirst({
    where: and(eq(savedPostsTable.postId, post.id), eq(savedPostsTable.userId, SESSION_USER_ID)),
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
      where: and(eq(eventRsvpsTable.postId, post.id), eq(eventRsvpsTable.userId, SESSION_USER_ID)),
    });
    rsvpByMe = mine?.status === "going";
  }
  let sharedPost = null;
  if (post.sharedPostId && embedShared) {
    const orig = await db.query.postsTable.findFirst({ where: eq(postsTable.id, post.sharedPostId) });
    if (orig) {
      const muted = await db.query.mutesTable.findFirst({
        where: and(eq(mutesTable.muterId, SESSION_USER_ID), eq(mutesTable.mutedId, orig.userId)),
      });
      if (!muted) sharedPost = await formatPost(orig, false);
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
  const type = req.query.type as string | undefined;
  const mutedIds = await getMutedUserIds(SESSION_USER_ID);
  const conditions = [];
  if (type) conditions.push(eq(postsTable.postType, type));
  if (mutedIds.length) conditions.push(notInArray(postsTable.userId, mutedIds));
  const where = conditions.length ? and(...conditions) : undefined;
  const posts = await db.select().from(postsTable).where(where).orderBy(desc(postsTable.createdAt));
  res.json(await Promise.all(posts.map(formatPost)));
});

router.get("/saved", async (_req, res) => {
  const rows = await db.query.savedPostsTable.findMany({
    where: eq(savedPostsTable.userId, SESSION_USER_ID),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  if (!rows.length) return res.json([]);
  const posts = await db.query.postsTable.findMany({
    where: inArray(postsTable.id, rows.map((r) => r.postId)),
  });
  const orderMap = new Map(rows.map((r, i) => [r.postId, i]));
  posts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  res.json(await Promise.all(posts.map(formatPost)));
});

router.post("/", async (req, res) => {
  const { title, content, postType, eventDate, imageUrl, videoUrl, pinLat, pinLng } = req.body;
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: SESSION_USER_ID,
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
  res.status(201).json(await formatPost(post));
});

router.post("/:postId/share", async (req, res) => {
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
      userId: SESSION_USER_ID,
      title: "",
      content,
      postType: "post",
      sharedPostId: sourceId,
    })
    .returning();
  res.status(201).json(await formatPost(post));
});

router.get("/summary", async (_req, res) => {
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
    upcomingEvents: await Promise.all(upcomingEvents.map(formatPost)),
    recentPins: formattedPins,
  });
});

router.get("/:postId", async (req, res) => {
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(await formatPost(post));
});

router.delete("/:postId", async (req, res) => {
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.userId !== SESSION_USER_ID) {
    return res.status(403).json({ error: "You can only delete your own posts" });
  }
  await db.delete(postLikesTable).where(eq(postLikesTable.postId, postId));
  await db.delete(postCommentsTable).where(eq(postCommentsTable.postId, postId));
  await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.postId, postId));
  await db.delete(savedPostsTable).where(eq(savedPostsTable.postId, postId));
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true });
});

router.post("/:postId/save", async (req, res) => {
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  const existing = await db.query.savedPostsTable.findFirst({
    where: and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, SESSION_USER_ID)),
  });
  if (!existing) {
    await db.insert(savedPostsTable).values({ postId, userId: SESSION_USER_ID });
  }
  res.json({ success: true });
});

router.delete("/:postId/save", async (req, res) => {
  const postId = parseInt(req.params.postId);
  await db
    .delete(savedPostsTable)
    .where(and(eq(savedPostsTable.postId, postId), eq(savedPostsTable.userId, SESSION_USER_ID)));
  res.json({ success: true });
});

router.post("/:postId/react", async (req, res) => {
  const postId = parseInt(req.params.postId);
  if (Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id" });
  const reaction = String(req.body?.reaction || "");
  if (!ALLOWED_REACTIONS.includes(reaction)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });

  const existing = await db.query.postLikesTable.findFirst({
    where: and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, SESSION_USER_ID)),
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
      .values({ postId, userId: SESSION_USER_ID, reaction })
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
  res.json(await formatPost(updated!));
});

router.post("/:postId/rsvp", async (req, res) => {
  const postId = parseInt(req.params.postId);
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.postType !== "event") {
    return res.status(400).json({ error: "You can only RSVP to events" });
  }
  const existing = await db.query.eventRsvpsTable.findFirst({
    where: and(eq(eventRsvpsTable.postId, postId), eq(eventRsvpsTable.userId, SESSION_USER_ID)),
  });
  if (existing) {
    await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.id, existing.id));
  } else {
    await db.insert(eventRsvpsTable).values({ postId, userId: SESSION_USER_ID, status: "going" });
  }
  res.json(await formatPost(post));
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

router.get("/:postId/comments", async (req, res) => {
  const postId = parseInt(req.params.postId);
  const comments = await db
    .select()
    .from(postCommentsTable)
    .where(eq(postCommentsTable.postId, postId))
    .orderBy(postCommentsTable.createdAt);
  const formatted = await Promise.all(
    comments.map(async (c) => {
      const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, c.userId) });
      return {
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        user: user ? formatUser(user) : null,
        content: c.content,
        imageUrl: c.imageUrl,
        videoUrl: c.videoUrl,
        createdAt: c.createdAt.toISOString(),
      };
    })
  );
  res.json(formatted);
});

router.post("/:postId/comments", async (req, res) => {
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
    .values({ postId, userId: SESSION_USER_ID, content: trimmedContent, imageUrl: trimmedImageUrl || null, videoUrl: trimmedVideoUrl || null })
    .returning();
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, comment.userId) });
  res.status(201).json({
    id: comment.id,
    postId: comment.postId,
    userId: comment.userId,
    user: user ? formatUser(user) : null,
    content: comment.content,
    imageUrl: comment.imageUrl,
    videoUrl: comment.videoUrl,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.delete("/:postId/comments/:commentId", async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  const comment = await db.query.postCommentsTable.findFirst({ where: eq(postCommentsTable.id, commentId) });
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== SESSION_USER_ID) {
    return res.status(403).json({ error: "You can only delete your own comments" });
  }
  await db.delete(postCommentsTable).where(eq(postCommentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
