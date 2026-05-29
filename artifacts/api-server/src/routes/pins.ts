import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pinsTable, pinLikesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

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

async function formatPin(pin: typeof pinsTable.$inferSelect) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, pin.userId) });
  const like = await db.query.pinLikesTable.findFirst({
    where: and(eq(pinLikesTable.pinId, pin.id), eq(pinLikesTable.userId, SESSION_USER_ID)),
  });
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
    likedByMe: !!like,
    createdAt: pin.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  let pins;
  if (type) {
    pins = await db.select().from(pinsTable).where(eq(pinsTable.type, type));
  } else {
    pins = await db.select().from(pinsTable);
  }
  res.json(await Promise.all(pins.map(formatPin)));
});

router.post("/", async (req, res) => {
  const { lat, lng, type, title, description } = req.body;
  const [pin] = await db
    .insert(pinsTable)
    .values({ userId: SESSION_USER_ID, lat, lng, type, title, description })
    .returning();
  res.status(201).json(await formatPin(pin));
});

router.get("/:pinId", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  if (!pin) return res.status(404).json({ error: "Pin not found" });
  res.json(await formatPin(pin));
});

router.delete("/:pinId", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  await db.delete(pinsTable).where(eq(pinsTable.id, pinId));
  res.json({ success: true });
});

router.post("/:pinId/like", async (req, res) => {
  const pinId = parseInt(req.params.pinId);
  const existing = await db.query.pinLikesTable.findFirst({
    where: and(eq(pinLikesTable.pinId, pinId), eq(pinLikesTable.userId, SESSION_USER_ID)),
  });
  if (existing) {
    await db.delete(pinLikesTable).where(eq(pinLikesTable.id, existing.id));
    await db.update(pinsTable).set({ likeCount: sql`${pinsTable.likeCount} - 1` }).where(eq(pinsTable.id, pinId));
  } else {
    await db.insert(pinLikesTable).values({ pinId, userId: SESSION_USER_ID });
    await db.update(pinsTable).set({ likeCount: sql`${pinsTable.likeCount} + 1` }).where(eq(pinsTable.id, pinId));
  }
  const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, pinId) });
  res.json(await formatPin(pin!));
});

export default router;
