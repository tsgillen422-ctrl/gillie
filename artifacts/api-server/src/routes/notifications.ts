import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();
const SESSION_USER_ID = 1;

router.get("/", async (_req, res) => {
  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, SESSION_USER_ID))
    .orderBy(desc(notificationsTable.createdAt));
  res.json(
    notifs.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      message: n.message,
      read: n.read,
      relatedId: n.relatedId,
      createdAt: n.createdAt.toISOString(),
    }))
  );
});

router.post("/:notificationId/read", async (req, res) => {
  const notificationId = parseInt(req.params.notificationId);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, notificationId));
  res.json({ success: true });
});

export default router;
