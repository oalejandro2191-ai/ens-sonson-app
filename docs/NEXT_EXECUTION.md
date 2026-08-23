# Current execution checkpoint

- Branch: `feature/local-studentapp-integration`
- Last functional commit before this checkpoint: `83aaa012d0b71e5857f951de3bba0b20a0435088`
- Last approved general CI: `83aaa012d0b71e5857f951de3bba0b20a0435088` — typecheck, lint, unit tests and build PASS.
- Last browser E2E result: run `32607990089` — 9 PASS, scenario 10 failed because the test incorrectly expected an empty-answer submit button to become enabled after server feedback.
- Current E2E correction: wait for `.server-feedback` instead of submit-button enabled state.
- Pending Phase 1 validation: browser E2E must reach `25 PASS / 0 FAIL`; active-session recovery migration/rollback must pass local Supabase integration, SQL guards and db lint.
- Last approved local backend before formalizing migration: active-session local patch recovery contract PASS, dashboard transaction/isolation PASS, db lint PASS.
- Artifact from last failed E2E: workflow artifact `9484709362` (`studentapp-e2e-32607990089`).
- Production changes: none.
- Paid resources created: none. Cost increment: USD 0.

## Next exact command

The CI-equivalent next validation is the GitHub Actions run automatically triggered by the checkpoint commit. Locally, the exact backend validation sequence is:

```bash
ENS_DB_TARGET=local-empty node scripts/assemble-empty-db-bootstrap.mjs
supabase start
supabase db reset --local
node scripts/remove-empty-db-bootstrap.mjs
supabase status -o env > /tmp/ens-supabase.env
set -a && source /tmp/ens-supabase.env && set +a
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/local/test_helpers.sql
SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" node tests/local-supabase/pilot-security-learning.mjs
SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" node tests/local-supabase/studentapp-runtime.mjs
psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/local-supabase/active-session-recovery.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f tests/local-supabase/active-session-rollback.sql
supabase db lint --local --level warning
```
