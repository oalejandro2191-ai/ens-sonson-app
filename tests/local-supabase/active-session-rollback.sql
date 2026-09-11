\set ON_ERROR_STOP on

begin;
\ir ../../supabase/rollback/20260822000004_active_route_session_recovery.rollback.sql

do $$
begin
  if to_regprocedure('public.get_my_active_route_session_v1(text)') is not null then
    raise exception 'rollback did not remove get_my_active_route_session_v1';
  end if;
  if to_regprocedure('public.start_route_lesson_session_v1(text,uuid,text,jsonb)') is null then
    raise exception 'rollback did not restore start_route_lesson_session_v1';
  end if;
end $$;

rollback;

-- Transaction rollback must leave the candidate migration active for subsequent tests.
do $$
begin
  if to_regprocedure('public.get_my_active_route_session_v1(text)') is null then
    raise exception 'rollback validation altered the test database';
  end if;
end $$;
