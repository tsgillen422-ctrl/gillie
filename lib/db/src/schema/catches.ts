import { pgTable, serial, integer, text, real, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const catchesTable = pgTable("catches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  // Which lake community the catch belongs to; 1 (Dale Hollow) for legacy rows.
  lakeId: integer("lake_id").notNull().default(1),
  species: text("species").notNull(),
  weight: real("weight"),
  length: real("length"),
  notes: text("notes"),
  bait: text("bait"),
  locationName: text("location_name"),
  imageUrl: text("image_url"),
  lat: real("lat"),
  lng: real("lng"),
  isPrivate: boolean("is_private").notNull().default(false),
  isMature: boolean("is_mature").notNull().default(false),
  caughtAt: timestamp("caught_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Social interactions on catches mirror the post tables (post_likes /
// post_comments / saved_posts) so catch log entries behave like normal posts.
export const catchLikesTable = pgTable("catch_likes", {
  id: serial("id").primaryKey(),
  catchId: integer("catch_id").notNull().references(() => catchesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  reaction: text("reaction").notNull().default("heart"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userCatchUnique: uniqueIndex("catch_likes_catch_user_unique").on(t.catchId, t.userId),
}));

export const catchCommentsTable = pgTable("catch_comments", {
  id: serial("id").primaryKey(),
  catchId: integer("catch_id").notNull().references(() => catchesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  isMature: boolean("is_mature").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const savedCatchesTable = pgTable("saved_catches", {
  id: serial("id").primaryKey(),
  catchId: integer("catch_id").notNull().references(() => catchesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userCatchUnique: uniqueIndex("saved_catches_catch_user_unique").on(t.catchId, t.userId),
}));

export const insertCatchSchema = createInsertSchema(catchesTable).omit({ id: true, createdAt: true });
export type InsertCatch = z.infer<typeof insertCatchSchema>;
export type Catch = typeof catchesTable.$inferSelect;
export type CatchLike = typeof catchLikesTable.$inferSelect;
export type CatchComment = typeof catchCommentsTable.$inferSelect;
export type SavedCatch = typeof savedCatchesTable.$inferSelect;
