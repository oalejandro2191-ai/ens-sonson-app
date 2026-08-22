-- STAGING ONLY until validated. Do not apply to production without explicit approval.
alter table private.practice_session_receipts enable row level security;
alter table private.institution_audit_log enable row level security;
alter table private.group_membership_events enable row level security;
revoke all on table private.practice_session_receipts from anon, authenticated;
revoke all on table private.institution_audit_log from anon, authenticated;
revoke all on table private.group_membership_events from anon, authenticated;
