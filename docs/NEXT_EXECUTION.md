# Current execution checkpoint

## FASE 1 — VALIDADA

- Closure commit: `66daf6036e5b88916f5c54c3663b3159e97926f1`.
- Final StudentApp browser E2E: run `32609818852` — **25 PASS / 0 FAIL**.
- Final Phase 1 closure CI: typecheck, lint, unit tests and build PASS.
- Production changes: none.

## STAGING ALPHA — REMOTE BACKEND READY

- Branch: `feature/admin-portal-mvp`.
- Supabase Staging project: `ddtdcjohzhjqunuajcod` (`ens-sonson-staging-db`, `us-east-1`, Free).
- Incremental cost confirmed: USD 0.
- Production Supabase `pgdoxpcwtqjbmqvzihhs`: untouched.
- Staging fixtures: 5 fictitious Auth accounts, 1 fictitious institution, 2 fictitious groups, 3 student memberships, 2 teacher assignments, 6 Learning Units, route `A1-V3`, 2 lessons.
- `student1.staging@ens.test` has one persisted mastered word.
- Staging Auth seed Edge Function: disabled, JWT required, HTTP 410 only.
- Temporary `pg_net`: removed.
- Credentials are not stored in Git.

## Remote authorization validation

- Student identity/dashboard/route RPC: PASS.
- Institution admin portal RPC: PASS with 2 groups, 3 active students, 6 Learning Units and 1 route.
- Teacher attempting admin portal: DENIED.
- Student attempting admin portal: DENIED.
- Teacher attempting student runtime dashboard: DENIED.
- Sensitive academic tables have SELECT-only RLS policies; direct student XP mutation did not change stored XP.
- Private schema browser grants: none.

## Vercel Staging

- Project: `ens-sonson-staging`.
- Project ID: `prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx`.
- Team: `team_Af0Tp4NtemXmlaO4n2BqjkDx` (`OSKR21`).
- Previous rollback deployment: `dpl_5e7hjsfUKkk4voTQnhGNu2hkZu2J`.
- Staging-only Vercel config binds the project and uses only public browser configuration values. No service role, DB password, JWT secret, or user password is in Git.
- Pending deployment source commit after config integration: `f397d68d2411c1e17eabcdaf092a14c3c3b8e199` plus this documentation checkpoint.

## Remaining exact work

1. Confirm CI on final branch head.
2. Deploy only `prj_qOKtSfoMGKuGWyCbdvsVdE6wrkxx`.
3. Validate `/api/health`, student login/lesson/recovery/persistence, admin login/counts and role rejection remotely.
4. Inspect runtime/build logs and record deployment ID + rollback.
5. Deliver staging URLs and temporary admin/student credentials.

Do not modify `main`, production Supabase, production Vercel, real roster, or real users.
