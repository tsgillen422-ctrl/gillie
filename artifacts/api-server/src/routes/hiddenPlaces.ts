import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, hiddenPlacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";

const router = Router();

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

// Visible to every authenticated user — hidden built-in places are filtered off
// the map for everyone, so all clients need to know the hidden set.
router.get("/", async (_req, res) => {
  const rows = await db.query.hiddenPlacesTable.findMany();
  res.json(rows.map((r) => ({ placeKey: r.placeKey })));
});

// Only an admin can permanently hide a built-in place for everyone.
router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) {
    return res.status(403).json({ error: "Only an admin can hide places" });
  }
  const { placeKey } = req.body ?? {};
  if (typeof placeKey !== "string" || !placeKey.trim()) {
    return res.status(400).json({ error: "placeKey is required" });
  }
  const key = placeKey.trim().slice(0, 200);
  const existing = await db.query.hiddenPlacesTable.findFirst({
    where: eq(hiddenPlacesTable.placeKey, key),
  });
  if (!existing) {
    await db.insert(hiddenPlacesTable).values({ placeKey: key, userId: uid });
  }
  res.status(201).json({ placeKey: key });
});

export default router;
