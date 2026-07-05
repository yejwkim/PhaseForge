import threading
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID
from time import sleep
from pathlib import Path
from typing import Any
from app.core.config import get_settings
from app.core.auth import AuthenticatedUser, get_current_user
from app.models.ingest import IngestRequest, IngestResponse
from app.services.materials import get_owned_material, update_material_status, delete_material_chunks, insert_material_chunks
from app.services.material_files import download_material_file, validate_material_file_metadata, write_temp_material_file
from app.services.parsing import extract_pdf_text
from app.services.chunking import chunk_document_text
from app.services.embeddings import generate_embeddings
from app.services.retrieval import retrieve_top_chunks_for_material
from app.models.generation import (
    ApplyQuestionRequest,
    GenerateRequest,
    QuestionDraft,
    RegenerateRequest,
)
from app.services.questions import (
    get_owned_course,
    get_owned_question,
    insert_questions,
    to_contract_question,
    update_question_content,
)
from app.services.course_retrieval import retrieve_course_context
from app.services.generation import generate_questions, regenerate_one
from app.services.figures import render_figure_json

settings = get_settings()

app = FastAPI(title="PhaseForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "environment": settings.environment
    }

@app.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest(request: IngestRequest, background_tasks: BackgroundTasks, 
                 current_user: AuthenticatedUser = Depends(get_current_user)) -> IngestResponse:
    material = get_owned_material(request.material_id, current_user.id)
    
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    update_material_status(request.material_id, "processing", None)
    
    background_tasks.add_task(run_ingestion, request.material_id, material)
    
    return IngestResponse(material_id=request.material_id, status="processing")

def run_ingestion(material_id: UUID, material: dict[str, Any]) -> None:
    temp_path: Path | None = None
    
    try:
        sleep(2)
        validate_material_file_metadata(material)
        file_bytes = download_material_file(str(material["storage_path"]))
        temp_path = write_temp_material_file(file_bytes, str(material["filename"]))
        parsed_document = extract_pdf_text(temp_path)
        chunks = chunk_document_text(parsed_document.text)
        if not chunks:
            raise ValueError("No retrievable chunks were generated from the material")
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = generate_embeddings(chunk_texts)
        delete_material_chunks(material_id)
        insert_material_chunks(material_id, chunks, embeddings)
        update_material_status(material_id, "done", None)
    except Exception as exc:
        update_material_status(material_id, "error", str(exc))
    finally:
        if temp_path and temp_path.exists():
            temp_path.unlink()

# Sync (def) on purpose: the body does blocking I/O. Validation runs inline so
# the client gets immediate errors; the slow Claude generation is backgrounded so
# it finishes even if the browser navigates away (results land in Question Pools).
@app.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate(request: GenerateRequest,
             current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, Any]:
    course = get_owned_course(request.course_id, current_user.id)

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if request.total_questions == 0:
        raise HTTPException(status_code=400, detail="Set at least one question count above zero.")

    # Detached daemon thread: generation is NOT tied to the request/response, so
    # it keeps running even if the browser navigates away right after the 202.
    threading.Thread(target=run_generation, args=(request,), daemon=True).start()
    return {"status": "generating", "expected": request.total_questions}


def run_generation(request: GenerateRequest) -> None:
    """Retrieve + generate + persist a question pool, off the request thread."""
    try:
        topics = [plan.name for plan in request.plans if plan.total > 0]
        chunks = retrieve_course_context(request.course_id, topics)
        if not chunks:
            print(f"[generate] no relevant material for topics {topics}", flush=True)
            return
        question_set = generate_questions(request, chunks)
        source_chunk_ids = [str(chunk["id"]) for chunk in chunks]
        insert_questions(
            request.course_id, request.assessment_id, question_set, source_chunk_ids, request.plans
        )
        print(
            f"[generate] done: {len(question_set.questions)} questions "
            f"(assessment {request.assessment_id})",
            flush=True,
        )
    except Exception as exc:
        print(f"[generate] background generation failed: {exc}", flush=True)

# Sync (def) on purpose: blocking I/O runs in FastAPI's threadpool.
@app.post("/regenerate")
def regenerate(request: RegenerateRequest,
               current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, Any]:
    question = get_owned_question(request.question_id, current_user.id)

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    chunks = retrieve_course_context(question["course_id"], [question["topic"]])

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No relevant material found for this topic — cannot regenerate.",
        )

    try:
        draft = regenerate_one(question, request.instructions, chunks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Question regeneration failed: {exc}")

    # Return a CANDIDATE without persisting — the professor compares it against the
    # current question and accepts it via /questions/apply (or regenerates again).
    # Render the figure spec to SVG here so the client shows/accepts the drawn figure.
    candidate = draft.model_dump(mode="json")
    candidate.pop("figure_spec_json", None)
    candidate["figure_svg"] = render_figure_json(draft.figure_spec_json)
    return candidate


@app.post("/questions/apply")
def apply_question(request: ApplyQuestionRequest,
                   current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, Any]:
    question = get_owned_question(request.question_id, current_user.id)

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # The instructor's accepted draft may change topic/difficulty/type.
    draft = QuestionDraft(
        question_type=request.question_type,
        topic=request.topic,
        difficulty=request.difficulty,
        prompt=request.prompt,
        options=request.options,
        answer=request.answer,
        explanation=request.explanation,
        rubric=request.rubric,
        learning_objective=request.learning_objective,
    )
    row = update_question_content(question, draft, request.figure_svg)
    return to_contract_question(row)


@app.get("/debug/me")
async def debug_me(current_user: AuthenticatedUser = Depends(get_current_user),) -> dict[str, str | None]:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role
    }
    
@app.get("/debug/retrieve")
async def debug_retrieve(material_id: UUID, query: str, top_k: int = 5,
                         current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, Any]:
    material = get_owned_material(material_id, current_user.id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    chunks = retrieve_top_chunks_for_material(material_id, query, top_k)
    
    return {"chunks": chunks}
