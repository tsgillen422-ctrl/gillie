---
name: api-client-react generated hooks
description: Conventions/gotchas when binding the orval-generated @workspace/api-client-react hooks in new screens (web or mobile).
---

# Generated hook gotchas (@workspace/api-client-react)

- **Query hooks require `queryKey` when you pass ANY query options.** Calling
  `useGetX(params, { query: { enabled } })` fails tsc with "Property 'queryKey'
  is missing". You must also pass `queryKey: getGetXQueryKey(params)` (import the
  matching `getGetXQueryKey` helper). Passing no options at all is fine.
  **Why:** orval emits `UseQueryOptions` that mark `queryKey` required; it is not
  auto-filled when you override options. **How to apply:** any new screen that
  conditionally enables a query must import + pass the queryKey helper.
- Query hooks return `T` directly (`const { data } = useGetX()`), not wrapped.
- Mutation arg shapes vary — grep `lib/api-client-react/src/generated/api.ts`
  for the exact variables type before calling. Examples that bit us:
  `reactToComment` needs `{ postId, commentId, data }` (not just commentId);
  `acceptFriendRequest` takes `{ requestId }` only.
- **No decline/reject friend-request endpoint exists** — only
  `acceptFriendRequest`. Don't render a reject action that has no backing call.
- `Post` has no `commentCount` field; derive comment count from
  `useGetPostComments(...).length`.
