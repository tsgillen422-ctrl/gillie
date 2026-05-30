---
name: DHL app layout shell
description: How the AppLayout shell sizes pages and how floating action buttons must be structured
---

# DHL app layout shell

## `<main>` must be `flex flex-col` (NOT `grid`)
In `AppLayout.tsx`, the `<main>` wrapper around the routed page must be
`flex-1 flex flex-col relative overflow-hidden min-h-0`.

**Why:** Every page root is `flex flex-col h-full` with an inner `flex-1 overflow-y-auto` scroll
region. `display: grid` on `main` was tried to fix an empty gray band, but `grid` parent + child
`h-full` + inner `overflow-y-auto` is a known combo where the inner region grows to its content
instead of scrolling — it killed scrolling on EVERY page (feed, pins, etc.). `flex flex-col` gives
the page root a definite height (main has a definite height from `flex-1` + `min-h-0` inside the
`h-[100dvh]` column), so `h-full` resolves AND the inner `flex-1 overflow-y-auto` scrolls. It also
fills the height so no empty gray band returns.

**How to apply:** Keep `main` as `flex flex-col`. Do NOT switch it to `grid` — that re-breaks scroll
on all pages. `main` must also stay `relative` because FABs/overlays anchor to it. If a single page
shows horizontal overflow, add `min-w-0` to that page's root (its grid/flex `min-width:auto` lets
wide children stretch it past the viewport).

## Floating action buttons: wrap, don't apply absolute on the Button
Put `absolute bottom-6 right-6 z-20` on a wrapping `<div>`, with the shadcn `<Button>` inside it
(see the feed page FAB). Applying the absolute-position classes directly on the `<Button>` rendered
it off-screen / mispositioned (class-composition quirk with the Button variants). The catches FAB
had this bug; matching the feed wrapper-div pattern fixed it.
