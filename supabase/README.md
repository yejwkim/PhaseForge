# supabase — Shared Source of Truth

Schema, RLS policies, and migrations shared by both `web` and `api`. The SQL in
`migrations/` is the single source of truth for the database schema.

Engineer A owns the draft; both engineers review, then it is frozen for the phase.

- Draft schema: [`../docs/schema.md`](../docs/schema.md)
- Requires the `pgvector` extension enabled.

**No migrations yet** — the first migration is written once the schema seam is agreed.
