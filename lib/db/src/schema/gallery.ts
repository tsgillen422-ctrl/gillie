import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const galleryItemsTable = pgTable("gallery_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull().default("image"),
  caption: text("caption"),
  // Optional link to a boat in the owner's fleet ("memories" on the boat profile).
  boatId: integer("boat_id"),
  isMature: boolean("is_mature").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGalleryItemSchema = createInsertSchema(galleryItemsTable).omit({ id: true, createdAt: true });
export type InsertGalleryItem = z.infer<typeof insertGalleryItemSchema>;
export type GalleryItem = typeof galleryItemsTable.$inferSelect;
