-- Deployable candidate: valid review spacing stabilization.
--
-- Confirmed defect in the current complete_route_lesson_session_v1:
-- a per-word review with >=75% is a valid pass and increases correct_streak,
-- but next_review_at is moved into the future only when the review is perfect.
-- A 3/4 valid pass can therefore be repeated immediately and compress mastery cycles.
--
-- Behavioral change in this candidate is intentionally one line only:
--   previous: next_at := case when perfect then now + interval else now end
--   candidate: next_at := case when pass    then now + interval else now end
--
-- The rest of the function mirrors the current server implementation so this file is
-- reproducible locally and can later be reviewed as a normal deployable migration.
-- DO NOT apply to production without explicit authorization.

create or replace function public.complete_route_lesson_session_v1(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  viewer uuid:=auth.uid();
  s public.practice_sessions%rowtype;
  r public.learning_routes%rowtype;
  l public.learning_lessons%rowtype;
  receipt jsonb;
  result jsonb;
  expected_count integer;
  actual_count integer;
  correct_count integer;
  pct numeric(5,2);
  mastered boolean;
  needs uuid[];
  activity_json jsonb;
  word_json jsonb;
  eligible_total integer;
  eligible_correct integer;
  eligible_avg integer;
  eligible_accuracy numeric;
  speed boolean;
  earned_xp integer:=0;
  earned_coins integer:=0;
  reward_inserted boolean:=false;
  review record;
  prev public.student_word_progress%rowtype;
  prev_exists boolean;
  pass boolean;
  perfect boolean;
  new_interval integer;
  new_streak integer;
  new_state public.mastery_state;
  next_at timestamptz;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;

  select psr.result into receipt
  from private.practice_session_receipts psr
  where psr.session_id=target_session_id and psr.student_id=viewer;
  if receipt is not null then
    return receipt || jsonb_build_object('idempotent_replay',true);
  end if;

  select * into s
  from public.practice_sessions
  where id=target_session_id and student_id=viewer
  for update;

  if s.id is null or s.route_id is null or s.lesson_id is null or s.run_mode<>'normal' then
    raise exception 'Sesión de ruta no disponible';
  end if;

  select psr.result into receipt
  from private.practice_session_receipts psr
  where psr.session_id=s.id and psr.student_id=viewer;
  if receipt is not null then
    return receipt || jsonb_build_object('idempotent_replay',true);
  end if;

  if s.status<>'in_progress' then raise exception 'La sesión no está disponible para finalizar'; end if;

  select * into r from public.learning_routes where id=s.route_id;
  select * into l from public.learning_lessons where id=s.lesson_id and route_id=s.route_id;
  if r.id is null or l.id is null then raise exception 'Versión curricular no disponible'; end if;

  expected_count:=l.unit_count*4;
  select count(*)::integer,count(*) filter(where a.is_correct)::integer
    into actual_count,correct_count
  from public.practice_attempts a
  where a.session_id=s.id and a.lesson_unit_position is not null;

  if actual_count<>expected_count then
    raise exception 'La lección aún no tiene todos los momentos evaluables registrados';
  end if;

  pct:=round((correct_count::numeric/expected_count)*100,2);
  mastered:=(correct_count::numeric/expected_count)>=r.mastery_threshold;

  select jsonb_build_object(
    'association',jsonb_build_object('correct',count(*) filter(where activity_type='association' and is_correct),'total',l.unit_count),
    'listening',jsonb_build_object('correct',count(*) filter(where activity_type='listening' and is_correct),'total',l.unit_count),
    'writing',jsonb_build_object('correct',count(*) filter(where activity_type='writing' and is_correct),'total',l.unit_count),
    'recall',jsonb_build_object('correct',count(*) filter(where activity_type='recall' and is_correct),'total',l.unit_count)
  ) into activity_json
  from public.practice_attempts
  where session_id=s.id and lesson_unit_position is not null;

  select
    coalesce(array_agg(x.word_id order by x.lesson_unit_position) filter(where x.corrects<4),'{}'::uuid[]),
    coalesce(jsonb_agg(jsonb_build_object('word_id',x.word_id,'correct',x.corrects,'total',4,'needs_practice',x.corrects<4) order by x.lesson_unit_position),'[]'::jsonb)
  into needs,word_json
  from (
    select lu.word_id,lu.lesson_unit_position,count(a.id) filter(where a.is_correct)::integer corrects
    from public.learning_lesson_units lu
    left join public.practice_attempts a
      on a.session_id=s.id and a.word_id=lu.word_id and a.lesson_unit_position is not null
    where lu.lesson_id=l.id
    group by lu.word_id,lu.lesson_unit_position
  ) x;

  select count(*)::integer,count(*) filter(where is_correct)::integer,coalesce(round(avg(response_time_ms)),0)::integer
    into eligible_total,eligible_correct,eligible_avg
  from public.practice_attempts
  where session_id=s.id and can_generate_reward;

  eligible_accuracy:=case when eligible_total>0 then eligible_correct::numeric/eligible_total else 0 end;
  speed:=eligible_total>0 and eligible_avg<=8000 and eligible_accuracy>=0.67;

  if eligible_total>0 then
    earned_xp:=eligible_correct*20+15+case when speed then 10 else 0 end;
    earned_coins:=eligible_correct*3+case when eligible_correct=eligible_total then 5 else 0 end;
  end if;

  for review in
    select a.word_id,
           count(*)::integer attempts,
           count(*) filter(where a.is_correct)::integer corrects,
           coalesce(round(avg(a.response_time_ms)),0)::integer avg_ms
    from public.practice_attempts a
    where a.session_id=s.id and a.counts_for_mastery
    group by a.word_id
  loop
    select * into prev
    from public.student_word_progress
    where student_id=viewer and word_id=review.word_id
    for update;

    prev_exists:=found;
    if not prev_exists then
      prev.student_id:=viewer;
      prev.word_id:=review.word_id;
      prev.mastery_state:='new';
      prev.interval_days:=0;
      prev.ease_factor:=2.30;
      prev.correct_streak:=0;
      prev.total_attempts:=0;
      prev.correct_attempts:=0;
      prev.mastered_at:=null;
    end if;

    pass:=review.corrects::numeric/review.attempts>=0.75;
    perfect:=review.corrects=review.attempts;
    new_streak:=case when pass then coalesce(prev.correct_streak,0)+1 else 0 end;
    new_interval:=case
      when not pass then 0
      when coalesce(prev.interval_days,0)=0 then 1
      when prev.interval_days=1 then 3
      else greatest(4,round(prev.interval_days*coalesce(prev.ease_factor,2.30))::integer)
    end;
    new_state:=case
      when not pass then 'learning'::public.mastery_state
      when new_streak>=5 and new_interval>=21 then 'mastered'::public.mastery_state
      when new_streak>=2 then 'review'::public.mastery_state
      else 'learning'::public.mastery_state
    end;

    -- Candidate fix: every valid pass is spaced, not only a perfect pass.
    next_at:=case when pass then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;

    insert into public.student_word_progress(
      student_id,word_id,mastery_state,interval_days,ease_factor,correct_streak,
      total_attempts,correct_attempts,last_response_time_ms,last_reviewed_at,
      next_review_at,mastered_at,last_change_source
    ) values(
      viewer,review.word_id,new_state,new_interval,coalesce(prev.ease_factor,2.30),new_streak,
      coalesce(prev.total_attempts,0)+review.attempts,
      coalesce(prev.correct_attempts,0)+review.corrects,
      review.avg_ms,clock_timestamp(),next_at,
      coalesce(prev.mastered_at,case when new_state='mastered' then clock_timestamp() else null end),
      'route_lesson'
    )
    on conflict(student_id,word_id) do update set
      mastery_state=excluded.mastery_state,
      interval_days=excluded.interval_days,
      ease_factor=excluded.ease_factor,
      correct_streak=excluded.correct_streak,
      total_attempts=excluded.total_attempts,
      correct_attempts=excluded.correct_attempts,
      last_response_time_ms=excluded.last_response_time_ms,
      last_reviewed_at=excluded.last_reviewed_at,
      next_review_at=excluded.next_review_at,
      mastered_at=excluded.mastered_at,
      last_change_source='route_lesson',
      updated_at=clock_timestamp();
  end loop;

  result:=jsonb_build_object(
    'route_code',r.route_code,
    'route_fingerprint',r.content_fingerprint,
    'lesson_id',l.id,
    'lesson_number',l.lesson_number,
    'purpose',l.purpose,
    'correct',correct_count,
    'total',expected_count,
    'percentage',pct,
    'mastered',mastered,
    'mastery_status',case when mastered then 'mastered' else 'needs_review' end,
    'by_activity',activity_json,
    'by_word',word_json,
    'needs_review_word_ids',to_jsonb(needs),
    'xp',earned_xp,
    'coins',earned_coins,
    'idempotent_replay',false
  );

  insert into public.student_lesson_progress(
    student_id,route_id,lesson_id,status,mastery_status,unlocked_at,started_at,finished_at,
    attempt_count,last_attempt_at,last_correct,last_total,last_percentage,best_correct,best_total,
    best_percentage,last_result,best_result,needs_review_word_ids,by_activity,updated_at
  ) values(
    viewer,r.id,l.id,'finished',case when mastered then 'mastered' else 'needs_review' end,
    coalesce((select unlocked_at from public.student_lesson_progress where student_id=viewer and route_id=r.id and lesson_id=l.id),s.started_at),
    s.started_at,clock_timestamp(),1,clock_timestamp(),correct_count,expected_count,pct,
    correct_count,expected_count,pct,result,result,needs,activity_json,clock_timestamp()
  )
  on conflict(student_id,route_id,lesson_id) do update set
    status='finished',
    mastery_status=excluded.mastery_status,
    started_at=coalesce(public.student_lesson_progress.started_at,excluded.started_at),
    finished_at=coalesce(public.student_lesson_progress.finished_at,excluded.finished_at),
    attempt_count=public.student_lesson_progress.attempt_count+1,
    last_attempt_at=excluded.last_attempt_at,
    last_correct=excluded.last_correct,
    last_total=excluded.last_total,
    last_percentage=excluded.last_percentage,
    last_result=excluded.last_result,
    needs_review_word_ids=excluded.needs_review_word_ids,
    by_activity=excluded.by_activity,
    updated_at=clock_timestamp(),
    best_correct=case when excluded.last_percentage>public.student_lesson_progress.best_percentage then excluded.last_correct else public.student_lesson_progress.best_correct end,
    best_total=case when excluded.last_percentage>public.student_lesson_progress.best_percentage then excluded.last_total else public.student_lesson_progress.best_total end,
    best_percentage=greatest(public.student_lesson_progress.best_percentage,excluded.last_percentage),
    best_result=case when excluded.last_percentage>public.student_lesson_progress.best_percentage then excluded.last_result else public.student_lesson_progress.best_result end;

  insert into public.reward_events(student_id,client_event_id,source,source_id,xp_delta,coin_delta,reason)
  values(viewer,'route-session:'||s.id::text,'free_practice',s.id,earned_xp,earned_coins,'route_lesson_completion')
  on conflict(student_id,client_event_id,reason) do nothing;
  reward_inserted:=found;

  if reward_inserted and eligible_total>0 then
    insert into public.student_stats(student_id,total_xp,coins,current_streak,longest_streak,last_practice_date)
    values(viewer,earned_xp,earned_coins,1,1,current_date)
    on conflict(student_id) do update set
      total_xp=public.student_stats.total_xp+excluded.total_xp,
      coins=public.student_stats.coins+excluded.coins,
      current_streak=case
        when public.student_stats.last_practice_date=current_date then public.student_stats.current_streak
        when public.student_stats.last_practice_date=current_date-1 then public.student_stats.current_streak+1
        else 1
      end,
      longest_streak=greatest(public.student_stats.longest_streak,case
        when public.student_stats.last_practice_date=current_date then public.student_stats.current_streak
        when public.student_stats.last_practice_date=current_date-1 then public.student_stats.current_streak+1
        else 1
      end),
      last_practice_date=current_date,
      updated_at=clock_timestamp();
  end if;

  update public.practice_sessions
  set completed_at=clock_timestamp(),status='completed',last_activity_at=clock_timestamp(),xp_earned=earned_xp,coins_earned=earned_coins
  where id=s.id;

  insert into private.practice_session_receipts(session_id,student_id,result)
  values(s.id,viewer,result)
  on conflict(session_id) do nothing;

  select psr.result into receipt
  from private.practice_session_receipts psr
  where psr.session_id=s.id and psr.student_id=viewer;

  return receipt;
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
