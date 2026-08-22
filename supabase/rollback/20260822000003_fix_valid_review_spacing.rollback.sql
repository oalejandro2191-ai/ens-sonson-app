-- Manual rollback for 20260822000003_fix_valid_review_spacing.sql.
-- Keep outside supabase/migrations so it is never applied automatically.
-- Restores the previously observed behavior: only a perfect review schedules the next interval.

do $$
declare
  ddl text;
  restored text;
  current_pattern constant text := 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+pass[[:space:]]+then[[:space:]]+clock_timestamp\(\)[[:space:]]*\+[[:space:]]*make_interval\(days[[:space:]]*=>[[:space:]]*new_interval\)[[:space:]]+else[[:space:]]+clock_timestamp\(\)[[:space:]]+end;';
  previous_pattern constant text := 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+perfect[[:space:]]+then[[:space:]]+clock_timestamp\(\)[[:space:]]*\+[[:space:]]*make_interval\(days[[:space:]]*=>[[:space:]]*new_interval\)[[:space:]]+else[[:space:]]+clock_timestamp\(\)[[:space:]]+end;';
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;

  if ddl ~* previous_pattern then
    raise notice 'previous spacing behavior already restored';
    return;
  end if;

  if ddl !~* current_pattern then
    raise exception 'Unexpected complete_route_lesson_session_v1 body; refusing rollback';
  end if;

  restored := regexp_replace(
    ddl,
    current_pattern,
    'next_at := case when perfect then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;',
    'i'
  );

  if restored = ddl then
    raise exception 'Rollback produced no function change';
  end if;

  execute restored;
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
