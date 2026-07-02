import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { backfillReciprocalFollows } from "./lib/backfillReciprocalFollows";
import { backfillFleets } from "./lib/backfillFleets";
import { startDemoPresenceRefresher, reconcileDemoUsers } from "./lib/demoData";
import { ensureReviewerClerkAccount } from "./middlewares/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
initRealtime(server);

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void backfillReciprocalFollows();
  void ensureReviewerClerkAccount();
  // Fleet backfill must finish before demo reconciliation: reconcile adds
  // extra demo boats, and a fleet row appearing first would make the backfill
  // skip migrating that user's legacy primary boat.
  void backfillFleets().then(() => reconcileDemoUsers());
  startDemoPresenceRefresher();
});
