---
name: ImageLightbox in-modal menus
description: Rules for adding menus/confirm UI inside the custom ImageLightbox portal (dhl-app)
---

ImageLightbox is a custom `createPortal` modal at `z-[100]` (not Radix Dialog).

- **Do not use Radix DropdownMenu/AlertDialog inside it.** Their content portals render at `z-50`, which is *behind* the `z-[100]` lightbox. Build in-modal menus/confirm as plain absolutely-positioned divs instead.
  **Why:** discovered when adding a three-dots Delete menu to gallery photos — a Radix menu would have been invisible behind the overlay.

- **Keep modal side effects (`document.body.style.overflow`, focus-on-open, focus restore) in a `useEffect` that depends ONLY on `open`.** Put Escape/Tab keyboard handling in a *separate* effect that may depend on inner state (menuOpen/confirmOpen) but performs no focus/scroll side effects.
  **Why:** coupling the side-effect effect to inner menu state makes every menu toggle run cleanup → restores focus to the opener and briefly unsets body scroll while the modal is still open. Flagged by code review.

- Tab focus trap must query focusable elements live (`container.querySelectorAll`) so dynamically-rendered menu/confirm buttons are included. The component is shared by ClickableImage (feed/map/catches/message-thread) — keep new props optional/backward-compatible.
