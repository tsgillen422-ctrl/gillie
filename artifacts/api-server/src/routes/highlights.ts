import { Router } from "express";
import { db } from "@workspace/db";
import {
  storiesTable,
  highlightsTable,
  highlightStoriesTable,
} from "@workspace/db";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { getStoryFriendIds, getExcludedAuthorIds } from "./stories";

const router = Router();

function formatHighlight(h: typeof highlightsTable.$inferSelect, storyCount: number) {
  return {
    id: h.id,
    userId: h.userId,
    title: h.title,
    coverUrl: h.coverUrl,
    storyCount,
    createdAt: h.createdAt.toISOString(),
  };
}

function formatHighlightStory(s: typeof highlightStoriesTable.$inferSelect) {
  return {
    id: s.id,
    highlightId: s.highlightId,
    mediaType: s.mediaType,
    mediaUrl: s.mediaUrl,
    text: s.text,
    bgColor: s.bgColor,
    caption: s.caption,
    placeName: s.placeName,
    filterCss: s.filterCss,
    stickers: s.stickers ?? null,
    storyCreatedAt: s.storyCreatedAt.toISOString(),
  };
}

// Whether the viewer may see this highlight. Mirrors story privacy: excluded
// authors (blocked/muted/hidden demo) are always off-limits, and highlights
// containing any friends-only story require friend access.
export async function canViewerAccessHighlight(
  viewerId: number,
  highlight: typeof highlightsTable.$inferSelect,
): Promise<boolean> {
  if (highlight.userId === viewerId) return true;
  const excluded = await getExcludedAuthorIds(viewerId);
  if (excluded.includes(highlight.userId)) return false;
  if (highlight.visibility === "friends") {
    const friendIds = await getStoryFriendIds(viewerId);
    if (!friendIds.includes(highlight.userId)) return false;
  }
  return true;
}

// A user's highlights, filtered for the viewer. Used by /users/:userId/highlights.
export async function getUserHighlightsForViewer(viewerId: number, targetId: number) {
  const excluded = await getExcludedAuthorIds(viewerId);
  if (targetId !== viewerId && excluded.includes(targetId)) return null;
  const conds = [eq(highlightsTable.userId, targetId)];
  if (targetId !== viewerId) {
    const friendIds = await getStoryFriendIds(viewerId);
    if (!friendIds.includes(targetId)) conds.push(eq(highlightsTable.visibility, "community"));
  }
  const highlights = await db
    .select()
    .from(highlightsTable)
    .where(and(...conds))
    .orderBy(desc(highlightsTable.createdAt));
  if (!highlights.length) return [];
  const counts = await db
    .select({ highlightId: highlightStoriesTable.highlightId, value: sql<number>`count(*)::int` })
    .from(highlightStoriesTable)
    .where(inArray(highlightStoriesTable.highlightId, highlights.map((h) => h.id)))
    .groupBy(highlightStoriesTable.highlightId);
  const countMap = new Map(counts.map((c) => [c.highlightId, c.value]));
  return highlights.map((h) => formatHighlight(h, countMap.get(h.id) ?? 0));
}

router.post("/", async (req, res) => {
  const uid = currentUserId(req);
  const { title, storyIds } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || title.trim().length > 50) {
    return res.status(400).json({ error: "Highlights need a title (max 50 characters)" });
  }
  if (!Array.isArray(storyIds) || !storyIds.length || storyIds.length > 20 || storyIds.some((id) => !Number.isInteger(id))) {
    return res.status(400).json({ error: "Pick 1-20 of your stories" });
  }
  // Only the author's own stories can be snapshotted into a highlight.
  const stories = await db
    .select()
    .from(storiesTable)
    .where(and(inArray(storiesTable.id, storyIds), eq(storiesTable.userId, uid)))
    .orderBy(asc(storiesTable.createdAt));
  if (!stories.length) return res.status(400).json({ error: "No matching stories to highlight" });

  // Strictest source visibility wins: one friends-only story makes the whole
  // highlight friends-only.
  const visibility = stories.some((s) => s.visibility === "friends") ? "friends" : "community";
  const cover = stories.find((s) => s.mediaType === "photo" && s.mediaUrl) ?? stories[0];

  const [highlight] = await db
    .insert(highlightsTable)
    .values({ userId: uid, title: title.trim(), coverUrl: cover.mediaUrl ?? null, visibility })
    .returning();
  await db.insert(highlightStoriesTable).values(
    stories.map((s) => ({
      highlightId: highlight.id,
      mediaType: s.mediaType,
      mediaUrl: s.mediaUrl,
      text: s.text,
      bgColor: s.bgColor,
      caption: s.caption,
      placeName: s.placeName,
      filterCss: s.filterCss,
      stickers: s.stickers,
      storyCreatedAt: s.createdAt,
    })),
  );
  res.status(201).json(formatHighlight(highlight, stories.length));
});

router.get("/:highlightId", async (req, res) => {
  const uid = currentUserId(req);
  const highlightId = parseInt(req.params.highlightId);
  if (isNaN(highlightId)) return res.status(400).json({ error: "Invalid highlight id" });
  const highlight = await db.query.highlightsTable.findFirst({ where: eq(highlightsTable.id, highlightId) });
  if (!highlight || !(await canViewerAccessHighlight(uid, highlight))) {
    return res.status(404).json({ error: "Highlight not found" });
  }
  const stories = await db
    .select()
    .from(highlightStoriesTable)
    .where(eq(highlightStoriesTable.highlightId, highlightId))
    .orderBy(asc(highlightStoriesTable.storyCreatedAt));
  res.json(stories.map(formatHighlightStory));
});

router.delete("/:highlightId", async (req, res) => {
  const uid = currentUserId(req);
  const highlightId = parseInt(req.params.highlightId);
  if (isNaN(highlightId)) return res.status(400).json({ error: "Invalid highlight id" });
  const highlight = await db.query.highlightsTable.findFirst({ where: eq(highlightsTable.id, highlightId) });
  if (!highlight) return res.status(404).json({ error: "Highlight not found" });
  if (highlight.userId !== uid) return res.status(403).json({ error: "You can only delete your own highlights" });
  await db.delete(highlightStoriesTable).where(eq(highlightStoriesTable.highlightId, highlightId));
  await db.delete(highlightsTable).where(eq(highlightsTable.id, highlightId));
  res.status(204).end();
});

export default router;
