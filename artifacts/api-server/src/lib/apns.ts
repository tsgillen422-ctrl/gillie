import { ApnsClient, Notification } from "apns2";
import { db, nativePushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { PushPayload } from "./push";

const teamId = process.env.APNS_TEAM_ID;
const keyId = process.env.APNS_KEY_ID;
// The .p8 key contents. Allow literal "\n" sequences (common when stored as a
// single-line secret) by converting them back to real newlines.
const signingKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
const bundleId = process.env.APNS_BUNDLE_ID ?? "app.dalehollowlake";
const production = process.env.APNS_PRODUCTION === "true";

let client: ApnsClient | null = null;

if (teamId && keyId && signingKey) {
  client = new ApnsClient({
    team: teamId,
    keyId,
    signingKey,
    defaultTopic: bundleId,
    host: production ? "api.push.apple.com" : "api.sandbox.push.apple.com",
  });
  logger.info(
    { production, bundleId },
    "APNs native push configured",
  );
} else {
  logger.warn(
    "APNs is not configured (missing APNS_TEAM_ID / APNS_KEY_ID / APNS_PRIVATE_KEY). Native push notifications are disabled.",
  );
}

export const isApnsConfigured = (): boolean => client !== null;

// APNs failure reasons that mean the device token is permanently invalid and
// should be pruned so we stop sending to it.
const DEAD_TOKEN_REASONS = new Set([
  "BadDeviceToken",
  "Unregistered",
  "DeviceTokenNotForTopic",
  "ExpiredToken",
]);

/**
 * Send a native (APNs) push to every device token registered for a user.
 * Dead tokens are pruned automatically. No-op when APNs is unconfigured.
 */
export async function sendApnsToUser(
  userId: number,
  payload: PushPayload,
): Promise<void> {
  if (!client) return;

  const tokens = await db
    .select()
    .from(nativePushTokensTable)
    .where(eq(nativePushTokensTable.userId, userId));

  if (tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (row) => {
      try {
        const note = new Notification(row.token, {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
          topic: bundleId,
          data: { url: payload.url, type: payload.type },
        });
        await client!.send(note);
      } catch (err) {
        const reason = (err as { reason?: string }).reason;
        if (reason && DEAD_TOKEN_REASONS.has(reason)) {
          await db
            .delete(nativePushTokensTable)
            .where(eq(nativePushTokensTable.id, row.id));
        } else {
          logger.warn({ err, userId }, "Failed to send APNs notification");
        }
      }
    }),
  );
}
