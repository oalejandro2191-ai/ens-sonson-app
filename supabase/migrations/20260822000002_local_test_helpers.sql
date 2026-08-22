-- TEST-ONLY. Never apply this migration to production.
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
declare membership_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  insert into private.institution_memberships(school_id,user_id,role,status)
  values(target_school_id,target_user_id,target_role,'active')
  on conflict(school_id,user_id,role) do update set status='active'
  returning id into membership_id;

  if target_role='student' and target_group_id is not null then
    insert into public.group_members(group_id,student_id,status)
    values(target_group_id,target_user_id,'active')
    on conflict(group_id,student_id) do update set status='active';
  elsif target_role='teacher' and target_group_id is not null and target_academic_year_id is not null then
    insert into private.teacher_assignments(membership_id,group_id,academic_year_id,status)
    values(membership_id,target_group_id,target_academic_year_id,'active')
    on conflict(membership_id,group_id,academic_year_id) do update set status='active';
  end if;
end $$;
revoke all on function public.local_test_configure_membership(uuid,uuid,public.institution_role,uuid,uuid) from public,anon,authenticated;
grant execute on function public.local_test_configure_membership(uuid,uuid,public.institution_role,uuid,uuid) to service_role;
