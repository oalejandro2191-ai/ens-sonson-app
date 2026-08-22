-- Deployable candidate: fix valid review spacing in complete_route_lesson_session_v1.
--
-- Confirmed bug:
--   pass := corrects / attempts >= 0.75
--   but next_review_at is spaced only when the review is perfect (4/4).
-- This lets a valid 3/4 review increase streak while remaining immediately due,
-- so repeated 75% passes can compress multiple mastery cycles into one sitting.
--
-- Minimal change only:
--   BEFORE: next_at depends on `perfect`
--   AFTER:  next_at depends on `pass`
--
-- The migration rewrites only that assignment inside the existing function definition
-- and refuses to continue if the expected legacy expression is not present.

do $$
declare
  ddl text;
  patched text;
  legacy_pattern constant text := 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+perfect[[:space:]]+then[[:space:]]+clock_timestamp\(\)[[:space:]]*\+[[:space:]]*make_interval\(days[[:space:]]*=>[[:space:]]*new_interval\)[[:space:]]+else[[:space:]]+clock_timestamp\(\)[[:space:]]+end;';
  patched_pattern constant text := 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+pass[[:space:]]+then[[:space:]]+clock_timestamp\(\)[[:space:]]*\+[[:space:]]*make_interval\(days[[:space:]]*=>[[:space:]]*new_interval\)[[:space:]]+else[[:space:]]+clock_timestamp\(\)[[:space:]]+end;';
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;

  if ddl ~* patched_pattern then
    raise notice 'valid-review spacing candidate already present';
    return;
  end if;

  if ddl !~* legacy_pattern then
    raise exception 'Unexpected complete_route_lesson_session_v1 body; refusing non-minimal replacement';
  end if;

  patched := regexp_replace(
    ddl,
    legacy_pattern,
    'next_at := case when pass then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;',
    'i'
  );

  if patched = ddl then
    raise exception 'Spacing candidate produced no function change';
  end if;

  execute patched;
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
