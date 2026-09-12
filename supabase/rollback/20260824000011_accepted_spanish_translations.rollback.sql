-- Functional rollback for accepted Spanish translations.
-- The accepted_translations column is intentionally preserved to avoid destroying curated data.
-- This restores association grading to the previous canonical-Spanish-only behavior.

create or replace function public.record_route_lesson_attempt_v1(
  target_session_id uuid,
  target_word_id uuid,
  target_activity_type public.activity_type,
  provided_answer text,
  provided_response_time_ms integer,
  provided_client_event_id text,
  provided_attempt_number smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  viewer uuid:=auth.uid();
  s public.practice_sessions%rowtype;
  existing public.practice_attempts%rowtype;
  w public.vocabulary_words%rowtype;
  unit_pos smallint;
  activity_pos smallint;
  norm text;
  expected jsonb;
  ok boolean;
  eligible boolean;
  created bigint;
  outcome public.attempt_outcome;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;
  select * into s from public.practice_sessions where id=target_session_id and student_id=viewer;
  if s.id is null then raise exception 'Sesión de ruta no disponible'; end if;

  select * into existing from public.practice_attempts where session_id=s.id and client_event_id=provided_client_event_id;
  if existing.id is not null then
    return jsonb_build_object('attempt_id',existing.id,'correct',existing.is_correct,'idempotent_replay',true);
  end if;
  if s.status<>'in_progress' then raise exception 'La sesión ya terminó'; end if;

  select lu.lesson_unit_position into unit_pos
  from public.learning_lesson_units lu
  where lu.lesson_id=s.lesson_id and lu.word_id=target_word_id;
  if unit_pos is null then raise exception 'La unidad no pertenece a esta lección'; end if;

  norm:=private.normalize_practice_answer(provided_answer);
  select * into w from public.vocabulary_words where id=target_word_id;
  if target_activity_type='association' then
    expected:=jsonb_build_array(w.spanish);
  else
    select coalesce(jsonb_agg(distinct x.val),'[]'::jsonb)
    into expected
    from (
      select w.english val
      union all
      select value from jsonb_array_elements_text(
        case when jsonb_typeof(w.accepted_forms)='array' then w.accepted_forms else '[]'::jsonb end
      )
    ) x
    where nullif(trim(x.val),'') is not null;
  end if;

  ok:=exists(
    select 1 from jsonb_array_elements_text(expected) e(answer)
    where private.normalize_practice_answer(e.answer)=norm
  );
  outcome:=case when norm='' then 'no_answer'::public.attempt_outcome when ok then 'correct'::public.attempt_outcome else 'incorrect'::public.attempt_outcome end;
  activity_pos:=case target_activity_type when 'association' then 1 when 'listening' then 2 when 'writing' then 3 else 4 end;
  eligible:=target_word_id=any(s.reward_eligible_word_ids);

  insert into public.practice_attempts(
    session_id,word_id,activity_type,answer_text,answer_normalized,is_correct,response_time_ms,attempt_number,
    client_event_id,outcome,source,source_id,counts_for_mastery,can_generate_reward,lesson_unit_position,activity_position
  ) values(
    s.id,target_word_id,target_activity_type,provided_answer,norm,ok,
    greatest(0,least(coalesce(provided_response_time_ms,0),120000)),provided_attempt_number,
    provided_client_event_id,outcome,s.source,s.source_id,eligible,eligible,unit_pos,activity_pos
  ) returning id into created;

  return jsonb_build_object(
    'attempt_id',created,'correct',ok,'idempotent_replay',false,
    'counts_for_mastery',eligible,'can_generate_reward',eligible
  );
end
$function$;
