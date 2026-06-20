-- PhaseForge — retrieval smoke-test helper for material chunks.
-- Adds an RPC used by the backend to fetch the top-k chunks for a query embedding.
-- Apply via Supabase SQL Editor (paste + Run)

create or replace function public.match_material_chunks_for_material(
  target_material_id uuid,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  material_id uuid,
  chunk_index int,
  content text,
  distance float
)
language sql
stable
as $$
  select
    mc.id,
    mc.material_id,
    mc.chunk_index,
    mc.content,
    mc.embedding <=> query_embedding as distance
  from public.material_chunks mc
  where mc.material_id = target_material_id
    and mc.embedding is not null
  order by mc.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_material_chunks_for_material(uuid, vector, int) to authenticated;
