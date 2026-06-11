---
name: Mature content gating
description: How offensive/mature content moderation + blur gating is wired, and the rule for keeping it leak-free.
---

Offensive/mature content is auto-moderated on upload (api-server `lib/moderation.ts`, AI vision/text classifier, FAILS OPEN → isMature=false on error so it never blocks uploads). Flagged rows carry `isMature` (posts, post_comments, gallery_items, catches, pins, messages). Users opt in to seeing it via `users.showMatureContent` (default false). Client blurs flagged content with `MatureGate` (reveals when `me.showMatureContent` OR per-item tap).

**Rule:** when a field is fed into `moderateContent`, every surface that renders that field must gate it when `isMature`. A leak is any moderated field shown unblurred.

**Why:** moderation is item-level (flag set if ANY text/image is offensive), so gating only the "main" field (e.g. post body) leaves offensive *title/species* visible. Compact previews are the easy miss: the conversation list renders `lastMessage` separately from the thread, so it needs its own gate AND `isMature` in the `GET /messages/conversations` serializer (lastMessage is a separate hand-built object, not the Message serializer).

**How to apply:** for any new moderated field/surface, gate ALL user-authored text+media of the flagged item, including short structural fields (pin title, catch species) and list previews. For compact previews where a blur overlay looks wrong, swap to a "Sensitive content hidden" placeholder keyed on `me.showMatureContent`. Generated types may lag — `isMature` is on the codegen Message/Comment/Catch schemas; for Post/Gallery/Pin use `(x as any).isMature`.
