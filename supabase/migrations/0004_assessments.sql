-- PhaseForge — assessments + public code validation for the desktop exam client.
-- Apply via Supabase SQL Editor (paste + Run).

create table if not exists public.assessments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title        text not null,
  code         text not null unique,
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  window_open  timestamptz,
  window_close timestamptz,
  config_json  jsonb,            -- { questions, minutes, topics: [...], difficulty, instructions }
  created_at   timestamptz not null default now()
);
create index if not exists assessments_course_id_idx on public.assessments (course_id);

alter table public.assessments enable row level security;

-- Instructor owns assessments via the course.
drop policy if exists "own assessments" on public.assessments;
create policy "own assessments"
  on public.assessments for all
  using (exists (
    select 1 from public.courses c
    where c.id = assessments.course_id and c.professor_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = assessments.course_id and c.professor_id = auth.uid()
  ));

-- Public validation: the desktop app (anonymous) calls this with a typed code.
-- security definer bypasses RLS but only returns a row for a valid, OPEN,
-- in-window assessment — it never lets anyone list codes.
create or replace function public.validate_assessment_code(p_code text)
returns table (
  id uuid,
  title text,
  course_title text,
  questions int,
  minutes int,
  topics jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    a.id,
    a.title,
    c.title as course_title,
    coalesce((a.config_json ->> 'questions')::int, 15) as questions,
    coalesce((a.config_json ->> 'minutes')::int, 60) as minutes,
    coalesce(a.config_json -> 'topics', '[]'::jsonb) as topics
  from public.assessments a
  join public.courses c on c.id = a.course_id
  where upper(a.code) = upper(p_code)
    and a.status = 'open'
    and (a.window_open is null or now() >= a.window_open)
    and (a.window_close is null or now() <= a.window_close);
$$;

grant execute on function public.validate_assessment_code(text) to anon, authenticated;
