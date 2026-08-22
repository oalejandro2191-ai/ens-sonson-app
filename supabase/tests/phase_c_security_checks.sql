select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private' and c.relname in ('practice_session_receipts','institution_audit_log','group_membership_events') order by c.relname;

select table_schema, table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'private' and table_name in ('practice_session_receipts','institution_audit_log','group_membership_events') and grantee in ('anon','authenticated') order by table_name, grantee, privilege_type;

select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) privileges
from information_schema.role_table_grants where table_schema = 'public' and table_name in ('learning_routes','learning_route_collections','learning_lessons','learning_lesson_units') and grantee in ('anon','authenticated') group by table_name,grantee order by table_name,grantee;
