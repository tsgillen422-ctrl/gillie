import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const catchesTable = pgTable("catches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  species: text("species").notNull(),
  weight: real("weight"),
  length: real("length"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  lat: real("lat"),
  lng: real("lng"),
  isPrivate: boolean("is_private").notNull().default(false),
  caughtAt: timestamp("caught_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCatchSchema = createInsertSchema(catchesTable).omit({ id: true, createdAt: true });
export type InsertCatch = z.infer<typeof insertCatchSchema>;
export type Catch = typeof catchesTable.$inferSelect;
