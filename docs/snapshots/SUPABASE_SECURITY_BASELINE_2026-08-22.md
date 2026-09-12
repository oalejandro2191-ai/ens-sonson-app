# Supabase security/model baseline — 2026-08-22

Project ref audited: `pgdoxpcwtqjbmqvzihhs` (production project, read-only during Phase C).

## Key row counts before stabilization writes

| Object | Rows |
|---|---:|
| public.schools | 1 |
| public.profiles | 2 |
| public.groups | 7 |
| public.group_members | 1 |
| public.vocabulary_words | 531 |
| public.vocabulary_collections | 13 |
| public.learning_routes | 3 |
| public.learning_lessons | 156 |
| public.learning_lesson_units | 825 |
| public.practice_sessions | 2 |
| public.practice_attempts | 0 |
| public.student_word_progress | 0 |
| public.student_lesson_progress | 0 |
| public.student_stats | 1 |
| public.reward_events | 0 |
| private.institution_memberships | 2 |
| private.teacher_assignments | 0 |
| private.student_enrollment_roster | 176 |

## RLS

RLS is enabled on the public institutional/academic tables reviewed, including `profiles`, `schools`, `groups`, `group_members`, route tables, practice tables and student progress/stat tables.

RLS was **disabled** at audit time on these private server-side tables:

- `private.practice_session_receipts`
- `private.institution_audit_log`
- `private.group_membership_events`

No direct `anon` or `authenticated` table grants were observed on those three private tables. A staging-only migration is prepared to enable RLS and explicitly revoke direct client grants; it has not been applied to production.

## Direct table grants relevant to the browser

- `anon`: SELECT only on the four published curriculum tables (`learning_routes`, `learning_route_collections`, `learning_lessons`, `learning_lesson_units`). Their RLS policies expose rows only through a published route.
- `authenticated`: SELECT only on the reviewed profile/group/session/progress/stat/reward tables.
- No direct authenticated INSERT/UPDATE/DELETE grants were observed on `practice_sessions`, `practice_attempts`, `student_word_progress`, `student_lesson_progress`, `student_stats` or `reward_events`; writes are intended to pass through server-validated RPCs.

## Role model

`public.institution_role` already contains:

- `student`
- `teacher`
- `institution_admin`
- `superadmin`

The older `public.app_role` contains only `student` and `teacher`. Institution-scope authorization is therefore the preferred role source for stabilization; do not overload the legacy enum without a deliberate migration.

## SECURITY DEFINER review

Important current RPCs use `SECURITY DEFINER` with an empty `search_path`, which is a good baseline. Spot checks confirm explicit `auth.uid()` / institution checks in the modern admin and route-learning RPCs.

### Modern group/admin functions reviewed

- `admin_create_group`: institution_admin/superadmin check.
- `admin_enroll_student`: institution_admin/superadmin check and verifies active student membership in the institution.
- `admin_assign_teacher`: institution_admin/superadmin check and verifies teacher membership.
- `admin_register_auth_member`: institution_admin/superadmin check; limited to student/teacher registration.

### Route-learning functions reviewed

- `start_route_lesson_session_v1`: requires authenticated active student membership in route school, validates route/lesson, prevents competing in-progress lessons, calculates reward/mastery-eligible words server-side.
- `record_route_lesson_attempt_v1`: session ownership validation, server-side answer validation, `client_event_id` idempotency/concurrency checks, server-owned `is_correct`, `counts_for_mastery` and reward eligibility.
- `complete_route_lesson_session_v1`: session ownership, receipt idempotency, exact evaluable-attempt count, route threshold, spaced-repetition/mastery writes, idempotent reward event and server-side stats update.

## Security debt requiring staging validation

1. `private.practice_session_receipts`, `private.institution_audit_log`, `private.group_membership_events` have RLS disabled.
2. Legacy `create_teacher_group` can create an institution when a legacy teacher profile has no school; it should not remain on the pilot path when `admin_create_group` is the controlled model.
3. `update_my_profile_alias` is executable by PUBLIC/anon according to ACL even though its body rejects unauthenticated calls. Staging should restrict execute to authenticated/service roles to reduce exposed surface.
4. `search_student_registration` and `get_registration_grades` are anonymous SECURITY DEFINER functions. They appear designed for pre-auth registration and must be threat-tested for enumeration/rate abuse before Phase D; do not remove them blindly.
5. Supabase Security Advisor reports leaked-password protection disabled. This must be evaluated before real pilot accounts.
6. `vector` is installed in `public` (advisor warning); this is not a pilot blocker by itself but should be tracked.

## Migration history snapshot

At audit time the migration list ran from `20260804163144 initial_schema` through `20260822162103 honor_explicit_superadmin_role_v1`, with 41 migrations returned by the platform.

This document is a **schema/security snapshot, not a database backup**. No production DDL/DML was executed to create it.
