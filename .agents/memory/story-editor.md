---
name: Story editor (full-screen)
description: Layering, coordinate, and compositing decisions for the Snapchat-style story editor
---

- **Radix portals vs full-screen overlays:** any full-screen editor portal above z-50 hides Radix Select/Popover content (ui components default `z-50`). Pass a higher z class (e.g. `z-[110]`) on the Content, or avoid portals. Also unmount any parent Radix Dialog while a full-screen overlay is up, or every tap dismisses it as an "outside" interaction.
  **Why:** More-sheet selects rendered behind the z-[105] editor; earlier camera-close bug had the same portal-dismiss root cause.
- **Sticker coordinates are stage-relative, not image-rect-relative.** The viewer renders StickerLayer over the whole media container (object-contain), so the editor must too — repositioning them relative to the photo rect would shift every existing story.
- **Drawings are flattened at post time; filters stay metadata.** Photo drawing strokes (normalized to stage) are composited onto the natural-size image by mapping the object-contain rect, re-uploaded as JPEG. filterCss is stored, never baked, so it must always pass the server allowlist regex.
- **Pinch-rotate:** normalize the atan2 delta to the shortest arc (±π wrap) or rotation jumps ~360° when fingers cross the seam.
- Music was intentionally excluded (no licensed catalog); crop deferred.
