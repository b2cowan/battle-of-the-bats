-- 297 — Every paid Coaches Portal team carries a free-team shadow
-- (COACH_HOST_OWN_TEAM_ENTRY_PLAN.md Part C, F04 — owner accepted 2026-09-13, D4 ruled: backfill prod.)
--
-- THE DEFECT: a standalone workspace gets `team_workspaces.basic_coach_team_id` only from an
-- upgrade (the free team it grew out of) or a claimed tournament entry (the free team the claim
-- minted). A workspace started FROM SCRATCH — direct signup — has neither, and nothing ever
-- resolved one. Everything the coach-side tournament layer keys on that shadow: the record page's
-- access check, roster submission's master roster, the public register form's team picker. So a
-- from-scratch portal's coach registering on ANY public page minted a separate free team the paid
-- portal could never see, and the hosted-tournament "Add my team" door (Part A) had nothing to
-- bridge to.
--
-- WHAT THIS DOES (data-only): for every workspace with no shadow and no source registration to
-- adopt one from, mint a `basic_coach_teams` row named after the rep team (`source =
-- 'premium_upgrade'`, the CHECK value that already means "exists because of a paid workspace"),
-- back-link it BOTH ways, and make the workspace's primary owner its active owner. Workspaces
-- whose source registration already bridges to a free team are left to the runtime resolver,
-- which adopts that team on first read (it always did). The code path that mints the same shadow
-- at provisioning and lazily on read went in with this migration; this covers the stock.
--
-- ⚠ SCHEMA-INVISIBLE: pure INSERT/UPDATE. `check:migrations` cannot see it — recorded in
-- MANUAL_PROD_STEPS.json for that reason. Verify on prod with the query at the foot of this file.
--
-- Idempotent: every INSERT is keyed on `basic_coach_team_id IS NULL`, and the back-link UPDATE
-- only fills a NULL; a second run finds nothing to do.
--
-- ⚠ ORDER ON RELEASE: apply BEFORE (or with) the promote that carries the code. The code's lazy
-- resolver mints the same shadow on first read; if both ran against the same workspace at once,
-- this file's minted row could lose the back-link race and sit orphaned (the resolver's own race
-- handling cleans up ITS loser, not this one). Old code is indifferent to an extra basic team, so
-- "before" is free; "after" is the one order to avoid.

begin;

with candidates as (
  select
    w.id                          as workspace_id,
    w.primary_owner_user_id       as owner_user_id,
    t.name                        as team_name,
    t.sport                       as sport,
    t.division                    as division,
    lower(u.email)                as owner_email
  from public.team_workspaces w
  join public.rep_teams t on t.id = w.rep_team_id
  left join auth.users u on u.id = w.primary_owner_user_id
  where w.basic_coach_team_id is null
    and w.primary_owner_user_id is not null
    and u.email is not null            -- primary_coach_email is NOT NULL; an owner with no email cannot own a shadow
    and not exists (
      select 1 from public.basic_coach_team_registrations r
      where r.tournament_team_id = w.source_tournament_team_id
    )
),
minted as (
  insert into public.basic_coach_teams
    (name, normalized_name, primary_coach_name, primary_coach_email, sport, age_group, source, team_workspace_id, created_at, updated_at)
  select
    c.team_name,
    lower(trim(c.team_name)),
    null,
    c.owner_email,
    left(c.sport, 80),
    left(c.division, 80),
    'premium_upgrade',
    c.workspace_id,
    now(),
    now()
  from candidates c
  returning id as basic_coach_team_id, team_workspace_id
),
linked as (
  update public.team_workspaces w
     set basic_coach_team_id = m.basic_coach_team_id
    from minted m
   where w.id = m.team_workspace_id
     and w.basic_coach_team_id is null
  returning w.id as workspace_id, w.basic_coach_team_id, w.primary_owner_user_id
)
insert into public.basic_coach_team_users (basic_coach_team_id, user_id, role, status)
select l.basic_coach_team_id, l.primary_owner_user_id, 'owner', 'active'
  from linked l
 where not exists (
   select 1 from public.basic_coach_team_users x
    where x.basic_coach_team_id = l.basic_coach_team_id and x.user_id = l.primary_owner_user_id
 );

commit;

-- Verify (expect 0 rows — every owned workspace has a shadow, or a source registration to adopt one from):
-- select w.id, t.name
--   from public.team_workspaces w
--   join public.rep_teams t on t.id = w.rep_team_id
--  where w.basic_coach_team_id is null
--    and w.primary_owner_user_id is not null
--    and not exists (select 1 from public.basic_coach_team_registrations r where r.tournament_team_id = w.source_tournament_team_id);
