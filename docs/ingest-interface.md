# Ingestion Job Interface — `POST /ingest` (Seam 2)

> Status: **DRAFT — pending review.** This is the contract between `web` (Engineer A) and
> `api` (Engineer B). Agreeing on it up front lets both tracks build independently and meet
> in the middle.

## Flow

1. **Frontend (`web`)** uploads the file to Supabase Storage, inserts a `materials` row with
   `status = 'uploaded'`, then calls `POST /ingest` with the material id.
2. **Backend (`api`)** sets `status = 'processing'`, runs `parse → chunk → embed → insert
   material_chunks`, then sets `status = 'done'` (or `'error'` with `error_message`).
3. **Frontend** polls `materials.status` (or subscribes via Supabase Realtime) to show progress.

```
web                         api                         db / storage
 │  upload file ───────────────────────────────────────▶ Storage
 │  insert materials(status=uploaded) ──────────────────▶ DB
 │  POST /ingest {material_id} ──────▶ │
 │                                     │ status=processing ─▶ DB
 │                                     │ parse → chunk → embed
 │                                     │ insert material_chunks ─▶ DB
 │                                     │ status=done | error ───▶ DB
 │  poll materials.status ◀──────────────────────────────── DB
```

## Request

```
POST /ingest
Authorization: Bearer <Supabase JWT>      # api verifies, extracts professor id
Content-Type: application/json

{ "material_id": "<uuid>" }
```

## Response

```
202 Accepted
{ "material_id": "<uuid>", "status": "processing" }
```

- The endpoint is **async**: it returns immediately after flipping status to `processing`;
  the pipeline runs in the background. The frontend tracks completion via `materials.status`,
  not via this response body.
- Errors during processing are written to `materials.status = 'error'` +
  `materials.error_message`, surfaced to the UI — not returned from this call.

## Auth

`api` verifies the Supabase JWT on every request and extracts the professor id. It must
confirm the `material_id` belongs to that professor before processing (never trust the
client). Invalid/expired token → `401`.

## Contract guarantees

- **Idempotent.** Re-ingesting the same `material_id` must not duplicate `material_chunks`
  (clear existing chunks for that material first, or upsert by `(material_id, chunk_index)`).
- **Stub first.** Engineer B ships a stub `POST /ingest` that only flips `status` with no real
  work, so Engineer A can integrate against it immediately. Real pipeline is wired later.

## Status values (must match `materials.status` in schema)

`uploaded → processing → done | error`
