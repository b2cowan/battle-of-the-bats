-- 313 — A coach's own team moves into a club WHOLE, and the move finishes itself
-- (Club Tier Stage 2, B04 / Ask 2 — owner ruling 2026-09-28: "finish it".
--  Plan: docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §4B B04, §6 Stage 2;
--  build prompt: docs/projects/active/CLUB_TIER_STAGE2_TRANSFER_PROMPT.md.)
--
-- Replaces migration 067's `complete_team_workspace_ownership_transfer`, which was written when a
-- team had ~17 tables and never revised (verified 2026-09-29: the live function on dev AND prod is
-- 067's body byte for byte). It moved 17 tables and left the rest of the team in the coach's own
-- org — the staff memberships (the access truth since mig 245), attendance, lineups, awards,
-- scouting, places, tryout scoring, development, money in, announcements, tags, the staff chat
-- room, the family portal links and the families' consents and opt-outs among them. After a move
-- the head coach was refused by every screen that checks membership. Only a FieldLogicHQ operator
-- could run it.
--
-- ── WHAT CHANGES ──────────────────────────────────────────────────────────────────────────────────
--
-- 1. ONE FUNCTION DOES THE WHOLE MOVE, AND THE SECOND "YES" RUNS IT. `move_team_into_club` records
--    the approving side's yes AND moves the team in the same transaction. There is no state where
--    both sides have said yes and nothing moved (which is what used to need an operator): if the
--    move cannot finish, the yes is not recorded either, and the approver sees why.
--
-- 2. THE TABLE LIST IS DECIDED BY RULE, NOT BY MEMORY. A coach's own org holds exactly one team
--    (guarded below — the move refuses otherwise), so every row it holds in a team table IS that
--    team's. `c_moves` lists those tables and moves every row by org. `c_moves_some` lists the
--    tables where only the team's part moves. Every other table that carries `org_id` stays with
--    the coach's org FOR A WRITTEN REASON — and that list lives in the build gate
--    (tests/unit/team-move-coverage.test.ts), which fails the build when the schema snapshot grows
--    a table with `org_id` that none of the three lists names. That is what stops a table added
--    next year from being left behind silently, which is exactly how 067 decayed.
--    ⚠ The gate PARSES the two arrays below. Keep one quoted table name per line.
--
-- 3. ROWS THAT POINT AT SOMETHING THAT STAYS ARE RE-POINTED, never left across two clubs:
--    - a guardian's person record (`person_id` → org_people) is cleared on the roster, tryout and
--      family-link rows and re-attached INSIDE THE CLUB by families_attach_people — the one home
--      for that rule (mig 252). A person is org-scoped by design (mig 251: the same parent at two
--      clubs is two records); a moved row must not keep pointing into the coach's org.
--    - "org budget" lines (org_budget_lines is the club-side budget; a Coaches Portal has none) are
--      cleared from payment requests and cost allocations defensively.
--    - the team's group is cleared (the club files it under its own groups), as 067 did.
--    - library rows the coach's org held as "the org's own" (team_id NULL — tags, drills, award
--      types, budget categories/items, payees, document templates) become THE TEAM'S own on the way
--      in. Moved as-is they would land in the CLUB's shared library, in front of every other team.
--
-- 4. THE STAFF COME WITH THE TEAM. Every ACTIVE staff member gets the capability-less `coach` seat
--    in the club the membership model gives every staff member. A person who already holds a real
--    role in the club keeps it UNCHANGED — including its status: 067 flipped any existing row to
--    'active', which would have quietly reinstated an admin the club had suspended.
--
-- 5. THE STAFF CHAT ROOM COMES TOO. A team's staff room is keyed (surface 'coach_peer', ref_id =
--    the team's org, ref_sub_id = the team). Left keyed to the coach's org, the club portal would
--    open a new, empty room and the staff's history would stay behind.
--
-- 6. FAMILIES' PRIVACY RECORDS COME WITH THEIR FAMILIES. An email opt-out (family_email_optouts,
--    keyed org + email) left behind would let the club email a family who asked not to be contacted.
--    Opt-outs and live consents move unless the club already holds the same one (then the club's
--    covers it, and the coach org's copy stays as its record).
--
-- 7. SAFETY THE OPERATOR STEP USED TO GIVE, KEPT:
--    - IDEMPOTENT: a second click or a second tab after the move landed answers `alreadyMoved`.
--    - THE TEAM PLACE is counted under the club's row lock, so two approvals at once cannot both
--      take the last place. The cap itself is plan-config (TypeScript) and arrives as p_team_cap.
--    - THE COACH'S OWN TOURNAMENT: a standalone Premium portal includes one tournament, and it
--      belongs to the coach's org, not the team, so it does not move. While it is still open
--      (draft or active) the move refuses — suspending the coach's org would lock them out of a
--      running tournament. A finished one stays with the coach's org as its history.
--    - THE TEAM'S ADDRESS: if the club already has a team at this slug, the move takes the first free
--      "-2", "-3"… instead of refusing (the public address changes with the org anyway).
--
-- ── WHAT DOES NOT MOVE (the gate's STAYS list carries the reason per table) ───────────────────────
-- The coach org as an account (its audit history, billing, overrides, telemetry, bell messages and
-- notification settings), its person records (re-derived in the club, see 3), its own tournament
-- and anything hanging off it, house league (a Coaches Portal runs none), and the org-level setup a
-- Coaches Portal does not use (org budget, venue library, team groups). FILES do not move either:
-- every document row stores its own storage path and is read by it (no path-prefix check exists),
-- so the objects stay where they are and keep working.
--
-- ── STRIPE ──────────────────────────────────────────────────────────────────────────────────────
-- Stays in app code, AFTER this commits (lib/team-ownership-transfer.ts): cancel now, no refund, no
-- proration (owner ruling 2026-09-28). ⚠ ORDER MATTERS: this function clears the Stripe ids on the
-- workspace and its org FIRST, so the `customer.subscription.deleted` webhook the cancel triggers
-- finds no workspace and sends no "your Coaches Portal has been cancelled" email.
--
-- ORDER: apply to prod BEFORE promoting the code that calls move_team_into_club. Drops 067's
-- function (its only caller, the operator's Complete Transfer, is removed in the same change), and
-- adds one partial unique index (one open request per team). The function half is invisible to
-- `check:migrations` — recorded in MANUAL_PROD_STEPS.json.

begin;

drop function if exists public.complete_team_workspace_ownership_transfer(uuid, uuid, text, text);

-- ONE OPEN REQUEST PER TEAM, enforced where it cannot be raced (/review 2026-09-29). The app refused a
-- second open request with an unlocked read, so two clubs asking in the same instant could both open
-- one — and two approvals of one team then locked each other (link → workspace vs workspace → the
-- other link) and one side was told "try again" about a team that had in fact moved. With this
-- index the second request fails its insert and is refused in words. ⚠ Creating it fails if any team
-- already holds two open requests: read prod first (expected none — the old routine allowed one
-- active link per team).
create unique index if not exists team_org_links_one_open_request
  on public.team_org_links (team_workspace_id)
  where status = 'ownership_pending';

create or replace function public.move_team_into_club(
  p_link_id uuid,
  p_approving_side text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_team_cap integer
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  -- Every row the coach's org holds in these tables is the team's, and all of it moves.
  c_moves constant text[] := array[
    'assistant_invite_tokens',
    'budget_categories',
    'budget_items',
    'family_links',
    'family_recap_views',
    'org_payees',
    'rep_allocation_installments',
    'rep_allocation_splits',
    'rep_budget_lines',
    'rep_cost_allocations',
    'rep_development_goal_reviews',
    'rep_document_templates',
    'rep_dues_payments',
    'rep_dues_payout_credits',
    'rep_dues_payouts',
    'rep_evaluation_not_assessed',
    'rep_fundraiser_credit_plan',
    'rep_fundraiser_entries',
    'rep_fundraisers',
    'rep_payable_installments',
    'rep_payable_payments',
    'rep_player_awards',
    'rep_player_continuity_links',
    'rep_player_development_goals',
    'rep_player_documents',
    'rep_player_dues_installments',
    'rep_player_dues_schedules',
    'rep_player_measurables',
    'rep_player_notes',
    'rep_player_observations',
    'rep_player_tryout_baselines',
    'rep_program_years',
    'rep_roster_players',
    'rep_season_refund_adjustments',
    'rep_team_announcements',
    'rep_team_award_types',
    'rep_team_call_up_appearances',
    'rep_team_circuits',
    'rep_team_coaches',
    'rep_team_drills',
    'rep_team_evaluation_sessions',
    'rep_team_event_attendance',
    'rep_team_events',
    'rep_team_expenses',
    'rep_team_game_moments',
    'rep_team_import_events',
    'rep_team_lineup_templates',
    'rep_team_lineups',
    'rep_team_measurable_types',
    'rep_team_money_in',
    'rep_team_opponent_aliases',
    'rep_team_opponent_observations',
    'rep_team_opponents',
    'rep_team_payment_requests',
    'rep_team_places',
    'rep_team_plan_templates',
    'rep_team_staff_memberships',
    'rep_team_tags',
    'rep_teams',
    'rep_tryout_evaluator_sessions',
    'rep_tryout_registrations',
    'rep_tryout_rubrics',
    'rep_tryout_scores',
    'rep_tryout_sessions',
    'rep_tryouts'
  ];
  -- Only the team's part of these moves (each has its own statement below, with its reason).
  c_moves_some constant text[] := array[
    'accounting_ledgers',
    'chat_message_reports',
    'chat_rooms',
    'family_consents',
    'family_email_optouts'
  ];
  -- Library tables where team_id NULL means "the org's own": in a coach's org that is the team's.
  c_team_library constant text[] := array[
    'budget_categories', 'budget_items', 'org_payees', 'rep_document_templates',
    'rep_team_award_types', 'rep_team_drills', 'rep_team_tags'
  ];
  v_link public.team_org_links%rowtype;
  v_workspace public.team_workspaces%rowtype;
  v_team public.rep_teams%rowtype;
  v_ws public.organizations%rowtype;
  v_club public.organizations%rowtype;
  v_now timestamptz := now();
  v_table text;
  v_rows bigint;
  v_moved jsonb := '{}'::jsonb;
  v_active_teams integer;
  v_slug text;
  v_suffix integer := 1;
  v_staff_seats integer := 0;
begin
  if p_approving_side is null or p_approving_side not in ('club', 'coach') then
    raise exception 'team_move_bad_side';
  end if;

  select * into v_link from public.team_org_links where id = p_link_id for update;
  if not found then
    raise exception 'team_move_not_found';
  end if;

  -- A second click, a second tab, or both sides at once: the move already landed — say so, don't fail.
  if v_link.status = 'org_owned' then
    return jsonb_build_object(
      'ok', true, 'alreadyMoved', true, 'linkId', v_link.id,
      'repTeamId', v_link.rep_team_id, 'linkedOrgId', v_link.linked_org_id
    );
  end if;

  -- Waiting on exactly THIS side: the other side has said yes, this one has not.
  if v_link.status <> 'ownership_pending' or v_link.link_type <> 'ownership' then
    raise exception 'team_move_not_waiting';
  end if;
  if p_approving_side = 'club'
     and (v_link.approved_by_team_user_id is null or v_link.approved_by_org_user_id is not null) then
    raise exception 'team_move_not_waiting';
  end if;
  if p_approving_side = 'coach'
     and (v_link.approved_by_org_user_id is null or v_link.approved_by_team_user_id is not null) then
    raise exception 'team_move_not_waiting';
  end if;

  select * into v_workspace from public.team_workspaces where id = v_link.team_workspace_id for update;
  if not found then
    raise exception 'team_move_workspace_not_found';
  end if;
  if v_workspace.workspace_state = 'archived' then
    raise exception 'team_move_workspace_archived';
  end if;
  if v_workspace.workspace_state = 'org_owned' then
    raise exception 'team_move_already_moved';
  end if;
  if v_workspace.rep_team_id <> v_link.rep_team_id then
    raise exception 'team_move_workspace_team_mismatch';
  end if;

  select * into v_team from public.rep_teams where id = v_link.rep_team_id for update;
  if not found then
    raise exception 'team_move_team_not_found';
  end if;

  -- Lock order: the coach's org, then the club. A coach's org is never a club, so two moves into the
  -- same club share only the club's lock and cannot deadlock.
  select * into v_ws from public.organizations where id = v_workspace.workspace_org_id for update;
  select * into v_club from public.organizations where id = v_link.linked_org_id for update;
  if v_club.id is null then
    raise exception 'team_move_club_not_found';
  end if;
  if v_club.account_kind = 'team_workspace' or v_club.plan_id = 'team' then
    raise exception 'team_move_target_not_a_club';
  end if;
  if v_team.org_id <> v_ws.id then
    raise exception 'team_move_team_not_in_workspace';
  end if;

  -- The rule "every row the coach's org holds is the team's" is true only for a one-team org.
  if (select count(*) from public.rep_teams where org_id = v_ws.id) <> 1 then
    raise exception 'team_move_workspace_holds_other_teams';
  end if;

  -- The coach's own tournament does not move; an open one keeps the coach's org alive until it ends.
  if exists (select 1 from public.tournaments where org_id = v_ws.id and status in ('draft', 'active')) then
    raise exception 'team_move_open_tournament';
  end if;

  -- The team place, counted under the club's lock.
  if p_team_cap is not null and not v_team.is_archived then
    select count(*) into v_active_teams
      from public.rep_teams where org_id = v_club.id and is_archived = false;
    if v_active_teams >= p_team_cap then
      raise exception 'team_move_team_limit';
    end if;
  end if;

  if exists (
    select 1 from public.accounting_ledgers
     where org_id = v_club.id and entity_type = 'team' and entity_id = v_team.id
  ) then
    raise exception 'team_move_team_ledger_conflict';
  end if;

  -- The address: kept when it is free in the club, else the first free "-2", "-3", …
  v_slug := v_team.slug;
  while v_slug is not null and exists (
    select 1 from public.rep_teams where org_id = v_club.id and slug = v_slug and id <> v_team.id
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_team.slug || '-' || v_suffix;
  end loop;

  -- This side's yes — recorded in the same transaction as the move, never on its own.
  if p_approving_side = 'club' then
    update public.team_org_links set approved_by_org_user_id = p_actor_user_id where id = v_link.id;
  else
    update public.team_org_links set approved_by_team_user_id = p_actor_user_id where id = v_link.id;
  end if;

  -- ── The staff come with the team ─────────────────────────────────────────────────────────────
  insert into public.organization_members (organization_id, user_id, role, accepted_at, status)
  select distinct v_club.id, m.user_id, 'coach', v_now, 'active'
    from public.rep_team_staff_memberships m
   where m.team_id = v_team.id and m.status = 'active'
  on conflict (organization_id, user_id) do update
     set accepted_at = case
           when public.organization_members.role = 'coach'
             then coalesce(public.organization_members.accepted_at, v_now)
           else public.organization_members.accepted_at
         end,
         status = case
           when public.organization_members.role = 'coach' and public.organization_members.status <> 'suspended'
             then 'active'
           else public.organization_members.status
         end;
  get diagnostics v_staff_seats = row_count;

  -- ── Re-point what would otherwise point into the coach's org ─────────────────────────────────
  update public.rep_roster_players set person_id = null where org_id = v_ws.id and person_id is not null;
  update public.rep_tryout_registrations set person_id = null where org_id = v_ws.id and person_id is not null;
  update public.family_links set person_id = null where org_id = v_ws.id and person_id is not null;

  update public.rep_team_payment_requests set budget_line_id = null
   where org_id = v_ws.id
     and budget_line_id in (select id from public.org_budget_lines where org_id = v_ws.id);
  update public.rep_cost_allocations set source_budget_line_id = null
   where org_id = v_ws.id
     and source_budget_line_id in (select id from public.org_budget_lines where org_id = v_ws.id);

  foreach v_table in array c_team_library loop
    -- A shared row and a team row with the same name would become two team rows with one name (each
    -- table's team-scoped unique name rule). Refuse in words, naming the table, rather than let the
    -- raw unique violation read as "the move failed" with no way forward (/review 2026-09-29).
    begin
      execute format('update public.%I set team_id = $1 where org_id = $2 and team_id is null', v_table)
        using v_team.id, v_ws.id;
    exception when unique_violation then
      raise exception 'team_move_library_name_clash: %', v_table;
    end;
  end loop;

  update public.rep_teams set group_id = null, slug = v_slug, updated_at = v_now where id = v_team.id;

  -- ── The move: every row of the team tables ───────────────────────────────────────────────────
  foreach v_table in array c_moves loop
    execute format('update public.%I set org_id = $1 where org_id = $2', v_table)
      using v_club.id, v_ws.id;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      v_moved := v_moved || jsonb_build_object(v_table, v_rows);
    end if;
  end loop;

  -- ── The team's part of the shared tables ─────────────────────────────────────────────────────
  -- The team's own ledger. The coach org's general ledger stays (a Coaches Portal never writes it).
  update public.accounting_ledgers set org_id = v_club.id
   where org_id = v_ws.id and entity_type = 'team' and entity_id = v_team.id;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('accounting_ledgers', v_rows); end if;

  -- The team's staff room, re-keyed to the club (the club portal finds it by the team's org).
  update public.chat_rooms
     set org_id = v_club.id,
         ref_id = case when ref_id = v_ws.id then v_club.id else ref_id end
   where org_id = v_ws.id and ref_sub_id = v_team.id;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('chat_rooms', v_rows); end if;

  update public.chat_message_reports set org_id = v_club.id
   where org_id = v_ws.id
     and room_id in (select id from public.chat_rooms where org_id = v_club.id and ref_sub_id = v_team.id);
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('chat_message_reports', v_rows); end if;

  -- A family's "don't email me" goes with the family. Where the club already holds the same one, the
  -- club's covers it and the coach org's copy stays as its record.
  update public.family_email_optouts o set org_id = v_club.id
   where o.org_id = v_ws.id
     and not exists (
       select 1 from public.family_email_optouts c where c.org_id = v_club.id and c.email = o.email
     );
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('family_email_optouts', v_rows); end if;

  update public.family_consents f set org_id = v_club.id
   where f.org_id = v_ws.id
     and (
       f.withdrawn_at is not null
       or not exists (
         select 1 from public.family_consents c
          where c.org_id = v_club.id
            and c.withdrawn_at is null
            and c.guardian_email = f.guardian_email
            and c.basis = f.basis
            and c.scope = f.scope
            and coalesce(c.source_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = coalesce(f.source_id, '00000000-0000-0000-0000-000000000000'::uuid)
       )
     );
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('family_consents', v_rows); end if;

  -- The team's guardians become people IN THE CLUB (matched by address to anyone the club knows).
  perform public.families_attach_people(v_club.id);

  -- ── The coach's own portal closes (as 067) ───────────────────────────────────────────────────
  update public.team_entitlements
     set status = 'cancelled', ends_at = coalesce(ends_at, v_now), updated_at = v_now
   where (team_workspace_id = v_workspace.id or rep_team_id = v_team.id)
     and status in ('active', 'trialing', 'past_due');

  update public.team_org_links set status = 'revoked', updated_at = v_now
   where team_workspace_id = v_workspace.id
     and id <> v_link.id
     and status in ('requested', 'invited', 'linked', 'ownership_pending');

  update public.team_org_links
     set status = 'org_owned', link_type = 'ownership', sharing_level = 'full_org_owned',
         billing_mode_after_approval = 'club_included', updated_at = v_now
   where id = v_link.id;

  -- ⚠ The Stripe ids are cleared HERE, before the app cancels the subscription, so the webhook the
  -- cancel triggers finds no workspace and sends no "cancelled" email (see the header).
  update public.team_workspaces
     set workspace_state = 'org_owned', billing_mode = 'club_included',
         billing_owner_org_id = v_club.id, billing_owner_user_id = null,
         stripe_customer_id = null, stripe_subscription_id = null,
         subscription_status = 'active', current_period_end = null, updated_at = v_now
   where id = v_workspace.id;

  update public.organizations
     set team_workspace_status = 'org_owned', subscription_status = 'canceled',
         stripe_customer_id = null, stripe_subscription_id = null,
         subscription_period = null, current_period_end = null
   where id = v_ws.id;

  update public.organization_members set status = 'suspended'
   where organization_id = v_ws.id and status <> 'suspended';

  insert into public.org_audit_log (org_id, actor_id, target_id, action, payload)
  values
    (v_club.id, p_actor_user_id, v_link.id, 'team_moved_into_club',
     jsonb_build_object(
       'approvingSide', p_approving_side, 'actorEmail', p_actor_email,
       'teamWorkspaceId', v_workspace.id, 'workspaceOrgId', v_ws.id, 'repTeamId', v_team.id,
       'teamName', v_team.name, 'slug', v_slug, 'previousSlug', v_team.slug,
       'staffSeats', v_staff_seats, 'moved', v_moved
     )),
    -- ⚠ The coach's subscription id is written HERE, durably, in the move's own transaction: the
    -- move clears it from the workspace and the org, and the app cancels it only after commit. If
    -- the process dies in between, this row is the one place that still names what to cancel.
    (v_ws.id, p_actor_user_id, v_link.id, 'team_moved_into_club',
     jsonb_build_object(
       'approvingSide', p_approving_side, 'actorEmail', p_actor_email,
       'linkedOrgId', v_club.id, 'teamWorkspaceId', v_workspace.id, 'repTeamId', v_team.id,
       'teamName', v_team.name,
       'previousStripeSubscriptionId', coalesce(v_workspace.stripe_subscription_id, v_ws.stripe_subscription_id)
     ));

  return jsonb_build_object(
    'ok', true,
    'alreadyMoved', false,
    'linkId', v_link.id,
    'teamWorkspaceId', v_workspace.id,
    'workspaceOrgId', v_ws.id,
    'linkedOrgId', v_club.id,
    'clubSlug', v_club.slug,
    'repTeamId', v_team.id,
    'teamName', v_team.name,
    'teamSlug', v_slug,
    'slugChanged', v_slug is distinct from v_team.slug,
    'previousBillingMode', v_workspace.billing_mode,
    'previousStripeSubscriptionId', coalesce(v_workspace.stripe_subscription_id, v_ws.stripe_subscription_id),
    'staffSeats', v_staff_seats,
    'moved', v_moved
  );
end;
$$;

comment on function public.move_team_into_club(uuid, text, uuid, text, integer) is
  'Moves a coach''s own (standalone) team into a club, whole, when the second side says yes (mig 313, '
  'replaces 067). Records that yes and the move in one transaction. Every table carrying org_id is '
  'moved (c_moves / c_moves_some) or stays for a reason held by tests/unit/team-move-coverage.test.ts. '
  'Idempotent (alreadyMoved). Stripe is cancelled by the app after commit. Service role only.';

revoke all on function public.move_team_into_club(uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.move_team_into_club(uuid, text, uuid, text, integer) to service_role;

commit;
