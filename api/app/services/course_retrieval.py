"""Course-level RAG retrieval.

Given a course and a set of topics, this module pulls the material chunks most
relevant to those topics from pgvector and tags each with its source material
type, so the generation step can treat past-exam chunks as style exemplars.
"""

from typing import Any, cast
from uuid import UUID
from app.core.config import get_settings
from app.core.supabase import get_supabase_client
from app.services.embeddings import generate_embeddings

# Fallback query used when the caller passes no topics: a generic probe so we
# still retrieve the most salient chunks across the course instead of nothing.
DEFAULT_QUERIES = ["key concepts, definitions, and important results"]


def _enrich(topic: str) -> str:
    """Turn a bare topic name into a fuller query. A short concept word like
    "Trees" embeds far from worded exam problems; framing it as an exam question
    pulls the query vector closer to the actual material, improving recall."""
    return f"{topic} — exam questions, problems, and key concepts about {topic}"


def retrieve_course_context(course_id: UUID, topics: list[str]) -> list[dict[str, Any]]:
    """Fan retrieval across every material in the course, one query per topic,
    de-duplicated by chunk id. Each topic contributes its own top-k chunks so a
    multi-topic exam is grounded on all of them, not just the dominant one."""
    settings = get_settings()
    supabase = get_supabase_client()

    # One embedding per topic; each becomes a separate vector search below.
    # Topics are enriched so short concept words still match worded exam chunks.
    cleaned = [topic.strip() for topic in topics if topic.strip()]
    queries = [_enrich(topic) for topic in cleaned] or DEFAULT_QUERIES
    embeddings = generate_embeddings(queries)

    # Keyed by chunk id so the same chunk surfacing under multiple topics is kept once.
    chunks_by_id: dict[str, dict[str, Any]] = {}
    for embedding in embeddings:
        # Vector similarity search scoped to this course (pgvector RPC).
        response = (
            supabase.rpc(
                "match_material_chunks_for_course",
                {
                    "target_course_id": str(course_id),
                    "query_embedding": embedding,
                    "match_count": settings.generation_retrieval_k,  # top-k per topic
                },
            )
            .execute()
        )
        for row in cast(list[dict[str, Any]], response.data or []):
            # Relevance gate: drop chunks beyond the cosine-distance cutoff so
            # off-topic material can't sneak into generation as "context".
            distance = row.get("distance")
            if distance is not None and distance > settings.generation_max_distance:
                continue
            chunks_by_id[str(row["id"])] = row  # de-dupe by chunk id

    # Enrich the final set with material type before handing off to generation.
    chunks = list(chunks_by_id.values())
    _attach_material_types(supabase, chunks)
    return chunks


def _attach_material_types(supabase: Any, chunks: list[dict[str, Any]]) -> None:
    """Tag each chunk with its material's type (e.g. ``past_exam``) and source PDF
    path, so generation can treat past-exam chunks as style exemplars and pull the
    actual page images for Claude's vision input.

    Mutates ``chunks`` in place, adding ``material_type`` and ``material_storage_path``.
    """
    # Look up metadata in a single batched query for the distinct source materials.
    material_ids = {str(c["material_id"]) for c in chunks if c.get("material_id")}
    if not material_ids:
        return

    response = (
        supabase.table("materials")
        .select("id, type, storage_path")
        .in_("id", list(material_ids))
        .execute()
    )
    # material id -> {type, storage_path}, for O(1) assignment back onto each chunk.
    meta_by_material = {
        str(row["id"]): row for row in cast(list[dict[str, Any]], response.data or [])
    }
    for chunk in chunks:
        meta = meta_by_material.get(str(chunk.get("material_id"))) or {}
        chunk["material_type"] = meta.get("type")
        chunk["material_storage_path"] = meta.get("storage_path")
