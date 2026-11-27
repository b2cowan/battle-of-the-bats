import { normalizeBillingCycle, type BillingCycle } from './plan-config';
import { DEFAULT_SPORT } from './sports';
import { isPastDueTransition, isRecoveryTransition, writePlatformEvent, type PlatformEventInput } from './platform-events';
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
import { getActiveOwnedTeamWorkspace } from './team-workspace-owned';
import { workspacesInForce } from './portal-in-force-server';
import { convertFreeTimePortal, findKeepPremiumPortal } from './portal-keep-premium';
import { restoreCoachesPortalRetainedRecords } from './portal-retained-restore';
import { decideTeamReactivation, type TeamReactivationAnswer, type TeamReactivationOrg } from './team-reactivation';

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

/**
 * True when an error is a Postgres unique-violation on team_workspaces.stripe_subscription_id —
 * i.e. a concurrent webhook event already provisioned the workspace for this subscription (mig 156).
 */
function isSubscriptionUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string } | null;
  if (e?.code !== '23505') return false;
  // Match the specific partial-unique index (mig 156) by NAME, with the column substring as a
  // fallback — both appear in the PostgrestError (constraint name in .message, the offending key
  // in .details). Any OTHER 23505 (a different table/index) rethrows, so we never swallow it.
  const text = `${e.message ?? ''} ${e.details ?? ''}`;
  return text.includes('team_workspaces_stripe_subscription_id_uniq') || text.includes('stripe_subscription_id');
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

/** Stripe statuses a portal's records have no word for: the workspace column refuses them (mig 065) and the two mappers
 *  above would call them paid up. */
const UNRECORDABLE_STATUSES: ReadonlySet<string> = new Set(['incomplete_expired', 'paused']);

export async function syncTeamWorkspaceSubscription(params: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  stripeSubscriptionItemId?: string | null;
  /** For a change to a running portal: no row that already says canceled is written. The ending can finish between the
   *  caller's read and these writes, and nothing later would undo a late write that switched the portal back on. */
  onlyWhileRunning?: boolean;
}): Promise<boolean> {
  const { data: workspace, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, billing_mode')
    .eq('stripe_subscription_id', params.stripeSubscriptionId)
    // A workspace that became a club (Stage 4b) or moved into one is a tombstone: its subscription is the club's now, and
    // must never run the Coaches Portal retention or email, whatever id a stray write left on the row.
    .neq('workspace_state', 'org_owned')
    .maybeSingle();

  if (error) throw error;
  if (!workspace) return false;
  if (UNRECORDABLE_STATUSES.has(params.subscriptionStatus)) return true;

  const orgStatus = mapStripeStatusToOrgStatus(params.subscriptionStatus);
  const entitlementStatus = mapStripeStatusToTeamEntitlementStatus(params.subscriptionStatus);
  // A renewal date or item the caller does not have keeps the one on file: it is never blanked.
  const periodEnd = params.currentPeriodEnd ? { current_period_end: params.currentPeriodEnd } : {};
  const item = params.stripeSubscriptionItemId ? { stripe_subscription_item_id: params.stripeSubscriptionItemId } : {};

  // A write that fails throws, so the webhook answers 500 and Stripe sends the event again (each write repeats safely).
  const workspaceWrite = supabaseAdmin
    .from('team_workspaces')
    .update({
      stripe_customer_id: params.stripeCustomerId,
      subscription_status: params.subscriptionStatus,
      ...periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspace.id);
  if (params.onlyWhileRunning) workspaceWrite.neq('subscription_status', 'canceled');
  const { data: workspaceRows, error: workspaceError } = await workspaceWrite.select('id');
  if (workspaceError) throw workspaceError;
  if (params.onlyWhileRunning && !workspaceRows?.length) return false;

  const entitlementWrite = supabaseAdmin
    .from('team_entitlements')
    .update({
      status: entitlementStatus,
      ...item,
      updated_at: new Date().toISOString(),
    })
    .eq('team_workspace_id', workspace.id);
  if (params.onlyWhileRunning) entitlementWrite.neq('status', 'canceled');
  const { error: entitlementError } = await entitlementWrite;
  if (entitlementError) throw entitlementError;

  // The account row goes LAST: a retry after a failure above still finds the old status there, so the turn to past due or
  // back is still seen and recorded.
  const accountWrite = supabaseAdmin
    .from('organizations')
    .update({
      stripe_customer_id: workspace.billing_mode === 'org_team_addon' ? null : params.stripeCustomerId,
      stripe_subscription_id: workspace.billing_mode === 'org_team_addon' ? null : params.stripeSubscriptionId,
      subscription_status: orgStatus,
      // No cycle is the ending's call (the subscription is deleted): the record stops saying monthly or annual.
      subscription_period: params.billingCycle ? normalizeBillingCycle(params.billingCycle) : null,
      ...periodEnd,
    })
    .eq('id', workspace.workspace_org_id);
  if (params.onlyWhileRunning) accountWrite.neq('subscription_status', 'canceled');
  const { data: accountRows, error: orgError } = await accountWrite.select('id');
  if (orgError) throw orgError;

  return params.onlyWhileRunning ? !!accountRows?.length : true;
}

/** The statuses a live portal's record follows. `canceled` belongs to the subscription's deletion (the one ending), and on
 *  `incomplete` nothing has been paid: writing it would call a portal Stripe has marked past due active again. */
const FOLLOWED_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/**
 * A later change to the subscription a LIVE portal already runs on (status, billing cycle, renewal date, item): it goes
 * onto that portal's record. It is not a second purchase, so it is answered before the one-portal guard, which used to
 * swallow it. Null when no portal IN FORCE holds this subscription: an ended or half-reactivated portal, another
 * subscription and a first purchase are the caller's to decide. Sends nothing.
 */
async function followLivePortalSubscription(params: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId?: string | null;
  subscriptionStatus: string;
  billingCycle: string;
  currentPeriodEnd?: string | null;
  eventSource: PlatformEventInput['source'];
  sourceEventId?: string | null;
}): Promise<TeamCheckoutProvisionResult | null> {
  const { data: portal, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id')
    .eq('stripe_subscription_id', params.stripeSubscriptionId)
    .neq('workspace_state', 'org_owned')
    .maybeSingle<{ id: string; workspace_org_id: string; rep_team_id: string }>();
  if (error) throw error;
  if (!portal || !(await workspacesInForce([portal.id])).has(portal.id)) return null;

  const answer = { provisioned: false, reason: 'already_exists', workspaceOrgId: portal.workspace_org_id } as const;
  if (!FOLLOWED_STATUSES.has(params.subscriptionStatus)) return answer;

  const { data: before, error: beforeError } = await supabaseAdmin
    .from('organizations')
    .select('subscription_status')
    .eq('id', portal.workspace_org_id)
    .maybeSingle<{ subscription_status: string | null }>();
  if (beforeError) throw beforeError;

  // Ended while we were reading: nothing to record.
  if (!(await syncTeamWorkspaceSubscription({ ...params, onlyWhileRunning: true }))) return answer;

  // The invoice events record these two only when they find the old status, so whichever runs first records it (two
  // arriving at the same instant can each record one, as on the club path).
  const status = mapStripeStatusToOrgStatus(params.subscriptionStatus);
  const turned = isPastDueTransition(before?.subscription_status, status) ? 'subscription_past_due'
    : isRecoveryTransition(before?.subscription_status, status) ? 'subscription_recovered'
    : null;
  if (turned) {
    await writePlatformEvent({
      eventType: turned,
      source: params.eventSource,
      sourceEventId: params.sourceEventId ? `${params.sourceEventId}:${turned}` : null,
      orgId: portal.workspace_org_id,
      previousPlanId: 'team',
      planId: 'team',
      previousSubscriptionStatus: before?.subscription_status ?? null,
      subscriptionStatus: status,
      metadata: { scope: 'coaches_portal', teamWorkspaceId: portal.id, billingCycle: params.billingCycle },
    });
  }
  return answer;
}

/**
 * The one rule (`lib/team-reactivation.ts`) read from our records. The checkout asks it before anything is made in Stripe
 * and the webhook asks it again after payment: add a refusal to the rule, never to one caller.
 */
export async function checkTeamReactivation(input: {
  reactivateOrgSlug: string | null;
  ownerUserId: string;
}): Promise<TeamReactivationAnswer<ReactivationWorkspace>> {
  return decideTeamReactivation<ReactivationWorkspace>(input, {
    async org(slug) {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select('id, account_kind, plan_id, subscription_status')
        .eq('slug', slug)
        .maybeSingle<TeamReactivationOrg>();
      if (error) throw error;
      return data;
    },
    async activeRole(orgId, userId) {
      const { data, error } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle<{ role: string }>();
      if (error) throw error;
      return data?.role ?? null;
    },
    async portal(orgId) {
      const { data, error } = await supabaseAdmin
        .from('team_workspaces')
        .select('id, workspace_org_id, rep_team_id, billing_mode, subscription_status')
        .eq('workspace_org_id', orgId)
        .maybeSingle<ReactivationWorkspace>();
      if (error) throw error;
      return data;
    },
  });
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
  const answer = await checkTeamReactivation(params.parsed);
  // The checkout asks first, so meeting this after payment means the records changed in between: say so for whoever reads
  // the error, with the portal named.
  if (answer.kind === 'refused') {
    throw new TeamWorkspaceProvisioningError(answer.code, `Reactivation refused after checkout for ${params.parsed.reactivateOrgSlug}; check Stripe for a subscription with no portal. ${answer.message}`);
  }
  if (answer.kind !== 'reactivate') return null;
  const workspace = answer.portal;

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

  // Keep Premium (Support console Stage 4b, Part 6): the coach's staff-given portal takes this purchase itself, BEFORE
  // the one-live-portal guard below (which counts that portal while its free time runs) and before the claim of the free
  // team (which that portal already holds, so a fresh provision would make a blank second portal).
  const keepPortal = await findKeepPremiumPortal({
    ownerUserId: parsed.ownerUserId,
    reactivateOrgSlug: parsed.reactivateOrgSlug,
    basicCoachTeamId: parsed.basicCoachTeamId,
    teamWorkspaceClaimId: parsed.teamWorkspaceClaimId,
    stripeSubscriptionId: params.stripeSubscriptionId,
  });
  if (keepPortal) {
    const subscriptionStatus = params.subscriptionStatus ?? 'active';
    const kept = await convertFreeTimePortal({
      portal: keepPortal,
      ownerUserId: parsed.ownerUserId,
      ownerEmail: parsed.ownerEmail,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
      subscriptionStatus,
      orgStatus: mapStripeStatusToOrgStatus(subscriptionStatus),
      entitlementStatus: mapStripeStatusToTeamEntitlementStatus(subscriptionStatus),
      billingCycle: params.billingCycle ?? parsed.billingCycle,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
      eventSource: params.eventSource,
      sourceEventId: params.sourceEventId ?? null,
    });
    return kept.converted || kept.reason === 'already_converted'
      ? { provisioned: false, reason: 'reactivated', workspaceOrgId: kept.workspaceOrgId, teamWorkspaceId: kept.teamWorkspaceId, repTeamId: kept.repTeamId }
      : { provisioned: false, reason: 'already_exists', workspaceOrgId: kept.workspaceOrgId };
  }

  const followed = await followLivePortalSubscription({
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripeSubscriptionItemId: params.stripeSubscriptionItemId ?? null,
    // No status is no news: never assumed active.
    subscriptionStatus: params.subscriptionStatus ?? '',
    billingCycle: params.billingCycle ?? parsed.billingCycle,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    eventSource: params.eventSource,
    sourceEventId: params.sourceEventId ?? null,
  });
  if (followed) return followed;

  // One Coaches Portal per owner — gate REACTIVATION too, not just fresh provision. A coach who
  // already has another LIVE portal must not reactivate a second one into a parallel live portal.
  // The reactivation target is a CANCELED workspace (not "live"), so reactivating your ONLY canceled
  // portal still works — this only trips when a different portal is already active/trialing/past_due.
  const ownerLivePortalPreReactivation = await getActiveOwnedTeamWorkspace(parsed.ownerUserId);
  if (ownerLivePortalPreReactivation) {
    return { provisioned: false, reason: 'already_exists', workspaceOrgId: ownerLivePortalPreReactivation.workspaceOrgId };
  }

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

  // One Coaches Portal per owner (defense-in-depth for the rare double-pay race that slips past the
  // stripe_subscription_id idempotency check above — two checkout sessions carry different sub ids).
  // The pre-checkout route guard is the primary block; this stops a SECOND portal from being created
  // if a webhook for a duplicate session still arrives. (Canceling/refunding the duplicate Stripe
  // subscription is a follow-up, only relevant once self-serve Coaches Portal checkout is ungated.)
  const ownerLivePortal = await getActiveOwnedTeamWorkspace(parsed.ownerUserId);
  if (ownerLivePortal) {
    return { provisioned: false, reason: 'already_exists', workspaceOrgId: ownerLivePortal.workspaceOrgId };
  }

  await assertTeamWorkspaceClaimAvailableForProvisioning(parsed.teamWorkspaceClaimId);

  let result: ProvisionStandaloneTeamWorkspaceResult;
  try {
    result = await provisionStandaloneTeamWorkspace({
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
      billingCycle: normalizeBillingCycle(params.billingCycle ?? parsed.billingCycle),
      entitlementSource: 'team_plan',
      entitlementStatus: mapStripeStatusToTeamEntitlementStatus(params.subscriptionStatus),
      eventSource: params.eventSource,
      sourceEventId: params.sourceEventId,
      actorUserId: parsed.ownerUserId,
      actorEmail: parsed.ownerEmail,
    });
  } catch (err) {
    // Lost the race for this subscription: a concurrent webhook event (checkout.session.completed
    // and customer.subscription.created fire together) already created the workspace, and the unique
    // index on team_workspaces.stripe_subscription_id (mig 156) rejected this second insert. The
    // loser's org was already rolled back inside the provisioner. Resolve to already_exists so the
    // webhook returns 200, provisions no duplicate, and sends NO second welcome email.
    if (isSubscriptionUniqueViolation(err)) {
      const { data: winner } = await supabaseAdmin
        .from('team_workspaces')
        .select('workspace_org_id')
        .eq('stripe_subscription_id', params.stripeSubscriptionId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return { provisioned: false, reason: 'already_exists', workspaceOrgId: (winner?.workspace_org_id as string) ?? null };
    }
    throw err;
  }

  if (parsed.teamWorkspaceClaimId) {
    await markTeamWorkspaceClaimed({
      claimId: parsed.teamWorkspaceClaimId,
      teamWorkspaceId: result.teamWorkspaceId,
      claimedByUserId: parsed.ownerUserId,
    });
  }

  // The growth half of the Billing events card: a brand-new Premium Coaches Portal is a new subscription.
  // Here and not in the provisioner, which the mock paths use too.
  // Only a subscription that is paying or in its trial: `incomplete` (a card still being authenticated)
  // provisions the workspace but has not paid anyone yet.
  if (params.subscriptionStatus === 'active' || params.subscriptionStatus === 'trialing') await writePlatformEvent({
    eventType: 'subscription_started',
    source: params.eventSource,
    sourceEventId: params.sourceEventId ? `${params.sourceEventId}:subscription_started` : null,
    orgId: result.org.id,
    actorUserId: parsed.ownerUserId,
    actorEmail: parsed.ownerEmail,
    planId: 'team',
    subscriptionStatus: mapStripeStatusToOrgStatus(params.subscriptionStatus),
    metadata: { scope: 'coaches_portal', teamWorkspaceId: result.teamWorkspaceId, billingCycle: params.billingCycle ?? parsed.billingCycle },
  });

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
        { kind: 'team_workspace_welcome', orgId: result.org.id, askedBy: parsed.ownerUserId },
      );
    } catch (err) {
      console.error('[team-checkout] Premium welcome email failed:', err);
    }
  }

  return { provisioned: true, result };
}
