---
name: DHL app layout shell
description: How the AppLayout shell sizes pages and how floating action buttons must be structured
---

# DHL app layout shell

## `<main>` must be a grid container
In `AppLayout.tsx`, the `<main>` wrapper around the routed page must use `grid` for display
(currently `flex-1 grid relative overflow-hidden min-h-0`).

**Why:** Every page root uses `h-full` (CSS `height: 100%`). A percentage height does not reliably
resolve against a flex-grown parent (`flex-1` + `min-h-0`), so the page root collapsed shorter than
`main`, leaving an empty gray band above the bottom nav (and breaking inner `flex-1 overflow-y-auto`
scroll regions). Making `main` a grid container stretches its single child to a definite track
height, so `h-full` resolves correctly.

**How to apply:** Keep `main` as grid. If you ever switch it back to block/flex, page roots will need
to become `flex-1 min-h-0` instead of `h-full`, or the gap returns. `main` must also stay `relative`
because FABs/overlays anchor to it.

## Floating action buttons: wrap, don't apply absolute on the Button
Put `absolute bottom-6 right-6 z-20` on a wrapping `<div>`, with the shadcn `<Button>` inside it
(see the feed page FAB). Applying the absolute-position classes directly on the `<Button>` rendered
it off-screen / mispositioned (class-composition quirk with the Button variants). The catches FAB
had this bug; matching the feed wrapper-div pattern fixed it.
