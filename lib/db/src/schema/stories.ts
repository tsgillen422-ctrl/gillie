import { pgTable, serial, integer, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  mediaType: text("media_type").notNull(), // photo | video | text
  mediaUrl: text("media_url"),
  text: text("text"),
  bgColor: text("bg_color"),
  caption: text("caption"),
  lat: real("lat"),
  lng: real("lng"),
  placeName: text("place_name"),
  visibility: text("visibility").notNull().default("friends"), // friends | community
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const storyViewsTable = pgTable(
  "story_views",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id").notNull().references(() => storiesTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("story_views_story_user_idx").on(t.storyId, t.userId)],
);

export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true, createdAt: true });
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof storiesTable.$inferSelect;
export type StoryView = typeof storyViewsTable.$inferSelect;
