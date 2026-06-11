import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { autoFollowDemoUsers, seedNewUserExtras } from "../lib/demoData";

// Clerk user IDs that should always have admin access. Lets the app owner
// bootstrap admin in any environment (incl. a fresh production database)
// without an existing admin to promote them.
const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type LocalUser = typeof usersTable.$inferSelect;

// Promote a configured owner to admin on login if they aren't already. Only
// writes once (when isAdmin flips), so it's a no-op for everyone else.
async function ensureOwnerAdmin(user: LocalUser): Promise<LocalUser> {
  if (user.isAdmin || !user.clerkId || !ADMIN_CLERK_IDS.includes(user.clerkId)) {
    return user;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ isAdmin: true })
    .where(eq(usersTable.id, user.id))
    .returning();
  logger.info(
    { userId: user.id, clerkId: user.clerkId },
    "Auto-promoted configured owner to admin",
  );
  return updated ?? user;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      localUserId?: number;
    }
  }
}

// Create a local app user the first time we see a given Clerk account, so the
// rest of the app (which keys everything off the integer users.id) keeps working.
export async function provisionLocalUser(clerkUserId: string) {
  const cu = await clerkClient.users.getUser(clerkUserId);
  const email =
    cu.primaryEmailAddress?.emailAddress ??
    cu.emailAddresses?.[0]?.emailAddress ??
    "";
  const rawBase = (email.split("@")[0] || cu.firstName || "lakefan").toLowerCase();
  const base = rawBase.replace(/[^a-z0-9_]/g, "").slice(0, 20) || "lakefan";

  let username = base;
  for (let attempt = 0; attempt < 25; attempt++) {
    const taken = await db.query.usersTable.findFirst({
      where: eq(usersTable.username, username),
    });
    if (!taken) break;
    username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const displayName =
    [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim() || username;

  const inserted = await db
    .insert(usersTable)
    .values({
      clerkId: clerkUserId,
      username,
      displayName,
      avatarUrl: cu.imageUrl ?? null,
    })
    .onConflictDoNothing({ target: usersTable.clerkId })
    .returning();
  if (inserted[0]) {
    // Populate the new user's map and feed with the demo community (no-op once
    // demo data is removed). Best-effort: never block sign-up on this.
    try {
      await autoFollowDemoUsers(inserted[0].id);
    } catch (err) {
      logger.warn({ err, userId: inserted[0].id }, "auto-follow demo users failed");
    }
    // Give the new user a welcome conversation + notifications (Messages/Alerts
    // tabs). Best-effort: never block sign-up on this.
    try {
      await seedNewUserExtras(inserted[0].id);
    } catch (err) {
      logger.warn({ err, userId: inserted[0].id }, "seed new user extras failed");
    }
    return inserted[0];
  }

  // Lost a race: another concurrent request provisioned this Clerk user first.
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkUserId),
  });
  if (existing) return existing;
  throw new Error("Failed to provision local user");
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkUserId),
    });
    if (!user) user = await provisionLocalUser(clerkUserId);
    user = await ensureOwnerAdmin(user);
    req.localUserId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}

// Resolve the authenticated local user id inside a handler. Safe to call only
// after requireAuth has run on the route.
export function currentUserId(req: Request): number {
  const id = req.localUserId;
  if (!id) {
    throw new Error("currentUserId() called on a route without requireAuth");
  }
  return id;
}
