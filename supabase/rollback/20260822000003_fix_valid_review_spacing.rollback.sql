-- Manual rollback for 20260822000003_fix_valid_review_spacing.sql.
-- This file intentionally lives outside supabase/migrations and is never automatic.
-- It restores the previous behavior where only a perfect review schedules the interval.

do $$
declare
  ddl text;
  restored text;
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;

  if ddl ~* 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+perfect[[:space:]]+then' then
    raise notice 'previous spacing behavior already restored';
    return;
  end if;

  if ddl !~* 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+pass[[:space:]]+then' then
    raise exception 'Unexpected complete_route_lesson_session_v1 body; refusing rollback';
  end if;

  restored := regexp_replace(
    ddl,
    'next_at([[:space:]]*):=([[:space:]]*)case([[:space:]]+)when([[:space:]]+)pass([[:space:]]+)then',
    'next_at\1:=\2case\3when\4perfect\5then',
    'i'
  );
  execute restored;
end $$;

revoke all on function public.complete_route_lesson_session_v1(uuid) from public,anon;
grant execute on function public.complete_route_lesson_session_v1(uuid) to authenticated;
