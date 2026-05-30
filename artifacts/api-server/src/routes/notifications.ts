import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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

router.delete("/:notificationId", async (req, res) => {
  const notificationId = parseInt(req.params.notificationId);
  if (isNaN(notificationId)) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }
  const [existing] = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.id, notificationId));
  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  if (existing.userId !== SESSION_USER_ID) {
    res.status(403).json({ error: "You can only delete your own notifications" });
    return;
  }
  await db
    .delete(notificationsTable)
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, SESSION_USER_ID)
      )
    );
  res.json({ success: true });
});

export default router;
