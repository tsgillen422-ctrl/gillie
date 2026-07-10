import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { postsTable } from "./posts";

// Tags ("with @someone") attached to posts. Exactly one of taggedUserId /
// taggedBusinessId is set per row. status lifecycle:
//   pending  -> tagged user has tag-approval enabled; not shown anywhere yet
//   approved -> shows on the tagged user's profile Tagged tab + post tag line
//   hidden   -> tagged user hid it from their profile; tag line still shows
// Removing a tag deletes the row entirely — the post itself is never touched.
export const postTagsTable = pgTable("post_tags", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  taggedUserId: integer("tagged_user_id").references(() => usersTable.id),
  taggedBusinessId: integer("tagged_business_id"),
  taggedByUserId: integer("tagged_by_user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("approved"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  postUserUnique: uniqueIndex("post_tags_post_user_unique").on(t.postId, t.taggedUserId),
}));

export const insertPostTagSchema = createInsertSchema(postTagsTable).omit({ id: true, createdAt: true });
export type InsertPostTag = z.infer<typeof insertPostTagSchema>;
export type PostTag = typeof postTagsTable.$inferSelect;
