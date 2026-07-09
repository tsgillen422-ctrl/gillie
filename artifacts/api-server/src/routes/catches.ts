import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  catchesTable,
  catchLikesTable,
  catchCommentsTable,
  savedCatchesTable,
  blocksTable,
} from "@workspace/db";
import { eq, and, desc, or, notInArray, count, inArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { moderateContent } from "../lib/moderation";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { isValidLakeId, DEFAULT_LAKE_ID } from "@workspace/lake-config";

const router = Router();

// Same reaction catalog as posts so the shared reaction picker works on both.
const ALLOWED_REACTIONS = ["heart", "fire", "laugh", "heart_eyes", "wow", "thumbsup", "thumbsdown", "sad", "angry"];

// True if either user has blocked the other; blocked users can never interact
// with each other's catches (Apple 5.1.2 — mirror of posts/messages gating).
async function isBlockedBetween(a: number, b: number) {
  if (a === b) return false;
  const row = await db.query.blocksTable.findFirst({
    where: or(
      and(eq(blocksTable.blockerId, a), eq(blocksTable.blockedId, b)),
      and(eq(blocksTable.blockerId, b), eq(blocksTable.blockedId, a)),
    ),
  });
  return Boolean(row);
}

// All user ids blocked either way relative to `uid` (for list filtering).
async function getBlockedIds(uid: number): Promise<number[]> {
  const blocks = await db.query.blocksTable.findMany({
    where: or(eq(blocksTable.blockerId, uid), eq(blocksTable.blockedId, uid)),
  });
  return blocks.map((b) => (b.blockerId === uid ? b.blockedId : b.blockerId));
}

// A catch is interactable when it's the viewer's own, or it's public, not from
// a hidden demo author, and there's no block between viewer and author.
async function canInteractWithCatch(uid: number, c: typeof catchesTable.$inferSelect): Promise<boolean> {
  if (c.userId === uid) return true;
  if (c.isPrivate) return false;
  const hidden = await getHiddenDemoUserIds(uid);
  if (hidden.includes(c.userId)) return false;
  return !(await isBlockedBetween(uid, c.userId));
}

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

async function formatCatch(c: typeof catchesTable.$inferSelect, uid: number) {
  const [user, reactionRows, commentRow, myLike, saved] = await Promise.all([
    db.query.usersTable.findFirst({ where: eq(usersTable.id, c.userId) }),
    db
      .select({ reaction: catchLikesTable.reaction, value: count() })
      .from(catchLikesTable)
      .where(eq(catchLikesTable.catchId, c.id))
      .groupBy(catchLikesTable.reaction),
    db
      .select({ value: count() })
      .from(catchCommentsTable)
      .where(eq(catchCommentsTable.catchId, c.id)),
    db.query.catchLikesTable.findFirst({
      where: and(eq(catchLikesTable.catchId, c.id), eq(catchLikesTable.userId, uid)),
    }),
    db.query.savedCatchesTable.findFirst({
      where: and(eq(savedCatchesTable.catchId, c.id), eq(savedCatchesTable.userId, uid)),
    }),
  ]);
  const reactionCounts: Record<string, number> = {};
  let likeCount = 0;
  for (const row of reactionRows) {
    reactionCounts[row.reaction] = row.value;
    likeCount += row.value;
  }
  return {
    id: c.id,
    userId: c.userId,
    user: user ? formatUser(user) : null,
    species: c.species,
    weight: c.weight,
    length: c.length,
    notes: c.notes,
    bait: c.bait,
    locationName: c.locationName,
    imageUrl: c.imageUrl,
    lat: c.lat,
    lng: c.lng,
    isPrivate: c.isPrivate,
    isMature: c.isMature,
    likeCount,
    reactionCounts,
    myReaction: myLike?.reaction ?? null,
    commentCount: commentRow[0]?.value ?? 0,
    savedByMe: Boolean(saved),
    caughtAt: c.caughtAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

async function formatCatchComment(c: typeof catchCommentsTable.$inferSelect) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, c.userId) });
  return {
    id: c.id,
    catchId: c.catchId,
    userId: c.userId,
    user: user ? formatUser(user) : null,
    content: c.content,
    imageUrl: c.imageUrl,
    isMature: c.isMature,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const profileUserId = req.query.profileUserId
    ? parseInt(req.query.profileUserId as string)
    : undefined;
  let rows;
  if (profileUserId !== undefined) {
    // A demo user's catches are invisible to anyone not in Demo Mode, and
    // blocked users never see each other's catches.
    if (profileUserId !== currentUserId(req)) {
      const hidden = await getHiddenDemoUserIds(currentUserId(req));
      if (hidden.includes(profileUserId)) return res.json([]);
      if (await isBlockedBetween(currentUserId(req), profileUserId)) return res.json([]);
    }
    rows = await db
      .select()
      .from(catchesTable)
      .where(
        profileUserId === currentUserId(req)
          ? eq(catchesTable.userId, profileUserId)
          : and(eq(catchesTable.userId, profileUserId), eq(catchesTable.isPrivate, false))
      )
      .orderBy(desc(catchesTable.caughtAt));
  } else {
    // Lake feed: hide demo authors' catches from anyone not in Demo Mode.
    // Optional lakeId scopes fishing reports to one lake community; older
    // iOS builds don't send it, which keeps the old all-lakes behavior.
    const hidden = await getHiddenDemoUserIds(currentUserId(req));
    const rawLakeId = req.query.lakeId != null ? Number(req.query.lakeId) : undefined;
    const conds = [
      or(
        eq(catchesTable.isPrivate, false),
        eq(catchesTable.userId, currentUserId(req)),
      ),
    ];
    if (hidden.length) conds.push(notInArray(catchesTable.userId, hidden));
    // Blocked users never see each other's catches in the lake feed.
    const blockedIds = await getBlockedIds(currentUserId(req));
    if (blockedIds.length) conds.push(notInArray(catchesTable.userId, blockedIds));
    if (rawLakeId !== undefined) {
      conds.push(eq(catchesTable.lakeId, isValidLakeId(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID));
    }
    rows = await db
      .select()
      .from(catchesTable)
      .where(and(...conds))
      .orderBy(desc(catchesTable.caughtAt));
  }
  res.json(await Promise.all(rows.map((r) => formatCatch(r, currentUserId(req)))));
});

router.post("/", async (req, res) => {
  const { species, weight, length, notes, bait, locationName, imageUrl, lat, lng, isPrivate, caughtAt, lakeId } = req.body;
  if (!species || !String(species).trim()) {
    return res.status(400).json({ error: "Species is required" });
  }
  const caught = caughtAt ? new Date(caughtAt) : new Date();
  if (isNaN(caught.getTime())) {
    return res.status(400).json({ error: "Invalid catch date" });
  }
  const isMature = await moderateContent({
    texts: [species, notes, bait, locationName],
    imagePaths: [imageUrl],
  });
  const [row] = await db
    .insert(catchesTable)
    .values({
      userId: currentUserId(req),
      lakeId: isValidLakeId(lakeId) ? lakeId : DEFAULT_LAKE_ID,
      species: String(species).trim(),
      weight: weight ?? null,
      length: length ?? null,
      notes: notes ?? null,
      bait: bait ? String(bait).trim() || null : null,
      locationName: locationName ? String(locationName).trim() || null : null,
      imageUrl: imageUrl ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      isPrivate: !!isPrivate,
      isMature,
      caughtAt: caught,
    })
    .returning();
  res.status(201).json(await formatCatch(row, currentUserId(req)));
});

router.delete("/:catchId", async (req, res) => {
  const catchId = parseInt(req.params.catchId);
  const row = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, catchId) });
  if (!row) return res.status(404).json({ error: "Catch not found" });
  if (row.userId !== currentUserId(req)) {
    return res.status(403).json({ error: "You can only delete your own catches" });
  }
  // No FK cascades in this schema — remove child rows before the parent.
  await db.delete(catchLikesTable).where(eq(catchLikesTable.catchId, catchId));
  await db.delete(catchCommentsTable).where(eq(catchCommentsTable.catchId, catchId));
  await db.delete(savedCatchesTable).where(eq(savedCatchesTable.catchId, catchId));
  await db.delete(catchesTable).where(eq(catchesTable.id, catchId));
  res.json({ success: true });
});

// --- Social interactions (mirrors the post endpoints) ---

async function loadInteractableCatch(req: any, res: any) {
  const catchId = parseInt(req.params.catchId);
  if (Number.isNaN(catchId)) {
    res.status(400).json({ error: "Invalid catch id" });
    return null;
  }
  const row = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, catchId) });
  if (!row || !(await canInteractWithCatch(currentUserId(req), row))) {
    res.status(404).json({ error: "Catch not found" });
    return null;
  }
  return row;
}

router.post("/:catchId/react", async (req, res) => {
  const uid = currentUserId(req);
  const row = await loadInteractableCatch(req, res);
  if (!row) return;
  const reaction = String(req.body?.reaction || "");
  if (!ALLOWED_REACTIONS.includes(reaction)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  const existing = await db.query.catchLikesTable.findFirst({
    where: and(eq(catchLikesTable.catchId, row.id), eq(catchLikesTable.userId, uid)),
  });
  if (existing && existing.reaction === reaction) {
    await db.delete(catchLikesTable).where(eq(catchLikesTable.id, existing.id));
  } else if (existing) {
    await db.update(catchLikesTable).set({ reaction }).where(eq(catchLikesTable.id, existing.id));
  } else {
    await db
      .insert(catchLikesTable)
      .values({ catchId: row.id, userId: uid, reaction })
      .onConflictDoUpdate({ target: [catchLikesTable.catchId, catchLikesTable.userId], set: { reaction } });
  }
  res.json(await formatCatch(row, uid));
});

router.get("/:catchId/comments", async (req, res) => {
  const row = await loadInteractableCatch(req, res);
  if (!row) return;
  const comments = await db
    .select()
    .from(catchCommentsTable)
    .where(eq(catchCommentsTable.catchId, row.id))
    .orderBy(catchCommentsTable.createdAt);
  // Hide comments authored by users blocked either way (group-style read-time
  // filtering) so blocked users never see each other's activity.
  const uid = currentUserId(req);
  const authorIds = [...new Set(comments.map((c) => c.userId))].filter((id) => id !== uid);
  let hiddenAuthors = new Set<number>();
  if (authorIds.length) {
    const blocks = await db.query.blocksTable.findMany({
      where: or(eq(blocksTable.blockerId, uid), eq(blocksTable.blockedId, uid)),
    });
    hiddenAuthors = new Set(blocks.map((b) => (b.blockerId === uid ? b.blockedId : b.blockerId)));
  }
  const visible = comments.filter((c) => !hiddenAuthors.has(c.userId));
  res.json(await Promise.all(visible.map(formatCatchComment)));
});

router.post("/:catchId/comments", async (req, res) => {
  const uid = currentUserId(req);
  const row = await loadInteractableCatch(req, res);
  if (!row) return;
  const trimmedContent = req.body?.content ? String(req.body.content).trim() : "";
  const trimmedImageUrl = req.body?.imageUrl ? String(req.body.imageUrl).trim() : "";
  if (!trimmedContent && !trimmedImageUrl) {
    return res.status(400).json({ error: "Add a message or photo to comment" });
  }
  const isMature = await moderateContent({
    texts: [trimmedContent],
    imagePaths: [trimmedImageUrl],
  });
  const [comment] = await db
    .insert(catchCommentsTable)
    .values({ catchId: row.id, userId: uid, content: trimmedContent, imageUrl: trimmedImageUrl || null, isMature })
    .returning();
  res.status(201).json(await formatCatchComment(comment));
});

router.delete("/:catchId/comments/:commentId", async (req, res) => {
  const uid = currentUserId(req);
  const catchId = parseInt(req.params.catchId);
  const commentId = parseInt(req.params.commentId);
  if (Number.isNaN(catchId) || Number.isNaN(commentId)) return res.status(400).json({ error: "Invalid id" });
  const comment = await db.query.catchCommentsTable.findFirst({ where: eq(catchCommentsTable.id, commentId) });
  if (!comment || comment.catchId !== catchId) return res.status(404).json({ error: "Comment not found" });
  const parent = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, catchId) });
  // Comment author or catch owner can remove a comment (same as posts).
  if (comment.userId !== uid && parent?.userId !== uid) {
    return res.status(403).json({ error: "You can only delete your own comments" });
  }
  await db.delete(catchCommentsTable).where(eq(catchCommentsTable.id, commentId));
  res.json({ success: true });
});

router.post("/:catchId/save", async (req, res) => {
  const uid = currentUserId(req);
  const row = await loadInteractableCatch(req, res);
  if (!row) return;
  await db
    .insert(savedCatchesTable)
    .values({ catchId: row.id, userId: uid })
    .onConflictDoNothing();
  res.json(await formatCatch(row, uid));
});

router.delete("/:catchId/save", async (req, res) => {
  const uid = currentUserId(req);
  const catchId = parseInt(req.params.catchId);
  if (Number.isNaN(catchId)) return res.status(400).json({ error: "Invalid catch id" });
  // Always allow removing your own save row (cleanup even if the catch later
  // became private/blocked), but never leak catch data for catches the viewer
  // can no longer access — respond 404 exactly like other gated endpoints.
  await db
    .delete(savedCatchesTable)
    .where(and(eq(savedCatchesTable.catchId, catchId), eq(savedCatchesTable.userId, uid)));
  const row = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, catchId) });
  if (!row || !(await canInteractWithCatch(uid, row))) {
    return res.status(404).json({ error: "Catch not found" });
  }
  res.json(await formatCatch(row, uid));
});

export default router;
