-- ENS English — secure manual student provisioning for institution_admin.
-- Auth account creation remains server-side in an Edge Function. These RPCs
-- validate institution/group scope and provision only an already-created Auth user.
-- A newly created student is pending_activation until the activation flow is completed.

create or replace function public.admin_validate_student_creation_v1(
  provided_full_name text,
  provided_email text,
  target_group_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_school uuid:=private.require_institution_admin();
  name_value text:=nullif(btrim(provided_full_name),'');
  email_value text:=lower(nullif(btrim(provided_email),''));
  group_name text;
begin
  if name_value is null then raise exception 'El nombre del estudiante es obligatorio'; end if;
  if length(name_value)>160 then raise exception 'El nombre del estudiante es demasiado largo'; end if;
  if email_value is null or position('@' in email_value)<=1 then raise exception 'Correo de acceso inválido'; end if;
  if length(email_value)>254 then raise exception 'Correo de acceso demasiado largo'; end if;

  select g.name into group_name
  from public.groups g
  where g.id=target_group_id
    and g.school_id=target_school
    and g.status='active'
    and g.archived_at is null;
  if group_name is null then raise exception 'Grupo activo no encontrado en esta institución'; end if;

  if exists(select 1 from auth.users u where lower(u.email)=email_value) then
    raise exception 'Ya existe una cuenta con ese correo de acceso';
  end if;

  return jsonb_build_object(
    'authorized',true,
    'school_id',target_school,
    'group_id',target_group_id,
    'group_name',group_name,
    'full_name',name_value,
    'email',email_value
  );
end $$;

create or replace function public.admin_provision_created_student_v1(
  target_user_id uuid,
  provided_full_name text,
  target_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  name_value text:=nullif(btrim(provided_full_name),'');
  group_name text;
  target_email text;
begin
  if name_value is null then raise exception 'El nombre del estudiante es obligatorio'; end if;

  select u.email into target_email from auth.users u where u.id=target_user_id;
  if target_email is null then raise exception 'Cuenta Auth no encontrada'; end if;

  select g.name into group_name
  from public.groups g
  where g.id=target_group_id
    and g.school_id=target_school
    and g.status='active'
    and g.archived_at is null;
  if group_name is null then raise exception 'Grupo activo no encontrado en esta institución'; end if;

  if exists(select 1 from private.institution_memberships im where im.user_id=target_user_id) then
    raise exception 'La cuenta ya tiene una membresía institucional';
  end if;
  if exists(select 1 from public.profiles p where p.id=target_user_id) then
    raise exception 'La cuenta ya tiene un perfil institucional';
  end if;

  insert into public.profiles(id,school_id,role,display_alias)
  values(target_user_id,target_school,'student',name_value);

  insert into private.institution_memberships(school_id,user_id,role,status)
  values(target_school,target_user_id,'student','pending_activation');

  insert into public.group_members(group_id,student_id,status,joined_at)
  values(target_group_id,target_user_id,'active',clock_timestamp());

  insert into public.student_stats(student_id)
  values(target_user_id)
  on conflict(student_id) do nothing;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'student.created','student',target_user_id,jsonb_build_object(
    'full_name',name_value,
    'email',target_email,
    'group_id',target_group_id,
    'group_name',group_name,
    'status','pending_activation',
    'source','manual_admin'
  ));

  return jsonb_build_object(
    'user_id',target_user_id,
    'full_name',name_value,
    'email',target_email,
    'status','pending_activation',
    'group_id',target_group_id,
    'group_name',group_name
  );
end $$;

revoke all on function public.admin_validate_student_creation_v1(text,text,uuid) from public,anon;
revoke all on function public.admin_provision_created_student_v1(uuid,text,uuid) from public,anon;
grant execute on function public.admin_validate_student_creation_v1(text,text,uuid) to authenticated;
grant execute on function public.admin_provision_created_student_v1(uuid,text,uuid) to authenticated;
