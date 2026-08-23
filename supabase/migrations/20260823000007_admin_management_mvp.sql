-- ENS English — institution admin management MVP
-- Incremental candidate migration. Safe for existing schemas.
-- Browser clients keep read-only table access; all writes below pass through
-- authenticated SECURITY DEFINER RPCs scoped to the caller's institution.

alter table public.vocabulary_words
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz;

do $$ begin
  alter table public.vocabulary_words
    add constraint vocabulary_words_status_check
    check (status in ('active','archived','unpublished'));
exception when duplicate_object then null;
end $$;

create index if not exists vocabulary_words_status_idx
  on public.vocabulary_words(status);

create or replace function public.get_admin_groups_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_school uuid := private.require_institution_admin();
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,
    'name',g.name,
    'grade',g.grade,
    'status',g.status,
    'archived_at',g.archived_at,
    'academic_year_id',g.academic_year_id,
    'academic_year',ay.name,
    'students',(
      select count(*)
      from public.group_members gm
      where gm.group_id=g.id and gm.status='active'
    )
  ) order by coalesce(g.archived_at,'infinity'::timestamptz),g.grade,g.name),'[]'::jsonb)
  into result
  from public.groups g
  left join public.academic_years ay on ay.id=g.academic_year_id
  where g.school_id=target_school;

  return result;
end $$;

create or replace function public.admin_create_group_v1(
  provided_name text,
  provided_grade text default null,
  provided_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  new_group public.groups%rowtype;
  normalized_name text:=nullif(btrim(provided_name),'');
  join_code_value text;
begin
  if normalized_name is null then raise exception 'El nombre del grupo es obligatorio'; end if;
  if length(normalized_name)>80 then raise exception 'El nombre del grupo es demasiado largo'; end if;

  if provided_academic_year_id is not null and not exists(
    select 1 from public.academic_years ay
    where ay.id=provided_academic_year_id and ay.school_id=target_school
  ) then raise exception 'Año académico inválido para esta institución'; end if;

  if exists(
    select 1 from public.groups g
    where g.school_id=target_school
      and lower(g.name)=lower(normalized_name)
      and g.archived_at is null
  ) then raise exception 'Ya existe un grupo activo con ese nombre'; end if;

  loop
    join_code_value:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    exit when not exists(select 1 from public.groups where join_code=join_code_value);
  end loop;

  insert into public.groups(school_id,name,grade,join_code,academic_year_id,status)
  values(target_school,normalized_name,nullif(btrim(provided_grade),''),join_code_value,provided_academic_year_id,'active')
  returning * into new_group;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'group.created','group',new_group.id,jsonb_build_object(
    'name',new_group.name,'grade',new_group.grade,'academic_year_id',new_group.academic_year_id
  ));

  return jsonb_build_object('id',new_group.id,'name',new_group.name,'grade',new_group.grade,'status',new_group.status);
end $$;

create or replace function public.admin_update_group_v1(
  target_group_id uuid,
  provided_name text,
  provided_grade text default null,
  provided_academic_year_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  before_row public.groups%rowtype;
  after_row public.groups%rowtype;
  normalized_name text:=nullif(btrim(provided_name),'');
begin
  select * into before_row from public.groups
  where id=target_group_id and school_id=target_school;
  if not found then raise exception 'Grupo no encontrado'; end if;
  if normalized_name is null then raise exception 'El nombre del grupo es obligatorio'; end if;
  if before_row.archived_at is not null then raise exception 'Un grupo archivado no se edita directamente; restáurelo primero'; end if;

  if provided_academic_year_id is not null and not exists(
    select 1 from public.academic_years ay
    where ay.id=provided_academic_year_id and ay.school_id=target_school
  ) then raise exception 'Año académico inválido para esta institución'; end if;

  if exists(
    select 1 from public.groups g
    where g.school_id=target_school and g.id<>target_group_id
      and lower(g.name)=lower(normalized_name) and g.archived_at is null
  ) then raise exception 'Ya existe un grupo activo con ese nombre'; end if;

  update public.groups
  set name=normalized_name,
      grade=nullif(btrim(provided_grade),''),
      academic_year_id=provided_academic_year_id
  where id=target_group_id
  returning * into after_row;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'group.updated','group',target_group_id,jsonb_build_object(
    'before',jsonb_build_object('name',before_row.name,'grade',before_row.grade,'academic_year_id',before_row.academic_year_id),
    'after',jsonb_build_object('name',after_row.name,'grade',after_row.grade,'academic_year_id',after_row.academic_year_id)
  ));

  return jsonb_build_object('id',after_row.id,'name',after_row.name,'grade',after_row.grade,'status',after_row.status);
end $$;

create or replace function public.admin_archive_group_v1(target_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  target_name text;
begin
  select name into target_name from public.groups where id=target_group_id and school_id=target_school;
  if target_name is null then raise exception 'Grupo no encontrado'; end if;

  update public.groups set status='archived',archived_at=coalesce(archived_at,clock_timestamp())
  where id=target_group_id and school_id=target_school;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'group.archived','group',target_group_id,jsonb_build_object('name',target_name));

  return jsonb_build_object('id',target_group_id,'status','archived');
end $$;

create or replace function public.admin_restore_group_v1(target_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
begin
  if not exists(select 1 from public.groups where id=target_group_id and school_id=target_school) then
    raise exception 'Grupo no encontrado';
  end if;
  update public.groups set status='active',archived_at=null where id=target_group_id and school_id=target_school;
  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'group.restored','group',target_group_id,'{}'::jsonb);
  return jsonb_build_object('id',target_group_id,'status','active');
end $$;

create or replace function public.get_admin_students_v1(
  provided_search text default null,
  provided_group_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_school uuid:=private.require_institution_admin();
  search_value text:=nullif(btrim(provided_search),'');
  result jsonb;
begin
  if provided_group_id is not null and not exists(
    select 1 from public.groups g where g.id=provided_group_id and g.school_id=target_school
  ) then raise exception 'Grupo fuera de la institución'; end if;

  select coalesce(jsonb_agg(student_row order by lower(student_row->>'full_name')),'[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'user_id',im.user_id,
      'full_name',coalesce(nullif(u.raw_user_meta_data->>'full_name',''),p.display_alias),
      'email',u.email,
      'status',im.status,
      'last_sign_in_at',u.last_sign_in_at,
      'group_id',g.id,
      'group_name',g.name,
      'grade',g.grade,
      'mastered',coalesce((select count(*) from public.student_word_progress swp where swp.student_id=im.user_id and swp.mastery_state='mastered'),0),
      'learning',coalesce((select count(*) from public.student_word_progress swp where swp.student_id=im.user_id and swp.mastery_state='learning'),0),
      'review',coalesce((select count(*) from public.student_word_progress swp where swp.student_id=im.user_id and swp.mastery_state='review'),0),
      'xp',coalesce(ss.total_xp,0)
    ) student_row
    from private.institution_memberships im
    join auth.users u on u.id=im.user_id
    left join public.profiles p on p.id=im.user_id
    left join lateral (
      select gg.id,gg.name,gg.grade
      from public.group_members gm
      join public.groups gg on gg.id=gm.group_id
      where gm.student_id=im.user_id
        and gm.status='active'
        and gg.school_id=target_school
      order by gm.joined_at desc
      limit 1
    ) g on true
    left join public.student_stats ss on ss.student_id=im.user_id
    where im.school_id=target_school and im.role='student'
      and (provided_group_id is null or g.id=provided_group_id)
      and (search_value is null or lower(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),p.display_alias,u.email,'')) like '%'||lower(search_value)||'%')
  ) q;
  return result;
end $$;

create or replace function public.admin_set_student_status_v1(target_user_id uuid, provided_status text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  before_status text;
  normalized_status text:=lower(btrim(provided_status));
begin
  if normalized_status not in ('pending_activation','active','suspended','archived') then
    raise exception 'Estado de estudiante inválido';
  end if;
  select status into before_status from private.institution_memberships
  where school_id=target_school and user_id=target_user_id and role='student';
  if before_status is null then raise exception 'Estudiante no encontrado en esta institución'; end if;

  update private.institution_memberships set status=normalized_status
  where school_id=target_school and user_id=target_user_id and role='student';

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'student.status_changed','student',target_user_id,jsonb_build_object('before',before_status,'after',normalized_status));

  return jsonb_build_object('user_id',target_user_id,'status',normalized_status);
end $$;

create or replace function public.admin_assign_student_group_v1(target_user_id uuid,target_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  old_group uuid;
  target_group_name text;
begin
  if not exists(select 1 from private.institution_memberships im where im.school_id=target_school and im.user_id=target_user_id and im.role='student') then
    raise exception 'Estudiante no encontrado en esta institución';
  end if;
  select name into target_group_name from public.groups
  where id=target_group_id and school_id=target_school and archived_at is null and status='active';
  if target_group_name is null then raise exception 'Grupo activo no encontrado en esta institución'; end if;

  select gm.group_id into old_group
  from public.group_members gm join public.groups g on g.id=gm.group_id
  where gm.student_id=target_user_id and gm.status='active' and g.school_id=target_school
  order by gm.joined_at desc limit 1;

  update public.group_members gm set status='inactive',ended_at=clock_timestamp(),end_reason='moved_by_admin'
  from public.groups g
  where gm.group_id=g.id and gm.student_id=target_user_id and gm.status='active' and g.school_id=target_school;

  insert into public.group_members(group_id,student_id,status,joined_at,ended_at,end_reason)
  values(target_group_id,target_user_id,'active',clock_timestamp(),null,null)
  on conflict(group_id,student_id) do update
  set status='active',joined_at=clock_timestamp(),ended_at=null,end_reason=null;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'student.group_changed','student',target_user_id,jsonb_build_object('before_group_id',old_group,'after_group_id',target_group_id,'after_group_name',target_group_name));

  return jsonb_build_object('user_id',target_user_id,'group_id',target_group_id,'group_name',target_group_name);
end $$;

create or replace function public.get_admin_vocabulary_v1(
  provided_search text default null,
  provided_status text default null,
  provided_limit integer default 100,
  provided_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_school uuid:=private.require_institution_admin();
  search_value text:=nullif(btrim(provided_search),'');
  limit_value integer:=greatest(1,least(coalesce(provided_limit,100),250));
  offset_value integer:=greatest(0,coalesce(provided_offset,0));
  result jsonb;
begin
  perform target_school;
  select jsonb_build_object(
    'total',count(*) over (),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',w.id,'learning_unit_id',w.learning_unit_id,'unit_code',w.unit_code,
      'english',w.english,'spanish',w.spanish,'unit_type',w.unit_type,
      'accepted_forms',w.accepted_forms,'category',w.category,'difficulty',w.difficulty,
      'example_en',w.example_en,'example_es',w.example_es,'priority',w.priority,
      'status',w.status,'archived_at',w.archived_at,'audio_path',w.audio_path,
      'lesson_refs',(select count(*) from public.learning_lesson_units llu where llu.word_id=w.id),
      'attempt_refs',(select count(*) from public.practice_attempts pa where pa.word_id=w.id),
      'progress_refs',(select count(*) from public.student_word_progress swp where swp.word_id=w.id)
    ) order by lower(w.english)),'[]'::jsonb)
  ) into result
  from (
    select * from public.vocabulary_words w
    where (provided_status is null or w.status=provided_status)
      and (search_value is null or lower(w.english) like '%'||lower(search_value)||'%' or lower(w.spanish) like '%'||lower(search_value)||'%')
    order by lower(w.english)
    limit limit_value offset offset_value
  ) w;
  return coalesce(result,jsonb_build_object('total',0,'items','[]'::jsonb));
end $$;

create or replace function public.admin_create_vocabulary_word_v1(
  provided_english text,
  provided_spanish text,
  provided_unit_type text default 'word',
  provided_accepted_forms jsonb default '[]'::jsonb,
  provided_category text default 'general',
  provided_difficulty smallint default 1,
  provided_example_en text default null,
  provided_example_es text default null,
  provided_priority smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  english_value text:=nullif(btrim(provided_english),'');
  spanish_value text:=nullif(btrim(provided_spanish),'');
  type_value text:=lower(btrim(coalesce(provided_unit_type,'word')));
  code_value text;
  new_word public.vocabulary_words%rowtype;
begin
  if english_value is null or spanish_value is null then raise exception 'Inglés y español son obligatorios'; end if;
  if type_value not in ('word','chunk','phrasal_verb','expression','command') then raise exception 'Tipo de Learning Unit inválido'; end if;
  if exists(select 1 from public.vocabulary_words w where lower(btrim(w.english))=lower(english_value) and w.unit_type=type_value and w.status<>'archived') then
    raise exception 'Ya existe una Learning Unit activa con ese inglés y tipo';
  end if;
  code_value:='LU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  insert into public.vocabulary_words(
    english,spanish,category,difficulty,pronunciation,audio_path,image_path,visual_hint,
    example_en,example_es,priority,unit_code,unit_type,lemma,accepted_forms,learning_unit_id,status
  ) values(
    english_value,spanish_value,coalesce(nullif(btrim(provided_category),''),'general'),
    greatest(1,least(coalesce(provided_difficulty,1),5)),null,null,null,null,
    coalesce(nullif(btrim(provided_example_en),''),english_value),
    coalesce(nullif(btrim(provided_example_es),''),spanish_value),
    greatest(1,coalesce(provided_priority,1)),code_value,type_value,lower(english_value),
    coalesce(provided_accepted_forms,'[]'::jsonb),code_value,'active'
  ) returning * into new_word;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'vocabulary.created','learning_unit',new_word.id,jsonb_build_object('english',new_word.english,'spanish',new_word.spanish,'unit_type',new_word.unit_type));

  return to_jsonb(new_word);
end $$;

create or replace function public.admin_update_vocabulary_word_v1(
  target_word_id uuid,
  provided_english text,
  provided_spanish text,
  provided_unit_type text,
  provided_accepted_forms jsonb,
  provided_category text,
  provided_difficulty smallint,
  provided_example_en text,
  provided_example_es text,
  provided_priority smallint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  before_row public.vocabulary_words%rowtype;
  after_row public.vocabulary_words%rowtype;
  is_used boolean;
  english_value text:=nullif(btrim(provided_english),'');
  spanish_value text:=nullif(btrim(provided_spanish),'');
  type_value text:=lower(btrim(provided_unit_type));
begin
  select * into before_row from public.vocabulary_words where id=target_word_id;
  if not found then raise exception 'Learning Unit no encontrada'; end if;
  if english_value is null or spanish_value is null then raise exception 'Inglés y español son obligatorios'; end if;
  if type_value not in ('word','chunk','phrasal_verb','expression','command') then raise exception 'Tipo de Learning Unit inválido'; end if;

  is_used:=exists(select 1 from public.learning_lesson_units where word_id=target_word_id)
       or exists(select 1 from public.practice_attempts where word_id=target_word_id)
       or exists(select 1 from public.student_word_progress where word_id=target_word_id);
  if is_used and (lower(english_value)<>lower(before_row.english) or type_value<>before_row.unit_type) then
    raise exception 'Una Learning Unit con historial no puede cambiar su inglés ni su tipo; cree una nueva versión';
  end if;

  update public.vocabulary_words set
    english=english_value,spanish=spanish_value,unit_type=type_value,
    lemma=case when is_used then lemma else lower(english_value) end,
    accepted_forms=coalesce(provided_accepted_forms,'[]'::jsonb),
    category=coalesce(nullif(btrim(provided_category),''),'general'),
    difficulty=greatest(1,least(coalesce(provided_difficulty,1),5)),
    example_en=coalesce(nullif(btrim(provided_example_en),''),english_value),
    example_es=coalesce(nullif(btrim(provided_example_es),''),spanish_value),
    priority=greatest(1,coalesce(provided_priority,1)),updated_at=clock_timestamp()
  where id=target_word_id returning * into after_row;

  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'vocabulary.updated','learning_unit',target_word_id,jsonb_build_object(
    'before',jsonb_build_object('english',before_row.english,'spanish',before_row.spanish,'unit_type',before_row.unit_type,'category',before_row.category),
    'after',jsonb_build_object('english',after_row.english,'spanish',after_row.spanish,'unit_type',after_row.unit_type,'category',after_row.category)
  ));
  return to_jsonb(after_row);
end $$;

create or replace function public.admin_archive_vocabulary_word_v1(target_word_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  target_english text;
begin
  select english into target_english from public.vocabulary_words where id=target_word_id;
  if target_english is null then raise exception 'Learning Unit no encontrada'; end if;
  update public.vocabulary_words set status='archived',archived_at=coalesce(archived_at,clock_timestamp()),updated_at=clock_timestamp() where id=target_word_id;
  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'vocabulary.archived','learning_unit',target_word_id,jsonb_build_object('english',target_english));
  return jsonb_build_object('id',target_word_id,'status','archived');
end $$;

create or replace function public.admin_restore_vocabulary_word_v1(target_word_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
begin
  if not exists(select 1 from public.vocabulary_words where id=target_word_id) then raise exception 'Learning Unit no encontrada'; end if;
  update public.vocabulary_words set status='active',archived_at=null,updated_at=clock_timestamp() where id=target_word_id;
  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'vocabulary.restored','learning_unit',target_word_id,'{}'::jsonb);
  return jsonb_build_object('id',target_word_id,'status','active');
end $$;

create or replace function public.admin_delete_unused_vocabulary_word_v1(target_word_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  target_school uuid:=private.require_institution_admin();
  target_english text;
begin
  select english into target_english from public.vocabulary_words where id=target_word_id;
  if target_english is null then raise exception 'Learning Unit no encontrada'; end if;
  if exists(select 1 from public.learning_lesson_units where word_id=target_word_id)
    or exists(select 1 from public.practice_attempts where word_id=target_word_id)
    or exists(select 1 from public.student_word_progress where word_id=target_word_id) then
    raise exception 'La Learning Unit tiene historial o referencias y no puede eliminarse; archívela';
  end if;
  delete from public.vocabulary_words where id=target_word_id;
  insert into private.institution_audit_log(school_id,actor_id,action,target_type,target_id,metadata)
  values(target_school,viewer,'vocabulary.deleted_unused','learning_unit',target_word_id,jsonb_build_object('english',target_english));
  return jsonb_build_object('id',target_word_id,'deleted',true);
end $$;

create or replace function public.get_admin_audit_v1(provided_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  target_school uuid:=private.require_institution_admin();
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'actor_id',a.actor_id,'action',a.action,'target_type',a.target_type,
    'target_id',a.target_id,'metadata',a.metadata,'created_at',a.created_at
  ) order by a.created_at desc),'[]'::jsonb)
  into result
  from (
    select * from private.institution_audit_log
    where school_id=target_school
    order by created_at desc
    limit greatest(1,least(coalesce(provided_limit,50),200))
  ) a;
  return result;
end $$;

create or replace function public.get_my_admin_portal_v1()
returns jsonb
language plpgsql
stable
security definer
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
  students_pending integer;
  learning_units_total integer;
  learning_units_active integer;
  learning_units_archived integer;
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

  select count(*) into groups_total from public.groups g where g.school_id=target_school and g.archived_at is null;
  select count(*) into students_active from private.institution_memberships im where im.school_id=target_school and im.role='student' and im.status='active';
  select count(*) into students_pending from private.institution_memberships im where im.school_id=target_school and im.role='student' and im.status='pending_activation';
  select count(*),count(*) filter(where status='active'),count(*) filter(where status='archived')
    into learning_units_total,learning_units_active,learning_units_archived from public.vocabulary_words;
  select count(*) into routes_total from public.learning_routes r where r.school_id=target_school;

  return jsonb_build_object(
    'profile',jsonb_build_object('user_id',viewer,'full_name',full_name,'institution_id',target_school,'institution',school_name,'role','institution_admin','assigned_groups',assigned_groups,'account_status',account_status,'last_access_at',last_access),
    'dashboard',jsonb_build_object('groups_total',groups_total,'students_active',students_active,'students_pending_activation',students_pending,'learning_units_total',learning_units_total,'learning_units_active',learning_units_active,'learning_units_archived',learning_units_archived,'routes_total',routes_total,'system_status','staging_ready')
  );
end $$;

revoke all on function public.get_admin_groups_v1() from public,anon;
revoke all on function public.admin_create_group_v1(text,text,uuid) from public,anon;
revoke all on function public.admin_update_group_v1(uuid,text,text,uuid) from public,anon;
revoke all on function public.admin_archive_group_v1(uuid) from public,anon;
revoke all on function public.admin_restore_group_v1(uuid) from public,anon;
revoke all on function public.get_admin_students_v1(text,uuid) from public,anon;
revoke all on function public.admin_set_student_status_v1(uuid,text) from public,anon;
revoke all on function public.admin_assign_student_group_v1(uuid,uuid) from public,anon;
revoke all on function public.get_admin_vocabulary_v1(text,text,integer,integer) from public,anon;
revoke all on function public.admin_create_vocabulary_word_v1(text,text,text,jsonb,text,smallint,text,text,smallint) from public,anon;
revoke all on function public.admin_update_vocabulary_word_v1(uuid,text,text,text,jsonb,text,smallint,text,text,smallint) from public,anon;
revoke all on function public.admin_archive_vocabulary_word_v1(uuid) from public,anon;
revoke all on function public.admin_restore_vocabulary_word_v1(uuid) from public,anon;
revoke all on function public.admin_delete_unused_vocabulary_word_v1(uuid) from public,anon;
revoke all on function public.get_admin_audit_v1(integer) from public,anon;

grant execute on function public.get_admin_groups_v1() to authenticated;
grant execute on function public.admin_create_group_v1(text,text,uuid) to authenticated;
grant execute on function public.admin_update_group_v1(uuid,text,text,uuid) to authenticated;
grant execute on function public.admin_archive_group_v1(uuid) to authenticated;
grant execute on function public.admin_restore_group_v1(uuid) to authenticated;
grant execute on function public.get_admin_students_v1(text,uuid) to authenticated;
grant execute on function public.admin_set_student_status_v1(uuid,text) to authenticated;
grant execute on function public.admin_assign_student_group_v1(uuid,uuid) to authenticated;
grant execute on function public.get_admin_vocabulary_v1(text,text,integer,integer) to authenticated;
grant execute on function public.admin_create_vocabulary_word_v1(text,text,text,jsonb,text,smallint,text,text,smallint) to authenticated;
grant execute on function public.admin_update_vocabulary_word_v1(uuid,text,text,text,jsonb,text,smallint,text,text,smallint) to authenticated;
grant execute on function public.admin_archive_vocabulary_word_v1(uuid) to authenticated;
grant execute on function public.admin_restore_vocabulary_word_v1(uuid) to authenticated;
grant execute on function public.admin_delete_unused_vocabulary_word_v1(uuid) to authenticated;
grant execute on function public.get_admin_audit_v1(integer) to authenticated;
