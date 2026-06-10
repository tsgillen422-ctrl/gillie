import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const waiverAcceptancesTable = pgTable("waiver_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  version: text("version").notNull(),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
});

export type WaiverAcceptance = typeof waiverAcceptancesTable.$inferSelect;
