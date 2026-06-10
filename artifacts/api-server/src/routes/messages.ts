import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, conversationsTable, conversationParticipantsTable, messagesTable, messageReactionsTable } from "@workspace/db";
import { eq, and, ne, desc, gt, inArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { broadcastToConversation } from "../lib/realtime";
import { createNotifications } from "../lib/notify";

const router = Router();

async function isParticipant(conversationId: number, userId: number) {
  const row = await db.query.conversationParticipantsTable.findFirst({
    where: and(
      eq(conversationParticipantsTable.conversationId, conversationId),
      eq(conversationParticipantsTable.userId, userId)
    ),
  });
  return Boolean(row);
}

const ALLOWED_MESSAGE_REACTIONS = ["heart", "fish", "boat", "fire"] as const;

function emptyReactionCounts() {
  return { heart: 0, fish: 0, boat: 0, fire: 0 } as Record<string, number>;
}

// Builds per-message reaction counts and the current user's own reaction.
async function reactionsForMessages(messageIds: number[], uid: number) {
  const counts = new Map<number, Record<string, number>>();
  const mine = new Map<number, string>();
  if (!messageIds.length) return { counts, mine };
  const rows = await db
    .select()
    .from(messageReactionsTable)
    .where(inArray(messageReactionsTable.messageId, messageIds));
  for (const r of rows) {
    if (!ALLOWED_MESSAGE_REACTIONS.includes(r.reaction as any)) continue;
    let c = counts.get(r.messageId);
    if (!c) {
      c = emptyReactionCounts();
      counts.set(r.messageId, c);
    }
    c[r.reaction] = (c[r.reaction] ?? 0) + 1;
    if (r.userId === uid) mine.set(r.messageId, r.reaction);
  }
  return { counts, mine };
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isOnline: u.isOnline,
    isBusiness: u.isBusiness,
    currentLat: null,
    currentLng: null,
    lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null,
    boatName: u.boatName,
    boatColor: u.boatColor,
    shareLocation: u.shareLocation,
    followerCount: 0,
    followingCount: 0,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/conversations", async (req, res) => {
  const myParticipations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, currentUserId(req)));

  const convos = await Promise.all(
    myParticipations.map(async (p) => {
      const conv = await db.query.conversationsTable.findFirst({
        where: eq(conversationsTable.id, p.conversationId),
      });
      if (!conv) return null;

      const myLastReadAt = p.lastReadAt;

      const participants = await db
        .select()
        .from(conversationParticipantsTable)
        .where(eq(conversationParticipantsTable.conversationId, conv.id));

      const participantUsers = await Promise.all(
        participants.map((pp) =>
          db.query.usersTable.findFirst({ where: eq(usersTable.id, pp.userId) })
        )
      );

      const lastMessage = await db.query.messagesTable.findFirst({
        where: eq(messagesTable.conversationId, conv.id),
        orderBy: [desc(messagesTable.createdAt)],
      });

      const unreadCount = await db
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conv.id),
            ne(messagesTable.senderId, currentUserId(req)),
            ...(myLastReadAt ? [gt(messagesTable.createdAt, myLastReadAt)] : [])
          )
        );

      let formattedLastMessage = null;
      if (lastMessage) {
        const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, lastMessage.senderId) });
        formattedLastMessage = {
          id: lastMessage.id,
          conversationId: lastMessage.conversationId,
          senderId: lastMessage.senderId,
          sender: sender ? formatUser(sender) : null,
          content: lastMessage.content,
          mediaUrl: lastMessage.mediaUrl,
          mediaType: lastMessage.mediaType,
          read: lastMessage.read,
          createdAt: lastMessage.createdAt.toISOString(),
        };
      }

      return {
        id: conv.id,
        name: conv.name,
        isGroup: conv.isGroup,
        participants: participantUsers.filter(Boolean).map((u) => formatUser(u!)),
        lastMessage: formattedLastMessage,
        unreadCount: unreadCount.length,
        createdAt: conv.createdAt.toISOString(),
      };
    })
  );

  res.json(convos.filter(Boolean));
});

router.post("/conversations", async (req, res) => {
  const { participantId } = req.body;

  // Reuse an existing 1:1 conversation between the two users if one exists,
  // so repeatedly opening "Message" with someone doesn't spawn duplicates.
  const myParticipations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, currentUserId(req)));

  for (const p of myParticipations) {
    const conv = await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.id, p.conversationId),
    });
    if (!conv || conv.isGroup) continue;
    const members = await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, conv.id));
    const ids = members.map((m) => m.userId).sort((a, b) => a - b);
    if (
      ids.length === 2 &&
      ids[0] === Math.min(currentUserId(req), participantId) &&
      ids[1] === Math.max(currentUserId(req), participantId)
    ) {
      const participantUsers = await Promise.all([
        db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) }),
        db.query.usersTable.findFirst({ where: eq(usersTable.id, participantId) }),
      ]);
      return res.status(200).json({
        id: conv.id,
        name: conv.name,
        isGroup: conv.isGroup,
        participants: participantUsers.filter(Boolean).map((u) => formatUser(u!)),
        lastMessage: null,
        unreadCount: 0,
        createdAt: conv.createdAt.toISOString(),
      });
    }
  }

  const [conv] = await db.insert(conversationsTable).values({}).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: currentUserId(req) },
    { conversationId: conv.id, userId: participantId },
  ]);
  const participantUsers = await Promise.all([
    db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) }),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, participantId) }),
  ]);
  res.status(201).json({
    id: conv.id,
    name: conv.name,
    isGroup: conv.isGroup,
    participants: participantUsers.filter(Boolean).map((u) => formatUser(u!)),
    lastMessage: null,
    unreadCount: 0,
    createdAt: conv.createdAt.toISOString(),
  });
});

router.post("/conversations/group", async (req, res) => {
  const { name, participantIds } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Group name is required" });
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: "At least one participant is required" });
  }
  const uniqueIds = Array.from(
    new Set(
      participantIds
        .map((id: unknown) => parseInt(String(id)))
        .filter((id: number) => !isNaN(id) && id !== currentUserId(req))
    )
  );
  const [conv] = await db
    .insert(conversationsTable)
    .values({ name: String(name).trim(), isGroup: true })
    .returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: currentUserId(req) },
    ...uniqueIds.map((id) => ({ conversationId: conv.id, userId: id })),
  ]);
  const allIds = [currentUserId(req), ...uniqueIds];
  const participantUsers = await Promise.all(
    allIds.map((id) => db.query.usersTable.findFirst({ where: eq(usersTable.id, id) }))
  );
  res.status(201).json({
    id: conv.id,
    name: conv.name,
    isGroup: conv.isGroup,
    participants: participantUsers.filter(Boolean).map((u) => formatUser(u!)),
    lastMessage: null,
    unreadCount: 0,
    createdAt: conv.createdAt.toISOString(),
  });
});

router.get("/conversations/:conversationId", async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  if (!(await isParticipant(conversationId, currentUserId(req)))) {
    return res.status(403).json({ error: "You are not a participant in this conversation" });
  }

  const participants = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, conversationId));
  const otherParticipants = participants.filter((p) => p.userId !== currentUserId(req));

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(messagesTable.createdAt);

  const { counts, mine } = await reactionsForMessages(msgs.map((m) => m.id), currentUserId(req));

  const formatted = await Promise.all(
    msgs.map(async (m) => {
      const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.senderId) });
      const read =
        otherParticipants.length > 0 &&
        otherParticipants.every(
          (p) => p.lastReadAt != null && p.lastReadAt >= m.createdAt
        );
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: sender ? formatUser(sender) : null,
        content: m.content,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        read,
        reactions: counts.get(m.id) ?? emptyReactionCounts(),
        myReaction: mine.get(m.id) ?? null,
        createdAt: m.createdAt.toISOString(),
      };
    })
  );
  res.json(formatted);
});

router.post("/conversations/:conversationId/read", async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  if (!(await isParticipant(conversationId, currentUserId(req)))) {
    return res.status(403).json({ error: "You are not a participant in this conversation" });
  }
  await db
    .update(conversationParticipantsTable)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        eq(conversationParticipantsTable.userId, currentUserId(req))
      )
    );
  res.json({ success: true });
});

router.post("/conversations/:conversationId", async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  if (!(await isParticipant(conversationId, currentUserId(req)))) {
    return res.status(403).json({ error: "You are not a participant in this conversation" });
  }
  const { content, mediaUrl, mediaType } = req.body;
  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId, senderId: currentUserId(req), content: content ?? "", mediaUrl: mediaUrl ?? null, mediaType: mediaType ?? null })
    .returning();
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) });
  broadcastToConversation(conversationId, {
    type: "message",
    conversationId,
    messageId: msg.id,
    senderId: msg.senderId,
  });

  // Notify every other participant (in-app + push). Fire-and-forget so a
  // notification failure never blocks sending the message.
  const recipients = await db
    .select({ userId: conversationParticipantsTable.userId })
    .from(conversationParticipantsTable)
    .where(
      and(
        eq(conversationParticipantsTable.conversationId, conversationId),
        ne(conversationParticipantsTable.userId, msg.senderId),
      ),
    );
  if (recipients.length) {
    const senderName = sender?.displayName || sender?.username || "Someone";
    const trimmed = (msg.content ?? "").trim();
    const preview = trimmed
      ? trimmed.length > 80
        ? `${trimmed.slice(0, 80)}…`
        : trimmed
      : msg.mediaType === "video"
        ? "Sent a video"
        : msg.mediaType === "image"
          ? "Sent a photo"
          : "Sent you a message";
    createNotifications(
      recipients.map((r) => ({
        userId: r.userId,
        type: "message",
        message: `${senderName}: ${preview}`,
        relatedId: conversationId,
      })),
    ).catch(() => {});
  }

  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    sender: sender ? formatUser(sender) : null,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
    read: msg.read,
    reactions: emptyReactionCounts(),
    myReaction: null,
    createdAt: msg.createdAt.toISOString(),
  });
});

router.delete("/conversations/:conversationId", async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  if (Number.isNaN(conversationId)) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, conversationId),
  });
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (!(await isParticipant(conversationId, currentUserId(req)))) {
    res.status(403).json({ error: "You can only delete conversations you're part of" });
    return;
  }
  await db.transaction(async (tx) => {
    const convMsgs = await tx
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId));
    const msgIds = convMsgs.map((m) => m.id);
    if (msgIds.length) {
      await tx.delete(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds));
    }
    await tx.delete(messagesTable).where(eq(messagesTable.conversationId, conversationId));
    await tx
      .delete(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, conversationId));
    await tx.delete(conversationsTable).where(eq(conversationsTable.id, conversationId));
  });
  res.json({ success: true });
});

router.delete("/:messageId", async (req, res) => {
  const messageId = parseInt(req.params.messageId);
  const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (msg.senderId !== currentUserId(req)) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }
  await db.delete(messageReactionsTable).where(eq(messageReactionsTable.messageId, messageId));
  await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  res.json({ success: true });
});

router.post("/:messageId/react", async (req, res) => {
  const uid = currentUserId(req);
  const messageId = parseInt(req.params.messageId);
  if (Number.isNaN(messageId)) return res.status(400).json({ error: "Invalid message id" });
  const reaction = String(req.body?.reaction || "");
  if (!ALLOWED_MESSAGE_REACTIONS.includes(reaction as any)) {
    return res.status(400).json({ error: "Invalid reaction" });
  }
  const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
  if (!msg) return res.status(404).json({ error: "Message not found" });
  if (!(await isParticipant(msg.conversationId, uid))) {
    return res.status(403).json({ error: "You are not a participant in this conversation" });
  }

  const existing = await db.query.messageReactionsTable.findFirst({
    where: and(eq(messageReactionsTable.messageId, messageId), eq(messageReactionsTable.userId, uid)),
  });
  if (existing && existing.reaction === reaction) {
    await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing.id));
  } else if (existing) {
    await db.update(messageReactionsTable).set({ reaction }).where(eq(messageReactionsTable.id, existing.id));
  } else {
    await db
      .insert(messageReactionsTable)
      .values({ messageId, userId: uid, reaction })
      .onConflictDoUpdate({ target: [messageReactionsTable.messageId, messageReactionsTable.userId], set: { reaction } });
  }

  const { counts, mine } = await reactionsForMessages([messageId], uid);
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, msg.senderId) });
  const otherParticipants = (
    await db
      .select()
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, msg.conversationId))
  ).filter((p) => p.userId !== msg.senderId);
  const read =
    otherParticipants.length > 0 &&
    otherParticipants.every((p) => p.lastReadAt != null && p.lastReadAt >= msg.createdAt);

  broadcastToConversation(msg.conversationId, {
    type: "message",
    conversationId: msg.conversationId,
    messageId: msg.id,
    senderId: msg.senderId,
  });

  res.json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    sender: sender ? formatUser(sender) : null,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
    read,
    reactions: counts.get(messageId) ?? emptyReactionCounts(),
    myReaction: mine.get(messageId) ?? null,
    createdAt: msg.createdAt.toISOString(),
  });
});

export default router;
