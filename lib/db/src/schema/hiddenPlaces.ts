import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const hiddenPlacesTable = pgTable("hidden_places", {
  id: serial("id").primaryKey(),
  placeKey: text("place_key").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHiddenPlaceSchema = createInsertSchema(hiddenPlacesTable).omit({ id: true, createdAt: true });
export type InsertHiddenPlace = z.infer<typeof insertHiddenPlaceSchema>;
export type HiddenPlace = typeof hiddenPlacesTable.$inferSelect;
