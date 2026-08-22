-- SQL-level guard: the candidate must space every valid pass and must not retain perfect-only spacing.
do $$
declare ddl text;
begin
  select pg_get_functiondef('public.complete_route_lesson_session_v1(uuid)'::regprocedure) into ddl;
  if ddl !~* 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+pass[[:space:]]+then' then
    raise exception 'candidate pass-based spacing expression is missing';
  end if;
  if ddl ~* 'next_at[[:space:]]*:=[[:space:]]*case[[:space:]]+when[[:space:]]+perfect[[:space:]]+then' then
    raise exception 'legacy perfect-only spacing expression remains active';
  end if;
end $$;
