import { db } from "@workspace/db";
import {
  usersTable,
  conversationsTable,
  conversationParticipantsTable,
  messagesTable,
  notificationsTable,
} from "@workspace/db";
import { count, eq, inArray } from "drizzle-orm";
import { clearDemoData, seedDemoData, seedNewUserExtras } from "../lib/demoData";

async function main() {
  await clearDemoData();
  await seedDemoData();

  const [tester] = await db
    .insert(usersTable)
    .values({ username: "seedcheck_tester2", displayName: "Seed Tester 2" })
    .returning({ id: usersTable.id });
  if (!tester) throw new Error("no tester");

  await seedNewUserExtras(tester.id);

  // Capture the welcome conversation id for the tester.
  const myConvIds = (
    await db
      .select({ conversationId: conversationParticipantsTable.conversationId })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.userId, tester.id))
  ).map((r) => r.conversationId);
  console.log("tester welcome convs:", myConvIds);

  // Now clear demo data — host is deleted; orphan cleanup should run.
  await clearDemoData();

  // Assertions: the welcome conversation + its participants + the message alert
  // should be gone.
  let leftoverConvs = 0;
  if (myConvIds.length) {
    const [c1] = await db
      .select({ v: count() })
      .from(conversationsTable)
      .where(inArray(conversationsTable.id, myConvIds));
    leftoverConvs = c1?.v ?? 0;
  }
  const [parts] = await db
    .select({ v: count() })
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, tester.id));
  const [msgAlerts] = await db
    .select({ v: count() })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, tester.id));
  console.log("after clear -> leftover welcome convs:", leftoverConvs);
  console.log("after clear -> tester participant rows:", parts?.v);
  console.log("after clear -> tester notifications (system/friend kept, message gone):");
  const notifs = await db
    .select({ type: notificationsTable.type, count: count() })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, tester.id))
    .groupBy(notificationsTable.type);
  console.log(JSON.stringify(notifs));
  console.log("total tester notifs:", msgAlerts?.v);

  // Cleanup tester + reseed demo for the live preview/dev DB.
  await db.delete(notificationsTable).where(eq(notificationsTable.userId, tester.id));
  await db.delete(usersTable).where(eq(usersTable.id, tester.id));
  const res = await seedDemoData();
  console.log("reseed:", res);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
