import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const pinsTable = pgTable("pins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  type: text("type").notNull().default("other"),
  title: text("title").notNull(),
  description: text("description"),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pinLikesTable = pgTable("pin_likes", {
  id: serial("id").primaryKey(),
  pinId: integer("pin_id").notNull().references(() => pinsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPinSchema = createInsertSchema(pinsTable).omit({ id: true, createdAt: true, likeCount: true });
export type InsertPin = z.infer<typeof insertPinSchema>;
export type Pin = typeof pinsTable.$inferSelect;
