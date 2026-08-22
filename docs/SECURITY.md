# Security baseline

- Browser code uses only Supabase project URL + publishable key.
- Privileged keys, database passwords and private secrets are forbidden in browser bundles and repository files.
- The client submits answers, never `is_correct`, mastery, XP, coins or rank.
- Core academic/public tables have RLS enabled.
- `practice_sessions`, `practice_attempts`, `student_word_progress`, `student_lesson_progress`, `student_stats` and `reward_events` expose SELECT only to `authenticated`; writes are expected through SECURITY DEFINER RPCs.
- `learning_routes`, `learning_route_collections`, `learning_lessons`, `learning_lesson_units` expose SELECT to anon/authenticated only for published routes.
- `private.practice_session_receipts`, `private.institution_audit_log`, and `private.group_membership_events` currently have RLS disabled. They are in the private schema and did not show direct anon/authenticated table grants; staging must still harden and verify them.
- Audited SECURITY DEFINER functions use an empty `search_path`.

No security migration is applied to production during Phase C.
