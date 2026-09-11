-- Rollback for 20260910000012_student_activation_flow.sql.
-- Non-destructive: existing student accounts, memberships and audit rows are preserved.

drop function if exists public.service_complete_student_activation_v1(uuid);
drop function if exists public.get_my_student_activation_state_v1();
