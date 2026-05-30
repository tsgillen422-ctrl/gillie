import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { db, conversationParticipantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger";

const WS_PATH = "/api/ws";

// Matches the single hardcoded session user used across the REST routes.
const SESSION_USER_ID = 1;

async function isParticipant(conversationId: number, userId: number) {
  const row = await db.query.conversationParticipantsTable.findFirst({
    where: and(
      eq(conversationParticipantsTable.conversationId, conversationId),
      eq(conversationParticipantsTable.userId, userId)
    ),
  });
  return Boolean(row);
}

const subscribers = new Map<number, Set<WebSocket>>();

function subscribe(conversationId: number, socket: WebSocket) {
  let set = subscribers.get(conversationId);
  if (!set) {
    set = new Set();
    subscribers.set(conversationId, set);
  }
  set.add(socket);
}

function unsubscribeAll(socket: WebSocket) {
  for (const [conversationId, set] of subscribers) {
    set.delete(socket);
    if (set.size === 0) subscribers.delete(conversationId);
  }
}

export function broadcastToConversation(conversationId: number, payload: unknown) {
  const set = subscribers.get(conversationId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

export function initRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    const pathname = url.split("?")[0];
    if (pathname !== WS_PATH) {
      // Reject upgrades we don't handle so the socket isn't left dangling.
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      void (async () => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg?.type === "subscribe" && typeof msg.conversationId === "number") {
            // Only let the caller subscribe to conversations they belong to.
            if (await isParticipant(msg.conversationId, SESSION_USER_ID)) {
              subscribe(msg.conversationId, ws);
            }
          }
        } catch {
          // ignore malformed client messages
        }
      })();
    });
    ws.on("close", () => unsubscribeAll(ws));
    ws.on("error", () => unsubscribeAll(ws));
  });

  logger.info({ path: WS_PATH }, "Realtime websocket server attached");
}
