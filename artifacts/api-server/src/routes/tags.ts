import { Router } from "express";
import { db } from "@workspace/db";
import {
  postTagsTable,
  postsTable,
  usersTable,
  businessProfilesTable,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getHiddenDemoUserIds } from "../lib/demoData";
import { formatPost, canViewPost } from "./posts";

const router = Router();

export async function formatTag(t: typeof postTagsTable.$inferSelect) {
  let taggedUser = null;
  let taggedBusiness = null;
  if (t.taggedUserId) {
    const u = await db.query.usersTable.findFirst({ where: eq(usersTable.id, t.taggedUserId) });
    if (u) {
      taggedUser = {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        isBusiness: u.isBusiness,
      };
    }
  }
  if (t.taggedBusinessId) {
    const b = await db.query.businessProfilesTable.findFirst({
      where: eq(businessProfilesTable.id, t.taggedBusinessId),
    });
    if (b) {
      taggedBusiness = {
        id: b.id,
        businessName: b.businessName,
        businessType: b.businessType,
        logoUrl: b.logoUrl ?? null,
        verified: b.status === "approved",
      };
    }
  }
  return {
    id: t.id,
    postId: t.postId,
    taggedUserId: t.taggedUserId,
    taggedBusinessId: t.taggedBusinessId,
    taggedByUserId: t.taggedByUserId,
    status: t.status,
    taggedUser,
    taggedBusiness,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Tags shown on a post: approved + hidden (hidden only leaves the profile). */
export async function getVisibleTagsForPost(postId: number) {
  const rows = await db.query.postTagsTable.findMany({
    where: and(eq(postTagsTable.postId, postId), inArray(postTagsTable.status, ["approved", "hidden"])),
  });
  return Promise.all(rows.map(formatTag));
}

// Posts where a user is tagged (approved only) — powers the profile Tagged tab.
// Gated on post visibility, blocks (via canViewPost's friend logic), and the
// demo-user curtain.
router.get("/user/:userId", async (req, res) => {
  const uid = currentUserId(req);
  const targetId = parseInt(req.params.userId);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId !== uid) {
    const hidden = await getHiddenDemoUserIds(uid);
    if (hidden.includes(targetId)) return res.json([]);
  }
  const tagRows = await db.query.postTagsTable.findMany({
    where: and(eq(postTagsTable.taggedUserId, targetId), eq(postTagsTable.status, "approved")),
    orderBy: desc(postTagsTable.createdAt),
  });
  if (!tagRows.length) return res.json([]);
  const posts = await db.query.postsTable.findMany({
    where: inArray(postsTable.id, tagRows.map((t) => t.postId)),
  });
  const byId = new Map(posts.map((p) => [p.id, p]));
  // Hide posts from demo authors the viewer can't see.
  const hiddenAuthors = new Set(await getHiddenDemoUserIds(uid));
  const out: any[] = [];
  for (const t of tagRows) {
    const post = byId.get(t.postId);
    if (!post) continue;
    if (hiddenAuthors.has(post.userId)) continue;
    if (!(await canViewPost(uid, post))) continue;
    out.push(await formatPost(post, uid));
  }
  res.json(out);
});

// The caller's own pending tags (approval queue).
router.get("/pending", async (req, res) => {
  const uid = currentUserId(req);
  const rows = await db.query.postTagsTable.findMany({
    where: and(eq(postTagsTable.taggedUserId, uid), eq(postTagsTable.status, "pending")),
    orderBy: desc(postTagsTable.createdAt),
  });
  res.json(await Promise.all(rows.map(formatTag)));
});

// Approve or hide a tag of yourself. Business tags can be managed by the
// business owner.
router.patch("/:tagId", async (req, res) => {
  const uid = currentUserId(req);
  const tagId = parseInt(req.params.tagId);
  const status = req.body?.status;
  if (status !== "approved" && status !== "hidden") {
    return res.status(400).json({ error: "status must be 'approved' or 'hidden'" });
  }
  const tag = await db.query.postTagsTable.findFirst({ where: eq(postTagsTable.id, tagId) });
  if (!tag) return res.status(404).json({ error: "Tag not found" });
  let allowed = tag.taggedUserId === uid;
  if (!allowed && tag.taggedBusinessId) {
    const biz = await db.query.businessProfilesTable.findFirst({
      where: eq(businessProfilesTable.id, tag.taggedBusinessId),
    });
    allowed = biz?.userId === uid;
  }
  if (!allowed) return res.status(403).json({ error: "You can only manage tags of yourself" });
  const [updated] = await db
    .update(postTagsTable)
    .set({ status })
    .where(eq(postTagsTable.id, tagId))
    .returning();
  res.json(await formatTag(updated));
});

// Remove a tag entirely. Allowed for the tagged person (or tagged business
// owner) and for the post author who created the tag. Never touches the post.
router.delete("/:tagId", async (req, res) => {
  const uid = currentUserId(req);
  const tagId = parseInt(req.params.tagId);
  const tag = await db.query.postTagsTable.findFirst({ where: eq(postTagsTable.id, tagId) });
  if (!tag) return res.status(404).json({ error: "Tag not found" });
  let allowed = tag.taggedUserId === uid || tag.taggedByUserId === uid;
  if (!allowed && tag.taggedBusinessId) {
    const biz = await db.query.businessProfilesTable.findFirst({
      where: eq(businessProfilesTable.id, tag.taggedBusinessId),
    });
    allowed = biz?.userId === uid;
  }
  if (!allowed) return res.status(403).json({ error: "You can't remove this tag" });
  await db.delete(postTagsTable).where(eq(postTagsTable.id, tagId));
  res.json({ success: true });
});

export default router;
