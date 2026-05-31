import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pinsTable, postsTable } from "@workspace/db";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";

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
    boatName: u.boatName,
    boatColor: u.boatColor,
  };
}

router.get("/", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (q.length < 2) {
    return res.json({ users: [], pins: [], posts: [] });
  }
  const term = `%${q}%`;

  const users = await db
    .select()
    .from(usersTable)
    .where(or(ilike(usersTable.displayName, term), ilike(usersTable.username, term)))
    .limit(10);

  const pins = await db
    .select()
    .from(pinsTable)
    .where(
      and(
        eq(pinsTable.approved, true),
        or(ilike(pinsTable.title, term), ilike(pinsTable.description, term))
      )
    )
    .limit(10);

  const posts = await db
    .select()
    .from(postsTable)
    .where(or(ilike(postsTable.title, term), ilike(postsTable.content, term)))
    .orderBy(desc(postsTable.createdAt))
    .limit(10);

  res.json({
    users: users.map(formatUser),
    pins: pins
      .filter((p) => p.visibility !== "friends" || p.userId === currentUserId(req))
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        lat: p.lat,
        lng: p.lng,
      })),
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      postType: p.postType,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

export default router;
