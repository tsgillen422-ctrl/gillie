import { pgTable, serial, integer, text, real, timestamp, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { boatsTable } from "./boats";

// Sticker overlays rendered on top of a story. Positions are fractions of the
// story frame (0..1) so they scale to any screen.
export type StorySticker = {
  type: "location" | "weather" | "boat" | "emoji";
  x: number;
  y: number;
  data: Record<string, string | number | null>;
};

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
  // "Posted from" boat tag (optional, must be one of the author's boats).
  boatId: integer("boat_id").references(() => boatsTable.id),
  // Lake-themed filter. Photos are baked at upload; videos apply this CSS live.
  filterName: text("filter_name"),
  filterCss: text("filter_css"),
  stickers: jsonb("stickers").$type<StorySticker[]>(),
  pollQuestion: text("poll_question"),
  pollOptions: jsonb("poll_options").$type<string[]>(),
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

// One reaction per user per story; re-reacting swaps the emoji.
export const storyReactionsTable = pgTable(
  "story_reactions",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id").notNull().references(() => storiesTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("story_reactions_story_user_idx").on(t.storyId, t.userId)],
);

export const storyPollVotesTable = pgTable(
  "story_poll_votes",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id").notNull().references(() => storiesTable.id),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    optionIndex: integer("option_index").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("story_poll_votes_story_user_idx").on(t.storyId, t.userId)],
);

// Permanent story collections on a profile ("Summer 2026", "Fishing", ...).
export const highlightsTable = pgTable("highlights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  // Strictest visibility of the source stories: if ANY snapshotted story was
  // friends-only, the whole highlight requires friend access.
  visibility: text("visibility").notNull().default("friends"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Snapshot of story content, because the source story row expires after 24h.
export const highlightStoriesTable = pgTable("highlight_stories", {
  id: serial("id").primaryKey(),
  highlightId: integer("highlight_id").notNull().references(() => highlightsTable.id),
  mediaType: text("media_type").notNull(),
  mediaUrl: text("media_url"),
  text: text("text"),
  bgColor: text("bg_color"),
  caption: text("caption"),
  placeName: text("place_name"),
  filterCss: text("filter_css"),
  stickers: jsonb("stickers").$type<StorySticker[]>(),
  storyCreatedAt: timestamp("story_created_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true, createdAt: true });
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof storiesTable.$inferSelect;
export type StoryView = typeof storyViewsTable.$inferSelect;
export type StoryReaction = typeof storyReactionsTable.$inferSelect;
export type StoryPollVote = typeof storyPollVotesTable.$inferSelect;
export type Highlight = typeof highlightsTable.$inferSelect;
export type HighlightStory = typeof highlightStoriesTable.$inferSelect;
