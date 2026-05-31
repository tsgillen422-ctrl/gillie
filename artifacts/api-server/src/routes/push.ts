import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { vapidPublicKey, isPushConfigured } from "../lib/push";

const router = Router();

router.get("/vapid-public-key", (_req, res) => {
  if (!isPushConfigured() || !vapidPublicKey) {
    res.status(503).json({ error: "Push notifications are not configured" });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
});

router.post("/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    res.status(400).json({ error: "Invalid push subscription" });
    return;
  }

  const userId = currentUserId(req);

  const existing = await db
    .select({ userId: pushSubscriptionsTable.userId })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .limit(1);

  if (existing.length > 0 && existing[0].userId !== userId) {
    res
      .status(409)
      .json({ error: "This push endpoint is registered to another account" });
    return;
  }

  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh, auth },
    });

  res.json({ success: true });
});

router.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string") {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }
  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, endpoint),
        eq(pushSubscriptionsTable.userId, currentUserId(req)),
      ),
    );
  res.json({ success: true });
});

export default router;
