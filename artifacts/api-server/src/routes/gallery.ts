import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, galleryItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { moderateContent } from "../lib/moderation";
import { getHiddenDemoUserIds } from "../lib/demoData";

const router = Router();

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

async function formatItem(g: typeof galleryItemsTable.$inferSelect) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, g.userId) });
  return {
    id: g.id,
    userId: g.userId,
    user: user ? formatUser(user) : null,
    mediaUrl: g.mediaUrl,
    mediaType: g.mediaType,
    caption: g.caption,
    isMature: g.isMature,
    createdAt: g.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const profileUserId = req.query.profileUserId
    ? parseInt(req.query.profileUserId as string)
    : currentUserId(req);
  // A demo user's gallery is invisible to anyone not in Demo Mode.
  if (profileUserId !== currentUserId(req)) {
    const hidden = await getHiddenDemoUserIds(currentUserId(req));
    if (hidden.includes(profileUserId)) return res.json([]);
  }
  const rows = await db
    .select()
    .from(galleryItemsTable)
    .where(eq(galleryItemsTable.userId, profileUserId))
    .orderBy(desc(galleryItemsTable.createdAt));
  res.json(await Promise.all(rows.map(formatItem)));
});

router.post("/", async (req, res) => {
  const { mediaUrl, mediaType, caption } = req.body;
  if (!mediaUrl || !String(mediaUrl).trim()) {
    return res.status(400).json({ error: "mediaUrl is required" });
  }
  const type = mediaType === "video" ? "video" : "image";
  const trimmedMedia = String(mediaUrl).trim();
  const isMature = await moderateContent({
    texts: [caption],
    imagePaths: type === "image" ? [trimmedMedia] : [],
  });
  const [row] = await db
    .insert(galleryItemsTable)
    .values({
      userId: currentUserId(req),
      mediaUrl: trimmedMedia,
      mediaType: type,
      caption: caption ?? null,
      isMature,
    })
    .returning();
  res.status(201).json(await formatItem(row));
});

router.delete("/:itemId", async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  const row = await db.query.galleryItemsTable.findFirst({ where: eq(galleryItemsTable.id, itemId) });
  if (!row) return res.status(404).json({ error: "Item not found" });
  if (row.userId !== currentUserId(req)) {
    return res.status(403).json({ error: "You can only delete your own gallery items" });
  }
  await db.delete(galleryItemsTable).where(eq(galleryItemsTable.id, itemId));
  res.json({ success: true });
});

export default router;
