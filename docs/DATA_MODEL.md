# Data model baseline

Verified existing Supabase entities relevant to stabilization include `public.schools`, `public.profiles`, `public.groups`, `public.group_members`, `private.institution_memberships`, `private.teacher_assignments`, `private.student_enrollment_roster`, `public.learning_routes`, `public.learning_route_collections`, `public.learning_lessons`, `public.learning_lesson_units`, `public.practice_sessions`, `public.practice_attempts`, `public.student_word_progress`, `public.student_lesson_progress`, `public.student_stats`, and `public.reward_events`.

Roles already represented at institution scope are `student`, `teacher`, `institution_admin` and `superadmin`. The older `public.app_role` enum contains only `student` and `teacher`; it should not be expanded casually before role responsibilities are consolidated.
