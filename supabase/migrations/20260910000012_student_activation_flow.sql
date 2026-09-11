-- ENS English — first-login student activation flow.
-- A student created or reset by an institution_admin must replace the temporary
-- password before academic access is considered fully active.

create or replace function public.get_my_student_activation_state_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  membership_status text;
  target_school uuid;
  display_name text;
  password_change_required boolean:=false;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;

  select im.status,im.school_id
  into membership_status,target_school
  from private.institution_memberships im
  where im.user_id=viewer and im.role='student'
  order by im.created_at desc
  limit 1;

  if membership_status is null then
    return jsonb_build_object(
      'required',false,
      'status',null,
      'school_id',null,
      'display_alias',null,
      'password_change_required',false
    );
  end if;

  select lower(coalesce(u.raw_app_meta_data->>'must_change_password','false'))='true'
  into password_change_required
  from auth.users u
  where u.id=viewer;

  select p.display_alias into display_name
  from public.profiles p
  where p.id=viewer;

  return jsonb_build_object(
    'required',(membership_status='pending_activation' or coalesce(password_change_required,false)),
    'status',membership_status,
    'school_id',target_school,
    'display_alias',display_name,
    'password_change_required',coalesce(password_change_required,false)
  );
end $$;

create or replace function public.service_complete_student_activation_v1(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  membership_status text;
  target_school uuid;
  activated boolean:=false;
  audit_action text;
begin
  if target_user_id is null then raise exception 'Estudiante requerido'; end if;

  select im.status,im.school_id
  into membership_status,target_school
  from private.institution_memberships im
  where im.user_id=target_user_id and im.role='student'
  order by im.created_at desc
  limit 1
  for update;

  if membership_status is null then raise exception 'Membresía estudiantil no encontrada'; end if;
  if membership_status not in ('pending_activation','active') then raise exception 'La cuenta no está disponible para activación'; end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=target_user_id and p.school_id=target_school and p.role='student'
  ) then
    raise exception 'Perfil estudiantil no encontrado';
  end if;

  if not exists(
    select 1
    from public.group_members gm
    join public.groups g on g.id=gm.group_id
    where gm.student_id=target_user_id
      and gm.status='active'
      and g.school_id=target_school
      and g.status='active'
      and g.archived_at is null
  ) then
    raise exception 'Grupo activo requerido para completar la activación';
  end if;

  if membership_status='pending_activation' then
    update private.institution_memberships
    set status='active'
    where school_id=target_school and user_id=target_user_id and role='student';
    activated:=true;
    audit_action:='student.activated';
  else
    audit_action:='student.password_changed';
  end if;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(
    target_school,
    target_user_id,
    audit_action,
    'student',
    target_user_id,
    jsonb_build_object('source','self_service_first_login','activated',activated)
  );

  return jsonb_build_object(
    'user_id',target_user_id,
    'status','active',
    'activated',activated
  );
end $$;

revoke all on function public.get_my_student_activation_state_v1() from public,anon;
revoke all on function public.service_complete_student_activation_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_my_student_activation_state_v1() to authenticated;
grant execute on function public.service_complete_student_activation_v1(uuid) to service_role;
