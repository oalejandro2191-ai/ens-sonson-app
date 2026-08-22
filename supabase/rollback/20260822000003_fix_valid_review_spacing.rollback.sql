-- Manual rollback for 20260822000003_fix_valid_review_spacing.sql.
-- Keep outside supabase/migrations so it is never applied automatically.
-- Restores the previously observed behavior: only a perfect review schedules the next interval.

do $$
declare
  ddl text;
  current_expression constant text := 'next_at:=case when pass then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;';
  previous_expression constant text := 'next_at:=case when perfect then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;';
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;

  if position(previous_expression in ddl) > 0 then
    raise notice 'previous spacing behavior already restored';
    return;
  end if;

  if position(current_expression in ddl) = 0 then
    raise exception 'Unexpected complete_route_lesson_session_v1 body; refusing rollback';
  end if;

  execute replace(ddl, current_expression, previous_expression);
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
