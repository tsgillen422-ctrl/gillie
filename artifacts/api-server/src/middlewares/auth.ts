import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
  if (inserted[0]) return inserted[0];

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
