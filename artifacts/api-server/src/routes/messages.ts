import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, conversationsTable, conversationParticipantsTable, messagesTable } from "@workspace/db";
import { eq, and, ne, desc } from "drizzle-orm";

const router = Router();
const SESSION_USER_ID = 1;

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

router.get("/conversations", async (_req, res) => {
  const myParticipations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, SESSION_USER_ID));

  const convos = await Promise.all(
    myParticipations.map(async (p) => {
      const conv = await db.query.conversationsTable.findFirst({
        where: eq(conversationsTable.id, p.conversationId),
      });
      if (!conv) return null;

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
            eq(messagesTable.read, false),
            ne(messagesTable.senderId, SESSION_USER_ID)
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
  const [conv] = await db.insert(conversationsTable).values({}).returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: SESSION_USER_ID },
    { conversationId: conv.id, userId: participantId },
  ]);
  const participantUsers = await Promise.all([
    db.query.usersTable.findFirst({ where: eq(usersTable.id, SESSION_USER_ID) }),
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
        .filter((id: number) => !isNaN(id) && id !== SESSION_USER_ID)
    )
  );
  const [conv] = await db
    .insert(conversationsTable)
    .values({ name: String(name).trim(), isGroup: true })
    .returning();
  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: SESSION_USER_ID },
    ...uniqueIds.map((id) => ({ conversationId: conv.id, userId: id })),
  ]);
  const allIds = [SESSION_USER_ID, ...uniqueIds];
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
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(messagesTable.createdAt);

  const formatted = await Promise.all(
    msgs.map(async (m) => {
      const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m.senderId) });
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: sender ? formatUser(sender) : null,
        content: m.content,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      };
    })
  );
  res.json(formatted);
});

router.post("/conversations/:conversationId/read", async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  await db
    .update(messagesTable)
    .set({ read: true })
    .where(
      and(
        eq(messagesTable.conversationId, conversationId),
        ne(messagesTable.senderId, SESSION_USER_ID)
      )
    );
  res.json({ success: true });
});

router.post("/conversations/:conversationId", async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  const { content, mediaUrl, mediaType } = req.body;
  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId, senderId: SESSION_USER_ID, content: content ?? "", mediaUrl: mediaUrl ?? null, mediaType: mediaType ?? null })
    .returning();
  const sender = await db.query.usersTable.findFirst({ where: eq(usersTable.id, SESSION_USER_ID) });
  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    sender: sender ? formatUser(sender) : null,
    content: msg.content,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
    read: msg.read,
    createdAt: msg.createdAt.toISOString(),
  });
});

router.delete("/:messageId", async (req, res) => {
  const messageId = parseInt(req.params.messageId);
  const msg = await db.query.messagesTable.findFirst({ where: eq(messagesTable.id, messageId) });
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (msg.senderId !== SESSION_USER_ID) {
    res.status(403).json({ error: "You can only delete your own messages" });
    return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  res.json({ success: true });
});

export default router;
