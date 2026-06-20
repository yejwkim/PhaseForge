from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
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

settings = get_settings()

app = FastAPI(title="PhaseForge API")

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
