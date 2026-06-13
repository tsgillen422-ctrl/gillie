import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { enableDemoModeForReviewer } from "../lib/demoData";

// Clerk user IDs that should always have admin access. Lets the app owner
// bootstrap admin in any environment (incl. a fresh production database)
// without an existing admin to promote them.
const ADMIN_CLERK_IDS = (process.env.ADMIN_CLERK_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// The App Store reviewer account. This email bypasses email verification (the
// Clerk user is pre-created with a verified email + password by
// ensureReviewerClerkAccount, so the reviewer signs IN without a code) and runs
// in Demo Mode (a fully populated demo world, isolated so regular users never
// see it). It is a STANDARD non-admin user — Apple reviewers must see the app
// exactly as a regular user, so Demo Mode grants content visibility only, never
// admin access.
// NOTE: must be a real, non-reserved TLD — Clerk rejects RFC 2606 reserved
// TLDs (.test/.example/.invalid/.localhost) with form_param_format_invalid.
export const REVIEWER_EMAIL = "apple-review@gillie.app";

function isReviewerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === REVIEWER_EMAIL;
}

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

  const reviewer = isReviewerEmail(email);

  const inserted = await db
    .insert(usersTable)
    .values({
      clerkId: clerkUserId,
      username,
      displayName,
      avatarUrl: cu.imageUrl ?? null,
      // The App Store reviewer is a STANDARD (non-admin) user — Apple reviewers
      // must see the app exactly as a regular user. They only get Demo Mode so
      // the world is populated for testing; Demo Mode grants no admin access.
      isAdmin: false,
      demoMode: reviewer,
    })
    .onConflictDoNothing({ target: usersTable.clerkId })
    .returning();
  if (inserted[0]) {
    // Only the reviewer (Demo Mode) gets the demo world preloaded: a populated
    // map/feed plus a welcome conversation. Regular users get nothing demo, so
    // they never see Demo Mode. Best-effort: never block sign-up on this.
    if (reviewer) {
      try {
        await enableDemoModeForReviewer(inserted[0].id);
      } catch (err) {
        logger.warn({ err, userId: inserted[0].id }, "enable demo mode for reviewer failed");
      }
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

// Demote the App Store reviewer (Demo Mode) back to a standard user if an older
// account row was created with admin. Apple reviewers must have no admin access;
// only writes once (when isAdmin flips off), so it's a no-op afterwards.
async function ensureReviewerNotAdmin(user: LocalUser): Promise<LocalUser> {
  if (!user.demoMode || !user.isAdmin) return user;
  const [updated] = await db
    .update(usersTable)
    .set({ isAdmin: false })
    .where(eq(usersTable.id, user.id))
    .returning();
  logger.info({ userId: user.id }, "Demoted App Store reviewer to standard user");
  return updated ?? user;
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
    user = await ensureReviewerNotAdmin(user);
    healReviewerDemo(user);
    req.localUserId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}

// Re-seed the reviewer's demo world if it was wiped after their account was
// created (e.g. an admin cleared demo data). Throttled + fire-and-forget so it
// never adds latency to the reviewer's requests; only runs for Demo Mode users.
const reviewerHealAt = new Map<number, number>();
const REVIEWER_HEAL_INTERVAL_MS = 5 * 60 * 1000;

function healReviewerDemo(user: LocalUser): void {
  if (!user.demoMode) return;
  const last = reviewerHealAt.get(user.id) ?? 0;
  if (Date.now() - last < REVIEWER_HEAL_INTERVAL_MS) return;
  reviewerHealAt.set(user.id, Date.now());
  enableDemoModeForReviewer(user.id).catch((err) => {
    logger.warn({ err, userId: user.id }, "reviewer demo self-heal failed");
  });
}

// Pre-create the App Store reviewer's Clerk account with a verified email +
// password so they can sign IN without an email-verification code. Best-effort
// and idempotent: runs on boot, no-ops if the account exists or the password
// secret is unset. Backend-created Clerk users have verified emails by default.
export async function ensureReviewerClerkAccount(): Promise<void> {
  const password = process.env.APPLE_REVIEW_PASSWORD;
  if (!password) {
    logger.warn(
      "APPLE_REVIEW_PASSWORD not set — skipping App Store reviewer account bootstrap",
    );
    return;
  }
  try {
    const res = await clerkClient.users.getUserList({ emailAddress: [REVIEWER_EMAIL] });
    const list = Array.isArray(res) ? res : (res?.data ?? []);
    if (list.length === 0) {
      await clerkClient.users.createUser({
        emailAddress: [REVIEWER_EMAIL],
        password,
        skipPasswordChecks: true,
      });
      logger.info("Created App Store reviewer Clerk account (verified email)");
      return;
    }

    // The account already exists — self-heal it so the reviewer can ALWAYS sign
    // in with just email + password and never gets a verification code. A
    // partially-provisioned account (e.g. created by a prior sign-up attempt)
    // can have an unverified email or no password; in that state Clerk falls
    // back to an email_code first factor, mailing a code to the reviewer's
    // unreachable mailbox. Re-running on every boot keeps the account usable.
    const user = list[0];

    // 1. Ensure the password matches the current secret.
    try {
      await clerkClient.users.updateUser(user.id, {
        password,
        skipPasswordChecks: true,
      });
    } catch (err) {
      logger.warn({ err }, "reviewer password sync failed");
    }

    // 2. Ensure the email address is verified (so password is a usable factor).
    const emailObj = (user.emailAddresses ?? []).find(
      (e) => e.emailAddress.trim().toLowerCase() === REVIEWER_EMAIL,
    );
    if (emailObj && emailObj.verification?.status !== "verified") {
      try {
        await clerkClient.emailAddresses.updateEmailAddress(emailObj.id, {
          verified: true,
        });
      } catch (err) {
        logger.warn({ err }, "reviewer email verification sync failed");
      }
    }

    // 3. Strip any enrolled second factor defensively — the reviewer mailbox /
    // phone are unreachable, so MFA would lock them out. No-op when none exists.
    try {
      await clerkClient.users.disableUserMFA(user.id);
    } catch {
      // No MFA enrolled (the common case) — ignore.
    }

    logger.info("Synced App Store reviewer Clerk account");
  } catch (err) {
    logger.error({ err }, "ensureReviewerClerkAccount failed");
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
