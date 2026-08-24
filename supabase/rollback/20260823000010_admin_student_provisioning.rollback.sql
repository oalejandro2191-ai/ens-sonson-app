-- Functional rollback for secure manual student provisioning.
-- Existing students created through the feature remain intact.

drop function if exists public.admin_provision_created_student_v1(uuid,text,uuid);
drop function if exists public.admin_validate_student_creation_v1(text,text,uuid);
