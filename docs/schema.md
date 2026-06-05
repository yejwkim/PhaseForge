# DB Schema — Phase 1 (Seam 1)

> Status: **DRAFT — pending review.** Engineer A drafts, both engineers review, then this
> is frozen for Phase 1 (small additive changes OK, no breaking changes).
>
> This is a seam both tracks depend on. The actual migration SQL will live in
> `supabase/migrations/` once this is agreed.

## Scope

Phase 1 only covers material ingestion. Later phases (item families, assessments,
sessions, analytics) expand this schema. Tables below are the Phase 1 subset.

## Tables

```
profiles          (id → auth.users, role, name, institution, created_at)
courses           (id, professor_id → profiles, title, description, created_at)
categories        (id, course_id → courses, name, difficulty_bands_json, created_at)
materials         (id, course_id → courses, category_id → categories (nullable),
                   type,                 -- lecture | notes | past_exam
                   filename, storage_path,
                   status,               -- uploaded | processing | done | error
                   error_message (nullable),
                   created_at)
material_chunks   (id, material_id → materials, chunk_index, content,
                   embedding vector(1536), created_at)
```

## Notes

- **Ownership / multi-tenancy.** Every table carries the owning professor's id (directly via
  `professor_id`, or transitively via `course_id`). RLS ensures a professor sees only their
  own rows. See [`schema.md` RLS section] below.
- **`materials.status`** is how the frontend tracks ingestion progress
  (`uploaded → processing → done | error`). `error_message` surfaces failures to the UI.
- **`material_chunks`** is the RAG source for Phase 2 retrieval.
- **`embedding vector(1536)`** — the dimension is locked here and must match the embedding
  model chosen by Engineer B. Changing it later means re-embedding everything. **Decide the
  model + dimension before freezing.** (1536 is a placeholder for the agreed model.)
- **Storage.** Files go to Supabase Storage; the DB stores `storage_path` only, never bytes.

## RLS

Every tenant table gets a Row-Level Security policy so a professor can only read/write their
own data:

- `profiles`: `id = auth.uid()`
- `courses`: `professor_id = auth.uid()`
- `categories` / `materials`: owned via `course_id`'s course `professor_id = auth.uid()`
- `material_chunks`: owned via `material_id`'s material → course → professor

Verify with two test users that one professor cannot read another's course.

## Open Questions (resolve before freeze)

- [ ] Embedding model & exact vector dimension (must match pgvector column).
- [ ] `categories.difficulty_bands_json` shape (e.g. `["Easy","Medium","Hard"]` vs richer config).
- [ ] Do we need a separate `students` table in Phase 1, or defer to Phase 3? (Default: defer.)
