import { pgTable, serial, integer, text, real, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  // Multi-lake: which lake community this post belongs to (@workspace/lake-config).
  lakeId: integer("lake_id").notNull().default(1),
  title: text("title").notNull(),
  content: text("content").notNull(),
  postType: text("post_type").notNull().default("post"),
  eventDate: timestamp("event_date"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  photos: text("photos").array(),
  engineSetup: text("engine_setup"),
  horsepower: integer("horsepower"),
  topSpeed: real("top_speed"),
  mods: text("mods"),
  pinLat: real("pin_lat"),
  pinLng: real("pin_lng"),
  sharedPostId: integer("shared_post_id"),
  // Set when the post was published as a business (author = business owner).
  businessId: integer("business_id"),
  visibility: text("visibility").notNull().default("community"),
  likeCount: integer("like_count").notNull().default(0),
  isMature: boolean("is_mature").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollOptionsTable = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  text: text("text").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollVotesTable = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  optionId: integer("option_id").notNull().references(() => pollOptionsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  pollUserUnique: uniqueIndex("poll_votes_post_user_unique").on(t.postId, t.userId),
}));

export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  reaction: text("reaction").notNull().default("heart"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userPostUnique: uniqueIndex("post_likes_post_user_unique").on(t.postId, t.userId),
}));

export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  likeCount: integer("like_count").notNull().default(0),
  isMature: boolean("is_mature").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => postCommentsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  reaction: text("reaction").notNull().default("heart"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userCommentUnique: uniqueIndex("comment_likes_comment_user_unique").on(t.commentId, t.userId),
}));

export const eventRsvpsTable = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("going"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, likeCount: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
export type EventRsvp = typeof eventRsvpsTable.$inferSelect;
