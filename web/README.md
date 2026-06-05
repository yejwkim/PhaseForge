# web — Instructor Web App (Engineer A)

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. The instructor-facing app:
auth, course & category management, material upload, and ingestion status.

**Not scaffolded yet** — framework install happens after the schema seam
([`../docs/schema.md`](../docs/schema.md)) is agreed.

Talks directly to Supabase (with RLS) for simple CRUD; calls `api`'s `POST /ingest`
([`../docs/ingest-interface.md`](../docs/ingest-interface.md)) to trigger the pipeline.
