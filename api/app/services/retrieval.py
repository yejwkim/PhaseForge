from typing import Any, cast
from uuid import UUID
from app.core.supabase import get_supabase_client
from app.services.embeddings import generate_embeddings

def retrieve_top_chunks_for_material(material_id: UUID, query: str, top_k: int = 5) -> list[dict[str, Any]]:
    query_embedding = generate_embeddings([query])[0]
    supabase = get_supabase_client()
    response = (
        supabase.rpc(
            "match_material_chunks_for_material",
            {
                "target_material_id": str(material_id),
                "query_embedding": query_embedding,
                "match_count": top_k
            }
        )
        .execute()
    )
    
    return cast(list[dict[str, Any]], response.data)
