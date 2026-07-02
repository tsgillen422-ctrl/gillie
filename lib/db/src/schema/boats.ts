import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// A user's fleet: one row per boat/watercraft. Exactly one boat per user should
// have isPrimary=true (enforced in the API layer, not the DB). The legacy
// users.boat* columns are kept as a denormalized copy of the user's *active*
// boat (primary by default, or the boat chosen at check-in) so the map, feed,
// and friends surfaces keep working unchanged.
export const boatsTable = pgTable("boats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  boatType: text("boat_type").notNull().default("speedboat"),
  color: text("color").notNull().default("#3b82f6"),
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  photoUrl: text("photo_url"),
  neon: boolean("neon").notNull().default(false),
  flag: boolean("flag").notNull().default(false),
  accent: text("accent"),
  notes: text("notes"),
  horsepower: integer("horsepower"),
  engineInfo: text("engine_info"),
  lengthFt: integer("length_ft"),
  favoriteMarina: text("favorite_marina"),
  favoriteCove: text("favorite_cove"),
  favoriteActivity: text("favorite_activity"),
  mods: text("mods"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBoatSchema = createInsertSchema(boatsTable).omit({ id: true, createdAt: true });
export type InsertBoat = z.infer<typeof insertBoatSchema>;
export type Boat = typeof boatsTable.$inferSelect;
