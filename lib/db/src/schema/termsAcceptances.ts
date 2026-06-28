import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const termsAcceptancesTable = pgTable("terms_acceptances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  version: text("version").notNull(),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
});

export type TermsAcceptance = typeof termsAcceptancesTable.$inferSelect;
