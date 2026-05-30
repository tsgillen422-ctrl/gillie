---
name: Realtime messaging websockets
description: How the message-thread realtime layer works and its constraints
---

Message threads get realtime updates over a websocket; 5s react-query polling is
kept as a fallback so messaging still works if the socket can't connect.

- Server: api-server attaches a `ws` `WebSocketServer({ noServer: true })` to the
  raw http server (index.ts uses `http.createServer(app)`), handling `upgrade`
  only for path `/api/ws` and destroying other upgrade sockets.
- The proxy DOES forward ws upgrades to the api artifact — verified that
  `ws://<host>/api/ws` connects and broadcasts arrive end-to-end.
- Client subscribes with `{type:"subscribe", conversationId}`; on a broadcast it
  invalidates the messages + conversations queries (does not patch cache directly).
- **Authz:** the subscribe handler must verify `isParticipant(conversationId,
  SESSION_USER_ID)` before registering the socket — otherwise any client can
  subscribe to arbitrary conversation IDs and leak message metadata.

**Why:** auth is single hardcoded `SESSION_USER_ID = 1` across REST + ws, so the
ws layer reuses that same identity; broadcasts are in-memory (single process), so
this won't survive horizontal scaling without a shared pub/sub.
