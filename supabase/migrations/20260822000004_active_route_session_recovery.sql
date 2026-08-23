-- Deployable candidate: server-authoritative active route session recovery.
-- This candidate is exercised only against the isolated local Docker stack in this phase.
-- Do not apply to the existing production backend without a separate explicit review and authorization.

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

  -- Recovery is server-authoritative and scoped to the authenticated student.
  select * into existing
  from public.practice_sessions
  where student_id=viewer
    and route_id=route_row.id
    and lesson_id=lesson_row.id
    and status='in_progress'
  order by started_at desc
  limit 1;

  if existing.id is not null then
    return jsonb_build_object(
      'session_id',existing.id,
      'recovered',true,
      'status',existing.status,
      'expected_evaluable',lesson_row.unit_count*4
    );
  end if;

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
    status='in_progress',
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

create or replace function public.get_my_active_route_session_v1(
  target_route_code text default 'A1-V3'
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  route_row public.learning_routes%rowtype;
  session_row public.practice_sessions%rowtype;
  lesson_row public.learning_lessons%rowtype;
  tasks jsonb;
  attempts jsonb;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;

  select * into route_row
  from public.learning_routes
  where route_code=target_route_code and status='published';
  if route_row.id is null then raise exception 'Ruta no disponible'; end if;

  if not private.has_institution_role(route_row.school_id,array['student'::public.institution_role]) then
    raise exception 'Perfil de estudiante requerido';
  end if;

  select * into session_row
  from public.practice_sessions
  where student_id=viewer
    and route_id=route_row.id
    and status='in_progress'
  order by started_at desc
  limit 1;

  if session_row.id is null then return null; end if;

  select * into lesson_row
  from public.learning_lessons
  where id=session_row.lesson_id and route_id=route_row.id;
  if lesson_row.id is null then raise exception 'Lección activa no disponible'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'word_id',lu.word_id,
    'lesson_unit_position',lu.lesson_unit_position,
    'activity_type',a.activity_type::text,
    'activity_position',a.activity_position,
    'english',w.english,
    'spanish',w.spanish,
    'example_en',w.example_en,
    'example_es',w.example_es,
    'audio_path',w.audio_path
  ) order by lu.lesson_unit_position,a.activity_position),'[]'::jsonb)
  into tasks
  from public.learning_lesson_units lu
  join public.vocabulary_words w on w.id=lu.word_id
  cross join (values
    ('association'::public.activity_type,1),
    ('listening'::public.activity_type,2),
    ('writing'::public.activity_type,3),
    ('recall'::public.activity_type,4)
  ) a(activity_type,activity_position)
  where lu.lesson_id=lesson_row.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',pa.id,
    'word_id',pa.word_id,
    'activity_type',pa.activity_type::text,
    'client_event_id',pa.client_event_id,
    'correct',pa.is_correct,
    'answered_at',pa.answered_at
  ) order by pa.lesson_unit_position,pa.activity_position),'[]'::jsonb)
  into attempts
  from public.practice_attempts pa
  where pa.session_id=session_row.id and pa.lesson_unit_position is not null;

  return jsonb_build_object(
    'session_id',session_row.id,
    'client_session_id',session_row.client_session_id,
    'status',session_row.status,
    'started_at',session_row.started_at,
    'route_code',route_row.route_code,
    'lesson',jsonb_build_object(
      'id',lesson_row.id,
      'title',lesson_row.title,
      'purpose',lesson_row.purpose,
      'unit_count',lesson_row.unit_count
    ),
    'expected_count',lesson_row.unit_count*4,
    'confirmed_count',jsonb_array_length(attempts),
    'tasks',tasks,
    'attempts',attempts
  );
end $$;

revoke all on function public.get_my_active_route_session_v1(text) from public,anon;
grant execute on function public.get_my_active_route_session_v1(text) to authenticated;
revoke all on function public.start_route_lesson_session_v1(text,uuid,text,jsonb) from public,anon;
grant execute on function public.start_route_lesson_session_v1(text,uuid,text,jsonb) to authenticated;
