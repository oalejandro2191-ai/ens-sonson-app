-- Deployable candidate: student read APIs required by StudentApp.
-- Mirrors the currently observed production signatures; safe to exercise locally first.

create or replace function public.get_my_portal_identity_v1()
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  p public.profiles%rowtype;
  institution_role text;
  superadmin boolean:=false;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;
  select * into p from public.profiles where id=viewer;
  if p.id is null then raise exception 'Perfil no disponible'; end if;
  select im.role::text into institution_role
  from private.institution_memberships im
  where im.user_id=viewer and im.status='active'
  order by im.created_at desc limit 1;
  select exists(select 1 from private.super_admins sa where sa.user_id=viewer) into superadmin;
  return jsonb_build_object(
    'user_id',viewer,
    'display_alias',p.display_alias,
    'app_role',p.role::text,
    'institution_role',coalesce(institution_role,p.role::text),
    'is_superadmin',superadmin,
    'school_id',p.school_id,
    'profile_photo_path',p.profile_photo_path
  );
end $$;

create or replace function public.get_my_learning_dashboard_v1(target_route_code text default 'A1-V3'::text)
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  r public.learning_routes%rowtype;
  completed integer;
  mastered_count integer;
  due_count integer;
  stats public.student_stats%rowtype;
  current_lesson jsonb;
  group_json jsonb;
  last_activity timestamptz;
  alias text;
  photo text;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;
  select * into r from public.learning_routes where route_code=target_route_code and status='published';
  if r.id is null then raise exception 'Ruta no disponible'; end if;
  if not private.has_institution_role(r.school_id,array['student'::public.institution_role]) then raise exception 'Perfil de estudiante requerido'; end if;
  select p.display_alias,p.profile_photo_path into alias,photo from public.profiles p where p.id=viewer;
  select count(*) filter(where finished_at is not null),count(*) filter(where mastery_status='mastered')
  into completed,mastered_count
  from public.student_lesson_progress where student_id=viewer and route_id=r.id;
  -- current_timestamp is STABLE for the transaction, matching this function's volatility.
  select count(*) into due_count from public.student_word_progress where student_id=viewer and next_review_at<=current_timestamp;
  select * into stats from public.student_stats where student_id=viewer;
  select max(x.ts) into last_activity from (
    select max(last_activity_at) ts from public.practice_sessions where student_id=viewer and route_id=r.id
    union all
    select max(last_attempt_at) from public.student_lesson_progress where student_id=viewer and route_id=r.id
  ) x;
  select jsonb_build_object('id',g.id,'name',g.name,'grade',g.grade,'section',g.section_code,'academic_year',y.name)
  into group_json
  from public.group_members gm
  join public.groups g on g.id=gm.group_id
  left join public.academic_years y on y.id=g.academic_year_id
  where gm.student_id=viewer and gm.status='active' and g.status='active' and g.archived_at is null
  order by gm.joined_at desc limit 1;
  select jsonb_build_object(
    'id',l.id,
    'position',l.route_lesson_position,
    'title',l.title,
    'purpose',l.purpose,
    'state',case when lp.status='in_progress' then 'in_progress' else 'available' end
  )
  into current_lesson
  from public.learning_lessons l
  left join public.student_lesson_progress lp on lp.student_id=viewer and lp.route_id=r.id and lp.lesson_id=l.id
  where l.route_id=r.id and lp.finished_at is null
    and (
      l.route_lesson_position=1
      or exists(
        select 1
        from public.learning_lessons prev
        join public.student_lesson_progress pp on pp.student_id=viewer and pp.route_id=r.id and pp.lesson_id=prev.id and pp.finished_at is not null
        where prev.route_id=r.id and prev.route_lesson_position=l.route_lesson_position-1
      )
    )
  order by case when lp.status='in_progress' then 0 else 1 end,l.route_lesson_position
  limit 1;
  return jsonb_build_object(
    'display_alias',alias,
    'profile_photo_path',photo,
    'group',group_json,
    'route',jsonb_build_object(
      'code',r.route_code,
      'fingerprint',r.content_fingerprint,
      'lesson_count',r.lesson_count,
      'completed',completed,
      'mastered',mastered_count,
      'traversed_percentage',round(completed::numeric*100/greatest(r.lesson_count,1),2),
      'mastery_percentage',round(mastered_count::numeric*100/greatest(r.lesson_count,1),2)
    ),
    'current_lesson',current_lesson,
    'streak',coalesce(stats.current_streak,0),
    'xp',coalesce(stats.total_xp,0),
    'credits',coalesce(stats.coins,0),
    'due_review_words',due_count,
    'last_activity_at',last_activity
  );
end $$;

create or replace function public.get_my_route_progress_v1(target_route_code text default 'A1-V3'::text)
returns jsonb
language plpgsql
stable security definer
set search_path=''
as $$
declare
  viewer uuid:=auth.uid();
  r public.learning_routes%rowtype;
  result jsonb;
begin
  if viewer is null then raise exception 'Sesión requerida'; end if;
  select * into r from public.learning_routes where route_code=target_route_code and status='published';
  if r.id is null then raise exception 'Ruta no disponible'; end if;
  if not private.has_institution_role(r.school_id,array['student'::public.institution_role]) then raise exception 'Perfil de estudiante requerido'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'lesson_id',l.id,
    'position',l.route_lesson_position,
    'status',coalesce(lp.status,'not_started'),
    'mastery_status',coalesce(lp.mastery_status,'not_started'),
    'started_at',lp.started_at,
    'finished_at',lp.finished_at,
    'attempt_count',coalesce(lp.attempt_count,0),
    'last_percentage',coalesce(lp.last_percentage,0),
    'best_percentage',coalesce(lp.best_percentage,0),
    'needs_review_word_ids',coalesce(to_jsonb(lp.needs_review_word_ids),'[]'::jsonb),
    'can_open',case when l.route_lesson_position=1 then true else exists(
      select 1 from public.learning_lessons prev
      join public.student_lesson_progress pp on pp.student_id=viewer and pp.route_id=r.id and pp.lesson_id=prev.id and pp.finished_at is not null
      where prev.route_id=r.id and prev.route_lesson_position=l.route_lesson_position-1
    ) end
  ) order by l.route_lesson_position),'[]'::jsonb)
  into result
  from public.learning_lessons l
  left join public.student_lesson_progress lp on lp.student_id=viewer and lp.route_id=r.id and lp.lesson_id=l.id
  where l.route_id=r.id;
  return jsonb_build_object('route_code',r.route_code,'route_id',r.id,'fingerprint',r.content_fingerprint,'lessons',result);
end $$;

revoke all on function public.get_my_portal_identity_v1() from public,anon;
revoke all on function public.get_my_learning_dashboard_v1(text) from public,anon;
revoke all on function public.get_my_route_progress_v1(text) from public,anon;
grant execute on function public.get_my_portal_identity_v1() to authenticated;
grant execute on function public.get_my_learning_dashboard_v1(text) to authenticated;
grant execute on function public.get_my_route_progress_v1(text) to authenticated;
