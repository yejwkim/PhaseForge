# PhaseForge
PhaseForge is an AI assessment platform that helps instructors turn past exams, slides, and rubrics into original, exam-ready questions with answer keys, similarity checks, calculation verification, and export-ready formatting.

## Repo layout

| Path | What | Track |
| --- | --- | --- |
| `web/` | Instructor web app — Next.js | Engineer A |
| `api/` | Backend / ingestion pipeline — FastAPI | Engineer B |
| `desktop/` | Student client — Electron installed app (later) | — |
| `supabase/` | Schema / RLS / migrations (shared source of truth) | shared |
| `docs/` | Seam definitions to agree on before splitting | shared |

See [`docs/repo-structure.md`](docs/repo-structure.md) for the layout rationale, and the two
seams to review first: [`docs/schema.md`](docs/schema.md) and
[`docs/ingest-interface.md`](docs/ingest-interface.md).
