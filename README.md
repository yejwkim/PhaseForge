<!-- Add a banner/logo here, e.g.: ![PhaseForge](docs/assets/banner.png) -->

# PhaseForge: AI Assessment Platform

**PhaseForge** turns an instructor's own course material — past exams, lecture slides, and notes — into **original, exam-ready questions with answer keys**, grounded in that material and written in the instructor's style. Questions are organized into reviewable pools, delivered to students through a locked-down exam client, and (in progress) expanded into verified, per-student question variants for adaptive testing.

Writing fair, original exam questions at scale is slow, and reusing past questions invites cheating. PhaseForge lets an instructor upload what they already have, generate a grounded question pool in seconds, review and approve each item, then hand every student a different — but equivalent — exam.

---

## 🚀 Key Features

**Material Ingestion (RAG)**
- Upload PDFs (lecture / notes / past exams) to Supabase Storage
- Parse → chunk → embed (`text-embedding-3-small`) into pgvector
- Per-professor isolation enforced with Row-Level Security

**Question Generation**
- Retrieves the most relevant chunks per topic (semantic search, relevance-filtered)
- **Claude (`claude-sonnet-4-6`)** writes original questions with full answer keys, grounded *only* in the uploaded material and mirroring the instructor's style
- Generated in small parallel batches by topic × difficulty — exact counts, no truncation on long exams
- Multiple-choice & short-answer, spread across Easy / Medium / Hard bands

**Question Pools (Review Hub)**
- Browse by **Course → Assessment → Topic → Question**
- Approve / reject each question; filter by *To review / Approved / Rejected*; bulk-delete rejected
- **Recreate** any question with free-text instructions, compare old vs. new side-by-side, then accept
- Add more questions (or a new topic) into an existing pool at any time

**Assessment Builder**
- Set the **pool size** (per topic, per difficulty) and **questions per student** (per topic) separately — a large pool feeds variety and anti-cheating
- Generates a shareable exam code on creation

**Student Exam Client (Desktop)**
- Electron kiosk app: enter assessment code → identify → consent → exam
- Pulls real, materials-grounded questions (answer keys withheld) via a security-definer RPC
- Lockdown (focus tracking) + webcam work capture

**Phase 2 — Families & Verification** *(in progress)*
- Parameterize a question into a reusable **family**, instantiate verified **variants**, and calibrate difficulty (IRT) so every student gets a distinct, equivalent item — see [`docs/phase2-contracts.md`](docs/phase2-contracts.md)

---

## 🧭 How It Works

```
            ┌── Instructor (web) ──┐                ┌── Student (desktop) ──┐
upload PDF ─▶ Storage + materials  │   enter code ─▶ validate_assessment_code
            │        │             │                │        │
            ▼        ▼             │                ▼        ▼
   POST /ingest  (parse→chunk→embed→pgvector)   exam_questions RPC (approved, no answer key)
            │                                          │
            ▼                                          ▼
   POST /generate ──▶ RAG retrieve ──▶ Claude ──▶ questions table ──▶ Question Pools (review/approve)
```

---

## 📦 Tech Stack

**Instructor Web App (`web/`)**
- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 · lucide-react
- `@supabase/ssr` + `@supabase/supabase-js`

**Backend / Pipeline (`api/`)**
- FastAPI + Uvicorn · Pydantic v2 / pydantic-settings
- `supabase` (service-role client) · `PyJWT[crypto]` (Supabase JWT auth)
- `pymupdf` (PDF parsing) · `openai` (embeddings) · `anthropic` (Claude generation)

**Student Client (`desktop/`)**
- Electron + electron-vite · React · TypeScript · Tailwind
- `@supabase/supabase-js` (anonymous kiosk client)

**Data & Models (`supabase/`)**
- Supabase Postgres + **pgvector** · Row-Level Security · security-definer RPCs
- Embeddings: OpenAI `text-embedding-3-small` (1536-dim)
- Generation: Anthropic `claude-sonnet-4-6` (structured outputs)

---

## 🗂️ Repo Layout

| Path | What |
| --- | --- |
| `web/` | Instructor web app — Next.js |
| `api/` | Backend / ingestion + generation — FastAPI |
| `desktop/` | Student exam client — Electron |
| `supabase/` | Schema / RLS / migrations (shared source of truth) |
| `docs/` | Seam definitions & contracts |

Key docs: [`docs/schema.md`](docs/schema.md) · [`docs/ingest-interface.md`](docs/ingest-interface.md) · [`docs/phase2-contracts.md`](docs/phase2-contracts.md)

---

## 🛠️ Setup Guide

### 0. Supabase (shared)
Create a Supabase project, then in the **SQL Editor** apply every migration in order:
```
supabase/migrations/0001_init.sql … 0009_questions_phase2_fields.sql
```
This creates the schema, RLS policies, pgvector index, the `materials` Storage bucket, and the generation/exam RPCs.

### 1. Backend (`api/`)
```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env   # then fill in the values below
uvicorn app.main:app --reload
```
`.env` keys:
```
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
SUPABASE_JWKS_URL, SUPABASE_ISSUER, SUPABASE_STORAGE_BUCKET
OPENAI_API_KEY        # embeddings
ANTHROPIC_API_KEY     # Claude generation
# GENERATION_MODEL, GENERATION_MAX_TOKENS, CORS_ORIGINS … have sane defaults
```

### 2. Instructor Web (`web/`)
```bash
cd web
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```
`.env.local` keys:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Student Desktop Client (`desktop/`)
```bash
cd desktop
npm install
cp .env.example .env   # fill in the values below
npm run dev
```
`.env` keys:
```
RENDERER_VITE_SUPABASE_URL
RENDERER_VITE_SUPABASE_ANON_KEY
```

---

## 📸 Main Screens

<!-- Add screenshots here, e.g.:
| Dashboard | Question Pools | Exam Client |
| --- | --- | --- |
| ![](docs/assets/dashboard.png) | ![](docs/assets/pools.png) | ![](docs/assets/exam.png) |
-->
_Screenshots coming soon._
Login Page
<img width="1508" height="820" alt="Screenshot 2026-06-26 at 4 46 06 PM" src="https://github.com/user-attachments/assets/149b7310-ac06-4a8c-af16-ca675e818609" />

Homepage

<img width="1508" height="820" alt="Screenshot 2026-06-26 at 4 46 37 PM" src="https://github.com/user-attachments/assets/3999c7a0-76a1-4479-9682-4394570a6033" />

Course Page
<img width="1508" height="820" alt="Screenshot 2026-06-26 at 4 46 52 PM" src="https://github.com/user-attachments/assets/b1850fee-3125-4ad1-b444-d1ded1edea5e" />

Source Materials Page
<img width="1508" height="798" alt="Screenshot 2026-06-26 at 4 47 25 PM" src="https://github.com/user-attachments/assets/0b2c45fb-26ca-413d-9ce5-f05ec8d03fb0" />

Assesment Page
<img width="1508" height="798" alt="Screenshot 2026-06-26 at 4 47 42 PM" src="https://github.com/user-attachments/assets/79a7b24c-1e7f-4569-9169-f9d58bb5e027" />

Create Assement Page
<img width="1508" height="795" alt="Screenshot 2026-06-26 at 4 48 08 PM" src="https://github.com/user-attachments/assets/64628ea6-f007-4822-bf89-668eb779ba7e" />

Question Pool Page
<img width="1508" height="795" alt="Screenshot 2026-06-26 at 4 48 28 PM" src="https://github.com/user-attachments/assets/0386c04d-57f9-488e-9857-568fd74e1f3b" />


---

## 👥 Developers

| Name | Role | Affiliation | GitHub |
| --- | --- | --- | --- |
| Isaac Choi | Question generation (Claude RAG) · Instructor web app · Student exam client | Computer Science @ UT Austin | [@isaacchoi031014](https://github.com/isaacchoi031014) |
| Yejune Kim | Ingestion pipeline · Question families / variants / verification · Schema & contracts | UT Austin | [@yejwkim](https://github.com/yejwkim) |
