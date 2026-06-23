import 'server-only';

// ⚠️ RETIRING (Club Repackaging, 2026-06-22): the org-pays "$19/team" billing-takeover
// (org_team_addon) is retired. Teams in a Club are included up to the plan cap; an external
// coach either keeps a standalone portal or transfers ownership in. The request/invite/respond/
// checkout entry points are no longer wired to any route (the team-links routes return 410).
// Only `completeOrgTeamAddonBillingFromMetadata` remains referenced (by the Stripe webhook) so
// any in-flight pre-cutover session could still settle — there are 0 such subscriptions in dev
// or prod (verified 2026-06-22), so this whole module is effectively dead and safe to delete
// once the webhook arms are removed post-cutover.

import { normalizeBillingCycle, type BillingCycle } from './plan-config';
import { isBillingMockEnabled, isStripeConfigured } from './billing-mock';
import { writePlatformEvent } from './platform-events';
import { stripe } from './stripe';
import { getStripePriceId } from './stripe-prices';
import { supabaseAdmin } from './supabase-admin';
import {
  mapStripeStatusToOrgStatus,
  mapStripeStatusToTeamEntitlementStatus,
} from './team-checkout';
import { getTeamOrgLinkSummary, type TeamOrgLinkSummary } from './team-org-links';
import type { TeamWorkspace, TeamWorkspaceBillingMode } from './team-workspace-entitlements';
import type { Organization } from './types';

const ORG_TEAM_ADDON_CHECKOUT_KIND = 'org_team_addon';
const METADATA_VERSION = '1';

type TeamOrgBillingLinkRow = {
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

type TeamWorkspaceBillingRow = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  primary_owner_user_id: string | null;
  workspace_state: string;
  billing_mode: TeamWorkspaceBillingMode;
  billing_owner_org_id: string | null;
  billing_owner_user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
};

type OrgTeamAddonMetadata = {
  orgId: string;
  teamWorkspaceId: string;
  workspaceOrgId: string;
  repTeamId: string;
  linkId: string;
  billingCycle: BillingCycle;
  approvedByOrgUserId: string | null;
  approvedByOrgEmail: string | null;
  previousTeamSubscriptionId: string | null;
};

export type TeamOrgBillingActionResult =
  | { ok: true; link: TeamOrgLinkSummary; applied?: boolean; url?: string | null; billingCycle?: BillingCycle }
  | { ok: false; status: number; error: string };

export type CompleteOrgTeamAddonBillingResult =
  | {
      ok: true;
      linkId: string;
      teamWorkspaceId: string;
      orgId: string;
      previousTeamSubscriptionId: string | null;
    }
  | { ok: false; reason: 'not_org_team_addon' | 'invalid_metadata' | 'missing_subscription_id' };

function metadataValue(value: string | null | undefined): string {
  return value == null ? '' : value.slice(0, 500);
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? '';
}

function appendSuccess(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}success=1`;
}

function parseOrgTeamAddonMetadata(metadata: Record<string, string> | null | undefined): OrgTeamAddonMetadata | null {
  if (!metadata || metadata.checkoutKind !== ORG_TEAM_ADDON_CHECKOUT_KIND) return null;

  const orgId = metadata.orgId?.trim();
  const teamWorkspaceId = metadata.teamWorkspaceId?.trim();
  const workspaceOrgId = metadata.workspaceOrgId?.trim();
  const repTeamId = metadata.repTeamId?.trim();
  const linkId = metadata.linkId?.trim();
  if (!orgId || !teamWorkspaceId || !workspaceOrgId || !repTeamId || !linkId) return null;

  return {
    orgId,
    teamWorkspaceId,
    workspaceOrgId,
    repTeamId,
    linkId,
    billingCycle: normalizeBillingCycle(metadata.billingCycle),
    approvedByOrgUserId: metadata.approvedByOrgUserId?.trim() || null,
    approvedByOrgEmail: metadata.approvedByOrgEmail?.trim() || null,
    previousTeamSubscriptionId: metadata.previousTeamSubscriptionId?.trim() || null,
  };
}

function buildOrgTeamAddonMetadata(params: {
  orgId: string;
  teamWorkspaceId: string;
  workspaceOrgId: string;
  repTeamId: string;
  linkId: string;
  billingCycle: BillingCycle;
  approvedByOrgUserId: string;
  approvedByOrgEmail?: string | null;
  previousTeamSubscriptionId?: string | null;
}): Record<string, string> {
  return {
    checkoutKind: ORG_TEAM_ADDON_CHECKOUT_KIND,
    metadataVersion: METADATA_VERSION,
    orgId: metadataValue(params.orgId),
    teamWorkspaceId: metadataValue(params.teamWorkspaceId),
    workspaceOrgId: metadataValue(params.workspaceOrgId),
    repTeamId: metadataValue(params.repTeamId),
    linkId: metadataValue(params.linkId),
    billingCycle: metadataValue(params.billingCycle),
    approvedByOrgUserId: metadataValue(params.approvedByOrgUserId),
    approvedByOrgEmail: metadataValue(params.approvedByOrgEmail),
    previousTeamSubscriptionId: metadataValue(params.previousTeamSubscriptionId),
  };
}

function isBillingTakeoverPending(link: TeamOrgBillingLinkRow): boolean {
  return link.link_type === 'billing' && link.billing_mode_after_approval === 'org_team_addon';
}

function canTransferBillingMode(mode: TeamWorkspaceBillingMode): boolean {
  return mode === 'team_direct' || mode === 'platform_override';
}

async function getLinkSummaryOrThrow(linkId: string): Promise<TeamOrgLinkSummary> {
  const summary = await getTeamOrgLinkSummary(linkId);
  if (!summary) throw new Error('Team org link summary could not be loaded.');
  return summary;
}

async function fetchLink(linkId: string): Promise<TeamOrgBillingLinkRow | null> {
  const { data, error } = await supabaseAdmin
    .from('team_org_links')
    .select('*')
    .eq('id', linkId)
    .maybeSingle();
  if (error) throw error;
  return (data as TeamOrgBillingLinkRow | null) ?? null;
}

async function fetchWorkspace(workspaceId: string): Promise<TeamWorkspaceBillingRow | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, primary_owner_user_id, workspace_state, billing_mode, billing_owner_org_id, billing_owner_user_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as TeamWorkspaceBillingRow | null) ?? null;
}

async function fetchLinkAndWorkspace(linkId: string): Promise<{
  link: TeamOrgBillingLinkRow;
  workspace: TeamWorkspaceBillingRow;
} | null> {
  const link = await fetchLink(linkId);
  if (!link) return null;
  const workspace = await fetchWorkspace(link.team_workspace_id);
  if (!workspace) return null;
  return { link, workspace };
}

function validateLinkedBasicLink(params: {
  link: TeamOrgBillingLinkRow;
  workspace: TeamWorkspaceBillingRow;
  orgId?: string;
  workspaceId?: string;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (params.orgId && params.link.linked_org_id !== params.orgId) {
    return { ok: false, status: 404, error: 'Team link was not found for this organization.' };
  }
  if (params.workspaceId && params.link.team_workspace_id !== params.workspaceId) {
    return { ok: false, status: 404, error: 'Team link was not found for this workspace.' };
  }
  if (params.link.status !== 'linked') {
    return { ok: false, status: 409, error: 'Create the Basic visibility link before moving billing.' };
  }
  if (params.link.sharing_level !== 'basic') {
    return { ok: false, status: 409, error: 'Only Basic linked Team workspaces can use this billing takeover flow.' };
  }
  if (params.workspace.workspace_state === 'archived' || params.workspace.workspace_state === 'org_owned') {
    return { ok: false, status: 409, error: 'This Team workspace cannot move to org billing.' };
  }
  if (params.workspace.billing_mode === 'org_team_addon' && params.workspace.billing_owner_org_id === params.link.linked_org_id) {
    return { ok: false, status: 409, error: 'This organization already pays for this Team workspace.' };
  }
  if (!canTransferBillingMode(params.workspace.billing_mode)) {
    return { ok: false, status: 409, error: 'This Team workspace billing mode cannot be moved through the org Team add-on flow.' };
  }
  return { ok: true };
}

async function writeOrgAudit(
  orgId: string,
  actorId: string | null,
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
    console.error('[team-org-billing] audit write error:', error);
  }
}

async function writeBillingLifecycleEvent(params: {
  eventType:
    | 'team_org_billing_requested'
    | 'team_org_billing_invited'
    | 'team_org_billing_invite_accepted'
    | 'team_org_billing_request_declined'
    | 'team_org_billing_invite_declined'
    | 'team_org_billing_checkout_started'
    | 'team_org_billing_takeover_completed';
  orgId: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  source?: 'app' | 'stripe' | 'mock';
  sourceEventId?: string | null;
  metadata: Record<string, unknown>;
}) {
  await writePlatformEvent({
    eventType: params.eventType,
    source: params.source ?? 'app',
    sourceEventId: params.sourceEventId ?? null,
    orgId: params.orgId,
    actorUserId: params.actorUserId ?? null,
    actorEmail: params.actorEmail ?? null,
    planId: 'team',
    metadata: params.metadata,
  });
}

export async function requestOrgTeamAddonBilling(input: {
  workspace: TeamWorkspace;
  linkId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOrgBillingActionResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team link was not found.' };

  const validation = validateLinkedBasicLink({
    link: found.link,
    workspace: found.workspace,
    workspaceId: input.workspace.id,
  });
  if (!validation.ok) return validation;

  if (isBillingTakeoverPending(found.link)) {
    if (found.link.approved_by_org_user_id && !found.link.approved_by_team_user_id) {
      return { ok: false, status: 409, error: 'This organization has already invited you to move billing. Accept or decline that invitation.' };
    }
    if (found.link.approved_by_team_user_id && !found.link.approved_by_org_user_id) {
      return { ok: true, link: await getLinkSummaryOrThrow(found.link.id) };
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update({
      link_type: 'billing',
      billing_mode_after_approval: 'org_team_addon',
      requested_by_user_id: input.actorUserId,
      approved_by_team_user_id: input.actorUserId,
      approved_by_org_user_id: null,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('team_workspace_id', input.workspace.id);
  if (error) throw error;

  await Promise.all([
    writeOrgAudit(input.workspace.workspaceOrgId, input.actorUserId, found.link.id, 'team_org_billing_requested_by_team', {
      linkedOrgId: found.link.linked_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
      billingModeAfterApproval: 'org_team_addon',
    }),
    writeOrgAudit(found.link.linked_org_id, input.actorUserId, found.link.id, 'team_org_billing_requested_by_team', {
      workspaceOrgId: input.workspace.workspaceOrgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
      billingModeAfterApproval: 'org_team_addon',
    }),
    writeBillingLifecycleEvent({
      eventType: 'team_org_billing_requested',
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

  return { ok: true, link: await getLinkSummaryOrThrow(found.link.id) };
}

export async function inviteOrgTeamAddonBilling(input: {
  orgId: string;
  linkId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOrgBillingActionResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team link was not found.' };

  const validation = validateLinkedBasicLink({
    link: found.link,
    workspace: found.workspace,
    orgId: input.orgId,
  });
  if (!validation.ok) return validation;

  if (isBillingTakeoverPending(found.link)) {
    if (found.link.approved_by_org_user_id && !found.link.approved_by_team_user_id) {
      return { ok: true, link: await getLinkSummaryOrThrow(found.link.id) };
    }
    if (found.link.approved_by_team_user_id && !found.link.approved_by_org_user_id) {
      return { ok: false, status: 409, error: 'This Team coach already requested org billing. Approve or decline that request.' };
    }
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update({
      link_type: 'billing',
      billing_mode_after_approval: 'org_team_addon',
      requested_by_user_id: null,
      approved_by_org_user_id: input.actorUserId,
      approved_by_team_user_id: null,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('linked_org_id', input.orgId);
  if (error) throw error;

  await Promise.all([
    writeOrgAudit(input.orgId, input.actorUserId, found.link.id, 'team_org_billing_invited_by_org', {
      workspaceOrgId: found.workspace.workspace_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
      billingModeAfterApproval: 'org_team_addon',
    }),
    writeOrgAudit(found.workspace.workspace_org_id, input.actorUserId, found.link.id, 'team_org_billing_invited_by_org', {
      linkedOrgId: input.orgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
      billingModeAfterApproval: 'org_team_addon',
    }),
    writeBillingLifecycleEvent({
      eventType: 'team_org_billing_invited',
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

  return { ok: true, link: await getLinkSummaryOrThrow(found.link.id) };
}

export async function respondToOrgTeamAddonBillingInvite(input: {
  workspace: TeamWorkspace;
  linkId: string;
  action: 'accept' | 'decline';
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOrgBillingActionResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team billing invitation was not found.' };

  const validation = validateLinkedBasicLink({
    link: found.link,
    workspace: found.workspace,
    workspaceId: input.workspace.id,
  });
  if (!validation.ok) return validation;

  if (!isBillingTakeoverPending(found.link) || !found.link.approved_by_org_user_id) {
    return { ok: false, status: 409, error: 'There is no org billing invitation waiting for this Team workspace.' };
  }
  if (found.link.approved_by_team_user_id) {
    return { ok: false, status: 409, error: 'This org billing invitation has already been reviewed.' };
  }

  const now = new Date().toISOString();
  const patch = input.action === 'accept'
    ? {
        approved_by_team_user_id: input.actorUserId,
        updated_at: now,
      }
    : {
        link_type: 'visibility',
        billing_mode_after_approval: null,
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
    ? 'team_org_billing_invite_accepted'
    : 'team_org_billing_invite_declined';
  const auditAction = input.action === 'accept'
    ? 'team_org_billing_invite_accepted_by_team'
    : 'team_org_billing_invite_declined_by_team';

  await Promise.all([
    writeOrgAudit(input.workspace.workspaceOrgId, input.actorUserId, found.link.id, auditAction, {
      linkedOrgId: found.link.linked_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
      billingModeAfterApproval: 'org_team_addon',
    }),
    writeOrgAudit(found.link.linked_org_id, input.actorUserId, found.link.id, auditAction, {
      workspaceOrgId: input.workspace.workspaceOrgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
      billingModeAfterApproval: 'org_team_addon',
    }),
    writeBillingLifecycleEvent({
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

  return { ok: true, link: await getLinkSummaryOrThrow(found.link.id) };
}

export async function declineOrgTeamAddonBillingRequest(input: {
  orgId: string;
  linkId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOrgBillingActionResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team billing request was not found.' };

  const validation = validateLinkedBasicLink({
    link: found.link,
    workspace: found.workspace,
    orgId: input.orgId,
  });
  if (!validation.ok) return validation;

  if (!isBillingTakeoverPending(found.link) || !found.link.approved_by_team_user_id || found.link.approved_by_org_user_id) {
    return { ok: false, status: 409, error: 'There is no Team billing request waiting for this organization.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('team_org_links')
    .update({
      link_type: 'visibility',
      billing_mode_after_approval: null,
      approved_by_org_user_id: input.actorUserId,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('linked_org_id', input.orgId);
  if (error) throw error;

  await Promise.all([
    writeOrgAudit(input.orgId, input.actorUserId, found.link.id, 'team_org_billing_request_declined_by_org', {
      workspaceOrgId: found.workspace.workspace_org_id,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeOrgAudit(found.workspace.workspace_org_id, input.actorUserId, found.link.id, 'team_org_billing_request_declined_by_org', {
      linkedOrgId: input.orgId,
      teamWorkspaceId: found.link.team_workspace_id,
      repTeamId: found.link.rep_team_id,
    }),
    writeBillingLifecycleEvent({
      eventType: 'team_org_billing_request_declined',
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

  return { ok: true, link: await getLinkSummaryOrThrow(found.link.id) };
}

async function setEntitlementActive(params: {
  teamWorkspaceId: string;
  orgId: string;
  repTeamId: string;
  stripeSubscriptionItemId?: string | null;
  status: string;
}) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('team_entitlements')
    .select('id')
    .eq('org_id', params.orgId)
    .eq('rep_team_id', params.repTeamId)
    .eq('source', 'org_team_addon')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const patch = {
    team_workspace_id: params.teamWorkspaceId,
    status: mapStripeStatusToTeamEntitlementStatus(params.status),
    starts_at: new Date().toISOString(),
    ends_at: null,
    stripe_subscription_item_id: params.stripeSubscriptionItemId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('team_entitlements')
      .update(patch)
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from('team_entitlements')
    .insert({
      ...patch,
      org_id: params.orgId,
      rep_team_id: params.repTeamId,
      source: 'org_team_addon',
    });
  if (error) throw error;
}

async function applyOrgTeamAddonBilling(params: {
  link: TeamOrgBillingLinkRow;
  workspace: TeamWorkspaceBillingRow;
  orgId: string;
  approvedByOrgUserId?: string | null;
  approvedByOrgEmail?: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId?: string | null;
  subscriptionStatus: string;
  billingCycle?: BillingCycle | string | null;
  currentPeriodEnd?: string | null;
  source: 'mock' | 'stripe';
  sourceEventId?: string | null;
}): Promise<CompleteOrgTeamAddonBillingResult> {
  const now = new Date().toISOString();
  const previousTeamSubscriptionId = params.workspace.stripe_subscription_id ?? null;
  const orgStatus = mapStripeStatusToOrgStatus(params.subscriptionStatus);

  const { error: workspaceError } = await supabaseAdmin
    .from('team_workspaces')
    .update({
      workspace_state: 'linked',
      billing_mode: 'org_team_addon',
      billing_owner_org_id: params.orgId,
      billing_owner_user_id: null,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      subscription_status: params.subscriptionStatus,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: now,
    })
    .eq('id', params.workspace.id);
  if (workspaceError) throw workspaceError;

  const { error: workspaceOrgError } = await supabaseAdmin
    .from('organizations')
    .update({
      team_workspace_status: 'linked',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: orgStatus,
      subscription_period: params.billingCycle ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
    })
    .eq('id', params.workspace.workspace_org_id);
  if (workspaceOrgError) throw workspaceOrgError;

  const { error: linkError } = await supabaseAdmin
    .from('team_org_links')
    .update({
      status: 'linked',
      link_type: 'billing',
      sharing_level: 'basic',
      billing_mode_after_approval: 'org_team_addon',
      approved_by_org_user_id: params.approvedByOrgUserId ?? params.link.approved_by_org_user_id,
      approved_by_team_user_id: params.link.approved_by_team_user_id ?? params.workspace.primary_owner_user_id,
      updated_at: now,
    })
    .eq('id', params.link.id)
    .eq('linked_org_id', params.orgId);
  if (linkError) throw linkError;

  const { error: oldEntitlementsError } = await supabaseAdmin
    .from('team_entitlements')
    .update({
      status: 'cancelled',
      ends_at: now,
      updated_at: now,
    })
    .eq('team_workspace_id', params.workspace.id)
    .eq('source', 'team_plan')
    .in('status', ['active', 'trialing', 'past_due']);
  if (oldEntitlementsError) throw oldEntitlementsError;

  await Promise.all([
    setEntitlementActive({
      teamWorkspaceId: params.workspace.id,
      orgId: params.workspace.workspace_org_id,
      repTeamId: params.workspace.rep_team_id,
      stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
      status: params.subscriptionStatus,
    }),
    setEntitlementActive({
      teamWorkspaceId: params.workspace.id,
      orgId: params.orgId,
      repTeamId: params.workspace.rep_team_id,
      stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
      status: params.subscriptionStatus,
    }),
  ]);

  await Promise.all([
    writeOrgAudit(params.orgId, params.approvedByOrgUserId ?? null, params.link.id, 'team_org_billing_takeover_completed', {
      workspaceOrgId: params.workspace.workspace_org_id,
      teamWorkspaceId: params.workspace.id,
      repTeamId: params.workspace.rep_team_id,
      billingMode: 'org_team_addon',
      previousTeamSubscriptionId,
      stripeSubscriptionId: params.stripeSubscriptionId,
    }),
    writeOrgAudit(params.workspace.workspace_org_id, params.approvedByOrgUserId ?? null, params.link.id, 'team_org_billing_takeover_completed', {
      linkedOrgId: params.orgId,
      teamWorkspaceId: params.workspace.id,
      repTeamId: params.workspace.rep_team_id,
      billingMode: 'org_team_addon',
      previousTeamSubscriptionId,
      stripeSubscriptionId: params.stripeSubscriptionId,
    }),
    writeBillingLifecycleEvent({
      eventType: 'team_org_billing_takeover_completed',
      source: params.source,
      sourceEventId: params.sourceEventId ?? null,
      orgId: params.orgId,
      actorUserId: params.approvedByOrgUserId ?? null,
      actorEmail: params.approvedByOrgEmail ?? null,
      metadata: {
        workspaceOrgId: params.workspace.workspace_org_id,
        teamWorkspaceId: params.workspace.id,
        repTeamId: params.workspace.rep_team_id,
        linkId: params.link.id,
        billingMode: 'org_team_addon',
        previousTeamSubscriptionId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
      },
    }),
  ]);

  return {
    ok: true,
    linkId: params.link.id,
    teamWorkspaceId: params.workspace.id,
    orgId: params.orgId,
    previousTeamSubscriptionId,
  };
}

export async function startOrgTeamAddonCheckout(input: {
  org: Pick<Organization, 'id' | 'name' | 'slug' | 'stripeCustomerId'>;
  linkId: string;
  billingCycle?: unknown;
  actorUserId: string;
  actorEmail?: string | null;
}): Promise<TeamOrgBillingActionResult> {
  const found = await fetchLinkAndWorkspace(input.linkId);
  if (!found) return { ok: false, status: 404, error: 'Team billing request was not found.' };

  const validation = validateLinkedBasicLink({
    link: found.link,
    workspace: found.workspace,
    orgId: input.org.id,
  });
  if (!validation.ok) return validation;

  if (!isBillingTakeoverPending(found.link)) {
    return { ok: false, status: 409, error: 'Ask the Team coach to request org billing or invite them to move billing first.' };
  }
  if (!found.link.approved_by_team_user_id) {
    return { ok: false, status: 409, error: 'The Team coach must approve org billing before checkout can start.' };
  }

  const billingCycle = normalizeBillingCycle(input.billingCycle);
  const now = new Date().toISOString();

  const { error: approvalError } = await supabaseAdmin
    .from('team_org_links')
    .update({
      approved_by_org_user_id: input.actorUserId,
      updated_at: now,
    })
    .eq('id', found.link.id)
    .eq('linked_org_id', input.org.id);
  if (approvalError) throw approvalError;

  const approvedLink = {
    ...found.link,
    approved_by_org_user_id: input.actorUserId,
  };

  const shouldApplyDirectly = isBillingMockEnabled() || (!isStripeConfigured() && process.env.NODE_ENV !== 'production');
  if (shouldApplyDirectly) {
    const mockNow = Date.now();
    const applied = await applyOrgTeamAddonBilling({
      link: approvedLink,
      workspace: found.workspace,
      orgId: input.org.id,
      approvedByOrgUserId: input.actorUserId,
      approvedByOrgEmail: input.actorEmail ?? null,
      stripeCustomerId: input.org.stripeCustomerId ?? `mock_cus_org_team_addon_${mockNow}`,
      stripeSubscriptionId: `mock_sub_org_team_addon_${billingCycle}_${mockNow}`,
      stripeSubscriptionItemId: `mock_si_org_team_addon_${mockNow}`,
      subscriptionStatus: 'active',
      billingCycle,
      currentPeriodEnd: null,
      source: 'mock',
      sourceEventId: `mock_org_team_addon_${found.link.id}_${mockNow}`,
    });
    if (!applied.ok) throw new Error('Mock org Team add-on billing could not be applied.');

    return {
      ok: true,
      link: await getLinkSummaryOrThrow(applied.linkId),
      applied: true,
      billingCycle,
    };
  }

  if (!isStripeConfigured()) {
    return { ok: false, status: 503, error: 'Stripe checkout is not configured.' };
  }

  const priceId = await getStripePriceId('org_team_addon', billingCycle);
  if (!priceId) {
    const cycleLabel = billingCycle === 'annual' ? 'Annual' : 'Monthly';
    return { ok: false, status: 400, error: `${cycleLabel} checkout is not configured for the org Team add-on yet.` };
  }

  let customerId = input.org.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.actorEmail ?? undefined,
      name: input.org.name,
      metadata: {
        orgId: input.org.id,
        checkoutKind: ORG_TEAM_ADDON_CHECKOUT_KIND,
      },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', input.org.id);
  }

  const metadata = buildOrgTeamAddonMetadata({
    orgId: input.org.id,
    teamWorkspaceId: found.workspace.id,
    workspaceOrgId: found.workspace.workspace_org_id,
    repTeamId: found.workspace.rep_team_id,
    linkId: found.link.id,
    billingCycle,
    approvedByOrgUserId: input.actorUserId,
    approvedByOrgEmail: input.actorEmail ?? null,
    previousTeamSubscriptionId: found.workspace.stripe_subscription_id,
  });
  const returnTo = `/${input.org.slug}/admin/org/coaches-portal-links`;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata },
    metadata,
    success_url: appendSuccess(`${appUrl()}${returnTo}`),
    cancel_url: `${appUrl()}${returnTo}`,
  });

  await writeBillingLifecycleEvent({
    eventType: 'team_org_billing_checkout_started',
    orgId: input.org.id,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail ?? null,
    metadata: {
      workspaceOrgId: found.workspace.workspace_org_id,
      teamWorkspaceId: found.workspace.id,
      repTeamId: found.workspace.rep_team_id,
      linkId: found.link.id,
      billingCycle,
      priceId,
    },
  });

  return {
    ok: true,
    link: await getLinkSummaryOrThrow(found.link.id),
    url: session.url,
    billingCycle,
  };
}

export async function completeOrgTeamAddonBillingFromMetadata(params: {
  metadata: Record<string, string> | null | undefined;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionItemId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
  sourceEventId?: string | null;
}): Promise<CompleteOrgTeamAddonBillingResult> {
  const parsed = parseOrgTeamAddonMetadata(params.metadata);
  if (!parsed) return { ok: false, reason: 'not_org_team_addon' };
  if (!params.stripeSubscriptionId) return { ok: false, reason: 'missing_subscription_id' };

  const found = await fetchLinkAndWorkspace(parsed.linkId);
  if (!found) return { ok: false, reason: 'invalid_metadata' };
  if (
    found.link.linked_org_id !== parsed.orgId ||
    found.workspace.id !== parsed.teamWorkspaceId ||
    found.workspace.workspace_org_id !== parsed.workspaceOrgId ||
    found.workspace.rep_team_id !== parsed.repTeamId
  ) {
    return { ok: false, reason: 'invalid_metadata' };
  }

  const billingCycle = parsed.billingCycle;
  return applyOrgTeamAddonBilling({
    link: {
      ...found.link,
      approved_by_org_user_id: parsed.approvedByOrgUserId ?? found.link.approved_by_org_user_id,
    },
    workspace: found.workspace,
    orgId: parsed.orgId,
    approvedByOrgUserId: parsed.approvedByOrgUserId,
    approvedByOrgEmail: parsed.approvedByOrgEmail,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
    subscriptionStatus: params.subscriptionStatus ?? 'active',
    billingCycle,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    source: 'stripe',
    sourceEventId: params.sourceEventId ?? null,
  });
}
