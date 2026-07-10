---
name: Post tagging & mentions privacy
description: Visibility rules for post tags (approved/hidden/pending) and mention markup; surfaces that must be gated.
---

# Post tagging & @mentions

- Mention markup stored in post/comment content: `@[Name](user:ID)` and `@[Name](business:ID)`; rendered client-side by `MentionText` (dhl-app `src/lib/mentions.tsx`).
- Tag statuses: `pending` (awaiting tagged user's approval), `approved` (public), `hidden`, `removed`.

## Visibility rules (server-authoritative)
- **Hidden tags are visible ONLY to the tagged user themselves** — not the post author, not anyone else. Stricter than Facebook semantics, chosen deliberately given this app's privacy-leak history. Enforced in `getVisibleTagsForPost(postId, viewerId)`; every caller MUST pass the viewer id or hidden tags leak.
- **Why:** "Hide" is a privacy action by the tagged person; showing the tag to the author defeats the point.
- `GET /tags/user/:userId` (Tagged profile tab) must apply the symmetric block check itself — `canViewPost` only gates friends-audience visibility, so community posts from blocked authors leak without an explicit blockedIds filter (same pattern as posts.ts feed).

## How to apply
- Any NEW surface that renders tags (search, notifications previews, share sheets, mobile app) must go through `getVisibleTagsForPost` with the viewer, and any tagged-posts listing must repeat the block + demo-user + canViewPost gauntlet.
- Tag approval settings live under Settings → Privacy → Tagging & Mentions (`/settings/tagging`).
