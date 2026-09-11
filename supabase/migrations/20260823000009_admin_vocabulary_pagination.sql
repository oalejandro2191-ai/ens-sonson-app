-- Correct total-count semantics for the institution-admin vocabulary catalog.
-- The previous implementation aggregated the page before the window count,
-- causing `total` to report 1. This replacement counts the filtered catalog
-- independently and then returns the requested page.

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
  total_count integer;
  items jsonb;
begin
  perform target_school;

  select count(*)
  into total_count
  from public.vocabulary_words w
  where (provided_status is null or w.status=provided_status)
    and (
      search_value is null
      or lower(w.english) like '%'||lower(search_value)||'%'
      or lower(w.spanish) like '%'||lower(search_value)||'%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',w.id,
    'learning_unit_id',w.learning_unit_id,
    'unit_code',w.unit_code,
    'english',w.english,
    'spanish',w.spanish,
    'unit_type',w.unit_type,
    'accepted_forms',w.accepted_forms,
    'category',w.category,
    'difficulty',w.difficulty,
    'example_en',w.example_en,
    'example_es',w.example_es,
    'priority',w.priority,
    'status',w.status,
    'archived_at',w.archived_at,
    'audio_path',w.audio_path,
    'lesson_refs',(select count(*) from public.learning_lesson_units llu where llu.word_id=w.id),
    'attempt_refs',(select count(*) from public.practice_attempts pa where pa.word_id=w.id),
    'progress_refs',(select count(*) from public.student_word_progress swp where swp.word_id=w.id)
  ) order by lower(w.english)),'[]'::jsonb)
  into items
  from (
    select *
    from public.vocabulary_words w
    where (provided_status is null or w.status=provided_status)
      and (
        search_value is null
        or lower(w.english) like '%'||lower(search_value)||'%'
        or lower(w.spanish) like '%'||lower(search_value)||'%'
      )
    order by lower(w.english)
    limit limit_value offset offset_value
  ) w;

  return jsonb_build_object(
    'total',total_count,
    'limit',limit_value,
    'offset',offset_value,
    'items',items
  );
end $$;

revoke all on function public.get_admin_vocabulary_v1(text,text,integer,integer) from public,anon;
grant execute on function public.get_admin_vocabulary_v1(text,text,integer,integer) to authenticated;
