from typing import Any, cast, TypeAlias
from uuid import UUID
from app.core.supabase import get_supabase_client
from app.services.chunking import TextChunk

JSON: TypeAlias = str | int | float | bool | None | list["JSON"] | dict[str, "JSON"]

def get_owned_material(material_id: UUID, professor_id: str) -> dict[str, Any] | None:
    supabase = get_supabase_client()
    material_response = (
        supabase.table("materials")
        .select("id, course_id, storage_path, filename, type")
        .eq("id", str(material_id))
        .single()
        .execute()
    )
    material = material_response.data
    
    if not material:
        return None

    material_row = cast(dict[str, Any], material)
    
    course_response = (
        supabase.table("courses")
        .select("id, professor_id")
        .eq("id", material_row["course_id"])
        .single()
        .execute()
    )
    course = course_response.data
    
    if not course:
        return None
    
    course_row = cast(dict[str, Any], course)
    
    if course_row["professor_id"] != professor_id:
        return None

    return material_row
    
def update_material_status(material_id: UUID, status: str, error_message: str | None = None) -> None:
    supabase = get_supabase_client()
    _ = (
        supabase.table("materials")
        .update({
            "status": status,
            "error_message": error_message
        })
        .eq("id", str(material_id))
        .execute()
    )

def delete_material_chunks(material_id: UUID) -> None:
    supabase = get_supabase_client()
    _ = (
        supabase.table("material_chunks")
        .delete()
        .eq("material_id", str(material_id))
        .execute()
    )
    
def insert_material_chunks(material_id: UUID, chunks: list[TextChunk],
                                      embeddings: list[list[float]]) -> None:
    if len(chunks) != len(embeddings):
        raise ValueError(f"Expected {len(chunks)} embeddings, received {len(embeddings)}")
    
    if not chunks:
        return
    
    supabase = get_supabase_client()
    rows: list[JSON] = [
        {
            "material_id": str(material_id),
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "embedding": cast(JSON, embedding)
        }
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]
    
    _ = (
        supabase.table("material_chunks")
        .insert(rows)
        .execute()
    )

# def mark_material_error(material_id: UUID, error_message: str) -> None:
#     update_material_status(material_id, "error", error_message)

# def mark_material_processing(material_id: UUID) -> None:
#     update_material_status(material_id, "processing", None)

# def mark_material_done(material_id: UUID) -> None:
#     update_material_status(material_id, "done", None)
