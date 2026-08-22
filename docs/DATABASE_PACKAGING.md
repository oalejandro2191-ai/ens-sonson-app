# ENS English database packaging

## A. EMPTY DATABASE BOOTSTRAP ONLY

Canonical bootstrap:

`supabase/bootstrap/EMPTY_DATABASE_BOOTSTRAP_ONLY/20260822000000_empty_database_bootstrap.sql`

Use only for an empty Docker/local database or, in the future, an explicitly authorized empty remote test project.

For the local stack the CI materializes it temporarily with:

```bash
ENS_DB_TARGET=local-empty node scripts/assemble-empty-db-bootstrap.mjs
supabase start
supabase db reset --local
node scripts/remove-empty-db-bootstrap.mjs
```

The temporary copy is never committed.

## B. Incremental candidates

Only these files belong to the incremental review set:

- `20260822000001_staging_security_hardening.sql`
- `20260822000002_student_read_api.sql`
- `20260822000003_fix_valid_review_spacing.sql`

They are candidates only. This repository does not authorize applying them to the existing production backend.

## C. Local-only infrastructure

The following must stay outside `supabase/migrations/`:

- `supabase/local/seed.sql`
- `supabase/local/test_helpers.sql`
- `@ens.local` identities created at runtime
- synthetic second institution
- artificial date manipulation
- fixtures and benchmark data

## Never run against production in this phase

Do not run `supabase link`, `supabase db push`, `supabase migration up --linked`, or any equivalent remote migration command. The existing production project must remain untouched.
