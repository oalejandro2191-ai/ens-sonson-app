\set ON_ERROR_STOP on

select id::text as student1_id from auth.users where email='student1@ens.local' \gset
select id::text as student2_id from auth.users where email='student2@ens.local' \gset
select id::text as teacher_id from auth.users where email='teacher@ens.local' \gset

begin;
set local role authenticated;

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub', :'student1_id', true);
do $$
declare payload jsonb;
begin
  payload:=public.get_my_active_route_session_v1('A1-V3');
  if payload is null then raise exception 'student1 active session missing'; end if;
  if payload->>'session_id' is null then raise exception 'active session id missing'; end if;
end $$;

-- A different student cannot discover the first student's active session.
select set_config('request.jwt.claim.sub', :'student2_id', true);
do $$
declare payload jsonb;
begin
  payload:=public.get_my_active_route_session_v1('A1-V3');
  if payload is not null then raise exception 'foreign active session leaked'; end if;
end $$;

-- The teacher role cannot enter the student runtime.
select set_config('request.jwt.claim.sub', :'teacher_id', true);
do $$
begin
  begin
    perform public.get_my_active_route_session_v1('A1-V3');
    raise exception 'teacher unexpectedly entered student runtime';
  exception
    when others then
      if sqlerrm='teacher unexpectedly entered student runtime' then raise; end if;
  end;
end $$;

rollback;

-- Anonymous callers must not receive EXECUTE privileges.
do $$
declare anon_exec boolean;
declare auth_exec boolean;
begin
  select has_function_privilege('anon','public.get_my_active_route_session_v1(text)','EXECUTE') into anon_exec;
  select has_function_privilege('authenticated','public.get_my_active_route_session_v1(text)','EXECUTE') into auth_exec;
  if anon_exec then raise exception 'anon unexpectedly has execute privilege'; end if;
  if not auth_exec then raise exception 'authenticated execute privilege missing'; end if;
end $$;
