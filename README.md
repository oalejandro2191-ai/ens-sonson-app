# ENS English — canonical stabilization repository

This repository is the controlled, traceable stabilization line for ENS English. It is **not** claimed to be the byte-identical source of the historical Vercel deployment from 2026-08-15.

## Current phase

- Production remains frozen at the historical Vercel project/deployment.
- `legacy/static-20260819` preserves the previous static GitHub implementation.
- `staging` contains the new controlled Next.js 16.3.0 baseline.
- No academic demo data may be presented as real data.
- Supabase must become the source of truth before the pilot.

## Local checks

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

See `docs/` for architecture, recovery, deployment and security decisions.
