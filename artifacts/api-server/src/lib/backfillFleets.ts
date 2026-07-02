import { db } from "@workspace/db";
import { usersTable, boatsTable } from "@workspace/db";
import { and, isNotNull, notInArray } from "drizzle-orm";
import { logger } from "./logger";

/**
 * One-time-ish startup backfill: any user who set up a boat before My Fleet
 * existed (users.boatName populated) but has no rows in the boats table gets
 * that boat migrated into their fleet as the Primary Boat. Idempotent — users
 * who already have fleet rows are skipped.
 */
export async function backfillFleets(): Promise<void> {
  try {
    const usersWithBoats = await db
      .selectDistinct({ userId: boatsTable.userId })
      .from(boatsTable);
    const excludeIds = usersWithBoats.map((r) => r.userId);

    const legacy = await db
      .select()
      .from(usersTable)
      .where(
        excludeIds.length
          ? and(isNotNull(usersTable.boatName), notInArray(usersTable.id, excludeIds))
          : isNotNull(usersTable.boatName)
      );

    let created = 0;
    for (const u of legacy) {
      if (!u.boatName || !u.boatName.trim()) continue;
      await db.insert(boatsTable).values({
        userId: u.id,
        name: u.boatName,
        boatType: u.boatType ?? "speedboat",
        color: u.boatColor ?? "#3b82f6",
        brand: u.boatBrand,
        model: u.boatModel,
        year: u.boatYear,
        photoUrl: u.boatPhotoUrl,
        neon: u.boatNeon ?? false,
        flag: u.boatFlag ?? false,
        accent: u.boatAccent,
        isPrimary: true,
      });
      created++;
    }
    if (created > 0) logger.info({ created }, "backfillFleets: migrated legacy boats into fleets");
  } catch (err) {
    logger.error({ err }, "backfillFleets failed");
  }
}
