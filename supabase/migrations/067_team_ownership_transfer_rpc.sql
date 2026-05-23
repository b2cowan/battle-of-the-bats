-- Migration 067: Standalone Team ownership transfer completion
-- Moves a mutually approved Team workspace into the linked organization in one
-- database transaction. Stripe cancellation stays in app code.

CREATE OR REPLACE FUNCTION public.complete_team_workspace_ownership_transfer(
  p_link_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_link public.team_org_links%ROWTYPE;
  v_workspace public.team_workspaces%ROWTYPE;
  v_team public.rep_teams%ROWTYPE;
  v_workspace_org public.organizations%ROWTYPE;
  v_linked_org public.organizations%ROWTYPE;
  v_now timestamptz := now();
  v_coach_count int := 0;
  v_team_ledger_count int := 0;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'ownership_transfer_reason_required';
  END IF;

  SELECT * INTO v_link
  FROM public.team_org_links
  WHERE id = p_link_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ownership_transfer_link_not_found';
  END IF;

  IF v_link.status <> 'ownership_pending'
    OR v_link.link_type <> 'ownership'
    OR v_link.sharing_level <> 'full_org_owned'
    OR v_link.approved_by_team_user_id IS NULL
    OR v_link.approved_by_org_user_id IS NULL THEN
    RAISE EXCEPTION 'ownership_transfer_not_ready';
  END IF;

  SELECT * INTO v_workspace
  FROM public.team_workspaces
  WHERE id = v_link.team_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ownership_transfer_workspace_not_found';
  END IF;

  IF v_workspace.workspace_state = 'archived' THEN
    RAISE EXCEPTION 'ownership_transfer_workspace_archived';
  END IF;

  IF v_workspace.workspace_state = 'org_owned' THEN
    RAISE EXCEPTION 'ownership_transfer_already_completed';
  END IF;

  IF v_workspace.rep_team_id <> v_link.rep_team_id THEN
    RAISE EXCEPTION 'ownership_transfer_workspace_team_mismatch';
  END IF;

  SELECT * INTO v_team
  FROM public.rep_teams
  WHERE id = v_link.rep_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ownership_transfer_team_not_found';
  END IF;

  SELECT * INTO v_workspace_org
  FROM public.organizations
  WHERE id = v_workspace.workspace_org_id
  FOR UPDATE;

  SELECT * INTO v_linked_org
  FROM public.organizations
  WHERE id = v_link.linked_org_id
  FOR UPDATE;

  IF v_linked_org.id IS NULL THEN
    RAISE EXCEPTION 'ownership_transfer_linked_org_not_found';
  END IF;

  IF v_linked_org.account_kind = 'team_workspace' OR v_linked_org.plan_id = 'team' THEN
    RAISE EXCEPTION 'ownership_transfer_target_must_be_organization';
  END IF;

  IF v_team.org_id <> v_workspace.workspace_org_id THEN
    RAISE EXCEPTION 'ownership_transfer_team_not_in_workspace_org';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rep_teams existing
    WHERE existing.org_id = v_link.linked_org_id
      AND existing.slug = v_team.slug
      AND existing.id <> v_team.id
  ) THEN
    RAISE EXCEPTION 'ownership_transfer_team_slug_conflict';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounting_ledgers existing
    WHERE existing.org_id = v_link.linked_org_id
      AND existing.entity_type = 'team'
      AND existing.entity_id = v_team.id
  ) THEN
    RAISE EXCEPTION 'ownership_transfer_team_ledger_conflict';
  END IF;

  -- Capture coach memberships before rep_team_coaches.org_id moves.
  WITH coach_users AS (
    SELECT DISTINCT user_id
    FROM public.rep_team_coaches
    WHERE team_id = v_team.id
  )
  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at, status)
  SELECT v_link.linked_org_id, user_id, 'coach', v_now, 'active'
  FROM coach_users
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    accepted_at = COALESCE(public.organization_members.accepted_at, v_now),
    status = 'active',
    role = CASE
      WHEN public.organization_members.role IN ('owner', 'admin', 'treasurer', 'staff', 'league_admin', 'league_registrar', 'official')
        THEN public.organization_members.role
      ELSE 'coach'
    END;

  GET DIAGNOSTICS v_coach_count = ROW_COUNT;

  UPDATE public.accounting_ledgers
  SET org_id = v_link.linked_org_id
  WHERE entity_type = 'team'
    AND entity_id = v_team.id
    AND org_id = v_workspace.workspace_org_id;
  GET DIAGNOSTICS v_team_ledger_count = ROW_COUNT;

  UPDATE public.org_payees
  SET org_id = v_link.linked_org_id
  WHERE team_id = v_team.id
    AND org_id = v_workspace.workspace_org_id;

  UPDATE public.rep_cost_allocations
  SET org_id = v_link.linked_org_id
  WHERE org_id = v_workspace.workspace_org_id
    AND id IN (
      SELECT allocation_id
      FROM public.rep_allocation_splits
      WHERE team_id = v_team.id
    );

  UPDATE public.rep_teams
  SET org_id = v_link.linked_org_id,
      group_id = NULL,
      updated_at = v_now
  WHERE id = v_team.id;

  UPDATE public.rep_program_years
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_team_coaches
  SET org_id = v_link.linked_org_id
  WHERE team_id = v_team.id;

  UPDATE public.rep_tryout_registrations
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_roster_players
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_team_events
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_document_templates
  SET org_id = v_link.linked_org_id
  WHERE team_id = v_team.id
    AND org_id = v_workspace.workspace_org_id;

  UPDATE public.rep_player_documents
  SET org_id = v_link.linked_org_id
  WHERE team_id = v_team.id;

  UPDATE public.rep_allocation_splits
  SET org_id = v_link.linked_org_id
  WHERE team_id = v_team.id;

  UPDATE public.rep_player_dues_schedules
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_team_expenses
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_team_payment_requests
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_budget_lines
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_fundraisers
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.rep_fundraiser_entries
  SET org_id = v_link.linked_org_id,
      updated_at = v_now
  WHERE team_id = v_team.id;

  UPDATE public.team_entitlements
  SET status = 'cancelled',
      ends_at = COALESCE(ends_at, v_now),
      updated_at = v_now
  WHERE (team_workspace_id = v_workspace.id OR rep_team_id = v_team.id)
    AND status IN ('active', 'trialing', 'past_due');

  UPDATE public.team_org_links
  SET status = 'revoked',
      updated_at = v_now
  WHERE team_workspace_id = v_workspace.id
    AND id <> v_link.id
    AND status IN ('requested', 'invited', 'linked', 'ownership_pending');

  UPDATE public.team_org_links
  SET status = 'org_owned',
      link_type = 'ownership',
      sharing_level = 'full_org_owned',
      billing_mode_after_approval = 'club_included',
      updated_at = v_now
  WHERE id = v_link.id;

  UPDATE public.team_workspaces
  SET workspace_state = 'org_owned',
      billing_mode = 'club_included',
      billing_owner_org_id = v_link.linked_org_id,
      billing_owner_user_id = NULL,
      stripe_customer_id = NULL,
      stripe_subscription_id = NULL,
      subscription_status = 'active',
      current_period_end = NULL,
      updated_at = v_now
  WHERE id = v_workspace.id;

  UPDATE public.organizations
  SET team_workspace_status = 'org_owned',
      subscription_status = 'canceled',
      stripe_customer_id = NULL,
      stripe_subscription_id = NULL,
      subscription_period = NULL,
      current_period_end = NULL
  WHERE id = v_workspace.workspace_org_id;

  UPDATE public.organization_members
  SET status = 'suspended'
  WHERE organization_id = v_workspace.workspace_org_id
    AND status <> 'suspended';

  INSERT INTO public.org_audit_log (org_id, actor_id, target_id, action, payload)
  VALUES
    (
      v_link.linked_org_id,
      p_actor_user_id,
      v_link.id,
      'team_org_ownership_transfer_completed',
      jsonb_build_object(
        'teamWorkspaceId', v_workspace.id,
        'workspaceOrgId', v_workspace.workspace_org_id,
        'repTeamId', v_team.id,
        'reason', trim(p_reason),
        'actorEmail', p_actor_email
      )
    ),
    (
      v_workspace.workspace_org_id,
      p_actor_user_id,
      v_link.id,
      'team_org_ownership_transfer_completed',
      jsonb_build_object(
        'linkedOrgId', v_link.linked_org_id,
        'teamWorkspaceId', v_workspace.id,
        'repTeamId', v_team.id,
        'reason', trim(p_reason),
        'actorEmail', p_actor_email
      )
    );

  RETURN jsonb_build_object(
    'ok', true,
    'linkId', v_link.id,
    'teamWorkspaceId', v_workspace.id,
    'workspaceOrgId', v_workspace.workspace_org_id,
    'linkedOrgId', v_link.linked_org_id,
    'repTeamId', v_team.id,
    'previousBillingMode', v_workspace.billing_mode,
    'previousStripeSubscriptionId', v_workspace.stripe_subscription_id,
    'teamLedgerCount', v_team_ledger_count,
    'coachMembershipsUpserted', v_coach_count
  );
END;
$$;

COMMENT ON FUNCTION public.complete_team_workspace_ownership_transfer(uuid, uuid, text, text) IS
  'Completes a mutually approved standalone Team ownership transfer by moving team-scoped rep-team data and the team ledger to the linked organization.';
