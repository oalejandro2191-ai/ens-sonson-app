-- Rollback for 20260822000006_public_reference_rls.sql

drop policy if exists "vocabulary_words_read" on public.vocabulary_words;
drop policy if exists "academic_years_read" on public.academic_years;

alter table public.vocabulary_words disable row level security;
alter table public.academic_years disable row level security;
