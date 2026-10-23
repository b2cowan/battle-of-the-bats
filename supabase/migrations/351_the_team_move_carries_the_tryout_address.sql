-- 351: the team move carries the head coach's tryout questions address — Club Tier Stage 4c-2 Part B (2026-10-22).
--
-- Migration 350 added rep_team_tryout_contacts, which carries org_id. The team move must say what happens to every org_id
-- table (tests/unit/team-move-coverage.test.ts): the address is the TEAM's — one row per team, set by a head coach whose
-- membership moves with the team (rep_team_staff_memberships is in c_moves, and its ids do not change) — so it moves into
-- the club with them. This re-creates move_team_into_club EXACTLY as 340 wrote it, with one line added to c_moves
-- (rep_team_tryout_contacts). Nothing else in the body changes.
--
-- A replaced function is invisible to the drift check: declared in MANUAL_PROD_STEPS.json.
--
-- The two statements before the function are 313's own, repeated verbatim so the NEWEST definition of the move stands
-- on its own (the coverage test reads only the newest). Both are idempotent: on a database that ran 313 they do nothing.

begin;

drop function if exists public.complete_team_workspace_ownership_transfer(uuid, uuid, text, text);

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
    'rep_sponsor_invoices',
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
    'rep_team_tryout_contacts',
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
  'replaces 067; mig 340 adds rep_sponsor_invoices, mig 351 rep_team_tryout_contacts). Records that yes and the move in one transaction. Every table '
  'carrying org_id is moved (c_moves / c_moves_some) or stays for a reason held by tests/unit/team-move-coverage.test.ts. '
  'Idempotent (alreadyMoved). Stripe is cancelled by the app after commit. Service role only.';

revoke all on function public.move_team_into_club(uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.move_team_into_club(uuid, text, uuid, text, integer) to service_role;

commit;
