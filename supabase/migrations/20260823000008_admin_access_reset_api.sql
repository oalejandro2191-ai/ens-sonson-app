-- Authorization bridge for the server-side password reset Edge Function.
-- No password or service-role secret passes through PostgreSQL or the browser.

create or replace function public.admin_validate_student_access_reset_v1(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_school uuid:=private.require_institution_admin();
  student_status text;
  student_name text;
begin
  select im.status,
         coalesce(nullif(u.raw_user_meta_data->>'full_name',''),p.display_alias)
  into student_status,student_name
  from private.institution_memberships im
  join auth.users u on u.id=im.user_id
  left join public.profiles p on p.id=im.user_id
  where im.school_id=target_school
    and im.user_id=target_user_id
    and im.role='student'
  order by im.created_at desc
  limit 1;

  if student_status is null then
    raise exception 'Estudiante no encontrado en esta institución';
  end if;
  if student_status='archived' then
    raise exception 'El estudiante está archivado; reactívelo antes de regenerar acceso';
  end if;

  return jsonb_build_object(
    'authorized',true,
    'student_user_id',target_user_id,
    'student_name',student_name,
    'student_status',student_status,
    'school_id',target_school
  );
end $$;

create or replace function public.admin_log_student_access_reset_v1(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
begin
  if not exists(
    select 1 from private.institution_memberships im
    where im.school_id=target_school and im.user_id=target_user_id and im.role='student'
  ) then raise exception 'Estudiante no encontrado en esta institución'; end if;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'student.access_reset','student',target_user_id,jsonb_build_object('method','temporary_password'));

  return jsonb_build_object('logged',true,'student_user_id',target_user_id);
end $$;

revoke all on function public.admin_validate_student_access_reset_v1(uuid) from public,anon;
revoke all on function public.admin_log_student_access_reset_v1(uuid) from public,anon;
grant execute on function public.admin_validate_student_access_reset_v1(uuid) to authenticated;
grant execute on function public.admin_log_student_access_reset_v1(uuid) to authenticated;
