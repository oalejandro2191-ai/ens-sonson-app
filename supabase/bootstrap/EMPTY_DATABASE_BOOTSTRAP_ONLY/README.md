# EMPTY DATABASE BOOTSTRAP ONLY

This directory contains the schema bootstrap required to create the ENS English academic backend from an **empty PostgreSQL/Supabase database**.

It is intentionally outside `supabase/migrations/`.

## Allowed targets

- Supabase CLI + Docker local stack created from scratch.
- A future, explicitly authorized, empty remote **test** project.

## Forbidden target

**Never apply this bootstrap to the existing production Supabase project.** It is not an incremental migration and must never be included in a production `supabase db push` migration set.

The incremental candidate set is the content of `supabase/migrations/` only.
