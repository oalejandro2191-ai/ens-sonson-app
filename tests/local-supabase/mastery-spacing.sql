-- SQL-level guard for the deployable valid-review spacing candidate.
do $$
declare
  ddl text;
  expected_pattern constant text := 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+pass[[:space:]]+then[[:space:]]+clock_timestamp\(\)[[:space:]]*\+[[:space:]]*make_interval\(days[[:space:]]*=>[[:space:]]*new_interval\)[[:space:]]+else[[:space:]]+clock_timestamp\(\)[[:space:]]+end;';
  forbidden_pattern constant text := 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+perfect[[:space:]]+then[[:space:]]+clock_timestamp\(\)[[:space:]]*\+[[:space:]]*make_interval\(days[[:space:]]*=>[[:space:]]*new_interval\)[[:space:]]+else[[:space:]]+clock_timestamp\(\)[[:space:]]+end;';
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;
  if ddl !~* expected_pattern then
    raise exception 'candidate spacing expression is missing';
  end if;
  if ddl ~* forbidden_pattern then
    raise exception 'legacy perfect-only spacing expression is still active';
  end if;
end $$;
