import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { clerkClient } from "@clerk/express";
import { db, conversationParticipantsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger";
import { provisionLocalUser } from "../middlewares/auth";

const WS_PATH = "/api/ws";

type AuthedSocket = WebSocket & { localUserId?: number };

// Guard against cross-site WebSocket hijacking: the browser sends Clerk cookies
// on the upgrade automatically, so we only honor upgrades whose Origin matches
// the host we're being reached at. Non-browser clients (no Origin) are allowed.
function isAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Authenticate the websocket handshake using the Clerk session cookie the
// browser sends with the upgrade request (same-origin), then resolve it to the
// local app user (just-in-time provisioning a row on first contact, mirroring
// the REST requireAuth path). Returns null when the connection is unauthenticated.
async function resolveLocalUserId(req: IncomingMessage): Promise<number | null> {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    const host = req.headers.host ?? "localhost";
    const requestState = await clerkClient.authenticateRequest(
      new Request(`https://${host}${req.url ?? ""}`, { headers }),
    );
    const clerkUserId = requestState.toAuth()?.userId;
    if (!clerkUserId) return null;
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkUserId),
    });
    if (user) return user.id;
    const provisioned = await provisionLocalUser(clerkUserId);
    return provisioned.id;
  } catch {
    return null;
  }
}

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
    if (!isAllowedOrigin(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    void (async () => {
      const localUserId = await resolveLocalUserId(req);
      if (localUserId == null) {
        // Don't accept connections we can't authenticate.
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        (ws as AuthedSocket).localUserId = localUserId;
        wss.emit("connection", ws, req);
      });
    })();
  });

  wss.on("connection", (ws: AuthedSocket) => {
    ws.on("message", (raw) => {
      void (async () => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg?.type === "subscribe" && typeof msg.conversationId === "number") {
            // Only let authenticated callers subscribe to conversations they belong to.
            if (
              ws.localUserId != null &&
              (await isParticipant(msg.conversationId, ws.localUserId))
            ) {
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
