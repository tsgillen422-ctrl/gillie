import { pgTable, serial, integer, text, real, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// A user-managed business listing. Users create/update their own listings;
// each stays "pending" until an admin approves it, after which it appears
// publicly in the Businesses tab and on the map.
// A user may own MULTIPLE businesses (e.g. marina + campground + rentals).
export const businessProfilesTable = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  // Multi-lake: which lake this business belongs to (@workspace/lake-config).
  lakeId: integer("lake_id").notNull().default(1),
  businessName: text("business_name").notNull(),
  // Free-text business type (e.g. "Marina", "Fishing Guide", or anything custom).
  businessType: text("business_type").notNull(),
  description: text("description"),
  // Branding for the social-style profile page.
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
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

// Users following a business — its posts appear in their "Following" feed.
export const businessFollowsTable = pgTable("business_follows", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessProfilesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  bizUserUnique: uniqueIndex("business_follows_business_user_unique").on(t.businessId, t.userId),
}));

// One review per user per business (1-5 stars + optional text).
export const businessReviewsTable = pgTable("business_reviews", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessProfilesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  rating: integer("rating").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  bizReviewerUnique: uniqueIndex("business_reviews_business_user_unique").on(t.businessId, t.userId),
}));

export type BusinessFollow = typeof businessFollowsTable.$inferSelect;
export type BusinessReview = typeof businessReviewsTable.$inferSelect;

export const insertBusinessProfileSchema = createInsertSchema(businessProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
