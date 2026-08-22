insert into public.schools(id,name,municipality,department) values
('11111111-1111-1111-1111-111111111111','ENS Local Pilot','Sonsón','Antioquia'),
('11111111-1111-1111-1111-111111111112','Other School Test','Medellín','Antioquia')
on conflict do nothing;

insert into public.academic_years(id,school_id,name,starts_on,ends_on) values
('22222222-2222-2222-2222-222222222221','11111111-1111-1111-1111-111111111111','2026','2026-01-01','2026-12-31'),
('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111112','2026','2026-01-01','2026-12-31')
on conflict do nothing;

insert into public.groups(id,school_id,name,grade,join_code,academic_year_id,section_code) values
('66666666-6666-6666-6666-666666666661','11111111-1111-1111-1111-111111111111','8A PILOT','8','LOCAL8A','22222222-2222-2222-2222-222222222221','A'),
('66666666-6666-6666-6666-666666666662','11111111-1111-1111-1111-111111111112','8X OTHER','8','OTHER8X','22222222-2222-2222-2222-222222222222','X')
on conflict do nothing;

insert into public.vocabulary_words(id,english,spanish,category,example_en,example_es,unit_code,lemma,accepted_forms,learning_unit_id) values
('55555555-5555-5555-5555-555555555551','be','ser o estar','core','I want to be a teacher.','Quiero ser docente.','LOCAL-BE','be','["be"]','local-be'),
('55555555-5555-5555-5555-555555555552','hello','hola','greetings','Hello, teacher!','¡Hola, profe!','LOCAL-HELLO','hello','["hello"]','local-hello')
on conflict do nothing;

insert into public.learning_routes(id,school_id,route_code,level,version,title,status,assignment_count,lesson_count,content_fingerprint,published_at,mastery_threshold) values
('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','A1-V3','A1',3,'A1 Local Pilot','published',2,1,'local-a1-v3-fixture',now(),0.80)
on conflict do nothing;

insert into public.learning_lessons(id,route_id,collection_id,lesson_number,route_lesson_position,title,unit_count,purpose) values
('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','77777777-7777-7777-7777-777777777777',1,1,'Personal Information · Pilot',2,'Validate server-authoritative learning flow')
on conflict do nothing;

insert into public.learning_lesson_units(lesson_id,collection_id,word_id,lesson_unit_position,source_collection_position) values
('44444444-4444-4444-4444-444444444444','77777777-7777-7777-7777-777777777777','55555555-5555-5555-5555-555555555551',1,1),
('44444444-4444-4444-4444-444444444444','77777777-7777-7777-7777-777777777777','55555555-5555-5555-5555-555555555552',2,2)
on conflict do nothing;
