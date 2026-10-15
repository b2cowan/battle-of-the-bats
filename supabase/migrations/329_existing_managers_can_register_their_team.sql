-- 329 — Existing team managers can register their team for tournaments
-- (COACH_REGISTER_EXISTING_TEAM_PLAN.md — owner rulings D1 + A3, 2026-10-13.)
--
-- THE RULING: who may register a Premium team on another organizer's registration form is a
-- PERMISSION — the new "Register for tournaments" staff grant (`registerTournaments` in
-- `rep_team_staff_memberships.capabilities`, `lib/coach-capabilities.ts`). It defaults to the head
-- coach (always) and the team manager (the Team manager preset carries it ON from today). A3: the
-- managers who ALREADY exist get it too — otherwise "defaults to the team manager" would be false on
-- every team that exists today, including the team whose coach reported this.
--
-- ⚠ WHY THIS ONE IS BACKFILLED WHEN RUN TOURNAMENTS AND MANAGE STAFF WERE NOT. The 2026-09-13
-- rulings declined to backfill Manage staff (the master key, never widened by default) and Run
-- tournaments (a preset is where access starts). Registering for a tournament is not a master key
-- and reaches nobody else's data; the owner ruled it in (A3, as recommended). This file does not
-- reopen either earlier ruling.
--
-- SCOPE — exactly the rows the ruling names, nothing wider:
--   · a membership labelled 'manager' (mig 288's stored kind — the label picks the starting bundle,
--     which is precisely what A3 is about), ACTIVE, an assistant row (a head row ignores grants and
--     can never carry a kind — the 288 CHECK);
--   · on a team whose CURRENT org is a standalone Premium workspace (`account_kind = 'team_workspace'
--     or plan_id = 'team'` — `isTeamWorkspaceOrg`, `lib/team-workspace-kind.ts`). A club's teams are
--     out of scope: `applyOrgGrantPolicy` writes the grant off there, so it must never land there by
--     data either. A team moved into its club (mig 313) has its memberships' org follow it, so it is
--     excluded by the join on the team's org;
--   · and only where the key is ABSENT — a head coach's explicit choice (none can exist before this
--     ships, but the rule is the point) is never overwritten, and the file re-applies cleanly.
--
-- THE PROJECTION: the live season's `rep_team_coaches` row mirrors the membership's role AND
-- capabilities (`lib/coach-membership.ts`, the projection invariant), so the same key is merged onto
-- that member's rows on a draft/active season. Closed seasons are the RECORD and are never touched.
--
-- OPEN INVITES: a manager invited before today carries the preset as it was (no key) and would accept
-- without the grant. An open invite ('pending' / 'pending_approval') labelled 'manager' on a
-- standalone team gets the key too, for the same reason as the memberships.
--
-- ⚠ DATA-ONLY AND INVISIBLE TO EVERY DRIFT CHECK. No table, column or constraint changes, so
-- `check:migrations` reports "in sync" whether or not this ran. Recorded in MANUAL_PROD_STEPS.json.
-- Its prod state is knowable only by asking the rows:
--   select count(*) from rep_team_staff_memberships m join rep_teams t on t.id = m.team_id
--     join organizations o on o.id = t.org_id
--    where m.staff_kind = 'manager' and m.status = 'active' and m.coach_role = 'assistant_coach'
--      and (o.account_kind = 'team_workspace' or o.plan_id = 'team')
--      and not (coalesce(m.capabilities, '{}'::jsonb) ? 'registerTournaments');
--   → 0 once applied. (Counted read-only 2026-10-13: prod 1 membership, 0 open invites; dev 0.)
--
-- A NULL `capabilities` stays a defaults bundle with one key set: `'{}' || {key}` merges ONE key and
-- the resolver fills every other grant from the assistant defaults, exactly as before this file.

begin;

-- ── 1. The memberships (the access truth) ────────────────────────────────────────────────────
with managers as (
  select m.id, m.team_id, m.user_id
    from rep_team_staff_memberships m
    join rep_teams t on t.id = m.team_id
    join organizations o on o.id = t.org_id
   where m.staff_kind = 'manager'
     and m.status = 'active'
     and m.coach_role = 'assistant_coach'
     and (o.account_kind = 'team_workspace' or o.plan_id = 'team')
     and not (coalesce(m.capabilities, '{}'::jsonb) ? 'registerTournaments')
),
updated as (
  update rep_team_staff_memberships m
     set capabilities = coalesce(m.capabilities, '{}'::jsonb) || '{"registerTournaments": true}'::jsonb
    from managers
   where m.id = managers.id
  returning m.team_id, m.user_id
)
-- ── 2. Their live-season projection rows (draft/active seasons only — closed ones are the record) ──
update rep_team_coaches rc
   set capabilities = coalesce(rc.capabilities, '{}'::jsonb) || '{"registerTournaments": true}'::jsonb
  from updated u, rep_program_years y
 where rc.team_id = u.team_id
   and rc.user_id = u.user_id
   and rc.coach_role = 'assistant_coach'
   and y.id = rc.program_year_id
   and y.status in ('draft', 'active')
   and not (coalesce(rc.capabilities, '{}'::jsonb) ? 'registerTournaments');

-- ── 3. Open manager invites on standalone teams, so an accept lands the grant ─────────────────
update assistant_invite_tokens i
   set initial_capabilities = coalesce(i.initial_capabilities, '{}'::jsonb) || '{"registerTournaments": true}'::jsonb
  from rep_teams t, organizations o
 where t.id = i.team_id
   and o.id = t.org_id
   and i.staff_kind = 'manager'
   and i.status in ('pending', 'pending_approval')
   and (o.account_kind = 'team_workspace' or o.plan_id = 'team')
   and not (coalesce(i.initial_capabilities, '{}'::jsonb) ? 'registerTournaments');

commit;
