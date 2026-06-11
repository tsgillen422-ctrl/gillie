import { db, friendRequestsTable } from "@workspace/db";
import { logger } from "./logger";

let done = false;

// Migration safety for the move from mutual friendship to one-way following.
// Before this change a single accepted friend_request row represented a MUTUAL
// friendship. Under the one-way model an accepted row only means
// followerId -> followeeId, so without a backfill every existing friendship
// would silently become one-directional. This idempotently inserts the missing
// reciprocal accepted row for each existing accepted pair, preserving current
// mutual relationships. New follows made after this change stay one-way.
export async function backfillReciprocalFollows(): Promise<void> {
  if (done) return;
  try {
    const rows = await db.query.friendRequestsTable.findMany();
    const existing = new Set(rows.map((r) => `${r.followerId}:${r.followeeId}`));
    const toInsert: { followerId: number; followeeId: number; status: string }[] = [];
    for (const r of rows) {
      if (r.status !== "accepted" || r.followerId === r.followeeId) continue;
      const reverseKey = `${r.followeeId}:${r.followerId}`;
      if (!existing.has(reverseKey)) {
        existing.add(reverseKey);
        toInsert.push({ followerId: r.followeeId, followeeId: r.followerId, status: "accepted" });
      }
    }
    if (toInsert.length) {
      await db.insert(friendRequestsTable).values(toInsert);
      logger.info(
        { count: toInsert.length },
        "Backfilled reciprocal follow rows to preserve existing mutual friendships"
      );
    }
    done = true;
  } catch (err) {
    logger.error({ err }, "Reciprocal follow backfill failed");
  }
}
