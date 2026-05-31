import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { sendPushToUser, type PushPayload } from "./push";
import { logger } from "./logger";

/** Fire-and-forget push: never let a push failure break the calling flow. */
async function safePush(userId: number, payload: PushPayload): Promise<void> {
  try {
    await sendPushToUser(userId, payload);
  } catch (err) {
    logger.warn({ err, userId }, "Push dispatch failed (notification still saved)");
  }
}

export interface NotificationInput {
  userId: number;
  type: string;
  message: string;
  relatedId?: number | null;
}

const PUSH_TITLES: Record<string, string> = {
  friend_request: "Dale Hollow Lake",
  sos: "🚨 SOS Alert",
  warning: "Moderator notice",
  message: "New message",
  post_like: "New reaction",
  pin_like: "New reaction",
  event: "Event update",
};

function pushPayloadFor(n: NotificationInput): PushPayload {
  let url: string;
  switch (n.type) {
    case "friend_request":
      url = "/friends?tab=requests";
      break;
    case "message":
      url = n.relatedId != null ? `/messages/${n.relatedId}` : "/messages";
      break;
    case "post_like":
    case "event":
      url = "/feed";
      break;
    case "pin_like":
      url = "/pins";
      break;
    case "warning":
      url = "/settings";
      break;
    default:
      url = "/notifications";
  }
  return {
    title: PUSH_TITLES[n.type] ?? "Dale Hollow Lake",
    body: n.message,
    url,
    type: n.type,
  };
}

/** Persist a notification row and fire a web-push to the recipient. */
export async function createNotification(input: NotificationInput): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: input.userId,
    type: input.type,
    message: input.message,
    relatedId: input.relatedId ?? null,
  });
  await safePush(input.userId, pushPayloadFor(input));
}

/** Bulk variant: one DB insert, one push per recipient. */
export async function createNotifications(
  inputs: NotificationInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  await db.insert(notificationsTable).values(
    inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      message: i.message,
      relatedId: i.relatedId ?? null,
    })),
  );
  await Promise.all(
    inputs.map((i) => safePush(i.userId, pushPayloadFor(i))),
  );
}
