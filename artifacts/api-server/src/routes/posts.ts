import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, postsTable, postLikesTable, pinsTable } from "@workspace/db";
import { eq, and, sql, desc, count } from "drizzle-orm";

const router = Router();
const SESSION_USER_ID = 1;

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

async function formatPost(post: typeof postsTable.$inferSelect) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, post.userId) });
  const like = await db.query.postLikesTable.findFirst({
    where: and(eq(postLikesTable.postId, post.id), eq(postLikesTable.userId, SESSION_USER_ID)),
  });
  return {
    id: post.id,
    userId: post.userId,
    user: user ? formatUser(user) : null,
    title: post.title,
    content: post.content,
    postType: post.postType,
    eventDate: post.eventDate ? post.eventDate.toISOString() : null,
    imageUrl: post.imageUrl,
    pinLat: post.pinLat,
    pinLng: post.pinLng,
    likeCount: post.likeCount,
    likedByMe: !!like,
    createdAt: post.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  let posts;
  if (type) {
    posts = await db.select().from(postsTable).where(eq(postsTable.postType, type)).orderBy(desc(postsTable.createdAt));
  } else {
    posts = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt));
  }
  res.json(await Promise.all(posts.map(formatPost)));
});

router.post("/", async (req, res) => {
  const { title, content, postType, eventDate, imageUrl, pinLat, pinLng } = req.body;
  const [post] = await db
    .insert(postsTable)
    .values({
      userId: SESSION_USER_ID,
      title,
      content,
      postType: postType || "post",
      eventDate: eventDate ? new Date(eventDate) : null,
      imageUrl,
      pinLat,
      pinLng,
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
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true });
});

router.post("/:postId/like", async (req, res) => {
  const postId = parseInt(req.params.postId);
  const existing = await db.query.postLikesTable.findFirst({
    where: and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, SESSION_USER_ID)),
  });
  if (existing) {
    await db.delete(postLikesTable).where(eq(postLikesTable.id, existing.id));
    await db.update(postsTable).set({ likeCount: sql`${postsTable.likeCount} - 1` }).where(eq(postsTable.id, postId));
  } else {
    await db.insert(postLikesTable).values({ postId, userId: SESSION_USER_ID });
    await db.update(postsTable).set({ likeCount: sql`${postsTable.likeCount} + 1` }).where(eq(postsTable.id, postId));
  }
  const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, postId) });
  res.json(await formatPost(post!));
});

export default router;
