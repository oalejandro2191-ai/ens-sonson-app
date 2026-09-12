-- Local/Staging only until explicitly approved for production.
alter table private.practice_session_receipts enable row level security;
alter table private.institution_audit_log enable row level security;
alter table private.group_membership_events enable row level security;
revoke all on table private.practice_session_receipts from anon, authenticated;
revoke all on table private.institution_audit_log from anon, authenticated;
revoke all on table private.group_membership_events from anon, authenticated;

-- Supabase service_role remains the trusted administrative identity for local test fixture setup.
grant usage on schema public, private to service_role;
grant all privileges on all tables in schema public, private to service_role;
grant all privileges on all sequences in schema public, private to service_role;

-- Keep legacy RPCs out of the pilot browser surface when they exist in a fuller schema.
do $$
begin
  if to_regprocedure('public.update_my_profile_alias(text)') is not null then
    execute 'revoke execute on function public.update_my_profile_alias(text) from public, anon';
    execute 'grant execute on function public.update_my_profile_alias(text) to authenticated, service_role';
  end if;
  if to_regprocedure('public.create_teacher_group(text,text)') is not null then
    execute 'revoke execute on function public.create_teacher_group(text,text) from public, anon, authenticated';
    execute 'grant execute on function public.create_teacher_group(text,text) to service_role';
  end if;
end $$;
