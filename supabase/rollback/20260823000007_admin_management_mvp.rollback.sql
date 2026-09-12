-- Functional rollback for 20260823000007_admin_management_mvp.sql
-- Intentionally retains vocabulary_words.status and archived_at columns to avoid
-- destructive loss if an operator already used archive states. It removes the
-- new management surface and restores the previous read-only admin dashboard.

drop function if exists public.get_admin_groups_v1();
drop function if exists public.admin_create_group_v1(text,text,uuid);
drop function if exists public.admin_update_group_v1(uuid,text,text,uuid);
drop function if exists public.admin_archive_group_v1(uuid);
drop function if exists public.admin_restore_group_v1(uuid);
drop function if exists public.get_admin_students_v1(text,uuid);
drop function if exists public.admin_set_student_status_v1(uuid,text);
drop function if exists public.admin_assign_student_group_v1(uuid,uuid);
drop function if exists public.get_admin_vocabulary_v1(text,text,integer,integer);
drop function if exists public.admin_create_vocabulary_word_v1(text,text,text,jsonb,text,smallint,text,text,smallint);
drop function if exists public.admin_update_vocabulary_word_v1(uuid,text,text,text,jsonb,text,smallint,text,text,smallint);
drop function if exists public.admin_archive_vocabulary_word_v1(uuid);
drop function if exists public.admin_restore_vocabulary_word_v1(uuid);
drop function if exists public.admin_delete_unused_vocabulary_word_v1(uuid);
drop function if exists public.get_admin_audit_v1(integer);

create or replace function public.get_my_admin_portal_v1()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  school_name text;
  full_name text;
  account_status text;
  last_access timestamptz;
  assigned_groups jsonb;
  groups_total integer;
  students_active integer;
  learning_units_total integer;
  routes_total integer;
begin
  select s.name into school_name from public.schools s where s.id=target_school;
  select coalesce(nullif(u.raw_user_meta_data->>'full_name',''),p.display_alias),im.status,u.last_sign_in_at
  into full_name,account_status,last_access
  from public.profiles p join auth.users u on u.id=p.id
  join private.institution_memberships im on im.user_id=p.id and im.school_id=target_school and im.role='institution_admin'
  where p.id=viewer order by im.created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'grade',g.grade,'academic_year',ay.name) order by g.name),'[]'::jsonb)
  into assigned_groups
  from private.teacher_assignments ta
  join private.institution_memberships tim on tim.id=ta.membership_id
  join public.groups g on g.id=ta.group_id
  left join public.academic_years ay on ay.id=g.academic_year_id
  where tim.user_id=viewer and tim.school_id=target_school and tim.role='teacher' and tim.status='active' and ta.status='active' and g.school_id=target_school and g.archived_at is null;

  select count(*) into groups_total from public.groups g where g.school_id=target_school;
  select count(*) into students_active from private.institution_memberships im where im.school_id=target_school and im.role='student' and im.status='active';
  select count(*) into learning_units_total from public.vocabulary_words;
  select count(*) into routes_total from public.learning_routes r where r.school_id=target_school;

  return jsonb_build_object(
    'profile',jsonb_build_object('user_id',viewer,'full_name',full_name,'institution_id',target_school,'institution',school_name,'role','institution_admin','assigned_groups',assigned_groups,'account_status',account_status,'last_access_at',last_access),
    'dashboard',jsonb_build_object('groups_total',groups_total,'students_active',students_active,'students_pending_activation',null,'learning_units_total',learning_units_total,'learning_units_active',null,'learning_units_archived',null,'routes_total',routes_total,'system_status','local_ready')
  );
end $$;

revoke all on function public.get_my_admin_portal_v1() from public,anon;
grant execute on function public.get_my_admin_portal_v1() to authenticated;
