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

## EXISTING 531 LEARNING UNITS — SOURCE BOUNDARY CONFIRMED

- Historical read-only audit evidence identifies production Supabase `pgdoxpcwtqjbmqvzihhs` as the authoritative location of the existing 531 Learning Units.
- Confirmed historical distribution: 482 `word`, 22 `chunk`, 13 `phrasal_verb`, 10 `expression`, 4 `command`; 13 collections.
- Historical A1 material organizes 275 assignments across the 13 collections / approximately 52 lessons; the remaining 266 units are part of the vocabulary bank and were intentionally not added to that A1 route at that stage.
- The canonical GitHub repository does **not** contain a complete versioned copy of those 531 rows.
- `legacy/static-20260819` contains frontend code that queried production tables `vocabulary_collections`, `collection_words` and nested `vocabulary_words`; it does not contain the corpus itself.
- `baseline/stabilization-v1` contains no vocabulary seed/corpus; its Supabase migration set is infrastructure/security only.
- File Library search found historical audit/specification documents confirming the counts and model, but no complete row-level export suitable for a real deduplication/quality audit.
- Therefore, a word-by-word audit or 531 -> 1000 expansion must **not** proceed from reconstructed guesses. A non-production export/copy of the authoritative vocabulary rows is required first.
- Do not query production to obtain that corpus while the current `production untouched` constraint remains in force.

## NEXT EXACT WORK

1. Exercise `admin-student-create` through an authenticated fictitious `institution_admin` session in Staging and verify `pending_activation`, correct group, zero stats and audit; do not use real users. If credentials are not safely available to the automation, keep this evidence level pending rather than bypassing Auth.
2. Freeze the Admin Portal MVP after that smoke, with no additional admin scope expansion.
3. Obtain a **non-production export/copy** of the authoritative 531 Learning Units. Do not reconstruct them from counts and do not read production while the production-freeze rule is active.
4. On that copy, audit exact rows for duplicates, normalized English collisions, translation quality, accepted forms, unit types, categories/collections, route references, status, examples and orphan/reference risks.
5. Only after the 531-row baseline is certified, design controlled batches toward ENS English 1K; never add the remaining units in one bulk jump.

Do not modify `main`, Git branch `staging`, production Supabase, production Vercel, real roster, or real users.
