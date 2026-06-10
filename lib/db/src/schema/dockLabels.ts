import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const dockLabelsTable = pgTable("dock_labels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  label: text("label").notNull(),
  emoji: text("emoji"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDockLabelSchema = createInsertSchema(dockLabelsTable).omit({ id: true, createdAt: true });
export type InsertDockLabel = z.infer<typeof insertDockLabelSchema>;
export type DockLabel = typeof dockLabelsTable.$inferSelect;
