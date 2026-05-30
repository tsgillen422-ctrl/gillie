---
name: DB deletes have no FK cascade
description: Drizzle schema in lib/db defines FKs without ON DELETE CASCADE; deleting a parent requires manually removing child rows first, inside a transaction.
---
The lib/db drizzle schema declares foreign keys WITHOUT cascade behavior.

**Rule:** To delete a parent row (e.g. a conversation), first delete its child rows
(messages, then join/participant rows), then the parent — and wrap all of them in a
single `db.transaction(async (tx) => { ... })` so a mid-way failure can't orphan rows.

**Why:** Without cascade, deleting the parent first would violate FK constraints or
leave orphaned children. Without a transaction, a partial failure leaves the data in
an inconsistent half-deleted state.

**How to apply:** Any new destructive endpoint that removes an entity with dependent
rows must follow this child-first, transactional order.
