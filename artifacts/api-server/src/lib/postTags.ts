import { db } from "@workspace/db";
import { postTagsTable, usersTable, businessProfilesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

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

/**
 * Tags shown on a post. Approved tags are public. Hidden tags are only shown
 * to the tagged person themselves (so they can see/manage the hidden state);
 * everyone else — including the post author — no longer sees the tag line.
 */
export async function getVisibleTagsForPost(postId: number, viewerId?: number) {
  const rows = await db.query.postTagsTable.findMany({
    where: and(
      eq(postTagsTable.postId, postId),
      inArray(postTagsTable.status, ["approved", "hidden"]),
    ),
  });
  const visible = rows.filter(
    (t) => t.status === "approved" || (viewerId != null && t.taggedUserId === viewerId),
  );
  return Promise.all(visible.map(formatTag));
}
