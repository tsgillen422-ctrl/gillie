---
name: Story editor (full-screen)
description: Layering, coordinate, and compositing decisions for the Snapchat-style story editor
---

- **Radix portals vs full-screen overlays:** any full-screen editor portal above z-50 hides Radix Select/Popover content (ui components default `z-50`). Pass a higher z class (e.g. `z-[110]`) on the Content, or avoid portals. Also unmount any parent Radix Dialog while a full-screen overlay is up, or every tap dismisses it as an "outside" interaction.
  **Why:** More-sheet selects rendered behind the z-[105] editor; earlier camera-close bug had the same portal-dismiss root cause.
- **Sticker coordinates are stage-relative, not image-rect-relative.** The viewer renders StickerLayer over the whole media container (object-contain), so the editor must too — repositioning them relative to the photo rect would shift every existing story.
- **Camera live filters are preview-only CSS.** StoryCamera applies filter css to the `<video>` only; the captured JPEG is always unfiltered and the chosen filter index rides through AddStoryDialog into StoryEditor's `initialFilterIdx`. Swipe detection on the preview must skip `button,input` targets or the zoom slider triggers filter changes.
- **Drawings are flattened at post time; filters stay metadata.** Photo drawing strokes (normalized to stage) are composited onto the natural-size image by mapping the object-contain rect, re-uploaded as JPEG. filterCss is stored, never baked, so it must always pass the server allowlist regex.
- **Pinch-rotate:** normalize the atan2 delta to the shortest arc (±π wrap) or rotation jumps ~360° when fingers cross the seam.
- Music was intentionally excluded (no licensed catalog); crop deferred.
- **AR face lenses (MediaPipe) are baked; color filters stay CSS.** FaceLandmarker wasm+model are self-hosted under `public/mediapipe` (loaded via BASE_URL — CDN-free for the Capacitor app); lens drawings on the overlay canvas ARE composited into the captured JPEG, unlike filterCss.
  **How to apply:** video + overlay canvas must share ONE transform wrapper (selfie mirror + CSS-zoom fallback) so live view and capture math stay aligned; capture crops the sensor frame to the stage aspect then the center 1/cssZoom region, and draws the overlay's matching center region under the same mirrored ctx.
- **Camera resolution must be requested LANDSCAPE-order** (width 1920, height 1080). Portrait-order ideals (1080x1920) make iOS/WebKit pick a small center-cropped mode → severely zoomed-in "1x" preview (user-reported bug). WebKit auto-rotates frames for portrait; object-cover handles the rest.
- **Camera video mode records the RAW stream** (MediaRecorder, mp4-first mime pick, mic requested just-in-time at record start, silent fallback if denied). Filters ride as CSS metadata (viewer applies filterCss to video too); lenses must be forced off in video mode since they can't be baked into video — never show a preview effect the recording won't have. Guard record-start across the mic-prompt await with stream token + identity checks.
- **Beauty "filters" are CSS approximations** (slight blur + brightness/contrast), not AR skin smoothing; all filter css must keep to the server FILTER_CSS_RE charset `[a-z0-9().,%\s-]` (no hex colors, no url()).
