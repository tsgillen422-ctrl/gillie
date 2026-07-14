import { pgTable, serial, integer, text, real, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
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
  // Social-profile customization -------------------------------------------
  // Accent color for the profile page (hex like "#0d9488"); null = app default.
  themeColor: text("theme_color"),
  // Amenity keys from the shared catalog (e.g. "fuel", "restaurant", "boat_ramp").
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  // Instagram-style highlight circles the owner curates.
  highlights: jsonb("highlights")
    .$type<{ id: string; label: string; icon: string; imageUrl?: string | null }[]>()
    .notNull()
    .default([]),
  // One pinned featured banner (announcement/event/special) shown atop the profile.
  featured: jsonb("featured").$type<{ title: string; text?: string | null; type: string } | null>().default(null),
  // Featured products/services (short strings the owner lists).
  products: jsonb("products").$type<string[]>().notNull().default([]),
  // Structured weekly hours for "Open now / Closes at…" (24h "HH:MM" strings).
  // Keys: mon..sun; null value = closed that day; column null = not set (free-text `hours` only).
  hoursStructured: jsonb("hours_structured")
    .$type<Record<string, { open: string; close: string } | null> | null>()
    .default(null),
  // pending | approved | rejected
  status: text("status").notNull().default("pending"),
  // Admin moderation flags — both hide the business from public listings/map
  // while preserving all data. isSuspended = admin enforcement action (owner
  // sees a "suspended" notice); isHidden = quietly removed from search/map
  // without a visible penalty (e.g. duplicate listing, spam prevention).
  isSuspended: boolean("is_suspended").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Users who "saved" (hearted) a business for quick access.
export const businessSavesTable = pgTable("business_saves", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessProfilesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  bizSaveUnique: uniqueIndex("business_saves_business_user_unique").on(t.businessId, t.userId),
}));

export type BusinessSave = typeof businessSavesTable.$inferSelect;

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
