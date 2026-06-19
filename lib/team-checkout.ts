import { normalizeBillingCycle, type BillingCycle } from './plan-config';
import { DEFAULT_SPORT } from './sports';
import { writePlatformEvent, type PlatformEventInput } from './platform-events';
import { supabaseAdmin } from './supabase-admin';
import { sendEmail, teamWorkspaceWelcomeHtml, SITE_URL } from './email';
import {
  provisionStandaloneTeamWorkspace,
  TeamWorkspaceProvisioningError,
  type ProvisionStandaloneTeamWorkspaceResult,
} from './team-workspace-provisioning';
import {
  assertTeamWorkspaceClaimAvailableForProvisioning,
  markTeamWorkspaceClaimed,
} from './team-workspace-claims';
import type { SubscriptionStatus } from './types';
import type { TeamEntitlementStatus, TeamWorkspaceSource } from './team-workspace-entitlements';

export type TeamCheckoutRequest = {
  teamName: string;
  workspaceName: string;
  teamSlug: string | null;
  workspaceSlug: string | null;
  sport: string;
  division: string | null;
  seasonName: string;
  seasonYear: number;
  billingCycle: BillingCycle;
  returnTo: string;
  claimToken: string | null;
  source: TeamWorkspaceSource;
  sourceTournamentId: string | null;
  sourceTournamentTeamId: string | null;
  teamWorkspaceClaimId: string | null;
  reactivateOrgSlug: string | null;
  /**
   * The originating FREE Basic team being upgraded (per-team upgrade). MUST be set only after the
   * route re-verifies the authenticated user owns it — it drives the workspace back-link and (Phase 4)
   * the data migration, so an unverified value would let one coach pull another's team into their
   * workspace. `normalizeTeamCheckoutRequest` defaults it null; the route fills it post-verification.
   */
  basicCoachTeamId: string | null;
};

export type TeamCheckoutMetadata = {
  ownerUserId: string;
  ownerEmail: string | null;
  teamName: string;
  workspaceName: string;
  teamSlug: string | null;
  workspaceSlug: string | null;
  sport: string;
  division: string | null;
  seasonName: string;
  seasonYear: number;
  billingCycle: BillingCycle;
  source: TeamWorkspaceSource;
  sourceTournamentId: string | null;
  sourceTournamentTeamId: string | null;
  teamWorkspaceClaimId: string | null;
  reactivateOrgSlug: string | null;
  basicCoachTeamId: string | null;
};

export type TeamCheckoutProvisionResult =
  | { provisioned: true; result: ProvisionStandaloneTeamWorkspaceResult }
  | {
      provisioned: false;
      reason: 'not_team_checkout' | 'already_exists' | 'missing_subscription_id' | 'reactivated';
      workspaceOrgId?: string | null;
      teamWorkspaceId?: string | null;
      repTeamId?: string | null;
    };

type ReactivationWorkspace = {
  id: string;
  workspace_org_id: string;
  rep_team_id: string;
  billing_mode: string | null;
  subscription_status: string | null;
};

type RetainedRecordRow = {
  id: string;
  record_type: string;
  record_id: string | null;
  metadata: {
    previousStatus?: unknown;
    retentionReason?: unknown;
    teamWorkspaceId?: unknown;
  } | null;
};

const TEAM_CHECKOUT_KIND = 'standalone_team';
const METADATA_VERSION = '1';

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, maxLength);
}

function cleanOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, maxLength);
  return text || null;
}

function cleanYear(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : NaN;
  const current = new Date().getFullYear();
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : current;
}

function metadataValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value).slice(0, 500);
}

export function normalizeTeamCheckoutRequest(body: Record<string, unknown>): TeamCheckoutRequest {
  const teamName = cleanText(body.teamName, '', 120);
  if (!teamName) {
    throw new Error('Team name is required.');
  }

  const seasonYear = cleanYear(body.seasonYear);
  const workspaceName = cleanText(body.workspaceName, `${teamName} Coaches Portal`, 140);
  const sport = cleanText(body.sport, DEFAULT_SPORT, 60);
  const seasonName = cleanText(body.seasonName, `${teamName} ${seasonYear}`, 140);
  const returnTo = typeof body.returnTo === 'string' && body.returnTo.startsWith('/')
    ? body.returnTo.slice(0, 240)
    : '/pricing';

  return {
    teamName,
    workspaceName,
    teamSlug: cleanOptionalText(body.teamSlug, 80),
    workspaceSlug: cleanOptionalText(body.workspaceSlug, 80),
    sport,
    division: cleanOptionalText(body.division, 80),
    seasonName,
    seasonYear,
    billingCycle: normalizeBillingCycle(body.billingCycle),
    returnTo,
    claimToken: cleanOptionalText(body.claimToken, 200),
    source: 'direct_signup',
    sourceTournamentId: null,
    sourceTournamentTeamId: null,
    teamWorkspaceClaimId: null,
    reactivateOrgSlug: cleanOptionalText(body.reactivateOrgSlug, 120),
    // Default null — the route sets this only after re-verifying the caller owns the team.
    basicCoachTeamId: null,
  };
}

export function buildTeamCheckoutMetadata(params: {
  ownerUserId: string;
  ownerEmail?: string | null;
  request: TeamCheckoutRequest;
}): Record<string, string> {
  return {
    checkoutKind: TEAM_CHECKOUT_KIND,
    metadataVersion: METADATA_VERSION,
    ownerUserId: metadataValue(params.ownerUserId),
    ownerEmail: metadataValue(params.ownerEmail),
    teamName: metadataValue(params.request.teamName),
    workspaceName: metadataValue(params.request.workspaceName),
    teamSlug: metadataValue(params.request.teamSlug),
    workspaceSlug: metadataValue(params.request.workspaceSlug),
    sport: metadataValue(params.request.sport),
    division: metadataValue(params.request.division),
    seasonName: metadataValue(params.request.seasonName),
    seasonYear: metadataValue(params.request.seasonYear),
    billingCycle: metadataValue(params.request.billingCycle),
    source: metadataValue(params.request.source),
    sourceTournamentId: metadataValue(params.request.sourceTournamentId),
    sourceTournamentTeamId: metadataValue(params.request.sourceTournamentTeamId),
    teamWorkspaceClaimId: metadataValue(params.request.teamWorkspaceClaimId),
    reactivateOrgSlug: metadataValue(params.request.reactivateOrgSlug),
    basicCoachTeamId: metadataValue(params.request.basicCoachTeamId),
  };
}

function normalizeCheckoutSource(value: string | null | undefined): TeamWorkspaceSource {
  return value === 'tournament_claim' ? 'tournament_claim' : 'direct_signup';
}

export function parseTeamCheckoutMetadata(metadata: Record<string, string> | null | undefined): TeamCheckoutMetadata | null {
  if (!metadata || metadata.checkoutKind !== TEAM_CHECKOUT_KIND) return null;

  const ownerUserId = metadata.ownerUserId?.trim();
  const teamName = metadata.teamName?.trim();
  const workspaceName = metadata.workspaceName?.trim();
  const seasonName = metadata.seasonName?.trim();
  if (!ownerUserId || !teamName || !workspaceName || !seasonName) return null;

  return {
    ownerUserId,
    ownerEmail: metadata.ownerEmail?.trim() || null,
    teamName,
    workspaceName,
    teamSlug: metadata.teamSlug?.trim() || null,
    workspaceSlug: metadata.workspaceSlug?.trim() || null,
    sport: metadata.sport?.trim() || DEFAULT_SPORT,
    division: metadata.division?.trim() || null,
    seasonName,
    seasonYear: cleanYear(metadata.seasonYear),
    billingCycle: normalizeBillingCycle(metadata.billingCycle),
    source: normalizeCheckoutSource(metadata.source),
    sourceTournamentId: metadata.sourceTournamentId?.trim() || null,
    sourceTournamentTeamId: metadata.sourceTournamentTeamId?.trim() || null,
    teamWorkspaceClaimId: metadata.teamWorkspaceClaimId?.trim() || null,
    reactivateOrgSlug: metadata.reactivateOrgSlug?.trim() || null,
    basicCoachTeamId: metadata.basicCoachTeamId?.trim() || null,
  };
}

export function mapStripeStatusToOrgStatus(status: string | null | undefined): SubscriptionStatus {
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'active';
}

export function mapStripeStatusToTeamEntitlementStatus(status: string | null | undefined): TeamEntitlementStatus {
  if (status === 'trialing') return 'trialing';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'active';
}

export async function syncTeamWorkspaceSubscription(params: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  stripeSubscriptionItemId?: string | null;
}): Promise<boolean> {
  const { data: workspace, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, billing_mode')
    .eq('stripe_subscription_id', params.stripeSubscriptionId)
    .maybeSingle();

  if (error) throw error;
  if (!workspace) return false;

  const orgStatus = mapStripeStatusToOrgStatus(params.subscriptionStatus);
  const entitlementStatus = mapStripeStatusToTeamEntitlementStatus(params.subscriptionStatus);

  await supabaseAdmin
    .from('team_workspaces')
    .update({
      stripe_customer_id: params.stripeCustomerId,
      subscription_status: params.subscriptionStatus,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspace.id);

  await supabaseAdmin
    .from('organizations')
    .update({
      stripe_customer_id: workspace.billing_mode === 'org_team_addon' ? null : params.stripeCustomerId,
      stripe_subscription_id: workspace.billing_mode === 'org_team_addon' ? null : params.stripeSubscriptionId,
      subscription_status: orgStatus,
      subscription_period: params.billingCycle ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
    })
    .eq('id', workspace.workspace_org_id);

  await supabaseAdmin
    .from('team_entitlements')
    .update({
      status: entitlementStatus,
      stripe_subscription_item_id: params.stripeSubscriptionItemId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('team_workspace_id', workspace.id);

  return true;
}

function restoredTournamentStatus(value: unknown): 'draft' | 'active' | 'completed' {
  return value === 'draft' || value === 'active' || value === 'completed'
    ? value
    : 'completed';
}

async function findReactivationWorkspace(parsed: TeamCheckoutMetadata): Promise<ReactivationWorkspace | null> {
  if (!parsed.reactivateOrgSlug) return null;

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, account_kind, plan_id, subscription_status')
    .eq('slug', parsed.reactivateOrgSlug)
    .maybeSingle<{
      id: string;
      slug: string;
      account_kind: string | null;
      plan_id: string | null;
      subscription_status: string | null;
    }>();

  if (orgError) throw orgError;
  if (!org) {
    throw new TeamWorkspaceProvisioningError('reactivation_workspace_not_found', 'The Coaches Portal workspace to reactivate was not found.');
  }
  if (org.account_kind !== 'team_workspace' && org.plan_id !== 'team') {
    throw new TeamWorkspaceProvisioningError('invalid_reactivation_workspace', 'Only Coaches Portal Premium workspaces can be reactivated here.');
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, status')
    .eq('organization_id', org.id)
    .eq('user_id', parsed.ownerUserId)
    .eq('status', 'active')
    .maybeSingle<{ id: string; role: string; status: string }>();

  if (memberError) throw memberError;
  if (!member || member.role !== 'owner') {
    throw new TeamWorkspaceProvisioningError('reactivation_not_owner', 'You must be the owner of this Coaches Portal workspace to reactivate it.');
  }

  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, billing_mode, subscription_status')
    .eq('workspace_org_id', org.id)
    .maybeSingle<ReactivationWorkspace>();

  if (workspaceError) throw workspaceError;
  if (!workspace) {
    throw new TeamWorkspaceProvisioningError('reactivation_workspace_not_found', 'The Coaches Portal workspace to reactivate was not found.');
  }
  if (workspace.billing_mode !== 'team_direct') {
    throw new TeamWorkspaceProvisioningError('org_billed_reactivation_not_supported', 'Org-billed Coaches Portal workspaces must be reactivated from the linked organization billing flow.');
  }
  if (workspace.subscription_status !== 'canceled' && org.subscription_status !== 'canceled') return null;

  return workspace;
}

async function restoreCoachesPortalRetainedRecords(orgId: string, workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('billing_retained_records')
    .select('id, record_type, record_id, metadata')
    .eq('org_id', orgId)
    .in('retained_state', ['retained_inactive', 'pending_purge'])
    .eq('metadata->>retentionReason', 'coaches_portal_cancellation');

  if (error) throw error;

  const retained = ((data ?? []) as RetainedRecordRow[]).filter(row => (
    row.record_type === 'tournament' ||
    row.metadata?.teamWorkspaceId === workspaceId
  ));
  if (retained.length === 0) return { restoredCount: 0, restoredTournamentIds: [] as string[] };

  const restoredTournamentIds: string[] = [];
  for (const record of retained.filter(row => row.record_type === 'tournament' && row.record_id)) {
    if (!record.record_id) continue;
    const { error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .update({
        status: restoredTournamentStatus(record.metadata?.previousStatus),
        is_active: restoredTournamentStatus(record.metadata?.previousStatus) === 'active',
      })
      .eq('org_id', orgId)
      .eq('id', record.record_id);

    if (!tournamentError) restoredTournamentIds.push(record.record_id);
  }

  const { error: recordError } = await supabaseAdmin
    .from('billing_retained_records')
    .update({ retained_state: 'restored' })
    .in('id', retained.map(row => row.id));

  if (recordError) throw recordError;
  return { restoredCount: retained.length, restoredTournamentIds };
}

async function reactivateTeamWorkspaceFromParsedMetadata(params: {
  parsed: TeamCheckoutMetadata;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId?: string | null;
  subscriptionStatus?: string | null;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  eventSource: PlatformEventInput['source'];
  sourceEventId?: string | null;
}): Promise<TeamCheckoutProvisionResult | null> {
  const workspace = await findReactivationWorkspace(params.parsed);
  if (!workspace) return null;

  const subscriptionStatus = params.subscriptionStatus ?? 'active';
  const orgStatus = mapStripeStatusToOrgStatus(subscriptionStatus);
  const entitlementStatus = mapStripeStatusToTeamEntitlementStatus(subscriptionStatus);
  const now = new Date().toISOString();

  const [{ error: workspaceError }, { error: orgError }] = await Promise.all([
    supabaseAdmin
      .from('team_workspaces')
      .update({
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        subscription_status: subscriptionStatus,
        current_period_end: params.currentPeriodEnd ?? null,
        billing_owner_user_id: params.parsed.ownerUserId,
        updated_at: now,
      })
      .eq('id', workspace.id),
    supabaseAdmin
      .from('organizations')
      .update({
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        subscription_status: orgStatus,
        subscription_period: params.billingCycle ?? params.parsed.billingCycle,
        current_period_end: params.currentPeriodEnd ?? null,
        billing_suspended_at: null,
        billing_suspension_reason: null,
        team_workspace_status: 'active',
      })
      .eq('id', workspace.workspace_org_id),
  ]);

  if (workspaceError) throw workspaceError;
  if (orgError) throw orgError;

  const { data: entitlement, error: entitlementLookupError } = await supabaseAdmin
    .from('team_entitlements')
    .select('id')
    .eq('team_workspace_id', workspace.id)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (entitlementLookupError) throw entitlementLookupError;

  if (entitlement) {
    const { error } = await supabaseAdmin
      .from('team_entitlements')
      .update({
        status: entitlementStatus,
        stripe_subscription_item_id: params.stripeSubscriptionItemId ?? null,
        updated_at: now,
      })
      .eq('id', entitlement.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from('team_entitlements')
      .insert({
        team_workspace_id: workspace.id,
        org_id: workspace.workspace_org_id,
        rep_team_id: workspace.rep_team_id,
        source: 'team_plan',
        status: entitlementStatus,
        stripe_subscription_item_id: params.stripeSubscriptionItemId ?? null,
      });
    if (error) throw error;
  }

  const restoreResult = await restoreCoachesPortalRetainedRecords(workspace.workspace_org_id, workspace.id);

  await writePlatformEvent({
    eventType: 'subscription_recovered',
    source: params.eventSource,
    sourceEventId: params.sourceEventId ?? null,
    orgId: workspace.workspace_org_id,
    actorUserId: params.parsed.ownerUserId,
    actorEmail: params.parsed.ownerEmail,
    previousPlanId: 'team',
    planId: 'team',
    previousSubscriptionStatus: 'canceled',
    subscriptionStatus: orgStatus,
    metadata: {
      scope: 'coaches_portal',
      teamWorkspaceId: workspace.id,
      restoredRetainedRecords: restoreResult.restoredCount,
      restoredTournamentIds: restoreResult.restoredTournamentIds,
    },
  });

  if (params.parsed.teamWorkspaceClaimId) {
    await markTeamWorkspaceClaimed({
      claimId: params.parsed.teamWorkspaceClaimId,
      teamWorkspaceId: workspace.id,
      claimedByUserId: params.parsed.ownerUserId,
    });
  }

  return {
    provisioned: false,
    reason: 'reactivated',
    workspaceOrgId: workspace.workspace_org_id,
    teamWorkspaceId: workspace.id,
    repTeamId: workspace.rep_team_id,
  };
}

export async function provisionTeamWorkspaceFromCheckoutMetadata(params: {
  metadata: Record<string, string> | null | undefined;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionItemId?: string | null;
  subscriptionStatus?: string | null;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  eventSource: PlatformEventInput['source'];
  sourceEventId?: string | null;
}): Promise<TeamCheckoutProvisionResult> {
  const parsed = parseTeamCheckoutMetadata(params.metadata);
  if (!parsed) return { provisioned: false, reason: 'not_team_checkout' };
  if (!params.stripeSubscriptionId) return { provisioned: false, reason: 'missing_subscription_id' };

  const reactivation = await reactivateTeamWorkspaceFromParsedMetadata({
    parsed,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
    subscriptionStatus: params.subscriptionStatus ?? 'active',
    billingCycle: params.billingCycle ?? parsed.billingCycle,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    eventSource: params.eventSource,
    sourceEventId: params.sourceEventId ?? null,
  });
  if (reactivation) return reactivation;

  const { data: existing, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id')
    .eq('stripe_subscription_id', params.stripeSubscriptionId)
    .maybeSingle();

  if (error) throw error;
  if (existing) {
    await syncTeamWorkspaceSubscription({
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      subscriptionStatus: params.subscriptionStatus ?? 'active',
      billingCycle: params.billingCycle ?? parsed.billingCycle,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
      stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
    });
    if (parsed.teamWorkspaceClaimId) {
      await markTeamWorkspaceClaimed({
        claimId: parsed.teamWorkspaceClaimId,
        teamWorkspaceId: existing.id as string,
        claimedByUserId: parsed.ownerUserId,
      });
    }
    return { provisioned: false, reason: 'already_exists', workspaceOrgId: existing.workspace_org_id as string };
  }

  await assertTeamWorkspaceClaimAvailableForProvisioning(parsed.teamWorkspaceClaimId);

  const result = await provisionStandaloneTeamWorkspace({
    ownerUserId: parsed.ownerUserId,
    ownerEmail: parsed.ownerEmail,
    teamName: parsed.teamName,
    teamSlug: parsed.teamSlug,
    workspaceName: parsed.workspaceName,
    workspaceSlug: parsed.workspaceSlug,
    sport: parsed.sport,
    division: parsed.division,
    seasonName: parsed.seasonName,
    seasonYear: parsed.seasonYear,
    source: parsed.source,
    sourceTournamentId: parsed.sourceTournamentId,
    sourceTournamentTeamId: parsed.sourceTournamentTeamId,
    // A verified upgrade carries its free team explicitly → back-link to THAT team. When absent
    // (brand-new team or tournament claim) pass undefined so the provisioner keeps its existing
    // fallback: deriving the free team from the source tournament registration.
    basicCoachTeamId: parsed.basicCoachTeamId ?? undefined,
    billingMode: 'team_direct',
    billingOwnerUserId: parsed.ownerUserId,
    subscriptionStatus: mapStripeStatusToOrgStatus(params.subscriptionStatus),
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripeSubscriptionItemId: params.stripeSubscriptionItemId,
    currentPeriodEnd: params.currentPeriodEnd,
    entitlementSource: 'team_plan',
    entitlementStatus: mapStripeStatusToTeamEntitlementStatus(params.subscriptionStatus),
    eventSource: params.eventSource,
    sourceEventId: params.sourceEventId,
    actorUserId: parsed.ownerUserId,
    actorEmail: parsed.ownerEmail,
  });

  if (parsed.teamWorkspaceClaimId) {
    await markTeamWorkspaceClaimed({
      claimId: parsed.teamWorkspaceClaimId,
      teamWorkspaceId: result.teamWorkspaceId,
      claimedByUserId: parsed.ownerUserId,
    });
  }

  // Premium Coaches Portal welcome — best-effort, fires once here (the FIRST webhook event to
  // provision wins; the second finds the workspace already exists and returns early above). Never
  // block provisioning or the webhook 200 on an email failure.
  if (parsed.ownerEmail) {
    try {
      await sendEmail(
        parsed.ownerEmail,
        `Welcome to your Premium Coaches Portal — ${parsed.teamName}`,
        teamWorkspaceWelcomeHtml({
          teamName: parsed.teamName,
          portalUrl: `${SITE_URL}/${result.org.slug}/coaches`,
        }),
      );
    } catch (err) {
      console.error('[team-checkout] Premium welcome email failed:', err);
    }
  }

  return { provisioned: true, result };
}
