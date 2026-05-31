import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

let configured = false;

if (publicKey && privateKey && subject) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
} else {
  logger.warn(
    "Web push is not configured (missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT). Push notifications are disabled.",
  );
}

export const isPushConfigured = (): boolean => configured;
export const vapidPublicKey = publicKey ?? null;

export interface PushPayload {
  title: string;
  body: string;
  /** Relative in-app path to open when the notification is clicked. */
  url?: string;
  type?: string;
}

/**
 * Send a web-push notification to every subscription registered for a user.
 * Dead subscriptions (HTTP 404/410) are pruned automatically.
 */
export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<void> {
  if (!configured) return;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone — remove it so we stop trying.
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.id, sub.id));
        } else {
          logger.warn({ err, userId }, "Failed to send web push notification");
        }
      }
    }),
  );
}
