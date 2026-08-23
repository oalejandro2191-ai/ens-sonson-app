-- Rollback for 20260822000004_active_route_session_recovery.sql.
-- Restores the previous start_route_lesson_session_v1 behavior and removes the read RPC.
-- This file is intentionally outside supabase/migrations and is exercised only in local validation.

drop function if exists public.get_my_active_route_session_v1(text);

create or replace function public.start_route_lesson_session_v1(
  target_route_code text,
  target_lesson_id uuid,
  provided_client_session_id text,
  provided_client_context jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  route_row public.learning_routes%rowtype;
  lesson_row public.learning_lessons%rowtype;
  existing public.practice_sessions%rowtype;
  created_id uuid;
  eligible uuid[];
  ctx jsonb:=coalesce(provided_client_context,'{}'::jsonb);
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;
  if provided_client_session_id is null
     or char_length(provided_client_session_id) not between 8 and 120
     or provided_client_session_id !~ '^[A-Za-z0-9:_-]+$' then
    raise exception 'client_session_id no válido';
  end if;

  select * into route_row
  from public.learning_routes
  where route_code=target_route_code and status='published';
  if route_row.id is null then raise exception 'Ruta no disponible'; end if;
  if not private.has_institution_role(route_row.school_id,array['student'::public.institution_role]) then
    raise exception 'Solo un estudiante activo puede iniciar una lección';
  end if;

  select * into lesson_row
  from public.learning_lessons
  where id=target_lesson_id and route_id=route_row.id;
  if lesson_row.id is null then raise exception 'La lección no pertenece a esta versión de la ruta'; end if;

  select * into existing
  from public.practice_sessions
  where student_id=viewer and client_session_id=provided_client_session_id;
  if existing.id is not null then
    return jsonb_build_object(
      'session_id',existing.id,
      'recovered',true,
      'status',existing.status,
      'expected_evaluable',lesson_row.unit_count*4
    );
  end if;

  select coalesce(
    array_agg(lu.word_id order by lu.lesson_unit_position)
      filter(where wp.word_id is null or wp.next_review_at<=clock_timestamp()),
    '{}'::uuid[]
  )
  into eligible
  from public.learning_lesson_units lu
  left join public.student_word_progress wp
    on wp.student_id=viewer and wp.word_id=lu.word_id
  where lu.lesson_id=lesson_row.id;

  insert into public.practice_sessions(
    student_id,client_session_id,source,source_id,route_id,lesson_id,
    session_kind,run_mode,status,last_activity_at,client_context,reward_eligible_word_ids
  ) values(
    viewer,provided_client_session_id,'free_practice',lesson_row.id,route_row.id,lesson_row.id,
    'learning','normal','in_progress',clock_timestamp(),ctx,eligible
  ) returning id into created_id;

  insert into public.student_lesson_progress(
    student_id,route_id,lesson_id,status,mastery_status,unlocked_at,started_at,updated_at
  ) values(
    viewer,route_row.id,lesson_row.id,'in_progress','in_progress',
    clock_timestamp(),clock_timestamp(),clock_timestamp()
  )
  on conflict(student_id,route_id,lesson_id) do update set
    started_at=coalesce(public.student_lesson_progress.started_at,excluded.started_at),
    updated_at=clock_timestamp();

  return jsonb_build_object(
    'session_id',created_id,
    'recovered',false,
    'status','in_progress',
    'route_code',route_row.route_code,
    'lesson_id',lesson_row.id,
    'expected_evaluable',lesson_row.unit_count*4
  );
end $$;

revoke all on function public.start_route_lesson_session_v1(text,uuid,text,jsonb) from public,anon;
grant execute on function public.start_route_lesson_session_v1(text,uuid,text,jsonb) to authenticated;
