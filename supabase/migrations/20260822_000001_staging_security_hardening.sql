-- STAGING ONLY until validated. Do not apply to production without explicit approval.
-- Phase C narrows the browser attack surface without changing academic rules.

-- Private server-internal receipt/audit tables should never be directly reachable by browser roles.
alter table private.practice_session_receipts enable row level security;
alter table private.institution_audit_log enable row level security;
alter table private.group_membership_events enable row level security;

revoke all on table private.practice_session_receipts from anon, authenticated;
revoke all on table private.institution_audit_log from anon, authenticated;
revoke all on table private.group_membership_events from anon, authenticated;

-- Alias updates are an authenticated self-service operation. The function itself checks auth.uid(),
-- but PUBLIC/anon EXECUTE is unnecessary exposure.
revoke execute on function public.update_my_profile_alias(text) from public, anon;
grant execute on function public.update_my_profile_alias(text) to authenticated, service_role;

-- Legacy teacher group creation can manufacture a school for a legacy teacher profile.
-- The controlled institutional path is admin_create_group(), which checks institution_admin/superadmin.
-- Keep the legacy function in the database for rollback/history, but remove it from the pilot API surface.
revoke execute on function public.create_teacher_group(text, text) from public, anon, authenticated;
grant execute on function public.create_teacher_group(text, text) to service_role;

-- Intentionally NOT changed here:
-- * search_student_registration()/get_registration_grades(): pre-auth registration surface; threat-test in Phase D.
-- * join_group_with_code(): activation/enrollment decision belongs to Phase D.
-- * legacy 67% practice RPCs: consolidation belongs to Phase F, not security hardening.
