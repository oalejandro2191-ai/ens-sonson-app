-- SQL-level guard for the deployable valid-review spacing candidate.
do $$
declare
  ddl text;
  expected_expression constant text := 'next_at:=case when pass then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;';
  forbidden_expression constant text := 'next_at:=case when perfect then clock_timestamp()+make_interval(days=>new_interval) else clock_timestamp() end;';
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;
  if position(expected_expression in ddl)=0 then
    raise exception 'candidate spacing expression is missing';
  end if;
  if position(forbidden_expression in ddl)>0 then
    raise exception 'legacy perfect-only spacing expression is still active';
  end if;
end $$;
