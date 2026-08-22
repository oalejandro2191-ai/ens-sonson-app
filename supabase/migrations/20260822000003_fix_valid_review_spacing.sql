-- Deployable candidate: fix valid review spacing in complete_route_lesson_session_v1.
--
-- Confirmed bug:
--   pass := corrects / attempts >= 0.75
--   but next_review_at is spaced only when the review is perfect (4/4).
-- This lets a valid 3/4 review increase streak while remaining immediately due,
-- so repeated 75% passes can compress multiple mastery cycles into one sitting.
--
-- Minimal change only:
--   BEFORE: next_at uses `perfect`
--   AFTER:  next_at uses `pass`
--
-- This migration intentionally refuses to mutate an unexpected function body.
-- It is a candidate only until remote deployment is explicitly authorized.

do $$
declare
  ddl text;
  old_expression constant text := 'next_at:=case when perfect then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;';
  new_expression constant text := 'next_at:=case when pass then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;';
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;

  if position(new_expression in ddl) > 0 then
    raise notice 'valid-review spacing candidate already present';
    return;
  end if;

  if position(old_expression in ddl) = 0 then
    raise exception 'Unexpected complete_route_lesson_session_v1 body; refusing non-minimal replacement';
  end if;

  execute replace(ddl, old_expression, new_expression);
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
