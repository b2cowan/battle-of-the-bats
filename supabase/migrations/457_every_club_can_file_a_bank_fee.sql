-- 457 — every club can file a bank fee and bank interest (Bank check novice UX S3, ruling 2, owner 2026-11-09;
-- build prompt docs/projects/active/BANK_CHECK_NOVICE_UX_S3_BUILD_PROMPT.md; plan BANK_CHECK_NOVICE_UX_PLAN.md §2 S3).
--
-- The Bank tab's new "Add a bank fee" / "Add interest" doors open Add an entry filed under a platform word. The club's
-- filing picker (scope=org, forPlanning=1) had neither, and no club had made its own (read on dev and prod 2026-11-09).
--
-- 1. A platform money-out word "Bank & payment fees" under the platform "Admin" heading (scope org: clubs only, as the
--    coach's own "League & Fees › Bank & payment fees" is team-only). Default, every sport, typed (a money-out word
--    always is), sorted after the four Admin words and before Misc.
-- 2. The platform "Other Income" heading widens from scope 'team' to 'both' (/dba 2026-11-09): the club's picker gains
--    Interest, Rebate, Donation and Other income — four hand-recorded money-in words with no special meaning anywhere
--    (no receipts, no derived actuals). Chosen over a second platform "Other Income" (org) holding only Interest: two
--    platform headings of one name show twice in the club's categories panel (it lists every platform heading) and split
--    the club's cross-team reports, which group by category id, into two identical-looking groups. Coaches read 'team'
--    and 'both', so nothing changes for a team.
--
-- Data only (no schema). Re-runnable: the insert skips an existing word, the update matches only a 'team' heading.
-- Each target is asserted to be exactly one platform row first, so a renamed or duplicated heading stops the migration
-- rather than writing to the wrong place.

begin;

do $$
declare n_admin int; n_other int;
begin
  select count(*) into n_admin from public.budget_categories
   where org_id is null and team_id is null and name = 'Admin' and scope = 'org';
  select count(*) into n_other from public.budget_categories
   where org_id is null and team_id is null and name = 'Other Income' and scope in ('team', 'both');
  if n_admin <> 1 then raise exception '457: expected one platform Admin heading (scope org), found %', n_admin; end if;
  if n_other <> 1 then raise exception '457: expected one platform Other Income heading, found %', n_other; end if;
end $$;

insert into public.budget_items
  (category_id, org_id, team_id, name, suggested_amount, sort_order, is_default, is_misc, direction, actual_source, sports)
select c.id, null, null, 'Bank & payment fees', null, 5, true, false, 'out', 'typed', null
  from public.budget_categories c
 where c.org_id is null and c.team_id is null and c.name = 'Admin' and c.scope = 'org'
   and not exists (
     select 1 from public.budget_items i
      where i.category_id = c.id and i.org_id is null and i.team_id is null and lower(i.name) = 'bank & payment fees');

update public.budget_categories
   set scope = 'both'
 where org_id is null and team_id is null and name = 'Other Income' and scope = 'team';

commit;
