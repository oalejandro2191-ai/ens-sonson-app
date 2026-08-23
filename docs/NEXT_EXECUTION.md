# Current execution checkpoint

## FASE 1 — VALIDADA

- Branch: `feature/local-studentapp-integration`
- Last functional commit: `aca8f890d0ee8d9e8479e0c43fe0145376958bfd`
- Final browser E2E run: `32609818852` — **25 PASS / 0 FAIL**.
- Final browser E2E job: `97120888496` — SUCCESS.
- Final local backend run: `32609818855` — SUCCESS.
- General CI for the functional commit: `32609818854` — SUCCESS.
- Final E2E artifact: `studentapp-e2e-32609818852`, artifact ID `9485216284`.
- Artifact contents: Playwright HTML report, screenshots, one trace per scenario, Next.js log, and `artifacts/e2e/matrix.ndjson` with 25 passed scenarios.
- Artifact SHA-256: `3939c86f745df2a5df089a20bdaae0a552a3f8a837e7a0e4f87092af96470807`.
- Artifact size: `18059696` bytes.
- GitHub artifact expiration: `2026-08-30T01:16:51Z`; a copy was downloaded at phase closure for preservation.

## Scenario 25 contract

`25 progreso persiste tras borrar localStorage y volver a autenticar` passed and verifies this exact sequence:

1. the fictitious student has server progress (`metric-learning = 2`);
2. clearing `localStorage` removes the local Supabase Auth session;
3. reload correctly returns the app to the login screen;
4. reauthentication restores the same server-backed academic progress (`metric-learning = 2`);
5. an explicit logout returns to login;
6. a second login still restores the same progress (`metric-learning = 2`).

Academic progress is therefore not sourced from `localStorage`; deleting browser-local Auth state does not delete the progress persisted in Supabase.

## Approved Phase 1 gates

- Login and identity: PASS.
- Student dashboard and lesson start: PASS.
- Correct/incorrect answer path with server authority: PASS.
- Double-submit and `client_event_id` idempotency: PASS.
- Session-completion idempotency: PASS.
- `Omitir`: PASS without attempt/evidence.
- `Salir`: PASS while preserving in-progress server session.
- Resume after closing browser context: PASS.
- Second browser context receives backend progress: PASS.
- Progress survives localStorage deletion after reauthentication: PASS.
- Foreign-session access blocked: PASS.
- Cross-institution isolation: PASS.
- Direct mastery write blocked: PASS.
- XP self-assignment blocked: PASS.
- `get_my_active_route_session_v1` incremental candidate, isolation tests and rollback: PASS.
- Database lint: PASS.

## Safety and cost

- Production Supabase changes: none.
- Production Vercel changes: none.
- `main` changes: none.
- Real users or groups created: none.
- Historical roster changes: none.
- Paid resources created: none.
- Incremental operating cost introduced by this phase: **USD 0**.
- No `supabase link`, `supabase db push`, linked migration, or production Vercel deployment was executed.

## Pending work

Phase 1 has no open validation gate. The next authorized work block is **FASE 2 — PORTAL DOCENTE-ADMINISTRADOR MVP** on a new branch `feature/admin-portal-mvp` created from this validated branch head.

The Phase 2 scope is deliberately limited to secure `institution_admin` authorization/layout, local group administration, local fictitious student administration, audit trail, and their tests. CSV import, definitive activation, full vocabulary administration, assignments, offline, audio, rankings and Avatar Studio remain out of scope.

## Next exact command

```bash
git switch feature/local-studentapp-integration
git pull --ff-only
git switch -c feature/admin-portal-mvp
```

First Phase 2 checkpoint after creating the branch:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
