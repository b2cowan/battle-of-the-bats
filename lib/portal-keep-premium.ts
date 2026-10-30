import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { writePlatformAuditLog } from './platform-audit';
import { writePlatformEvent, type PlatformEventInput } from './platform-events';
import { captureError } from './observability/capture';
import { PORTAL_FREE_TIME_GRANT_TYPE } from './portal-free-time';
import type { SubscriptionStatus } from './types';
import type { TeamEntitlementStatus } from './team-workspace-entitlements';

/**
 * Keep Premium (Support console Stage 4b, Part 6; Q11-2): a coach on free time from staff buys the Premium Coaches
 * Portal, and the purchase attaches to THE SAME portal (before or after its last free day), so the coach always ends
 * on one portal with everything they made. The checkout gains two duties and nothing else (gate step 5): reuse this
 * portal, and clear its end.
 *
 * The conversion: the workspace becomes coach-paid (`team_direct`, the Stripe ids), the organization's stored ended
 * state is cleared, the entitlement loses its end and becomes `team_plan`, and a free-time grant still running ends
 * with its own audit entry (the Story reads "the coach chose Premium"). The billing mode moves by compare-and-set, and
 * a repeat of the same subscription re-applies the rest, because Stripe may deliver `checkout.session.completed` more
 * than once and concurrently, and a delivery that stopped halfway must be repaired by the next one.
 *
 * ⚠ Nothing else runs (T15): no cancel, retention, archive or email is reachable from here. `free_time_given_at` is
 * never cleared (the Story and the limits read it); the portal stops counting as staff-given the moment its billing
 * mode leaves `platform_override` (`freeTimePortalOrgIds`).
 */

export type KeepPremiumPortal = { workspaceId: string; orgId: string; orgSlug: string; repTeamId: string; basicTeamId: string | null };

/**
 * The coach's staff-given portal this checkout is for, or null. Only a portal staff gave free time that nobody pays for
 * yet, owned by this coach, and named by the checkout: the billing page's Keep Premium (its slug) or the free team's
 * Upgrade (its free team). A tournament-claim checkout is for a different team and never reuses it.
 */
export async function findKeepPremiumPortal(input: {
  ownerUserId: string;
  reactivateOrgSlug?: string | null;
  basicCoachTeamId?: string | null;
  claimToken?: string | null;
  teamWorkspaceClaimId?: string | null;
  /**
   * The webhook's subscription: a portal this same subscription already converted is found again, so a delivery that
   * stopped halfway is repaired by the next one. (The checkout route passes none: only an unconverted portal.)
   */
  stripeSubscriptionId?: string | null;
}): Promise<KeepPremiumPortal | null> {
  if (input.claimToken || input.teamWorkspaceClaimId) return null;
  if (!input.reactivateOrgSlug && !input.basicCoachTeamId) return null;
  // One staff-given portal per coach (mig 406's partial unique index on the mark), so at most one row.
  const { data: ws, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id, basic_coach_team_id, billing_mode, stripe_subscription_id')
    .eq('primary_owner_user_id', input.ownerUserId)
    .not('free_time_given_at', 'is', null)
    .maybeSingle<{
      id: string; workspace_org_id: string; rep_team_id: string; basic_coach_team_id: string | null;
      billing_mode: string | null; stripe_subscription_id: string | null;
    }>();
  if (error) throw error;
  if (!ws) return null;
  const unconverted = ws.billing_mode === 'platform_override';
  if (!unconverted) {
    // Converted already. Only a conversion by THIS subscription that did not finish is taken again: the entitlement's
    // end is cleared LAST, so an end still on it means the rest is owed. A finished one is an ordinary paid portal, and
    // its later Stripe events take the ordinary path.
    if (!input.stripeSubscriptionId || ws.stripe_subscription_id !== input.stripeSubscriptionId) return null;
    const { data: ent, error: entError } = await supabaseAdmin
      .from('team_entitlements')
      .select('id')
      .eq('team_workspace_id', ws.id)
      .not('ends_at', 'is', null)
      .limit(1);
    if (entError) throw entError;
    if (!ent || ent.length === 0) return null;
  }
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', ws.workspace_org_id)
    .maybeSingle<{ slug: string }>();
  if (orgError) throw orgError;
  if (!org?.slug) return null;
  const named = (!!input.reactivateOrgSlug && input.reactivateOrgSlug === org.slug)
    || (!!input.basicCoachTeamId && input.basicCoachTeamId === ws.basic_coach_team_id);
  if (!named) return null;
  return { workspaceId: ws.id, orgId: ws.workspace_org_id, orgSlug: org.slug, repTeamId: ws.rep_team_id, basicTeamId: ws.basic_coach_team_id };
}

export type KeepPremiumResult =
  | { converted: true; workspaceOrgId: string; teamWorkspaceId: string; repTeamId: string }
  | { converted: false; reason: 'already_converted'; workspaceOrgId: string; teamWorkspaceId: string; repTeamId: string }
  | { converted: false; reason: 'taken'; workspaceOrgId: string }
  /** Stripe has not taken the first payment yet (or never will): nothing was changed, and the free time keeps running. */
  | { converted: false; reason: 'not_settled'; workspaceOrgId: string };

/** A subscription whose first payment is not through. Converting on it would revoke free days for a purchase that may never complete. */
const NOT_SETTLED = new Set(['incomplete', 'incomplete_expired']);

/** Turn the coach's staff-given portal into their own paid portal (see the file note). */
export async function convertFreeTimePortal(params: {
  portal: KeepPremiumPortal;
  ownerUserId: string;
  ownerEmail: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId?: string | null;
  /** Stripe's own status, kept on the workspace. */
  subscriptionStatus: string;
  /** The same status in the organization's and the entitlement's words (the caller maps them, `lib/team-checkout.ts`). */
  orgStatus: SubscriptionStatus;
  entitlementStatus: TeamEntitlementStatus;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
  eventSource: PlatformEventInput['source'];
  sourceEventId?: string | null;
}): Promise<KeepPremiumResult> {
  const { portal } = params;
  const now = new Date().toISOString();
  const same = { workspaceOrgId: portal.orgId, teamWorkspaceId: portal.workspaceId, repTeamId: portal.repTeamId };
  // Who did it, on the Story and the audit log: the coach (a checkout can carry no address; the coach is still who).
  const actor = params.ownerEmail ?? 'The coach';

  // Review (4b): nothing moves until the payment is through. A later delivery of the same subscription ('active' or
  // 'trialing') finds the portal still unconverted and converts it then; the free days are never burned on a purchase
  // that does not complete.
  if (NOT_SETTLED.has(params.subscriptionStatus)) return { converted: false, reason: 'not_settled', workspaceOrgId: portal.orgId };

  // The claim: only the first delivery moves the billing mode.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('team_workspaces')
    .update({
      billing_mode: 'team_direct',
      billing_owner_user_id: params.ownerUserId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      subscription_status: params.subscriptionStatus,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: now,
    })
    .eq('id', portal.workspaceId)
    .eq('billing_mode', 'platform_override')
    .select('id');
  if (claimError) throw claimError;
  const fresh = (claimed ?? []).length > 0;
  if (!fresh) {
    const { data: ws, error } = await supabaseAdmin
      .from('team_workspaces')
      .select('stripe_subscription_id')
      .eq('id', portal.workspaceId)
      .maybeSingle<{ stripe_subscription_id: string | null }>();
    if (error) throw error;
    // Another subscription converted it first: this one attaches to nothing (the caller says so, never a second portal).
    if (ws?.stripe_subscription_id !== params.stripeSubscriptionId) {
      // ...and it is still a live subscription billing the coach. Nothing else will ever notice, so staff are told on the
      // Errors screen (and Today's "New errors") with the one thing to do: cancel it and refund it in Stripe (owner, 4b).
      await captureError(
        new Error(`Keep Premium: the coach paid twice. Subscription ${params.stripeSubscriptionId} attached to nothing and is still billing them; the portal is on ${ws?.stripe_subscription_id ?? 'another subscription'}. Cancel ${params.stripeSubscriptionId} in Stripe and refund its payment.`),
        {
          route: 'portal-keep-premium', severity: 'error', title: 'Keep Premium: a second subscription is billing a coach',
          org: { id: portal.orgId, slug: portal.orgSlug }, user: { id: params.ownerUserId, email: params.ownerEmail },
        },
      );
      return { converted: false, reason: 'taken', workspaceOrgId: portal.orgId };
    }
  }

  // In this order, each step repeatable, so a delivery that stopped is finished by the next one: the stored ended state
  // is cleared, a free time still running ends, and LAST the entitlement loses its end and becomes the coach's own plan
  // (an end still on it is how `findKeepPremiumPortal` knows the rest is owed).
  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .update({
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      subscription_status: params.orgStatus,
      subscription_period: params.billingCycle ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
      billing_suspended_at: null,
      billing_suspension_reason: null,
    })
    .eq('id', portal.orgId);
  if (orgError) throw orgError;

  // A free time still running ends here, with its own entry; one that already ran out is left as it is (it ended by
  // itself, and the Story says so).
  const { data: grants, error: grantError } = await supabaseAdmin
    .from('org_overrides')
    .select('id, expires_at')
    .eq('org_id', portal.orgId)
    .eq('type', PORTAL_FREE_TIME_GRANT_TYPE)
    .is('revoked_at', null)
    .gt('expires_at', now);
  if (grantError) throw grantError;
  for (const g of grants ?? []) {
    const { data: ended, error } = await supabaseAdmin
      .from('org_overrides')
      .update({ revoked_at: now, revoked_by: actor })
      .eq('id', g.id)
      .is('revoked_at', null)
      .select('id');
    if (error) throw error;
    if (!ended || ended.length === 0) continue;
    await writePlatformAuditLog(actor, portal.orgId, 'revoke_override', 'id', g.id, {
      portal: true, subscribed: true, was_expires_at: g.expires_at,
    }, { reason: 'The coach chose Premium.' });
  }

  const { error: entError } = await supabaseAdmin
    .from('team_entitlements')
    .update({
      source: 'team_plan',
      status: params.entitlementStatus,
      ends_at: null,
      stripe_subscription_item_id: params.stripeSubscriptionItemId ?? null,
      updated_at: now,
    })
    .eq('team_workspace_id', portal.workspaceId);
  if (entError) throw entError;

  // The purchase's record is written by whichever delivery FINISHES the job (review, 4b): a delivery that stopped after
  // the claim is repaired by the next one, and that one must not leave a paid portal with no Story entry and no start
  // event. Both writes are repeatable: the audit row is looked for first, and the start event dedupes on the subscription.
  const { count: audited, error: auditReadError } = await supabaseAdmin
    .from('platform_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', portal.orgId)
    .eq('action', 'keep_premium');
  if (auditReadError) throw auditReadError;
  if (!audited) {
    await writePlatformAuditLog(actor, portal.orgId, 'keep_premium', 'billing_mode', 'platform_override', {
      billing_mode: 'team_direct', stripe_subscription_id: params.stripeSubscriptionId, ended_running_grants: (grants ?? []).length,
    }, { reason: 'The coach chose Premium.' });
  }
  // A real new subscription (the staff-given portal was never one: T35).
  if (params.subscriptionStatus === 'active' || params.subscriptionStatus === 'trialing') {
    await writePlatformEvent({
      eventType: 'subscription_started',
      source: params.eventSource,
      sourceEventId: `keep-premium:${params.stripeSubscriptionId}:subscription_started`,
      orgId: portal.orgId,
      actorUserId: params.ownerUserId,
      actorEmail: params.ownerEmail,
      planId: 'team',
      subscriptionStatus: params.orgStatus,
      metadata: { scope: 'coaches_portal', teamWorkspaceId: portal.workspaceId, billingCycle: params.billingCycle ?? null, from: 'portal_free_time' },
    });
  }

  return fresh ? { converted: true, ...same } : { converted: false, reason: 'already_converted', ...same };
}
