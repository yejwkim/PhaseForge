<div align="center">

# 🎓 PhaseForge

### Turn your course material into original, exam-ready questions — with answer keys.

<img width="678" height="205" alt="Screenshot 2026-06-26 at 4 59 31 PM" src="https://github.com/user-attachments/assets/d74c1ff3-4d08-47cb-90b9-15f5fa591cdc" />

<br/>

![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-2C2E3B?logo=electron&logoColor=white)
![Claude](https://img.shields.io/badge/Claude_Sonnet_4.6-D97757?logo=anthropic&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_Embeddings-412991?logo=openai&logoColor=white)

</div>

---

**PhaseForge** is an AI assessment platform that turns an instructor's own material — past exams, lecture slides, and notes — into **original, exam-ready questions with answer keys**, grounded in that material and written in the instructor's style. Questions are organized into reviewable pools, delivered to students through a locked-down exam client, and (in progress) expanded into verified, per-student variants for adaptive testing.

> Writing fair, original exam questions at scale is slow, and reusing past questions invites cheating. PhaseForge lets an instructor upload what they already have, generate a grounded question pool in seconds, review and approve each item, then hand every student a different — but equivalent — exam.

---

## 🚀 Key Features

| | |
| --- | --- |
| **📥 Material Ingestion (RAG)** | Upload PDFs (lectures / notes / past exams) → parse → chunk → embed (`text-embedding-3-small`) into pgvector. Per-professor isolation via Row-Level Security. |
| **🤖 Question Generation** | **Claude (`claude-sonnet-4-6`)** writes original questions + answer keys grounded *only* in the uploaded material, mirroring the instructor's style. Generated in parallel batches by topic × difficulty — exact counts, no truncation on long exams. |
| **🗂️ Question Pools** | Browse **Course → Assessment → Topic → Question**. Approve / reject, filter by status, bulk-delete rejected. **Recreate** any question with custom instructions and compare old vs. new side-by-side. Add more questions or topics to an existing pool anytime. |
| **📝 Assessment Builder** | Set the **pool size** (per topic / difficulty) and **questions per student** (per topic) separately — a larger pool feeds variety and anti-cheating. Generates a shareable exam code. |
| **🖥️ Student Exam Client** | Electron kiosk: enter code → identify → consent → exam. Serves real, materials-grounded questions (answer keys withheld) via a security-definer RPC. Lockdown + webcam work capture. |
| **🧬 Phase 2 — Families & Verification** *(in progress)* | Parameterize a question into a reusable **family**, instantiate verified **variants**, and calibrate difficulty (IRT) so every student gets a distinct, equivalent item. See [`docs/phase2-contracts.md`](docs/phase2-contracts.md). |

---

## 🧭 How It Works

<img width="873" height="720" alt="Screenshot 2026-06-26 at 4 57 12 PM" src="https://github.com/user-attachments/assets/0aed0948-062c-49e5-b42e-110760495cb3" />

---

## 📸 Screens

<table>
  <tr>
    <td width="50%" align="center"><b>Homepage</b><br/><img src="https://github.com/user-attachments/assets/3999c7a0-76a1-4479-9682-4394570a6033" /></td>
    <td width="50%" align="center"><b>Courses</b><br/><img src="https://github.com/user-attachments/assets/b1850fee-3125-4ad1-b444-d1ded1edea5e" /></td>
  </tr>
  <tr>
    <td width="50%" align="center"><b>Source Materials</b><br/><img src="https://github.com/user-attachments/assets/0b2c45fb-26ca-413d-9ce5-f05ec8d03fb0" /></td>
    <td width="50%" align="center"><b>Assessments</b><br/><img src="https://github.com/user-attachments/assets/79a7b24c-1e7f-4569-9169-f9d58bb5e027" /></td>
  </tr>
  <tr>
    <td width="50%" align="center"><b>Create Assessment</b><br/><img src="https://github.com/user-attachments/assets/64628ea6-f007-4822-bf89-668eb779ba7e" /></td>
    <td width="50%" align="center"><b>Question Pool</b><br/><img src="https://github.com/user-attachments/assets/0386c04d-57f9-488e-9857-568fd74e1f3b" /></td>
  </tr>
</table>

---

## 📦 Tech Stack

<table>
<tr><td><b>Instructor Web (<code>web/</code>)</b></td><td>Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · lucide-react · <code>@supabase/ssr</code></td></tr>
<tr><td><b>Backend / Pipeline (<code>api/</code>)</b></td><td>FastAPI + Uvicorn · Pydantic v2 · <code>supabase</code> (service-role) · <code>PyJWT</code> · <code>pymupdf</code> · <code>openai</code> · <code>anthropic</code></td></tr>
<tr><td><b>Student Client (<code>desktop/</code>)</b></td><td>Electron + electron-vite · React · TypeScript · Tailwind · <code>@supabase/supabase-js</code></td></tr>
<tr><td><b>Data & Models (<code>supabase/</code>)</b></td><td>Postgres + <b>pgvector</b> · Row-Level Security · security-definer RPCs · OpenAI <code>text-embedding-3-small</code> · Anthropic <code>claude-sonnet-4-6</code></td></tr>
</table>

---

## 🗂️ Repo Layout

| Path | What |
| --- | --- |
| `web/` | Instructor web app — Next.js |
| `api/` | Backend / ingestion + generation — FastAPI |
| `desktop/` | Student exam client — Electron |
| `supabase/` | Schema / RLS / migrations (shared source of truth) |
| `docs/` | Seam definitions & contracts |

Key docs: [`schema.md`](docs/schema.md) · [`ingest-interface.md`](docs/ingest-interface.md) · [`phase2-contracts.md`](docs/phase2-contracts.md)

---

## 🛠️ Setup

<details>
<summary><b>0. Supabase (shared)</b></summary>

Create a Supabase project, then in the **SQL Editor** apply every migration in order:
```
supabase/migrations/0001_init.sql … 0009_questions_phase2_fields.sql
```
This creates the schema, RLS policies, the pgvector index, the `materials` Storage bucket, and the generation/exam RPCs.
</details>

<details>
<summary><b>1. Backend (<code>api/</code>)</b></summary>

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env   # then fill in the values below
uvicorn app.main:app --reload
```
```
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
SUPABASE_JWKS_URL, SUPABASE_ISSUER, SUPABASE_STORAGE_BUCKET
OPENAI_API_KEY        # embeddings
ANTHROPIC_API_KEY     # Claude generation
# GENERATION_MODEL, GENERATION_MAX_TOKENS, CORS_ORIGINS … have sane defaults
```
</details>

<details>
<summary><b>2. Instructor Web (<code>web/</code>)</b></summary>

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL=http://localhost:8000
```
</details>

<details>
<summary><b>3. Student Desktop Client (<code>desktop/</code>)</b></summary>

```bash
cd desktop
npm install
cp .env.example .env
npm run dev
```
```
RENDERER_VITE_SUPABASE_URL
RENDERER_VITE_SUPABASE_ANON_KEY
```
</details>

---

## 👥 Developers

| Name | Role | Affiliation | GitHub |
| --- | --- | --- | --- |
| **Isaac Choi** | Question generation (Claude RAG) · Instructor web app · Student exam client | CS & Mathematics @ UT Austin | [@isaacchoi031014](https://github.com/isaacchoi031014) |
| **Yejune Kim** | Ingestion pipeline · Question families / variants / verification · Schema & contracts | CS & Data Science @ UT Austin | [@yejwkim](https://github.com/yejwkim) |
