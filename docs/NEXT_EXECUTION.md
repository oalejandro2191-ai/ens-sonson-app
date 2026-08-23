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
- Current checkpoint: secure `institution_admin` authorization and initial `/admin` layout.
- Authorization source: active `private.institution_memberships` role `institution_admin`; `superadmin` is not used for daily portal authorization.
- Current backend read surface: `get_my_admin_portal_v1()`.
- Dashboard values come from local Supabase. Fields without an implemented source return null and the UI displays `No configurado` instead of inventing data.
- Group and student administrative writes are intentionally NOT part of this first checkpoint.

## Safety and scope

- No production Supabase/Vercel/domain changes.
- No real students or groups.
- No historical roster changes.
- No remote Supabase project or Development Branch.
- No paid resources.
- No CSV, definitive activation, full vocabulary administration, assignments, offline, audio, rankings or Avatar Studio.

## Pending validation for this checkpoint

- CI: typecheck, lint, unit tests, build.
- Supabase local reset must apply `20260822000005_admin_portal_read_api.sql` cleanly.
- Migration boundary and rollback guard must pass.

## Next exact work block after green validation

Implement protected local group administration only:

- list own-institution groups;
- create fictitious group;
- edit name/grade/academic year;
- activate/archive without physical deletion;
- expose active student count;
- record audit events.

Then commit as:

```text
feat: add local group administration
```
