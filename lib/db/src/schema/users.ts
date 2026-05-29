import { pgTable, text, serial, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  isOnline: boolean("is_online").notNull().default(false),
  isBusiness: boolean("is_business").notNull().default(false),
  currentLat: real("current_lat"),
  currentLng: real("current_lng"),
  lastSeen: timestamp("last_seen"),
  boatName: text("boat_name"),
  boatColor: text("boat_color").notNull().default("#3b82f6"),
  boatType: text("boat_type").notNull().default("speedboat"),
  shareLocation: boolean("share_location").notNull().default(true),
  followerCount: serial("follower_count"),
  followingCount: serial("following_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
