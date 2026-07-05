-- PhaseForge — optional SVG figure per question (diagrams, graphs, geometry).
-- Claude emits SVG markup; the clients render it as an <img> data-URI (safe).
-- Apply via Supabase SQL Editor (paste + Run).

alter table public.questions
  add column if not exists figure_svg text not null default '';

-- Re-expose the exam RPC with the figure so the student client can show it
-- (answer key still withheld). Drop first: the return-column set changes, which
-- CREATE OR REPLACE cannot do.
drop function if exists public.exam_questions_for_assessment(uuid, int);

create or replace function public.exam_questions_for_assessment(
  p_assessment_id uuid,
  p_limit int default 1
)
returns table (
  id uuid,
  type text,
  topic text,
  difficulty text,
  prompt text,
  options jsonb,
  figure_svg text
)
language sql
security definer
set search_path = ''
as $$
  select
    q.id,
    q.type,
    q.topic,
    q.difficulty,
    q.prompt,
    q.options,
    q.figure_svg
  from public.questions q
  join public.assessments a on a.course_id = q.course_id
  where a.id = p_assessment_id
    and a.status = 'open'
    and (a.window_open is null or now() >= a.window_open)
    and (a.window_close is null or now() <= a.window_close)
  order by q.created_at
  limit greatest(p_limit, 1);
$$;

grant execute on function public.exam_questions_for_assessment(uuid, int) to anon, authenticated;
