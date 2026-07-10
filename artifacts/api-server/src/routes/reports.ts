import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  postsTable,
  postLikesTable,
  postCommentsTable,
  eventRsvpsTable,
  savedPostsTable,
  pinsTable,
  pinLikesTable,
  pinFavoritesTable,
  reportsTable,
  catchesTable,
  catchLikesTable,
  catchCommentsTable,
  savedCatchesTable,
  businessProfilesTable,
  businessFollowsTable,
  businessReviewsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import type { Request } from "express";
import { currentUserId } from "../middlewares/auth";
import { createNotification } from "../lib/notify";

const router = Router();

const POST_REASONS = ["spam", "harassment", "inappropriate", "false_information", "illegal", "other"];
const USER_REASONS = ["spam", "harassment", "inappropriate", "impersonation", "other"];
const PIN_REASONS = ["incorrect_location", "duplicate", "unsafe_information", "inappropriate"];
const CATCH_REASONS = ["spam", "harassment", "inappropriate", "false_information", "illegal", "other"];
const BUSINESS_REASONS = ["fake_listing", "incorrect_information", "inappropriate", "spam", "other"];

function reasonsFor(targetType: string): string[] | null {
  if (targetType === "post") return POST_REASONS;
  if (targetType === "user") return USER_REASONS;
  if (targetType === "pin") return PIN_REASONS;
  if (targetType === "catch") return CATCH_REASONS;
  if (targetType === "business") return BUSINESS_REASONS;
  return null;
}

function formatUserBrief(u: typeof usersTable.$inferSelect | null | undefined) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isSuspended: u.isSuspended,
    warningCount: u.warningCount,
  };
}

function serializeReport(r: typeof reportsTable.$inferSelect) {
  return {
    id: r.id,
    reporterId: r.reporterId,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    details: r.details,
    status: r.status,
    action: r.action,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

async function requireAdmin(req: Request): Promise<boolean> {
  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.id, currentUserId(req)) });
  return !!me?.isAdmin;
}

// Resolve the user who owns the reported target (post author, pin creator, or the user itself).
async function resolveTargetOwner(targetType: string, targetId: number): Promise<number | null> {
  if (targetType === "user") return targetId;
  if (targetType === "post") {
    const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, targetId) });
    return post?.userId ?? null;
  }
  if (targetType === "pin") {
    const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, targetId) });
    return pin?.userId ?? null;
  }
  if (targetType === "catch") {
    const c = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, targetId) });
    return c?.userId ?? null;
  }
  if (targetType === "business") {
    const b = await db.query.businessProfilesTable.findFirst({ where: eq(businessProfilesTable.id, targetId) });
    return b?.userId ?? null;
  }
  return null;
}

// POST /api/reports - submit a report
router.post("/", async (req, res) => {
  const { targetType, targetId, reason, details } = req.body ?? {};
  const allowed = reasonsFor(targetType);
  if (!allowed) return res.status(400).json({ error: "Invalid report target" });
  if (!targetId || typeof targetId !== "number") {
    return res.status(400).json({ error: "Invalid target id" });
  }
  if (!reason || !allowed.includes(reason)) {
    return res.status(400).json({ error: "Invalid reason" });
  }
  if (targetType === "user") {
    const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "User not found" });
  } else if (targetType === "post") {
    const target = await db.query.postsTable.findFirst({ where: eq(postsTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "Post not found" });
  } else if (targetType === "pin") {
    const target = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "Pin not found" });
  } else if (targetType === "catch") {
    const target = await db.query.catchesTable.findFirst({ where: eq(catchesTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "Catch not found" });
  } else if (targetType === "business") {
    const target = await db.query.businessProfilesTable.findFirst({ where: eq(businessProfilesTable.id, targetId) });
    if (!target) return res.status(404).json({ error: "Business not found" });
  }
  const [report] = await db
    .insert(reportsTable)
    .values({
      reporterId: currentUserId(req),
      targetType,
      targetId,
      reason,
      details: typeof details === "string" && details.trim() ? details.trim() : null,
    })
    .returning();
  res.status(201).json(serializeReport(report));
});

// GET /api/reports - admin: list reports (optional ?status= filter)
router.get("/", async (req, res) => {
  if (!(await requireAdmin(req))) return res.status(403).json({ error: "Admin access required" });
  const status = req.query.status as string | undefined;
  const rows = status
    ? await db.select().from(reportsTable).where(eq(reportsTable.status, status)).orderBy(desc(reportsTable.createdAt))
    : await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const reporter = await db.query.usersTable.findFirst({ where: eq(usersTable.id, r.reporterId) });
      const ownerId = await resolveTargetOwner(r.targetType, r.targetId);
      const owner = ownerId
        ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, ownerId) })
        : null;
      let targetSummary: string | null = null;
      let targetExists = true;
      if (r.targetType === "post") {
        const post = await db.query.postsTable.findFirst({ where: eq(postsTable.id, r.targetId) });
        targetExists = !!post;
        targetSummary = post ? post.title || post.content?.slice(0, 120) || "(no text)" : null;
      } else if (r.targetType === "pin") {
        const pin = await db.query.pinsTable.findFirst({ where: eq(pinsTable.id, r.targetId) });
        targetExists = !!pin;
        targetSummary = pin ? pin.title || pin.description?.slice(0, 120) || "(no text)" : null;
      } else if (r.targetType === "user") {
        targetExists = !!owner;
        targetSummary = owner ? `@${owner.username}` : null;
      }
      return {
        ...serializeReport(r),
        reporter: formatUserBrief(reporter),
        targetOwner: formatUserBrief(owner),
        targetSummary,
        targetExists,
      };
    })
  );
  res.json(enriched);
});

// PATCH /api/reports/:id - admin: take action on a report
router.patch("/:id", async (req, res) => {
  if (!(await requireAdmin(req))) return res.status(403).json({ error: "Admin access required" });
  const id = parseInt(req.params.id);
  const { action } = req.body ?? {};
  const VALID = ["dismiss", "remove", "warn", "suspend"];
  if (!VALID.includes(action)) return res.status(400).json({ error: "Invalid action" });

  const report = await db.query.reportsTable.findFirst({ where: eq(reportsTable.id, id) });
  if (!report) return res.status(404).json({ error: "Report not found" });

  const ownerId = await resolveTargetOwner(report.targetType, report.targetId);

  if (action === "remove") {
    if (report.targetType === "post") {
      await db.delete(postLikesTable).where(eq(postLikesTable.postId, report.targetId));
      await db.delete(postCommentsTable).where(eq(postCommentsTable.postId, report.targetId));
      await db.delete(eventRsvpsTable).where(eq(eventRsvpsTable.postId, report.targetId));
      await db.delete(savedPostsTable).where(eq(savedPostsTable.postId, report.targetId));
      await db.delete(postsTable).where(eq(postsTable.id, report.targetId));
    } else if (report.targetType === "pin") {
      await db.delete(pinLikesTable).where(eq(pinLikesTable.pinId, report.targetId));
      await db.delete(pinFavoritesTable).where(eq(pinFavoritesTable.pinId, report.targetId));
      await db.delete(pinsTable).where(eq(pinsTable.id, report.targetId));
    } else if (report.targetType === "catch") {
      await db.delete(catchLikesTable).where(eq(catchLikesTable.catchId, report.targetId));
      await db.delete(catchCommentsTable).where(eq(catchCommentsTable.catchId, report.targetId));
      await db.delete(savedCatchesTable).where(eq(savedCatchesTable.catchId, report.targetId));
      await db.delete(catchesTable).where(eq(catchesTable.id, report.targetId));
    } else if (report.targetType === "business") {
      // No FK cascades: clear child rows and detach business posts first,
      // mirroring the DELETE /businesses/me cleanup sequence.
      await db.delete(businessFollowsTable).where(eq(businessFollowsTable.businessId, report.targetId));
      await db.delete(businessReviewsTable).where(eq(businessReviewsTable.businessId, report.targetId));
      await db.update(postsTable).set({ businessId: null }).where(eq(postsTable.businessId, report.targetId));
      await db.delete(businessProfilesTable).where(eq(businessProfilesTable.id, report.targetId));
      if (ownerId) {
        await db.update(usersTable).set({ isBusiness: false }).where(eq(usersTable.id, ownerId));
      }
    } else if (report.targetType === "user" && ownerId) {
      // Removing a reported user = suspend their account.
      await db.update(usersTable).set({ isSuspended: true }).where(eq(usersTable.id, ownerId));
    }
  } else if (action === "warn" && ownerId) {
    const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ownerId) });
    await db
      .update(usersTable)
      .set({ warningCount: (owner?.warningCount ?? 0) + 1 })
      .where(eq(usersTable.id, ownerId));
    await createNotification({
      userId: ownerId,
      type: "warning",
      message: "You have received a warning from a moderator for violating community guidelines.",
      relatedId: null,
    });
  } else if (action === "suspend" && ownerId) {
    await db.update(usersTable).set({ isSuspended: true }).where(eq(usersTable.id, ownerId));
    await createNotification({
      userId: ownerId,
      type: "warning",
      message: "Your account has been suspended by a moderator.",
      relatedId: null,
    });
  }

  const actionToOutcome: Record<string, { status: string; action: string }> = {
    dismiss: { status: "dismissed", action: "dismissed" },
    remove: { status: "resolved", action: "removed" },
    warn: { status: "resolved", action: "warned" },
    suspend: { status: "resolved", action: "suspended" },
  };
  const outcome = actionToOutcome[action];
  const [updated] = await db
    .update(reportsTable)
    .set({ status: outcome.status, action: outcome.action, resolvedAt: new Date() })
    .where(eq(reportsTable.id, id))
    .returning();
  res.json(serializeReport(updated));
});

export default router;
