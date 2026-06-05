# api — Backend / Ingestion Pipeline (Engineer B)

FastAPI (Python). Verifies the Supabase JWT and runs the heavy ingestion pipeline:
`parse → chunk → embed → store` into `material_chunks` (pgvector).

**Not scaffolded yet.** First deliverable is a stub `POST /ingest` that only flips
`materials.status`, so the `web` upload flow can integrate immediately.

Contract: [`../docs/ingest-interface.md`](../docs/ingest-interface.md).
