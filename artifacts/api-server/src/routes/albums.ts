import { Router } from "express";
import { db } from "@workspace/db";
import { albumsTable, galleryItemsTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray, count } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";

const router = Router();

const ALBUM_NAME_MAX = 60;

async function formatAlbum(a: typeof albumsTable.$inferSelect) {
  // Cover: explicit coverUrl wins; otherwise the newest item in the album.
  let coverUrl = a.coverUrl;
  if (!coverUrl) {
    const newest = await db.query.galleryItemsTable.findFirst({
      where: eq(galleryItemsTable.albumId, a.id),
      orderBy: desc(galleryItemsTable.createdAt),
    });
    coverUrl = newest?.mediaUrl ?? null;
  }
  const [countRow] = await db
    .select({ value: count() })
    .from(galleryItemsTable)
    .where(eq(galleryItemsTable.albumId, a.id));
  return {
    id: a.id,
    userId: a.userId,
    name: a.name,
    coverUrl,
    itemCount: countRow?.value ?? 0,
    createdAt: a.createdAt.toISOString(),
  };
}

// List a profile's albums (defaults to the caller's own).
router.get("/", async (req, res) => {
  const profileUserId = req.query.profileUserId
    ? parseInt(req.query.profileUserId as string)
    : currentUserId(req);
  if (!Number.isInteger(profileUserId)) return res.status(400).json({ error: "Invalid profileUserId" });
  // Mirror the gallery rule: a demo user's albums are invisible outside Demo Mode.
  if (profileUserId !== currentUserId(req)) {
    const hidden = await getHiddenDemoUserIds(currentUserId(req));
    if (hidden.includes(profileUserId)) return res.json([]);
  }
  const rows = await db
    .select()
    .from(albumsTable)
    .where(eq(albumsTable.userId, profileUserId))
    .orderBy(desc(albumsTable.createdAt));
  res.json(await Promise.all(rows.map(formatAlbum)));
});

router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Album name is required" });
  if (name.length > ALBUM_NAME_MAX) {
    return res.status(400).json({ error: `Album name must be at most ${ALBUM_NAME_MAX} characters` });
  }
  const [row] = await db.insert(albumsTable).values({ userId: uid, name }).returning();
  res.status(201).json(await formatAlbum(row));
});

router.patch("/:albumId", async (req, res) => {
  const uid = currentUserId(req);
  const albumId = parseInt(req.params.albumId);
  const album = await db.query.albumsTable.findFirst({ where: eq(albumsTable.id, albumId) });
  if (!album) return res.status(404).json({ error: "Album not found" });
  if (album.userId !== uid) return res.status(403).json({ error: "You can only edit your own albums" });
  const updates: Partial<typeof albumsTable.$inferInsert> = {};
  if (req.body?.name !== undefined) {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "Album name is required" });
    if (name.length > ALBUM_NAME_MAX) {
      return res.status(400).json({ error: `Album name must be at most ${ALBUM_NAME_MAX} characters` });
    }
    updates.name = name;
  }
  if (req.body?.coverUrl !== undefined) {
    const cover = req.body.coverUrl;
    if (cover !== null && typeof cover !== "string") {
      return res.status(400).json({ error: "coverUrl must be a string or null" });
    }
    // The cover must be media that lives in this album (or null to reset).
    if (cover) {
      const item = await db.query.galleryItemsTable.findFirst({
        where: and(eq(galleryItemsTable.albumId, albumId), eq(galleryItemsTable.mediaUrl, cover)),
      });
      if (!item) return res.status(400).json({ error: "Cover must be a photo in this album" });
    }
    updates.coverUrl = cover || null;
  }
  if (!Object.keys(updates).length) return res.json(await formatAlbum(album));
  const [updated] = await db.update(albumsTable).set(updates).where(eq(albumsTable.id, albumId)).returning();
  res.json(await formatAlbum(updated));
});

// Deleting an album detaches its items back to the general gallery — media is
// never deleted with the album.
router.delete("/:albumId", async (req, res) => {
  const uid = currentUserId(req);
  const albumId = parseInt(req.params.albumId);
  const album = await db.query.albumsTable.findFirst({ where: eq(albumsTable.id, albumId) });
  if (!album) return res.status(404).json({ error: "Album not found" });
  if (album.userId !== uid) return res.status(403).json({ error: "You can only delete your own albums" });
  await db.update(galleryItemsTable).set({ albumId: null }).where(eq(galleryItemsTable.albumId, albumId));
  await db.delete(albumsTable).where(eq(albumsTable.id, albumId));
  res.json({ success: true });
});

export default router;
