-- ENS English Staging Alpha seed.
-- Fictitious data only. No passwords or real roster data belong in this file.
-- Intended only for the isolated Supabase Staging project.

begin;

do $$
declare
  v_school uuid;
  v_year uuid;
  v_teacher uuid;
  v_admin uuid;
  v_s1 uuid;
  v_s2 uuid;
  v_s3 uuid;
  v_g6 uuid;
  v_g7 uuid;
  v_teacher_membership uuid;
  v_route uuid;
  v_l1 uuid;
  v_l2 uuid;
  v_word uuid;
begin
  if (select count(*) from auth.users where email in (
    'admin.staging@ens.test','teacher.staging@ens.test','student1.staging@ens.test','student2.staging@ens.test','student3.staging@ens.test'
  )) <> 5 then
    raise exception 'Staging Auth fixtures are incomplete';
  end if;

  if exists (
    select 1 from auth.users
    where coalesce(raw_user_meta_data->>'staging_fixture','false') <> 'true'
  ) then
    raise exception 'Refusing seed: non-staging Auth user detected';
  end if;

  select id into v_admin from auth.users where email='admin.staging@ens.test';
  select id into v_teacher from auth.users where email='teacher.staging@ens.test';
  select id into v_s1 from auth.users where email='student1.staging@ens.test';
  select id into v_s2 from auth.users where email='student2.staging@ens.test';
  select id into v_s3 from auth.users where email='student3.staging@ens.test';

  select id into v_school from public.schools where name='ENS English Staging' limit 1;
  if v_school is null then
    insert into public.schools(name,municipality,department,country_code)
    values('ENS English Staging','Staging','Antioquia','CO') returning id into v_school;
  end if;

  select id into v_year from public.academic_years where school_id=v_school and name='2026 STAGING' limit 1;
  if v_year is null then
    insert into public.academic_years(school_id,name,starts_on,ends_on)
    values(v_school,'2026 STAGING','2026-01-01','2026-12-31') returning id into v_year;
  end if;

  insert into public.profiles(id,school_id,role,display_alias)
  values
    (v_admin,v_school,'teacher','Admin Staging'),
    (v_teacher,v_school,'teacher','Teacher Staging'),
    (v_s1,v_school,'student','Student One Staging'),
    (v_s2,v_school,'student','Student Two Staging'),
    (v_s3,v_school,'student','Student Three Staging')
  on conflict(id) do update set school_id=excluded.school_id, role=excluded.role, display_alias=excluded.display_alias, updated_at=now();

  insert into private.institution_memberships(school_id,user_id,role,status)
  values
    (v_school,v_admin,'institution_admin','active'),
    (v_school,v_teacher,'teacher','active'),
    (v_school,v_s1,'student','active'),
    (v_school,v_s2,'student','active'),
    (v_school,v_s3,'student','active')
  on conflict(school_id,user_id,role) do update set status='active';

  select id into v_g6 from public.groups where school_id=v_school and name='6A PRUEBA' limit 1;
  if v_g6 is null then
    insert into public.groups(school_id,teacher_id,name,grade,join_code,academic_year_id,status,section_code)
    values(v_school,v_teacher,'6A PRUEBA','6','STG6A26',v_year,'active','A') returning id into v_g6;
  end if;

  select id into v_g7 from public.groups where school_id=v_school and name='7A PRUEBA' limit 1;
  if v_g7 is null then
    insert into public.groups(school_id,teacher_id,name,grade,join_code,academic_year_id,status,section_code)
    values(v_school,v_teacher,'7A PRUEBA','7','STG7A26',v_year,'active','A') returning id into v_g7;
  end if;

  insert into public.group_members(group_id,student_id,status)
  values(v_g6,v_s1,'active'),(v_g6,v_s2,'active'),(v_g7,v_s3,'active')
  on conflict(group_id,student_id) do update set status='active', ended_at=null, end_reason=null;

  select id into v_teacher_membership from private.institution_memberships
  where school_id=v_school and user_id=v_teacher and role='teacher' and status='active';

  insert into private.teacher_assignments(membership_id,group_id,academic_year_id,status)
  values(v_teacher_membership,v_g6,v_year,'active'),(v_teacher_membership,v_g7,v_year,'active')
  on conflict(membership_id,group_id,academic_year_id) do update set status='active';

  insert into public.vocabulary_words(english,spanish,category,difficulty,example_en,example_es,priority,unit_code,unit_type,lemma,accepted_forms,learning_unit_id)
  values
    ('mother','madre','family',1,'My mother is kind.','Mi madre es amable.',10,'STG-W001','word','mother','["mother"]','STG-LU001'),
    ('father','padre','family',1,'My father is at home.','Mi padre está en casa.',10,'STG-W002','word','father','["father"]','STG-LU002'),
    ('family','familia','family',1,'This is my family.','Esta es mi familia.',10,'STG-W003','word','family','["family"]','STG-LU003'),
    ('school','escuela','school',1,'I go to school.','Voy a la escuela.',10,'STG-W004','word','school','["school"]','STG-LU004'),
    ('teacher','docente','school',1,'The teacher speaks English.','El docente habla inglés.',10,'STG-W005','word','teacher','["teacher"]','STG-LU005'),
    ('book','libro','school',1,'Open your book.','Abre tu libro.',10,'STG-W006','word','book','["book"]','STG-LU006')
  on conflict(unit_code) do update set english=excluded.english,spanish=excluded.spanish,category=excluded.category,example_en=excluded.example_en,example_es=excluded.example_es,accepted_forms=excluded.accepted_forms,updated_at=now();

  insert into public.learning_routes(school_id,route_code,level,version,title,status,assignment_count,lesson_count,content_fingerprint,published_at,mastery_threshold)
  values(v_school,'A1-V3','A1',3,'A1 Staging Alpha','published',0,2,'staging-alpha-v1',now(),0.80)
  on conflict(route_code) do update set school_id=excluded.school_id,level=excluded.level,version=excluded.version,title=excluded.title,status='published',lesson_count=2,content_fingerprint=excluded.content_fingerprint,published_at=coalesce(public.learning_routes.published_at,now());

  select id into v_route from public.learning_routes where route_code='A1-V3';

  select id into v_l1 from public.learning_lessons where route_id=v_route and route_lesson_position=1;
  if v_l1 is null then
    insert into public.learning_lessons(route_id,collection_id,lesson_number,route_lesson_position,title,unit_count,purpose)
    values(v_route,'10000000-0000-0000-0000-000000000001'::uuid,1,1,'My Family',3,'Reconocer y recuperar vocabulario básico de familia.') returning id into v_l1;
  end if;

  select id into v_l2 from public.learning_lessons where route_id=v_route and route_lesson_position=2;
  if v_l2 is null then
    insert into public.learning_lessons(route_id,collection_id,lesson_number,route_lesson_position,title,unit_count,purpose)
    values(v_route,'10000000-0000-0000-0000-000000000002'::uuid,2,2,'At School',3,'Reconocer y recuperar vocabulario básico escolar.') returning id into v_l2;
  end if;

  delete from public.learning_lesson_units where lesson_id in (v_l1,v_l2);
  insert into public.learning_lesson_units(lesson_id,collection_id,word_id,lesson_unit_position,source_collection_position)
  select v_l1,'10000000-0000-0000-0000-000000000001'::uuid,id,row_number() over(order by unit_code)::smallint,row_number() over(order by unit_code)::integer
  from public.vocabulary_words where unit_code in ('STG-W001','STG-W002','STG-W003')
  union all
  select v_l2,'10000000-0000-0000-0000-000000000002'::uuid,id,row_number() over(order by unit_code)::smallint,row_number() over(order by unit_code)::integer
  from public.vocabulary_words where unit_code in ('STG-W004','STG-W005','STG-W006');

  insert into public.student_stats(student_id,total_xp,coins,current_streak,longest_streak)
  values(v_s1,0,0,0,0),(v_s2,0,0,0,0),(v_s3,0,0,0,0)
  on conflict(student_id) do nothing;

  select id into v_word from public.vocabulary_words where unit_code='STG-W001';
  insert into public.student_word_progress(student_id,word_id,mastery_state,interval_days,ease_factor,correct_streak,total_attempts,correct_attempts,last_response_time_ms,last_reviewed_at,next_review_at,mastered_at,last_change_source)
  values(v_s1,v_word,'mastered',21,2.30,5,20,19,1800,now()-interval '1 day',now()+interval '21 days',now()-interval '1 day','staging_seed')
  on conflict(student_id,word_id) do update set mastery_state='mastered',interval_days=21,correct_streak=5,total_attempts=20,correct_attempts=19,last_reviewed_at=now()-interval '1 day',next_review_at=now()+interval '21 days',mastered_at=coalesce(public.student_word_progress.mastered_at,now()-interval '1 day'),last_change_source='staging_seed',updated_at=now();
end $$;

commit;
