---
name: DHL api-spec codegen + counts gotchas
description: Non-obvious traps when adding endpoints to lib/api-spec (orval) and maintaining denormalized counts in api-server
---

# Inline request bodies collide in codegen

When adding a POST/PATCH operation to `lib/api-spec/openapi.yaml`, do NOT define the
`requestBody` schema inline. Orval generates a `<OperationId>Body` type in BOTH the
react-client and zod outputs, and `lib/api-zod/src/index.ts` re-exports both with
`export *`, producing TS2308 "already exported a member" during `typecheck:libs`.

**How to apply:** Define a named component schema under `components/schemas`
(e.g. `ReactionInput`) and `$ref` it from the requestBody — matches the existing
pattern (`CommentInput`, `PostInput`). Then `pnpm --filter @workspace/api-spec run codegen`.

# Seeded like/reaction counts are NOT backed by join-table rows

`posts.like_count` (and pin like counts) are seeded with inflated demo numbers that
have NO corresponding rows in `post_likes`. So maintaining the count by recomputing
`COUNT(*)` from the join table collapses the seeded number to ~0/1 the moment a user
interacts — a visible regression that makes posts look unpopular.

**Why:** demo realism depends on those inflated counts.
**How to apply:** maintain these counters with a delta (`+1` on add, `-1` on remove,
0 on changing reaction type), clamped with `GREATEST(col + delta, 0)`. Do not "fix
drift" by recomputing from the join table unless you also backfill real rows.
