import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Custom photo/video albums on user profiles. Media items live in
// gallery_items and reference an album via gallery_items.album_id; deleting an
// album detaches its items (album_id -> null) instead of deleting media.
export const albumsTable = pgTable("albums", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  // Optional explicit cover; when null the newest item in the album is used.
  coverUrl: text("cover_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlbumSchema = createInsertSchema(albumsTable).omit({ id: true, createdAt: true });
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type Album = typeof albumsTable.$inferSelect;
