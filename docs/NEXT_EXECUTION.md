# Current execution checkpoint

## FASE 1 — VALIDADA

- Closure commit: `66daf6036e5b88916f5c54c3663b3159e97926f1`.
- Final StudentApp browser E2E: run `32609818852` — **25 PASS / 0 FAIL**.
- Production changes: none.

## ADMIN PORTAL MVP — VALIDATED GATE

- Branch: `feature/admin-portal-mvp`.
- Exact product/test commit deployed to Staging: `ea7f187729f1809787e35ed119e152800bff56f1`.
- CI run `32684011856`: **PASS** — typecheck, lint, tests, build.
- Local Supabase run `32684011864`: **PASS**.
- Combined Student/Admin browser E2E run `32684011863`: **PASS**.
- Admin capabilities in the validated code: dashboard, group create/edit/archive/restore, student list/search/filter/move/suspend/reactivate/archive, secure access reset, secure manual student creation route, vocabulary create/edit/archive/restore/delete-unused, audit log, and paginated full vocabulary catalog.

## SUPABASE STAGING — ADMIN BACKEND READY

- Project: `ddtdcjohzhjqunuajcod` (`ens-sonson-staging-db`, `us-east-1`, Free).
- Incremental cost: USD 0.
- Production Supabase `pgdoxpcwtqjbmqvzihhs`: untouched.
- Existing fixtures remain fictitious only: 5 Auth accounts, 1 institution, 2 groups, 3 students, 1 teacher, 6 Learning Units, route `A1-V3`, 2 lessons.
- Applied admin migrations:
  - `admin_management_mvp` — repository candidate `20260823000007_admin_management_mvp.sql`
  - `admin_access_reset_api` — repository candidate `20260823000008_admin_access_reset_api.sql`
  - `admin_vocabulary_pagination` — repository candidate `20260823000009_admin_vocabulary_pagination.sql`
  - `admin_student_provisioning` — repository candidate `20260823000010_admin_student_provisioning.sql`
- `admin_student_provisioning` was applied only after CI + local Supabase + browser E2E were green on the exact deployed commit.
- A manually provisioned student is created as `pending_activation`, not `active`; group membership and zeroed student statistics are created without inventing academic progress.
- Edge Function `admin-student-access`: version 1, ACTIVE, `verify_jwt=true`.
- Edge Function `admin-student-create`: id `d97ad13b-e3e1-4bf7-94f5-eb11bf4ab28b`, version 1, ACTIVE, `verify_jwt=true`.
- `admin-student-create` validates the caller through the institution-admin RPC before using Auth Admin, keeps service-role credentials server-side, creates a one-time temporary password, and attempts Auth rollback if institutional provisioning fails.
- Browser never receives service-role credentials.
- Old one-time Auth seed function remains inert; temporary `pg_net` remains removed.

## REMOTE ADMIN BACKEND SMOKE

Validated against Staging using fictitious identities / rollback transactions only:

- `institution_admin` reads portal/groups/students/vocabulary: PASS.
- Current Staging fixture counts: 2 groups, 3 active students, 6 Learning Units, 1 route.
- Vocabulary pagination: PASS.
- Student calling admin RPC: DENIED.
- Teacher calling admin RPC: DENIED.
- Password reset authorization bridge: PASS.
- Group create -> update -> archive -> restore: PASS inside transaction and rolled back.
- Vocabulary create -> update -> archive -> restore -> delete when unused: PASS inside transaction and rolled back.
- Destructive delete of a used Learning Unit: DENIED as designed.
- No transaction-smoke fixture changes were retained.
- Manual student creation through the deployed Edge Function has **not** yet been declared a remote authenticated-browser PASS; the function is deployed/ACTIVE and the same contract is green locally. Do not upgrade this evidence level until an authenticated Staging session actually exercises it.

## VERCEL STAGING — DEPLOYED

- Project: `ens-sonson-staging`.
- Project ID: `prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx`.
- Team: `team_Af0Tp4NtemXmlaO4n2BqjkDx` (`OSKR21`).
- Stable alias: `https://ens-sonson-staging.vercel.app`.
- Current deployment: `dpl_49WWDy1XCQ1QGhZDfBf6sinbgVit` — **READY**.
- Exact source SHA fetched during build: `ea7f187729f1809787e35ed119e152800bff56f1`.
- `/api/health`: HTTP 200 and reports the exact SHA above, `environment=staging`, `academicDataMode=backend`.
- `/admin`: HTTP 200.
- `/admin/estudiantes/nuevo`: HTTP 200.
- `/admin/vocabulario`: HTTP 200.
- New deployment runtime error scan: no runtime errors in the checked one-hour window.
- New deployment warning/error log scan: no warning/error logs for the checked one-hour window.
- Previous READY deployment `dpl_HspUBV1k71eJdqTLi6PxLUXcBWPb` remains the immediate rollback candidate; older candidate `dpl_5e7hjsfUKkk4voTQnhGNu2hkZu2J` also remains available.
- Production Vercel project `prj_u9bB5CwLOIWtyWdSA7LKRfzBRj5r` was not touched.

## NEXT EXACT WORK

1. Exercise `admin-student-create` through an authenticated fictitious `institution_admin` session in Staging and verify `pending_activation`, correct group, zero stats and audit; do not use real users.
2. If that smoke is green, freeze the Admin Portal MVP checkpoint; no further admin scope expansion yet.
3. Identify the authoritative source of the existing ~531 Learning Units without touching production data or inventing a corpus.
4. Audit/de-duplicate that source before any expansion.
5. Expand in controlled, reviewable batches toward the ENS English 1K catalog; do not add the remaining units in one bulk jump.

Do not modify `main`, Git branch `staging`, production Supabase, production Vercel, real roster, or real users.
