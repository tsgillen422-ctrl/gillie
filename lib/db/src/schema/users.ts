import { pgTable, text, serial, boolean, real, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
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
  // Apple 5.1.2: location is only published while the user has manually checked
  // in. This timestamp is the single source of truth for "actively sharing" —
  // sharing is active iff it is non-null AND in the future. Cleared on stop /
  // expiry / cold launch. shareLocation is kept in sync only for legacy reads.
  locationSharingExpiresAt: timestamp("location_sharing_expires_at"),
  boatName: text("boat_name"),
  boatColor: text("boat_color").notNull().default("#3b82f6"),
  boatType: text("boat_type").notNull().default("speedboat"),
  boatBrand: text("boat_brand"),
  boatModel: text("boat_model"),
  boatYear: integer("boat_year"),
  boatPhotoUrl: text("boat_photo_url"),
  homeMarina: text("home_marina"),
  // Whether the profile shows the "My Boat" card. Lets non-boat-owners hide
  // the boat section entirely while keeping every other feature.
  showBoat: boolean("show_boat").notNull().default(true),
  boatNeon: boolean("boat_neon").notNull().default(false),
  boatFlag: boolean("boat_flag").notNull().default(false),
  boatAccent: text("boat_accent"),
  interests: text("interests").array(),
  // Pinned "Favorite Things" shown on the profile: [{ label, value }, ...]
  // e.g. { label: "Favorite Cove", value: "Wolf River" }. Free-form, user-curated.
  favoriteThings: jsonb("favorite_things").$type<{ label: string; value: string }[]>(),
  shareLocation: boolean("share_location").notNull().default(false),
  requireFollowApproval: boolean("require_follow_approval").notNull().default(false),
  showFollowers: boolean("show_followers").notNull().default(true),
  showFriends: boolean("show_friends").notNull().default(true),
  followerSeeLocation: boolean("follower_see_location").notNull().default(true),
  followerSeePosts: boolean("follower_see_posts").notNull().default(true),
  followerSendMessages: boolean("follower_send_messages").notNull().default(true),
  showMatureContent: boolean("show_mature_content").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  demoMode: boolean("demo_mode").notNull().default(false),
  followerCount: serial("follower_count"),
  followingCount: serial("following_count"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuspended: boolean("is_suspended").notNull().default(false),
  warningCount: integer("warning_count").notNull().default(0),
  waiverAcceptedAt: timestamp("waiver_accepted_at"),
  waiverVersion: text("waiver_version"),
  // App Store / EULA: acceptance of the Terms of Service, Privacy Policy, and
  // Community Guidelines. termsVersion is compared against the current frontend
  // TERMS_VERSION; a mismatch (incl. null) re-prompts the user before app access.
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: text("terms_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
