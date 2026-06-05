# Repo Structure & Decisions

PhaseForge lives in a **single git repo** with multiple language tracks side by side.
We do **not** use a JS monorepo tool (Turborepo / pnpm workspaces) — `web`/`desktop` are
JS and `api` is Python, so each track managing its own dependencies is simpler.

```
PhaseForge/
├── docs/         # Documents to agree on & freeze before splitting (seam definitions)
├── supabase/     # ★ Shared source of truth for both tracks (schema / RLS / migrations)
├── web/          # Instructor web app — Next.js (Engineer A) — Phase 1
├── api/          # Backend / ingestion pipeline — FastAPI (Engineer B) — Phase 1
└── desktop/      # Student client — Electron installed app (lockdown + camera) — later
```

## Key Decisions

1. **Flat monorepo, no JS tooling.** One repo / per-folder independent dependencies.
2. **`supabase/` at the root.** The schema is a seam both `web` and `api` depend on, so it
   is not nested under either. The SQL in `supabase/migrations/` is the single source of
   truth for the schema. Engineer A drafts → both review → frozen for the phase
   (small additions OK, no breaking changes).
3. **Instructor = web (`web`), student = installed app (`desktop`).** The student client
   must be Electron, not a browser, because of lockdown (kiosk / fullscreen) and external
   document-camera access. This comes in a later build step and is **not** in Phase 1 scope.

## Track Split (Phase 1)

- **Engineer A — `web/` + `supabase/`**: monorepo init, Next.js (App Router) + Tailwind +
  shadcn/ui, Supabase project / schema / pgvector, RLS, auth, course & category management,
  material upload UI, ingestion status.
- **Engineer B — `api/`**: FastAPI skeleton + JWT verification, document parsing, chunking,
  embedding, pgvector storage, hardened `POST /ingest`.

## The Two Seams (agree before splitting code)

1. **DB schema** → [`schema.md`](./schema.md)
2. **Ingestion job interface** (`POST /ingest`) → [`ingest-interface.md`](./ingest-interface.md)

## Intentionally Not Done Yet

- Actual framework install for `web/` / `api/` — after the schema seam is agreed.
- `desktop/` — later step (client v1).
