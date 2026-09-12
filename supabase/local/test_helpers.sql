-- TEST-ONLY LOCAL HELPER. This file intentionally lives outside supabase/migrations.
-- It must never be applied by supabase db push or to any remote project.
create or replace function public.local_test_configure_membership(
  target_user_id uuid,
  target_school_id uuid,
  target_role public.institution_role,
  target_group_id uuid default null,
  target_academic_year_id uuid default null
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare configured_membership_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;

  insert into private.institution_memberships(school_id,user_id,role,status)
  values(target_school_id,target_user_id,target_role,'active')
  on conflict(school_id,user_id,role) do update set status='active'
  returning id into configured_membership_id;

  if target_role='student' and target_group_id is not null then
    insert into public.group_members(group_id,student_id,status)
    values(target_group_id,target_user_id,'active')
    on conflict(group_id,student_id) do update set status='active';
  elsif target_role='teacher' and target_group_id is not null and target_academic_year_id is not null then
    insert into private.teacher_assignments(membership_id,group_id,academic_year_id,status)
    values(configured_membership_id,target_group_id,target_academic_year_id,'active')
    on conflict(membership_id,group_id,academic_year_id) do update set status='active';
  end if;
end $$;

revoke all on function public.local_test_configure_membership(uuid,uuid,public.institution_role,uuid,uuid) from public,anon,authenticated;
grant execute on function public.local_test_configure_membership(uuid,uuid,public.institution_role,uuid,uuid) to service_role;


-- TEST-ONLY helper for browser activation scenarios.
create or replace function public.local_test_configure_pending_student(
  target_user_id uuid,
  target_school_id uuid,
  target_group_id uuid
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;

  insert into private.institution_memberships(school_id,user_id,role,status)
  values(target_school_id,target_user_id,'student','pending_activation')
  on conflict(school_id,user_id,role) do update set status='pending_activation';

  insert into public.group_members(group_id,student_id,status)
  values(target_group_id,target_user_id,'active')
  on conflict(group_id,student_id) do update set status='active';

  insert into public.student_stats(student_id)
  values(target_user_id)
  on conflict(student_id) do nothing;
end $$;

revoke all on function public.local_test_configure_pending_student(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.local_test_configure_pending_student(uuid,uuid,uuid) to service_role;
