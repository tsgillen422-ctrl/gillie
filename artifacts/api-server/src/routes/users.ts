import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

const SESSION_USER_ID = 1;

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    coverUrl: u.coverUrl,
    bio: u.bio,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    currentLat: u.shareLocation ? u.currentLat : null,
    currentLng: u.shareLocation ? u.currentLng : null,
    lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
    boatName: u.boatName,
    boatColor: u.boatColor,
    boatType: u.boatType,
    boatNeon: u.boatNeon,
    boatFlag: u.boatFlag,
    shareLocation: u.shareLocation,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/me", async (req, res) => {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, SESSION_USER_ID),
  });
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json(formatUser(user));
});

router.patch("/me", async (req, res) => {
  const { displayName, bio, avatarUrl, coverUrl, boatName, boatColor, boatType, boatNeon, boatFlag, isBusiness, shareLocation } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (coverUrl !== undefined) updates.coverUrl = coverUrl;
  if (boatName !== undefined) updates.boatName = boatName;
  if (boatColor !== undefined) updates.boatColor = boatColor;
  if (boatType !== undefined) {
    const validBoatTypes = ["speedboat", "pontoon", "sailboat", "kayak", "jetski", "yacht"];
    if (!validBoatTypes.includes(boatType)) {
      return res.status(400).json({ error: "Invalid boatType" });
    }
    updates.boatType = boatType;
  }
  if (boatNeon !== undefined) {
    if (typeof boatNeon !== "boolean") {
      return res.status(400).json({ error: "boatNeon must be a boolean" });
    }
    updates.boatNeon = boatNeon;
  }
  if (boatFlag !== undefined) {
    if (typeof boatFlag !== "boolean") {
      return res.status(400).json({ error: "boatFlag must be a boolean" });
    }
    updates.boatFlag = boatFlag;
  }
  if (isBusiness !== undefined) updates.isBusiness = isBusiness;
  if (shareLocation !== undefined) updates.shareLocation = shareLocation;
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, SESSION_USER_ID)).returning();
  res.json(formatUser(updated));
});

router.patch("/me/location", async (req, res) => {
  const { lat, lng } = req.body;
  const [updated] = await db
    .update(usersTable)
    .set({ currentLat: lat, currentLng: lng, isOnline: true, lastSeen: new Date() })
    .where(eq(usersTable.id, SESSION_USER_ID))
    .returning();
  res.json(formatUser(updated));
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "");
  if (!q) return res.json([]);
  const users = await db
    .select()
    .from(usersTable)
    .where(or(ilike(usersTable.username, `%${q}%`), ilike(usersTable.displayName, `%${q}%`)))
    .limit(20);
  res.json(users.map(formatUser));
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(formatUser(user));
});

export default router;
