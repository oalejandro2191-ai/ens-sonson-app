# Current execution checkpoint

## FASE 1 — VALIDADA

- Closure commit: `66daf6036e5b88916f5c54c3663b3159e97926f1`.
- Final StudentApp browser E2E: run `32609818852` — **25 PASS / 0 FAIL**.
- Production changes: none.

## ADMIN PORTAL MVP — LOCAL GATE GREEN

- Branch: `feature/admin-portal-mvp`.
- Last validated product/test commit before this documentation checkpoint: `c12f1d7329ade572bedde8fbf3d3ab4ba0466eb3`.
- CI run `32657629892`: PASS — typecheck, lint, tests, build.
- Local Supabase run `32657629873`: PASS.
- Combined browser E2E run `32657629863`: PASS — StudentApp 25 scenarios plus institution-admin scenarios.
- Admin capabilities present in code: dashboard, groups create/edit/archive/restore, students list/search/filter/move/suspend/reactivate/archive, secure access reset trigger, vocabulary create/edit/archive/restore/delete-unused, audit log, and paginated vocabulary catalog route.

## SUPABASE STAGING — ADMIN BACKEND APPLIED

- Project: `ddtdcjohzhjqunuajcod` (`ens-sonson-staging-db`, `us-east-1`, Free).
- Incremental cost: USD 0.
- Production Supabase `pgdoxpcwtqjbmqvzihhs`: untouched.
- Existing fictitious fixtures remain: 5 Auth accounts, 1 institution, 2 groups, 3 students, 1 teacher, 6 Learning Units, route `A1-V3`, 2 lessons.
- Migrations newly applied to Staging after local validation:
  - `admin_management_mvp` (repository candidate `20260823000007_admin_management_mvp.sql`)
  - `admin_access_reset_api` (repository candidate `20260823000008_admin_access_reset_api.sql`)
  - `admin_vocabulary_pagination` (repository candidate `20260823000009_admin_vocabulary_pagination.sql`)
- Edge Function `admin-student-access`: version 1, ACTIVE, `verify_jwt=true`.
- Browser never receives service-role credentials.
- Old one-time Auth seed function remains inert; temporary `pg_net` remains removed.

## REMOTE ADMIN SMOKE — PASS

Validated directly against Staging using fictitious identities only:

- `institution_admin` reads portal/groups/students/vocabulary: PASS.
- Current Staging counts: 2 groups, 3 active students, 6 Learning Units, 1 route.
- Vocabulary pagination: `limit=3` returns 3 items and `total=6`: PASS.
- Student calling admin RPC: DENIED.
- Teacher calling admin RPC: DENIED.
- Password reset authorization bridge recognizes same-institution student: PASS.
- Group create -> update -> archive -> restore: PASS inside transaction and rolled back.
- Vocabulary create -> update -> archive -> restore -> delete when unused: PASS inside transaction and rolled back.
- Destructive delete of used Learning Unit: DENIED as designed.
- No smoke fixture changes were retained.

## VERCEL STAGING

- Project: `ens-sonson-staging`.
- Project ID: `prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx`.
- Team: `team_Af0Tp4NtemXmlaO4n2BqjkDx` (`OSKR21`).
- Current deployment before publishing the new admin UI: `dpl_HspUBV1k71eJdqTLi6PxLUXcBWPb` — READY.
- Older rollback candidate: `dpl_5e7hjsfUKkk4voTQnhGNu2hkZu2J`.
- Repository `.vercel/project.json` is bound specifically to the Staging project ID/team above.

## NEXT EXACT WORK

1. Finish the remaining administrator autonomy gap: secure manual creation of a fictitious student/account from `/admin` without exposing service-role credentials.
2. Add local integration + browser tests for manual creation and duplicate prevention.
3. Re-run CI + local Supabase + combined Student/Admin E2E.
4. Publish the validated admin UI only to Vercel project `prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx` and record the new deployment/rollback.
5. After the admin is fully usable, audit/de-duplicate the existing 531 Learning Units before expanding toward the ENS English 1K catalog.

Do not modify `main`, production Supabase, production Vercel, real roster, or real users.
