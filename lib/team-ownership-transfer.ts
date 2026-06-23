import 'server-only';

import { writePlatformEvent } from './platform-events';
import { writePlatformAuditLog } from './platform-audit';
import { isStripeConfigured } from './billing-mock';
import { stripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { getTeamOrgLinkSummary, type TeamOrgLinkSummary } from './team-org-links';
import { PLAN_CONFIG } from './plan-config';
import type { OrgPlan } from './types';
import type { TeamWorkspace, TeamWorkspaceBillingMode } from './team-workspace-entitlements';

type OwnershipLinkRow = {
  id: string;
  team_workspace_id: string;
  rep_team_id: string;
  linked_org_id: string;
  status: string;
  link_type: string;
  sharing_level: string;
  requested_by_user_id: string | null;
  approved_by_team_user_id: string | null;
  approved_by_org_user_id: string | null;
  billing_mode_after_approval: TeamWorkspaceBillingMode | null;
};

type OwnershipWorkspaceRow = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  workspace_state: string;
  billing_mode: TeamWorkspaceBillingMode;
  billing_owner_org_id: string | null;
  stripe_subscription_id: string | null;
};

type OwnershipOrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string | null;
  enabled_addons: unknown;
  account_kind: string | null;
};

export type TeamOwnershipTransferResult =
  | { ok: true; link: TeamOrgLinkSummary }
  | { ok: false; status: number; error: string };

export type CompleteTeamOwnershipTransferResult =
  | {
      ok: true;
      result: Record<string, unknown>;
      stripeCancellation: 'not_needed' | 'cancelled' | 'failed';
      stripeCancellationError?: string;
    }
  | { ok: false; status: number; error: string };

async function fetchLinkAndWorkspace(linkId: string): Promise<{
  link: OwnershipLinkRow;
  workspace: OwnershipWorkspaceRow;
} | null> {
  const { data: link, error: linkError } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link) return null;

  const row = link as OwnershipLinkRow;
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, workspace_state, billing_mode, billing_owner_org_id, stripe_subscription_id')
    .eq('id', row.team_workspace_id)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) return null;

  return { link: row, workspace: workspace as OwnershipWorkspaceRow };
}

function baseLinkState(workspace: OwnershipWorkspaceRow, linkedOrgId: string) {
  if (workspace.billing_mode === 'org_team_addon' && workspace.billing_owner_org_id === linkedOrgId) {
    return {
      status: 'linked',
      link_type: 'billing',
      sharing_level: 'basic',
      billing_mode_after_approval: 'org_team_addon',
    };
  }

  return {
    status: 'linked',
    link_type: 'visibility',
    sharing_level: 'basic',
    billing_mode_after_approval: null,
  };
}

function validateOwnershipBase(params: {
  link: OwnershipLinkRow;
  workspace: OwnershipWorkspaceRow;
  orgId?: string;
  workspaceId?: string;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (params.orgId && params.link.linked_org_id !== params.orgId) {
    return { ok: false, status: 404, error: 'Team link was not found for this organization.' };
  }
  if (params.workspaceId && params.link.team_workspace_id !== params.workspaceId) {
    return { ok: false, status: 404, error: 'Team link was not found for this workspace.' };
  }
  if (params.workspace.workspace_state === 'archived') {
    return { ok: false, status: 409, error: 'Archived Team workspaces cannot transfer ownership.' };
  }
  if (params.workspace.workspace_state === 'org_owned' || params.link.status === 'org_owned') {
    return { ok: false, status: 409, error: 'This Team workspace is already org-owned.' };
  }
  if (params.link.status !== 'linked' && params.link.status !== 'ownership_pending') {
    return { ok: false, status: 409, error: 'Create the Basic visibility link before requesting ownership transfer.' };
  }
  return { ok: true };
}

async function getSummaryOrThrow(linkId: string): Promise<TeamOrgLinkSummary> {
  const summary = await getTeamOrgLinkSummary(linkId);
  if (!summary) throw new Error('Team ownership transfer link could not be loaded.');
  return summary;
}

async function writeOrgAudit(
  orgId: string,
  actorId: string,
  targetId: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from('org_audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    target_id: targetId,
    action,
    payload,
  });
  if (error) {
    console.error('[team-ownership-transfer] audit write error:', error);
  }
}

async function writeOwnershipEvent(params: {
  eventType:
    | 'team_org_ownership_requested'
    | 'team_org_ownership_invited'
    | 'team_org_ownership_request_approved'
    | 'team_org_ownership_invite_accepted'
    | 'team_org_ownership_request_declined'
    | 'team_org_ownership_invite_declined'
    | 'team_org_ownership_transfer_completed';
  orgId: string;
  actorUserId: string;
  actorEmail?: string | null;
  source?: 'app' | 'platform_admin';
  metadata: Record<string, unknown>;
}) {
  await writePlatformEvent({
    eventType: params.eventType,
    source: params.source ?? 'app',
    orgId: params.orgId,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail ?? null,
    planId: 'team',
    metadata: params.metadata,
  });
}

function enabledAddonsIncludes(value: unknown, addon: string): boolean {
  return Array.isArray(value) && value.includes(addon);
}

function orgHasRepTeamsModule(org: OwnershipOrgRow): boolean {
  // Plan-config-driven (Club Repackaging): any plan whose tier includes module_rep_teams
  // qualifies — covers club AND club_large (and any future club-tier band) without hardcoding
  // each plan key. Falls back to the per-org add-on for non-tier grants.
  const planModules = PLAN_CONFIG[org.plan_id as OrgPlan]?.moduleEntitlements ?? [];
  return planModules.includes('module_rep_teams') || enabledAddonsIncludes(org.enabled_addons, 'module_rep_teams');
}

async function fetchOrg(orgId: string): Promise<OwnershipOrgRow | null> {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, enabled_addons, account_kind')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as OwnershipOrgRow | null) ?? null;
}

async function cancelStripeSubscription(subscriptionId: string | null): Promise<{
  status: 'not_needed' | 'cancelled' | 'failed';
  error?: string;
}> {
  if (!subscriptionId || !subscriptionId.startsWith('sub_')) return { status: 'not_needed' };
  if (!isStripeConfigured()) return { status: 'failed', error: 'Stripe is not configured; cancel the prior Team subscription manually.' };

  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { status: 'cancelled' };
  } catch (error) {
    console.error('[team-ownership-transfer] Stripe cancellation failed:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Stripe cancellation failed.',
    };
  }
}

export async function requestTeamOwnershipTransfer(input: {
  workspace: TeamWorkspace;
  linkId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOwnershipTransferResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team link was not found.' };

  const validation = validateOwnershipBase({
    link: found.link,
    workspace: found.workspace,
    workspaceId: input.workspace.id,
  });
  if (!validation.ok) return validation;

  if (found.link.status === 'ownership_pending') {
    if (found.link.approved_by_org_user_id && !found.link.approved_by_team_user_id) {
      return { ok: false, status: 409, error: 'This organization has already invited you to transfer ownership. Accept or decline that invitation.' };
    }
    if (found.link.approved_by_team_user_id) {
      return { ok: true, link: await getSummaryOrThrow(found.link.id) };
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update({
      status: 'ownership_pending',
      link_type: 'ownership',
      sharing_level: 'full_org_owned',
      requested_by_user_id: input.actorUserId,
      approved_by_team_user_id: input.actorUserId,
      approved_by_org_user_id: null,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('team_workspace_id', input.workspace.id);
  if (error) throw error;

  await Promise.all([
    writeOrgAudit(input.workspace.workspaceOrgId, input.actorUserId, found.link.id, 'team_org_ownership_requested_by_team', {
      linkedOrgId: found.link.linked_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOrgAudit(found.link.linked_org_id, input.actorUserId, found.link.id, 'team_org_ownership_requested_by_team', {
      workspaceOrgId: input.workspace.workspaceOrgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOwnershipEvent({
      eventType: 'team_org_ownership_requested',
      orgId: input.workspace.workspaceOrgId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      metadata: {
        linkedOrgId: found.link.linked_org_id,
        teamWorkspaceId: found.link.team_workspace_id,
        repTeamId: found.link.rep_team_id,
        linkId: found.link.id,
      },
    }),
  ]);

  return { ok: true, link: await getSummaryOrThrow(found.link.id) };
}

export async function inviteTeamOwnershipTransfer(input: {
  orgId: string;
  linkId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOwnershipTransferResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team link was not found.' };

  const validation = validateOwnershipBase({
    link: found.link,
    workspace: found.workspace,
    orgId: input.orgId,
  });
  if (!validation.ok) return validation;

  if (found.link.status === 'ownership_pending') {
    if (found.link.approved_by_org_user_id && !found.link.approved_by_team_user_id) {
      return { ok: true, link: await getSummaryOrThrow(found.link.id) };
    }
    if (found.link.approved_by_team_user_id && !found.link.approved_by_org_user_id) {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('team_org_links')
        .update({
          approved_by_org_user_id: input.actorUserId,
          updated_at: now,
        })
        .eq('id', found.link.id)
        .eq('linked_org_id', input.orgId);
      if (error) throw error;

      await Promise.all([
        writeOrgAudit(input.orgId, input.actorUserId, found.link.id, 'team_org_ownership_request_approved_by_org', {
          workspaceOrgId: found.workspace.workspace_org_id,
          teamWorkspaceId: found.link.team_workspace_id,
          repTeamId: found.link.rep_team_id,
        }),
        writeOrgAudit(found.workspace.workspace_org_id, input.actorUserId, found.link.id, 'team_org_ownership_request_approved_by_org', {
          linkedOrgId: input.orgId,
          teamWorkspaceId: found.link.team_workspace_id,
          repTeamId: found.link.rep_team_id,
        }),
        writeOwnershipEvent({
          eventType: 'team_org_ownership_request_approved',
          orgId: input.orgId,
          actorUserId: input.actorUserId,
          actorEmail: input.actorEmail ?? null,
          metadata: {
            workspaceOrgId: found.workspace.workspace_org_id,
            teamWorkspaceId: found.link.team_workspace_id,
            repTeamId: found.link.rep_team_id,
            linkId: found.link.id,
            approvedExistingRequest: true,
          },
        }),
      ]);

      return { ok: true, link: await getSummaryOrThrow(found.link.id) };
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update({
      status: 'ownership_pending',
      link_type: 'ownership',
      sharing_level: 'full_org_owned',
      requested_by_user_id: null,
      approved_by_org_user_id: input.actorUserId,
      approved_by_team_user_id: null,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('linked_org_id', input.orgId);
  if (error) throw error;

  await Promise.all([
    writeOrgAudit(input.orgId, input.actorUserId, found.link.id, 'team_org_ownership_invited_by_org', {
      workspaceOrgId: found.workspace.workspace_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOrgAudit(found.workspace.workspace_org_id, input.actorUserId, found.link.id, 'team_org_ownership_invited_by_org', {
      linkedOrgId: input.orgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOwnershipEvent({
      eventType: 'team_org_ownership_invited',
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      metadata: {
        workspaceOrgId: found.workspace.workspace_org_id,
        teamWorkspaceId: found.link.team_workspace_id,
        repTeamId: found.link.rep_team_id,
        linkId: found.link.id,
      },
    }),
  ]);

  return { ok: true, link: await getSummaryOrThrow(found.link.id) };
}

export async function respondToTeamOwnershipTransferInvite(input: {
  workspace: TeamWorkspace;
  linkId: string;
  action: 'accept' | 'decline';
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOwnershipTransferResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team ownership invitation was not found.' };

  const validation = validateOwnershipBase({
    link: found.link,
    workspace: found.workspace,
    workspaceId: input.workspace.id,
  });
  if (!validation.ok) return validation;

  if (found.link.status !== 'ownership_pending' || found.link.link_type !== 'ownership' || !found.link.approved_by_org_user_id) {
    return { ok: false, status: 409, error: 'There is no ownership transfer invitation waiting for this Team workspace.' };
  }
  if (found.link.approved_by_team_user_id) {
    return { ok: false, status: 409, error: 'This ownership transfer invitation has already been reviewed.' };
  }

  const now = new Date().toISOString();
  const patch = input.action === 'accept'
    ? { approved_by_team_user_id: input.actorUserId, updated_at: now }
    : {
        ...baseLinkState(found.workspace, found.link.linked_org_id),
        approved_by_team_user_id: input.actorUserId,
        updated_at: now,
      };

  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update(patch)
    .eq('id', found.link.id)
    .eq('team_workspace_id', input.workspace.id);
  if (error) throw error;

  const eventType = input.action === 'accept'
    ? 'team_org_ownership_invite_accepted'
    : 'team_org_ownership_invite_declined';
  const auditAction = input.action === 'accept'
    ? 'team_org_ownership_invite_accepted_by_team'
    : 'team_org_ownership_invite_declined_by_team';

  await Promise.all([
    writeOrgAudit(input.workspace.workspaceOrgId, input.actorUserId, found.link.id, auditAction, {
      linkedOrgId: found.link.linked_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOrgAudit(found.link.linked_org_id, input.actorUserId, found.link.id, auditAction, {
      workspaceOrgId: input.workspace.workspaceOrgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOwnershipEvent({
      eventType,
      orgId: input.workspace.workspaceOrgId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      metadata: {
        linkedOrgId: found.link.linked_org_id,
        teamWorkspaceId: found.link.team_workspace_id,
        repTeamId: found.link.rep_team_id,
        linkId: found.link.id,
      },
    }),
  ]);

  return { ok: true, link: await getSummaryOrThrow(found.link.id) };
}

export async function declineTeamOwnershipTransferRequest(input: {
  orgId: string;
  linkId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOwnershipTransferResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team ownership request was not found.' };

  const validation = validateOwnershipBase({
    link: found.link,
    workspace: found.workspace,
    orgId: input.orgId,
  });
  if (!validation.ok) return validation;

  if (found.link.status !== 'ownership_pending' || found.link.link_type !== 'ownership' || !found.link.approved_by_team_user_id || found.link.approved_by_org_user_id) {
    return { ok: false, status: 409, error: 'There is no Team ownership request waiting for this organization.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update({
      ...baseLinkState(found.workspace, found.link.linked_org_id),
      approved_by_org_user_id: input.actorUserId,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('linked_org_id', input.orgId);
  if (error) throw error;

  await Promise.all([
    writeOrgAudit(input.orgId, input.actorUserId, found.link.id, 'team_org_ownership_request_declined_by_org', {
      workspaceOrgId: found.workspace.workspace_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOrgAudit(found.workspace.workspace_org_id, input.actorUserId, found.link.id, 'team_org_ownership_request_declined_by_org', {
      linkedOrgId: input.orgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOwnershipEvent({
      eventType: 'team_org_ownership_request_declined',
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail ?? null,
      metadata: {
        workspaceOrgId: found.workspace.workspace_org_id,
        teamWorkspaceId: found.link.team_workspace_id,
        repTeamId: found.link.rep_team_id,
        linkId: found.link.id,
      },
    }),
  ]);

  return { ok: true, link: await getSummaryOrThrow(found.link.id) };
}

export async function completeTeamOwnershipTransfer(input: {
  linkId: string;
  actorUserId: string;
  actorEmail: string;
  reason: string;
}): Promise<CompleteTeamOwnershipTransferResult> {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    return { ok: false, status: 400, error: 'Reason is required.' };
  }

  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team ownership transfer was not found.' };

  if (
    found.link.status !== 'ownership_pending' ||
    found.link.link_type !== 'ownership' ||
    found.link.sharing_level !== 'full_org_owned' ||
    !found.link.approved_by_team_user_id ||
    !found.link.approved_by_org_user_id
  ) {
    return { ok: false, status: 409, error: 'Ownership transfer is not ready for platform completion.' };
  }

  const targetOrg = await fetchOrg(found.link.linked_org_id);
  if (!targetOrg) return { ok: false, status: 404, error: 'Linked organization was not found.' };
  if (targetOrg.account_kind === 'team_workspace' || targetOrg.plan_id === 'team') {
    return { ok: false, status: 409, error: 'Ownership transfer target must be a normal organization.' };
  }
  if (!orgHasRepTeamsModule(targetOrg)) {
    return {
      ok: false,
      status: 409,
      error: 'The target organization must have Club or the Rep Teams module before ownership transfer can complete.',
    };
  }

  const previousSubscriptionId = found.workspace.stripe_subscription_id ?? null;
  const { data, error } = await supabaseAdmin.rpc('complete_team_workspace_ownership_transfer', {
    p_link_id: input.linkId,
    p_actor_user_id: input.actorUserId,
    p_actor_email: input.actorEmail,
    p_reason: reason,
  });

  if (error) {
    const message = error.message || 'Ownership transfer could not be completed.';
    if (message.includes('ownership_transfer_team_slug_conflict')) {
      return { ok: false, status: 409, error: 'The target organization already has a rep team with this slug.' };
    }
    if (message.includes('ownership_transfer_team_ledger_conflict')) {
      return { ok: false, status: 409, error: 'The target organization already has a team ledger for this Team.' };
    }
    if (message.includes('ownership_transfer_not_ready')) {
      return { ok: false, status: 409, error: 'Ownership transfer is not ready for platform completion.' };
    }
    console.error('[team-ownership-transfer] complete RPC failed:', error);
    return { ok: false, status: 500, error: 'Ownership transfer could not be completed.' };
  }

  const transferResult = (data ?? {}) as Record<string, unknown>;
  const stripeCancellation = await cancelStripeSubscription(previousSubscriptionId);

  await Promise.all([
    writePlatformAuditLog(
      input.actorEmail,
      found.link.linked_org_id,
      'complete_team_ownership_transfer',
      'team_org_link',
      {
        linkId: found.link.id,
        teamWorkspaceId: found.workspace.id,
        workspaceOrgId: found.workspace.workspace_org_id,
        repTeamId: found.workspace.rep_team_id,
        previousBillingMode: found.workspace.billing_mode,
        previousStripeSubscriptionId: previousSubscriptionId,
      },
      {
        ...transferResult,
        reason,
        stripeCancellation: stripeCancellation.status,
        stripeCancellationError: stripeCancellation.error ?? null,
      },
    ),
    writeOwnershipEvent({
      eventType: 'team_org_ownership_transfer_completed',
      orgId: found.link.linked_org_id,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      source: 'platform_admin',
      metadata: {
        ...transferResult,
        reason,
        stripeCancellation: stripeCancellation.status,
        stripeCancellationError: stripeCancellation.error ?? null,
      },
    }),
  ]);

  return {
    ok: true,
    result: transferResult,
    stripeCancellation: stripeCancellation.status,
    stripeCancellationError: stripeCancellation.error,
  };
}
