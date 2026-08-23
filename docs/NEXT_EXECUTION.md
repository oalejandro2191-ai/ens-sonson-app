# Current execution checkpoint

## FASE 1 — VALIDADA

- Closure commit: `66daf6036e5b88916f5c54c3663b3159e97926f1`.
- Final StudentApp browser E2E: run `32609818852` — **25 PASS / 0 FAIL**.
- Final StudentApp artifact: `studentapp-e2e-32609818852`, artifact ID `9485216284`.
- Artifact SHA-256: `3939c86f745df2a5df089a20bdaae0a552a3f8a837e7a0e4f87092af96470807`.
- Final Phase 1 closure CI: run `32610059098` — typecheck, lint, unit tests and build PASS.
- Production changes: none. Incremental cost: USD 0.

## FASE 2 — PORTAL DOCENTE-ADMINISTRADOR MVP — EN CURSO

- Branch: `feature/admin-portal-mvp`.
- Base: Phase 1 closure commit `66daf6036e5b88916f5c54c3663b3159e97926f1`.
- Current validated functional checkpoint: `11c83f2d1b9ea953014c9ad867133ef1fd035db9`.
- Fix included: repaired the migration-boundary syntax guard after the prior CI stopped before exercising product code.
- CI run `32610950804`: typecheck PASS, lint PASS, tests PASS, build PASS.
- Local Supabase run `32610950803`: bootstrap/reset/migrations/integration/rollback/db lint PASS.
- Browser E2E run `32610950802`: 25 scenarios PASS.
- Authorization source: active `private.institution_memberships` role `institution_admin`; `superadmin` is not used for daily portal authorization.
- Current backend read surface: `get_my_admin_portal_v1()`.
- Dashboard values come from backend data. Fields without an implemented source return null and the UI displays `No configurado` instead of inventing data.
- Group and student administrative writes are intentionally NOT part of this Alpha checkpoint.

## STAGING ALPHA — AUTHORIZED, NOT YET CREATED

The user has explicitly authorized one separate Supabase Free project and deployment only to the existing Vercel project `ens-sonson-staging` (`prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx`).

Mandatory gate before remote creation:

- organization must be `APP ENGLISH CLASS`;
- creation cost must be USD 0;
- sufficient Free project capacity must exist;
- no paid compute, add-on or upgrade may be activated;
- production Supabase `pgdoxpcwtqjbmqvzihhs` must remain untouched;
- production Vercel `ens-sonson-app` must remain untouched.

If any creation flow requests payment/card/upgrade, stop without creating the project.

## Safety and scope

- No production Supabase/Vercel/domain changes.
- No real students or groups.
- No historical roster import or 130 real accounts.
- No paid resources.
- No CSV, definitive activation, full vocabulary administration, assignments, complete offline, mass audio, rankings or Avatar Studio.

## Next exact work block

1. Inspect Supabase organization, current projects, plan and project creation cost.
2. Only if cost is USD 0 and Free capacity exists, create `ens-sonson-staging-db`.
3. Apply empty-database bootstrap plus incremental migrations 00001–00005 only.
4. Create staging-only fictitious seed outside production migrations.
5. Connect only Vercel project `prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx` and deploy ENS English Staging Alpha.
6. Execute remote student/admin/security smoke tests and record rollback.
