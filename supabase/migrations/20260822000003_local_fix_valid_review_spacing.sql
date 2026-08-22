-- LOCAL/STAGING CANDIDATE FIX ONLY. DO NOT APPLY TO PRODUCTION WITHOUT APPROVAL.
-- Production currently treats >=75% as a valid per-word review but schedules the next review
-- in the future only when the review is 100% perfect. That allows repeated 75% passes to be
-- immediately eligible again and can compress five mastery cycles into one sitting.
-- This candidate preserves the 75% pass threshold but spaces every valid pass by interval_days.

create or replace function public.complete_route_lesson_session_v1(target_session_id uuid) returns jsonb
language plpgsql security definer set search_path=''
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
  pct numeric;
  lesson_mastered boolean;
  eligible_total integer;
  eligible_correct integer;
  earned_xp integer:=0;
  earned_coins integer:=0;
  review record;
  prev public.student_word_progress%rowtype;
  pass boolean;
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
  if s.id is null then raise exception 'Sesión de ruta no disponible'; end if;

  select * into r from public.learning_routes where id=s.route_id;
  select * into l from public.learning_lessons where id=s.lesson_id;

  expected_count:=l.unit_count*4;
  select count(*)::integer, count(*) filter(where is_correct)::integer
    into actual_count,correct_count
  from public.practice_attempts
  where session_id=s.id and lesson_unit_position is not null;
  if actual_count<>expected_count then
    raise exception 'La lección aún no tiene todos los momentos evaluables registrados';
  end if;

  pct:=round(correct_count::numeric*100/expected_count,2);
  lesson_mastered:=(correct_count::numeric/expected_count)>=r.mastery_threshold;

  select count(*)::integer, count(*) filter(where is_correct)::integer
    into eligible_total,eligible_correct
  from public.practice_attempts
  where session_id=s.id and can_generate_reward;
  if eligible_total>0 then
    earned_xp:=eligible_correct*20+15;
    earned_coins:=eligible_correct*3;
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
    where student_id=viewer and word_id=review.word_id;
    if not found then
      prev.interval_days:=0;
      prev.ease_factor:=2.30;
      prev.correct_streak:=0;
      prev.total_attempts:=0;
      prev.correct_attempts:=0;
      prev.mastered_at:=null;
    end if;

    pass:=review.corrects::numeric/review.attempts>=0.75;
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

    -- Critical stabilization change: any valid pass is spaced, not only a perfect pass.
    next_at:=case
      when pass then clock_timestamp()+make_interval(days=>new_interval)
      else clock_timestamp()
    end;

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
    'correct',correct_count,
    'total',expected_count,
    'percentage',pct,
    'mastered',lesson_mastered,
    'xp',earned_xp,
    'coins',earned_coins,
    'idempotent_replay',false
  );

  insert into public.student_lesson_progress(
    student_id,route_id,lesson_id,status,mastery_status,finished_at,attempt_count,
    last_attempt_at,last_correct,last_total,last_percentage,best_correct,best_total,
    best_percentage,last_result,best_result,updated_at
  ) values(
    viewer,r.id,l.id,'finished',case when lesson_mastered then 'mastered' else 'needs_review' end,
    clock_timestamp(),1,clock_timestamp(),correct_count,expected_count,pct,
    correct_count,expected_count,pct,result,result,clock_timestamp()
  )
  on conflict(student_id,route_id,lesson_id) do update set
    status='finished',
    mastery_status=excluded.mastery_status,
    finished_at=coalesce(public.student_lesson_progress.finished_at,excluded.finished_at),
    attempt_count=public.student_lesson_progress.attempt_count+1,
    last_attempt_at=excluded.last_attempt_at,
    last_correct=excluded.last_correct,
    last_total=excluded.last_total,
    last_percentage=excluded.last_percentage,
    last_result=excluded.last_result,
    best_percentage=greatest(public.student_lesson_progress.best_percentage,excluded.last_percentage),
    updated_at=clock_timestamp();

  insert into public.reward_events(student_id,client_event_id,source,source_id,xp_delta,coin_delta,reason)
  values(viewer,'route-session:'||s.id::text,'free_practice',s.id,earned_xp,earned_coins,'route_lesson_completion')
  on conflict(student_id,client_event_id,reason) do nothing;

  if eligible_total>0 then
    insert into public.student_stats(student_id,total_xp,coins,current_streak,longest_streak,last_practice_date)
    values(viewer,earned_xp,earned_coins,1,1,current_date)
    on conflict(student_id) do update set
      total_xp=public.student_stats.total_xp+excluded.total_xp,
      coins=public.student_stats.coins+excluded.coins,
      updated_at=clock_timestamp();
  end if;

  update public.practice_sessions
  set completed_at=clock_timestamp(),status='completed',xp_earned=earned_xp,coins_earned=earned_coins
  where id=s.id;

  insert into private.practice_session_receipts(session_id,student_id,result)
  values(s.id,viewer,result);

  return result;
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
