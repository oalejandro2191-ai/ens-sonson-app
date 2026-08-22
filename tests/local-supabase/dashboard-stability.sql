\set ON_ERROR_STOP on

select id::text as student1_id from auth.users where email='student1@ens.local' \gset
select id::text as student2_id from auth.users where email='student2@ens.local' \gset

begin;

-- Build a deterministic due-review condition without persisting it.
update public.student_word_progress
set next_review_at=current_timestamp + interval '1 day'
where student_id=:'student1_id'::uuid;

update public.student_word_progress
set next_review_at=current_timestamp - interval '1 minute'
where student_id=:'student1_id'::uuid
  and word_id=(select word_id from public.student_word_progress where student_id=:'student1_id'::uuid order by word_id limit 1);

update public.student_word_progress
set next_review_at=current_timestamp - interval '1 minute'
where student_id=:'student2_id'::uuid;

select set_config('request.jwt.claim.sub', :'student1_id', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select count(*)::int as expected_due
from public.student_word_progress
where student_id=auth.uid() and next_review_at<=current_timestamp \gset

select (public.get_my_learning_dashboard_v1('A1-V3')->>'due_review_words')::int as dashboard_due_1 \gset
select (public.get_my_learning_dashboard_v1('A1-V3')->>'due_review_words')::int as dashboard_due_2 \gset

\if :dashboard_due_1 != :expected_due
  \echo 'dashboard due count mismatch'
  \quit 1
\endif
\if :dashboard_due_2 != :expected_due
  \echo 'dashboard result changed unexpectedly inside one transaction'
  \quit 1
\endif
\if :expected_due != 1
  \echo 'dashboard included another student or fixture setup is invalid'
  \quit 1
\endif

rollback;
