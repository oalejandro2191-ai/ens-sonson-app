-- Remote Staging hardening discovered by Supabase security advisor.
-- Keeps public reference data readable only through the intended roles while enabling RLS.

alter table public.academic_years enable row level security;
alter table public.vocabulary_words enable row level security;

drop policy if exists "academic_years_read" on public.academic_years;
create policy "academic_years_read"
on public.academic_years
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.school_id = academic_years.school_id
  )
);

drop policy if exists "vocabulary_words_read" on public.vocabulary_words;
create policy "vocabulary_words_read"
on public.vocabulary_words
for select
to anon, authenticated
using (true);
