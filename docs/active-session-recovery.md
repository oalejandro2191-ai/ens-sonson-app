# Phase 1 — Active route session recovery candidate

`20260822000004_active_route_session_recovery.sql` formalizes the local StudentApp recovery contract as an incremental migration candidate.

It adds `get_my_active_route_session_v1(text)` and updates `start_route_lesson_session_v1(...)` so an authenticated student recovers an unfinished server session for the same route and lesson even when the browser lost its previous client session id.

The RPC is student-only, institution-scoped through the published route and `private.has_institution_role`, and never accepts a student id from the browser.

Rollback is stored outside the deployable migration set at:

`supabase/rollback/20260822000004_active_route_session_recovery.rollback.sql`

The rollback is validated transactionally in local Docker; production remains outside this phase.
