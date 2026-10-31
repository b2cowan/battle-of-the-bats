-- 414: a coach's own workspace becomes the club, in place — Plan & billing Stage 4b, Part 1 (2026-10-30).
--
-- Owner ruling 2026-10-30 (BUSINESS_DECISIONS.md, "A Premium coach's own workspace BECOMES the club, in place"): the coach's
-- team does not move, is not copied and is not re-parented; the workspace organization itself turns into the club. This is
-- the sibling of move_team_into_club (313/351), which is the OTHER door (a coach joining SOMEONE ELSE'S club).
--
-- WHAT IT DOES, in one transaction, repeatable without harm (docs/projects/active/PLAN_AND_BILLING_STAGE4B_PLAN.md §3.2):
--   · organizations: account_kind 'organization' (the real tag — also un-hides the club from the public directory),
--     team_workspace_status NULL, plan_id + tournament_limit from the plan, name = the club name the coach typed (NULL keeps
--     today's), billing_suspended_* cleared. NOT touched: slug, team_limit, free_floor, is_discoverable (stays false until the
--     coach opts in — ruled), the org's own Stripe columns (the real Club subscription writes them), the owner and head-coach
--     memberships, the basic_coach_teams shadow.
--   · team_workspaces: TOMBSTONED, never deleted (team_entitlements, basic_coach_teams and team_org_links point at it):
--     workspace_state 'org_owned', billing_mode 'club_included', Stripe ids NULL. ⚠ The NULL is the load-bearing line: the
--     webhook's portal branch (syncTeamWorkspaceSubscription) keys on this column ALONE, so a Club cancellation or a late
--     event carrying the old Premium price finds no workspace and never runs the portal retention or its email.
--   · team_entitlements ended; a staff-given free-time grant (org_overrides) revoked with its audit entry; open
--     team_org_links revoked.
--   · the workspace-only staff grants (tournaments, registerTournaments) stripped from every place they are stored: the
--     membership rows, the rep_team_coaches projection, pending invites — and the tournament bundle the projection wrote
--     onto organization_members.capabilities (coach-role members), so a co-head coach does not keep tournament rights in a club.
--   · one org_audit_log row.
--
-- GATED on a settled Club subscription: the org already carries the Club plan, a subscription id, and a status of 'active' or
-- 'trialing' (a started Club trial counts — a free-time coach starts one). Anything else refuses by name and writes nothing;
-- the next billing event calls it again. Refuses a workspace holding more than one team, so a surprise is visible.
--
-- The caller passes the tournament limit and the actor because PLAN_CONFIG lives in TypeScript (the bridge does the same with
-- its team cap). No Stripe call lives here. Service role only.
--
-- A new function is invisible to the drift check: declared in MANUAL_PROD_STEPS.json. NOT applied to any database by this file.

begin;

create or replace function public.flip_workspace_into_club(
  p_org_id uuid,
  p_plan text,
  p_club_name text,
  p_tournament_limit integer,
  p_actor text
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  -- lib/module-entitlements.ts isClubPlan(): one definition in TypeScript, pinned to this list by tests/unit/workspace-flip-guard.test.ts.
  c_club_plans constant text[] := array['club', 'club_large'];
  -- lib/coach-capabilities.ts WORKSPACE_ONLY_GRANTS.
  c_workspace_grants constant text[] := array['tournaments', 'registerTournaments'];
  -- lib/coach-tournament-grant.ts TOURNAMENT_BUNDLE: the override keys "Run tournaments" writes onto a coach-role member.
  c_tournament_bundle constant text[] := array[
    'module_tournaments', 'create_tournaments', 'manage_registrations', 'manage_schedule_structure', 'update_schedule',
    'submit_scores', 'check_in_teams', 'manage_contacts', 'post_announcements', 'post_rules', 'send_communications',
    'seal_tournaments', 'manage_branding'
  ];
  -- lib/portal-free-time.ts PORTAL_FREE_TIME_GRANT_TYPE: the billing-status grant that holds a free-time portal open.
  c_free_time_grant_type constant text := 'subscription_status';
  v_ws public.team_workspaces%rowtype;
  v_org public.organizations%rowtype;
  v_now timestamptz := now();
  v_actor text := coalesce(nullif(btrim(p_actor), ''), 'system');
  v_name text := nullif(btrim(p_club_name), '');
  v_teams integer;
  v_grant record;
  v_ended_grants integer := 0;
  v_ended_entitlements bigint := 0;
  v_revoked_links bigint := 0;
  v_stripped jsonb := '{}'::jsonb;
  v_rows bigint;
begin
  -- Lock order matches the bridge: the workspace row, then the organization.
  select * into v_ws from public.team_workspaces where workspace_org_id = p_org_id for update;
  if not found then
    raise exception 'workspace_flip_not_a_workspace';
  end if;

  select * into v_org from public.organizations where id = p_org_id for update;
  if not found then
    raise exception 'workspace_flip_org_not_found';
  end if;

  -- A second event, a retry, the move and the webhook at once: it already happened — say so, write nothing.
  if v_org.account_kind = 'organization'
     and v_ws.workspace_state = 'org_owned'
     and v_ws.billing_mode = 'club_included' then
    return jsonb_build_object(
      'ok', true, 'alreadyFlipped', true,
      'orgId', v_org.id, 'orgSlug', v_org.slug, 'workspaceId', v_ws.id
    );
  end if;

  if v_org.account_kind <> 'team_workspace' then
    raise exception 'workspace_flip_not_a_workspace';
  end if;
  -- A team that moved into someone else's club (archived or org_owned while the tag still says workspace) is history.
  if v_ws.workspace_state in ('archived', 'org_owned') then
    raise exception 'workspace_flip_workspace_closed';
  end if;

  if p_plan is null or not (p_plan = any (c_club_plans)) then
    raise exception 'workspace_flip_not_a_club_plan';
  end if;
  if v_org.plan_id <> p_plan then
    raise exception 'workspace_flip_plan_mismatch';
  end if;
  if v_org.stripe_subscription_id is null or v_org.subscription_status not in ('active', 'trialing') then
    raise exception 'workspace_flip_not_settled';
  end if;

  select count(*) into v_teams from public.rep_teams where org_id = v_org.id;
  if v_teams > 1 then
    raise exception 'workspace_flip_holds_other_teams';
  end if;

  -- ── The organization becomes the club ────────────────────────────────────────────────────────
  update public.organizations
     set account_kind = 'organization',
         team_workspace_status = null,
         plan_id = p_plan,
         tournament_limit = coalesce(p_tournament_limit, tournament_limit),
         name = coalesce(v_name, name),
         billing_suspended_at = null,
         billing_suspension_reason = null
   where id = v_org.id;

  -- ── The workspace row is a tombstone, never deleted ──────────────────────────────────────────
  -- ⚠ The Stripe ids are cleared HERE so the webhook's portal branch (keyed on this column alone) finds nothing to sync,
  -- retain or email about when the Club subscription is later cancelled or a stale Premium event arrives.
  update public.team_workspaces
     set workspace_state = 'org_owned', billing_mode = 'club_included',
         billing_owner_org_id = v_org.id, billing_owner_user_id = null,
         stripe_customer_id = null, stripe_subscription_id = null,
         subscription_status = 'active', current_period_end = null, updated_at = v_now
   where id = v_ws.id;

  -- Clubs entitle their own teams. Positive filter: the codebase spells the ended status both ways.
  update public.team_entitlements
     set status = 'cancelled', ends_at = v_now, updated_at = v_now
   where (team_workspace_id = v_ws.id or rep_team_id = v_ws.rep_team_id)
     and status in ('active', 'trialing', 'past_due');
  get diagnostics v_ended_entitlements = row_count;

  -- A staff-given free-time grant would keep overriding the Club subscription's real status: end it, with its own entry
  -- (lib/portal-keep-premium.ts convertFreeTimePortal does the same in TypeScript). A grant with no end is still running.
  for v_grant in
    select id, expires_at from public.org_overrides
     where org_id = v_org.id
       and type = c_free_time_grant_type
       and revoked_at is null
       and (expires_at is null or expires_at > v_now)
     for update
  loop
    update public.org_overrides set revoked_at = v_now, revoked_by = v_actor
     where id = v_grant.id and revoked_at is null;
    insert into public.platform_audit_log (actor_email, org_id, action, field, old_value, new_value, reason)
    values (
      v_actor, v_org.id, 'revoke_override', 'id', to_jsonb(v_grant.id::text),
      jsonb_build_object('portal', true, 'subscribed', true, 'was_expires_at', v_grant.expires_at),
      'The coach started a club.'
    );
    v_ended_grants := v_ended_grants + 1;
  end loop;

  update public.team_org_links set status = 'revoked', updated_at = v_now
   where team_workspace_id = v_ws.id
     and status in ('requested', 'invited', 'linked', 'ownership_pending');
  get diagnostics v_revoked_links = row_count;

  -- ── The workspace-only staff grants leave every place they are stored ────────────────────────
  -- Written the way applyOrgGrantPolicy writes a club bundle (both switches false), and only where one is on.
  update public.rep_team_staff_memberships
     set capabilities = capabilities || jsonb_build_object('tournaments', false, 'registerTournaments', false)
   where org_id = v_org.id
     and ((capabilities ->> 'tournaments') = 'true' or (capabilities ->> 'registerTournaments') = 'true');
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_stripped := v_stripped || jsonb_build_object('rep_team_staff_memberships', v_rows); end if;

  update public.rep_team_coaches
     set capabilities = capabilities || jsonb_build_object('tournaments', false, 'registerTournaments', false)
   where org_id = v_org.id
     and ((capabilities ->> 'tournaments') = 'true' or (capabilities ->> 'registerTournaments') = 'true');
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_stripped := v_stripped || jsonb_build_object('rep_team_coaches', v_rows); end if;

  update public.assistant_invite_tokens
     set initial_capabilities = initial_capabilities || jsonb_build_object('tournaments', false, 'registerTournaments', false)
   where org_id = v_org.id
     and status in ('pending', 'pending_approval')
     and ((initial_capabilities ->> 'tournaments') = 'true' or (initial_capabilities ->> 'registerTournaments') = 'true');
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_stripped := v_stripped || jsonb_build_object('assistant_invite_tokens', v_rows); end if;

  -- The tournament bundle the projection wrote onto a coach-role membership: exactly its keys removed (the projection's
  -- own "off"), an emptied map back to NULL. In a club the tournaments are the club's, and the projection stops running.
  update public.organization_members
     set capabilities = nullif(capabilities - c_tournament_bundle, '{}'::jsonb)
   where organization_id = v_org.id
     and role = 'coach'
     and capabilities is not null
     and capabilities <> (capabilities - c_tournament_bundle);
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_stripped := v_stripped || jsonb_build_object('organization_members', v_rows); end if;

  insert into public.org_audit_log (org_id, actor_id, target_id, action, payload)
  values (
    v_org.id, null, v_ws.id, 'workspace_flipped_into_club',
    jsonb_build_object(
      'actor', v_actor, 'plan', p_plan, 'teamWorkspaceId', v_ws.id, 'repTeamId', v_ws.rep_team_id,
      'previousName', v_org.name, 'name', coalesce(v_name, v_org.name),
      'previousPlanId', v_org.plan_id, 'previousSubscriptionStatus', v_org.subscription_status,
      'previousWorkspaceBillingMode', v_ws.billing_mode,
      'previousWorkspaceStripeSubscriptionId', v_ws.stripe_subscription_id,
      'endedEntitlements', v_ended_entitlements, 'endedFreeTimeGrants', v_ended_grants,
      'revokedLinks', v_revoked_links, 'strippedGrants', v_stripped
    )
  );

  return jsonb_build_object(
    'ok', true,
    'alreadyFlipped', false,
    'orgId', v_org.id,
    'orgSlug', v_org.slug,
    'workspaceId', v_ws.id,
    'repTeamId', v_ws.rep_team_id,
    'name', coalesce(v_name, v_org.name),
    'endedEntitlements', v_ended_entitlements,
    'endedFreeTimeGrants', v_ended_grants,
    'revokedLinks', v_revoked_links,
    'strippedGrants', v_stripped
  );
end;
$$;

comment on function public.flip_workspace_into_club(uuid, text, text, integer, text) is
  'Turns a coach''s standalone Coaches Portal organization into a club IN PLACE (Plan & billing Stage 4b Part 1, mig 414): '
  'account_kind/plan/limit/name, the workspace row tombstoned with its Stripe ids NULL (so a Club cancellation never runs the '
  'portal retention or email), the entitlement and any staff-given free-time grant ended, open links revoked, the workspace-only '
  'staff grants stripped, one org_audit_log row. One transaction, idempotent (alreadyFlipped), refuses by name unless a settled '
  'Club subscription is on file. No Stripe call. Service role only.';

revoke all on function public.flip_workspace_into_club(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.flip_workspace_into_club(uuid, text, text, integer, text) to service_role;

commit;
