import { pgTable, text, serial, boolean, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  location: text("location"),
  hometown: text("hometown"),
  birthday: text("birthday"),
  relationshipStatus: text("relationship_status"),
  gender: text("gender"),
  work: text("work"),
  isOnline: boolean("is_online").notNull().default(false),
  isOnWater: boolean("is_on_water").notNull().default(false),
  isBusiness: boolean("is_business").notNull().default(false),
  currentLat: real("current_lat"),
  currentLng: real("current_lng"),
  lastSeen: timestamp("last_seen"),
  boatName: text("boat_name"),
  boatColor: text("boat_color").notNull().default("#3b82f6"),
  boatType: text("boat_type").notNull().default("speedboat"),
  boatNeon: boolean("boat_neon").notNull().default(false),
  boatFlag: boolean("boat_flag").notNull().default(false),
  boatAccent: text("boat_accent"),
  interests: text("interests").array(),
  shareLocation: boolean("share_location").notNull().default(true),
  requireFollowApproval: boolean("require_follow_approval").notNull().default(false),
  showFollowers: boolean("show_followers").notNull().default(true),
  showFriends: boolean("show_friends").notNull().default(true),
  followerSeeLocation: boolean("follower_see_location").notNull().default(true),
  followerSeePosts: boolean("follower_see_posts").notNull().default(true),
  followerSendMessages: boolean("follower_send_messages").notNull().default(true),
  showMatureContent: boolean("show_mature_content").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  followerCount: serial("follower_count"),
  followingCount: serial("following_count"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuspended: boolean("is_suspended").notNull().default(false),
  warningCount: integer("warning_count").notNull().default(0),
  waiverAcceptedAt: timestamp("waiver_accepted_at"),
  waiverVersion: text("waiver_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
