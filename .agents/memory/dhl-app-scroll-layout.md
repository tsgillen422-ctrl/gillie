---
name: DHL app scroll layout
description: Why AppLayout's <main> must stay overflow-hidden; the page-owns-scroll convention.
---

# DHL app: page-owns-scroll convention

In `artifacts/dhl-app`, every page component owns its own scroll: its root is
`flex flex-col h-full` with either an inner `flex-1 overflow-y-auto` content pane
(feed, pins, catches, messages, search, notifications, friends, message-thread) or
`overflow-y-auto` on the root itself (profile, settings); map fills with `h-full`.

`AppLayout`'s `<main>` MUST stay `overflow-hidden min-h-0` (NOT `overflow-y-auto`).

**Why:** When `<main>` was also `overflow-y-auto`, it created a nested second scroll
container. On mobile Safari the inner page's `h-full` collapsed to content height
inside the scrollable parent, leaving dead whitespace above the bottom nav and
clipping the last feed item. Making `main` non-scrolling (overflow-hidden) + min-h-0
makes each page's own scroll the single scroll context, so it fills to the nav.

**How to apply:** Do not add scrolling to `main`. Keep new pages on the
`h-full` + own-scroll pattern rather than relying on the layout to scroll.

# Button position:absolute is overridden by hover-elevate

In this app, `Button` (shadcn) bakes `hover-elevate active-elevate-2` into its base
variants, and those utilities force `position: relative`, which OVERRIDES a
`className="absolute ..."` passed to the Button. The element stays in normal flow.

**Why it bit us:** The feed's floating "+" FAB had `className="absolute bottom-6 right-6"`
but rendered `position:relative`, so it sat in flow as a flex child, stole ~56px at the
bottom of the column, and shrank the scroll area — producing a persistent empty gray
"box" above the bottom nav (the thing the user kept circling). It also rendered
off-screen (left:-24) instead of bottom-right.

**How to apply:** To absolutely/fixed-position a Button, wrap it in a plain
`<div className="absolute ...">` (a div has no elevate utility) and keep the Button
unpositioned. Do NOT put `absolute`/`fixed` directly on a `<Button>`. The same trap
applies to any absolutely-positioned Button (e.g. close "X" buttons over media).
