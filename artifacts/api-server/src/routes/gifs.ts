import { Router } from "express";

const router = Router();

router.get("/search", async (req, res) => {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GIF search is not configured yet." });
  }
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: "24",
      rating: "pg-13",
      bundle: "messaging_non_clips",
    });
    const url = q
      ? `https://api.giphy.com/v1/gifs/search?${params.toString()}&q=${encodeURIComponent(q)}`
      : `https://api.giphy.com/v1/gifs/trending?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ error: "Couldn't reach the GIF service." });
    }
    const body = (await response.json()) as { data?: any[] };
    const results = (body.data ?? [])
      .map((g) => {
        const images = g?.images ?? {};
        const full = images.downsized?.url || images.original?.url || images.fixed_height?.url;
        const preview = images.fixed_width_small?.url || images.fixed_height_small?.url || images.preview_gif?.url || full;
        if (!full || !preview) return null;
        return { id: String(g.id), url: full as string, previewUrl: preview as string };
      })
      .filter((g): g is { id: string; url: string; previewUrl: string } => g !== null);
    res.json(results);
  } catch {
    res.status(502).json({ error: "Couldn't reach the GIF service." });
  }
});

export default router;
