import { db } from "@workspace/db";
import {
  usersTable,
  blocksTable,
  friendRequestsTable,
  businessProfilesTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { createNotifications } from "./notify";

// Mention markup inserted by the composer autocomplete:
//   @[Display Name](user:123)  or  @[Business Name](business:45)
const MENTION_RE = /@\[([^\]]{1,80})\]\((user|business):(\d+)\)/g;

export interface ParsedMention {
  kind: "user" | "business";
  id: number;
  name: string;
}

/** Extract mention tokens from a piece of text (deduped by kind+id). */
export function parseMentions(text: string | null | undefined): ParsedMention[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const kind = m[2] as "user" | "business";
    const id = parseInt(m[3]);
    if (!Number.isInteger(id)) continue;
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, id, name: m[1] });
  }
  return out.slice(0, 20);
}

/** True when a and b block each other in either direction. */
export async function isBlockedEitherWay(a: number, b: number): Promise<boolean> {
  const row = await db.query.blocksTable.findFirst({
    where: or(
      and(eq(blocksTable.blockerId, a), eq(blocksTable.blockedId, b)),
      and(eq(blocksTable.blockerId, b), eq(blocksTable.blockedId, a)),
    ),
  });
  return !!row;
}

/** Mutual friendship = accepted follow rows in BOTH directions. */
export async function areMutualFriends(a: number, b: number): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    db.query.friendRequestsTable.findFirst({
      where: and(
        eq(friendRequestsTable.followerId, a),
        eq(friendRequestsTable.followeeId, b),
        eq(friendRequestsTable.status, "accepted"),
      ),
    }),
    db.query.friendRequestsTable.findFirst({
      where: and(
        eq(friendRequestsTable.followerId, b),
        eq(friendRequestsTable.followeeId, a),
        eq(friendRequestsTable.status, "accepted"),
      ),
    }),
  ]);
  return !!ab && !!ba;
}

/** Privacy gate shared by tagging and mentions: 'everyone' | 'friends' | 'none'. */
export async function passesAudiencePrivacy(
  actorId: number,
  target: { id: number },
  setting: string | null | undefined,
): Promise<boolean> {
  if (actorId === target.id) return true;
  const level = setting === "friends" || setting === "none" ? setting : "everyone";
  if (level === "none") return false;
  if (await isBlockedEitherWay(actorId, target.id)) return false;
  if (level === "friends") return areMutualFriends(actorId, target.id);
  return true;
}

/**
 * Validate parsed user mentions against each target's mentionPrivacy + blocks.
 * Returns the user ids that may actually be notified. Business mentions are
 * validated to approved businesses; their owners get the notification.
 */
export async function resolveMentionRecipients(
  actorId: number,
  mentions: ParsedMention[],
): Promise<{ userIds: number[]; businessOwnerIds: number[] }> {
  const userIds = mentions.filter((m) => m.kind === "user").map((m) => m.id);
  const businessIds = mentions.filter((m) => m.kind === "business").map((m) => m.id);

  const allowedUsers: number[] = [];
  if (userIds.length) {
    const users = await db.query.usersTable.findMany({
      where: inArray(usersTable.id, userIds),
    });
    for (const u of users) {
      if (u.id === actorId) continue;
      if (await passesAudiencePrivacy(actorId, u, u.mentionPrivacy)) {
        allowedUsers.push(u.id);
      }
    }
  }

  const ownerIds: number[] = [];
  if (businessIds.length) {
    const bizRows = await db.query.businessProfilesTable.findMany({
      where: and(
        inArray(businessProfilesTable.id, businessIds),
        eq(businessProfilesTable.status, "approved"),
      ),
    });
    for (const b of bizRows) {
      if (b.userId === actorId) continue;
      if (await isBlockedEitherWay(actorId, b.userId)) continue;
      if (!ownerIds.includes(b.userId)) ownerIds.push(b.userId);
    }
  }

  return { userIds: allowedUsers, businessOwnerIds: ownerIds };
}

/** Fire mention notifications for a post caption or comment. */
export async function notifyMentions(opts: {
  actorId: number;
  actorName: string;
  text: string | null | undefined;
  type: "mention" | "comment_mention";
  relatedId: number; // post id
}): Promise<void> {
  const mentions = parseMentions(opts.text);
  if (!mentions.length) return;
  const { userIds, businessOwnerIds } = await resolveMentionRecipients(opts.actorId, mentions);
  const recipients = [...new Set([...userIds, ...businessOwnerIds])];
  if (!recipients.length) return;
  const noun = opts.type === "comment_mention" ? "a comment" : "a post";
  await createNotifications(
    recipients.map((userId) => ({
      userId,
      type: opts.type,
      message: `${opts.actorName} mentioned you in ${noun}`,
      relatedId: opts.relatedId,
    })),
  );
}
