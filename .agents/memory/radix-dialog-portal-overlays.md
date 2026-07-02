---
name: Full-screen portal overlays over a Radix Dialog
description: Overlays portaled to document.body while a Radix Dialog is open get dismissed as "outside" taps; how to layer them safely
---

Any full-screen overlay rendered via createPortal to document.body while a Radix Dialog is open (e.g. the story camera over AddStoryDialog) is OUTSIDE DialogContent, so every tap on it fires the dialog's outside-interaction dismissal — the dialog closes and unmounts the overlay ("app closes when I tap the button").

**Why:** Radix DismissableLayer treats any pointer-down outside DialogContent as a dismiss request, and modal dialogs also set `pointer-events: none` on body, which portaled children inherit.

**How to apply:** when an overlay flag is open: (1) on DialogContent, `preventDefault()` in `onPointerDownOutside` + `onInteractOutside`, and make `onEscapeKeyDown` close only the overlay; (2) put `pointer-events-auto` on the overlay's portal root. Handlers must no-op when the overlay is closed so normal dismissal still works. Related: no Radix portals inside the z-[100] lightbox (see imagelightbox-modal-menus.md).
