import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, dockLabelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { isValidLakeId, DEFAULT_LAKE_ID } from "@workspace/lake-config";

const router = Router();

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

function formatDockLabel(d: typeof dockLabelsTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    lakeId: d.lakeId,
    label: d.label,
    emoji: d.emoji ?? null,
    lat: d.lat,
    lng: d.lng,
    createdAt: d.createdAt.toISOString(),
  };
}

// Visible to every authenticated user — dock labels are shared map furniture.
router.get("/", async (req, res) => {
  const rawLakeId = req.query.lakeId != null ? Number(req.query.lakeId) : undefined;
  const rows = await db.query.dockLabelsTable.findMany({
    where:
      rawLakeId !== undefined
        ? eq(dockLabelsTable.lakeId, isValidLakeId(rawLakeId) ? rawLakeId : DEFAULT_LAKE_ID)
        : undefined,
  });
  res.json(rows.map(formatDockLabel));
});

// Only an admin can place a dock label.
router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) {
    return res.status(403).json({ error: "Only an admin can place dock labels" });
  }
  const { label, emoji, lat, lng, lakeId } = req.body ?? {};
  if (typeof label !== "string" || !label.trim() || typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "label, lat and lng are required" });
  }
  const emojiValue = typeof emoji === "string" && emoji.trim() ? emoji.trim().slice(0, 8) : null;
  const [row] = await db
    .insert(dockLabelsTable)
    .values({
      userId: uid,
      lakeId: isValidLakeId(lakeId) ? lakeId : DEFAULT_LAKE_ID,
      label: label.trim().slice(0, 60),
      emoji: emojiValue,
      lat,
      lng,
    })
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
