import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, dockLabelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";

const router = Router();

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

function formatDockLabel(d: typeof dockLabelsTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    label: d.label,
    lat: d.lat,
    lng: d.lng,
    createdAt: d.createdAt.toISOString(),
  };
}

// Visible to every authenticated user — dock labels are shared map furniture.
router.get("/", async (_req, res) => {
  const rows = await db.query.dockLabelsTable.findMany();
  res.json(rows.map(formatDockLabel));
});

// Only an admin can place a dock label.
router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) {
    return res.status(403).json({ error: "Only an admin can place dock labels" });
  }
  const { label, lat, lng } = req.body ?? {};
  if (typeof label !== "string" || !label.trim() || typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "label, lat and lng are required" });
  }
  const [row] = await db
    .insert(dockLabelsTable)
    .values({ userId: uid, label: label.trim().slice(0, 60), lat, lng })
    .returning();
  res.status(201).json(formatDockLabel(row));
});

// Only an admin can remove a dock label.
router.delete("/:labelId", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) {
    return res.status(403).json({ error: "Only an admin can remove dock labels" });
  }
  const id = parseInt(req.params.labelId, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid dock label id" });
  }
  await db.delete(dockLabelsTable).where(eq(dockLabelsTable.id, id));
  res.json({ ok: true });
});

export default router;
