---
name: Full-screen portal overlays over a Radix Dialog
description: Overlays portaled to document.body while a Radix Dialog is open get dismissed as "outside" taps; how to layer them safely
---

Any full-screen overlay rendered via createPortal to document.body while a Radix Dialog is open (e.g. the story camera over AddStoryDialog) is OUTSIDE DialogContent, so every tap on it fires the dialog's outside-interaction dismissal — the dialog closes and unmounts the overlay ("app closes when I tap the button").

**Why:** Radix DismissableLayer treats any pointer-down outside DialogContent as a dismiss request, and modal dialogs also set `pointer-events: none` on body, which portaled children inherit.

**How to apply:** when an overlay flag is open: (1) on DialogContent, `preventDefault()` in `onPointerDownOutside` + `onInteractOutside`, and make `onEscapeKeyDown` close only the overlay; (2) put `pointer-events-auto` on the overlay's portal root; (3) **also set `modal={overlayClosed}` on the Dialog root** — the dismissal/pointer-events guards alone are NOT enough: the modal dialog's FocusScope focus trap steals focus from the overlay's inputs (typing silently fails, keyboard never opens on iOS) and its RemoveScroll lock blocks touch scrolling in the overlay (horizontal rows won't scroll). Dropping to non-modal while the overlay is open releases both; it flips back automatically when the overlay closes. Handlers must no-op when the overlay is closed so normal dismissal still works. Alternative (AddStoryDialog pattern): unmount the Dialog entirely while the overlay is up. Related: no Radix portals inside the z-[100] lightbox (see imagelightbox-modal-menus.md).
