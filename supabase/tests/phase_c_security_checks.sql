-- Phase C verification queries. Run only against the Supabase development branch after migration.

-- 1) Private server-internal tables must have RLS enabled.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private'
  and c.relname in ('practice_session_receipts','institution_audit_log','group_membership_events')
order by c.relname;

-- 2) Browser roles must have no direct privileges on those private tables. Expected: zero rows.
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'private'
  and table_name in ('practice_session_receipts','institution_audit_log','group_membership_events')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- 3) Published curriculum remains read-only for anon/authenticated.
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('learning_routes','learning_route_collections','learning_lessons','learning_lesson_units')
  and grantee in ('anon','authenticated')
group by table_name,grantee
order by table_name,grantee;

-- 4) Alias update must not be executable by anon/PUBLIC and must remain available to authenticated.
select has_function_privilege('anon','public.update_my_profile_alias(text)','EXECUTE') as anon_alias_execute,
       has_function_privilege('authenticated','public.update_my_profile_alias(text)','EXECUTE') as authenticated_alias_execute;

-- 5) Legacy create_teacher_group must not be callable by pilot browser roles.
select has_function_privilege('anon','public.create_teacher_group(text,text)','EXECUTE') as anon_legacy_create_group,
       has_function_privilege('authenticated','public.create_teacher_group(text,text)','EXECUTE') as authenticated_legacy_create_group;

-- 6) Core academic tables remain SELECT-only to authenticated; expected privileges must not include INSERT/UPDATE/DELETE.
select table_name, string_agg(privilege_type, ',' order by privilege_type) privileges
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('practice_sessions','practice_attempts','student_word_progress','student_lesson_progress','student_stats','reward_events')
  and grantee='authenticated'
group by table_name
order by table_name;
