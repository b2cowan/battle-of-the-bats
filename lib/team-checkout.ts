import { normalizeBillingCycle, type BillingCycle } from './plan-config';
import { supabaseAdmin } from './supabase-admin';
import {
  provisionStandaloneTeamWorkspace,
  type ProvisionStandaloneTeamWorkspaceInput,
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
  ageGroup: string | null;
  seasonName: string;
  seasonYear: number;
  billingCycle: BillingCycle;
  returnTo: string;
  claimToken: string | null;
  source: TeamWorkspaceSource;
  sourceTournamentId: string | null;
  sourceTournamentTeamId: string | null;
  teamWorkspaceClaimId: string | null;
};

export type TeamCheckoutMetadata = {
  ownerUserId: string;
  ownerEmail: string | null;
  teamName: string;
  workspaceName: string;
  teamSlug: string | null;
  workspaceSlug: string | null;
  sport: string;
  ageGroup: string | null;
  seasonName: string;
  seasonYear: number;
  billingCycle: BillingCycle;
  source: TeamWorkspaceSource;
  sourceTournamentId: string | null;
  sourceTournamentTeamId: string | null;
  teamWorkspaceClaimId: string | null;
};

export type TeamCheckoutProvisionResult =
  | { provisioned: true; result: ProvisionStandaloneTeamWorkspaceResult }
  | { provisioned: false; reason: 'not_team_checkout' | 'already_exists' | 'missing_subscription_id'; workspaceOrgId?: string | null };

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
  const sport = cleanText(body.sport, 'softball', 60);
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
    ageGroup: cleanOptionalText(body.ageGroup, 80),
    seasonName,
    seasonYear,
    billingCycle: normalizeBillingCycle(body.billingCycle),
    returnTo,
    claimToken: cleanOptionalText(body.claimToken, 200),
    source: 'direct_signup',
    sourceTournamentId: null,
    sourceTournamentTeamId: null,
    teamWorkspaceClaimId: null,
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
    ageGroup: metadataValue(params.request.ageGroup),
    seasonName: metadataValue(params.request.seasonName),
    seasonYear: metadataValue(params.request.seasonYear),
    billingCycle: metadataValue(params.request.billingCycle),
    source: metadataValue(params.request.source),
    sourceTournamentId: metadataValue(params.request.sourceTournamentId),
    sourceTournamentTeamId: metadataValue(params.request.sourceTournamentTeamId),
    teamWorkspaceClaimId: metadataValue(params.request.teamWorkspaceClaimId),
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
    sport: metadata.sport?.trim() || 'softball',
    ageGroup: metadata.ageGroup?.trim() || null,
    seasonName,
    seasonYear: cleanYear(metadata.seasonYear),
    billingCycle: normalizeBillingCycle(metadata.billingCycle),
    source: normalizeCheckoutSource(metadata.source),
    sourceTournamentId: metadata.sourceTournamentId?.trim() || null,
    sourceTournamentTeamId: metadata.sourceTournamentTeamId?.trim() || null,
    teamWorkspaceClaimId: metadata.teamWorkspaceClaimId?.trim() || null,
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

export async function provisionTeamWorkspaceFromCheckoutMetadata(params: {
  metadata: Record<string, string> | null | undefined;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionItemId?: string | null;
  subscriptionStatus?: string | null;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  eventSource: ProvisionStandaloneTeamWorkspaceInput['eventSource'];
  sourceEventId?: string | null;
}): Promise<TeamCheckoutProvisionResult> {
  const parsed = parseTeamCheckoutMetadata(params.metadata);
  if (!parsed) return { provisioned: false, reason: 'not_team_checkout' };
  if (!params.stripeSubscriptionId) return { provisioned: false, reason: 'missing_subscription_id' };

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
    ageGroup: parsed.ageGroup,
    seasonName: parsed.seasonName,
    seasonYear: parsed.seasonYear,
    source: parsed.source,
    sourceTournamentId: parsed.sourceTournamentId,
    sourceTournamentTeamId: parsed.sourceTournamentTeamId,
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

  return { provisioned: true, result };
}
