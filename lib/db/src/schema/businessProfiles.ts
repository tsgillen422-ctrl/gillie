import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// A user-managed business listing. Users create/update their own profile;
// it stays "pending" until an admin approves it, after which it appears
// publicly in the Businesses tab and on the map.
export const businessProfilesTable = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id),
  // Multi-lake: which lake this business belongs to (@workspace/lake-config).
  lakeId: integer("lake_id").notNull().default(1),
  businessName: text("business_name").notNull(),
  // Free-text business type (e.g. "Marina", "Fishing Guide", or anything custom).
  businessType: text("business_type").notNull(),
  description: text("description"),
  // Array of photo URLs (object storage paths like /api/storage/...).
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  phone: text("phone"),
  website: text("website"),
  hours: text("hours"),
  lat: real("lat"),
  lng: real("lng"),
  serviceArea: text("service_area"),
  // pending | approved | rejected
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
