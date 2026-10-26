import { supabaseAdmin } from './supabase-admin';
import { writePlatformAuditLog } from './platform-audit';
import { getEffectiveTournamentLimit } from './plan-config';
import { archiveOverCapTournamentsForPlanChange, isLowerPlan } from './billing-retention';
import { isClubPlan } from './module-entitlements';
import { applyPlanChangeSideEffects, hadSubscriptionBefore, hasLiveSubscription } from './plan-move';
import { PAYING_CLUB_PLAN_REFUSAL, isEndedSubscriptionStatus, stripeStillBills } from './stripe-billing-state';
import { getStripe } from './stripe';
import { getPlanConfigOverride } from './plan-config-db';
import { restoreAfterReactivation } from './billing-reactivation';
import type { OrgPlan } from './types';

/**
 * An operator's plan change — the ONE rule both platform-admin paths run: the single-org Plan and
 * Limits save and every org in a Bulk Operations plan change. Before 2026-10-24 the bulk path kept its
 * own copy, which wrote the plan and archived over-cap tournaments but skipped the Club trial, the
 * Founding comp revoke, the stale team-limit clear and the reactivation restore — so moving clubs onto
 * Club in bulk started no trials. A route calls this; it never repeats any step of it.
 *
 * Order: the Club trial decision (H02) → the plan write → the database half every plan change runs
 * (applyPlanChangeSideEffects) → the reactivation restore (A07) → the over-cap archive → the audit trail.
 * A failure AFTER the plan is saved is reported in `warnings` (or `archiveWarning`), never swallowed and
 * never turned into a failure of the change itself. A failed plan write throws PlanUpdateError.
 *
 * M6 (Support console Stage 3, owner Q9 2026-10-26): a club that Stripe still bills — a subscription not yet cancelled
 * in Stripe, whatever its billing status — is refused before anything is written (PlanRefusedError) when the change
 * moves its plan or its tournament limit. Our columns are not what Stripe charges for, and the webhook writes Stripe's
 * plan and tournament limit back at every subscription event, so a staff change here was silently undone while Stripe
 * kept charging the old price. A custom team limit alone (a Club · Association deal) is never written by the webhook, so
 * it still saves on a paying club. The owner moves plan on their Plan & billing page (which
 * moves Stripe), or staff cancel the subscription first. Every caller (the pencil, Put it back, Bulk changes, the plan
 * route) obeys it because the refusal lives here.
 */


export type OperatorPlanCurrent = {
  plan_id: string;
  tournament_limit: number;
  team_limit: number | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_period: string | null;
  current_period_end: string | null;
};

export type OperatorPlanChangeInput = {
  orgId: string;
  planId: OrgPlan;
  /** The requested tournament limit; the effective one (plan floors, 9999 = unlimited) is worked out here. */
  tournamentLimit: number;
  /** Omit to leave a custom team cap alone; a number sets it; 0 or null clears it. */
  teamLimit?: number | null;
  reason: string;
  actor: string;
  /** The target plan's trial length, when the caller already read it (a bulk batch reads it once, not per org). */
  trialDays?: number;
  /** The main audit row's action, plus fields added to every object-valued audit row (e.g. a bulk operation id). */
  audit: { action: string; extra?: Record<string, unknown> };
};

export type OperatorPlanChangeResult = {
  current: OperatorPlanCurrent | null;
  effectiveTournamentLimit: number;
  teamLimitProvided: boolean;
  normalizedTeamLimit: number | null;
  clubTrialDays: number;
  clearedTeamLimit: boolean;
  revokedComps: number;
  reactivated: boolean;
  archivedTournaments: { id: string; name: string }[];
  archiveWarning?: string;
  warnings: string[];
};

export class PlanUpdateError extends Error {}

/** Has Stripe ended this subscription (cancelled, abandoned, or gone)? Unknown counts as not ended: the change is refused. */
async function subscriptionEndedInStripe(subscriptionId: string): Promise<boolean> {
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId, {}, { timeout: 8000, maxNetworkRetries: 1 });
    return isEndedSubscriptionStatus(sub.status);
  } catch (err) {
    const e = err as { statusCode?: number; code?: string };
    return e.statusCode === 404 || e.code === 'resource_missing';
  }
}
/** A staff plan change the rule refuses before writing anything; `message` is the sentence the person reads. */
export class PlanRefusedError extends Error {
  readonly code = 'paying_through_stripe' as const;
  constructor() { super(PAYING_CLUB_PLAN_REFUSAL); }
}

export async function applyOperatorPlanChange(input: OperatorPlanChangeInput): Promise<OperatorPlanChangeResult> {
  const { orgId, planId, reason, actor } = input;
  const extra = input.audit.extra ?? {};
  const effectiveTournamentLimit = getEffectiveTournamentLimit(planId, input.tournamentLimit);
  // Per-org rep-team capacity override (Club Repackaging). Stores the RAW value (a value RAISES the band
  // for "custom above 30" Club · Association deals). IMPORTANT: only written when the caller EXPLICITLY
  // includes teamLimit — an unrelated plan/limit save (which omits it) must NOT wipe an existing custom cap.
  const teamLimitProvided = input.teamLimit !== undefined;
  const normalizedTeamLimit = (typeof input.teamLimit === 'number' && input.teamLimit > 0) ? Math.floor(input.teamLimit) : null;

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, tournament_limit, team_limit, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_period, current_period_end')
    .eq('id', orgId)
    .single<OperatorPlanCurrent>();
  const currentEffectiveLimit = current
    ? getEffectiveTournamentLimit(current.plan_id as OrgPlan, current.tournament_limit)
    : null;

  // Q9: while Stripe bills the club, its plan and tournament limit change in Stripe, never here. Our record says so first;
  // when it does, Stripe is asked, because a missed webhook leaves a subscription Stripe already ended reading as live
  // here — and refusing that club for good would leave staff only the destructive cancel. Stripe unreachable: refused.
  const billedPerRecord = !!current
    && stripeStillBills({ stripeSubscriptionId: current.stripe_subscription_id, subscriptionStatus: current.subscription_status });
  let subscriptionEnded = !billedPerRecord;
  if (current && billedPerRecord && (current.plan_id !== planId || currentEffectiveLimit !== effectiveTournamentLimit)) {
    subscriptionEnded = await subscriptionEndedInStripe(current.stripe_subscription_id!);
    if (!subscriptionEnded) throw new PlanRefusedError();
  }

  const { count: nonArchivedTournamentCount } = await supabaseAdmin
    .from('tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .neq('status', 'archived');

  const updatePayload: {
    plan_id: OrgPlan;
    tournament_limit: number;
    team_limit?: number | null;
    subscription_status?: 'active' | 'trialing';
    stripe_subscription_id?: null;
    subscription_period?: null;
    current_period_end?: string | null;
  } = {
    plan_id: planId,
    tournament_limit: effectiveTournamentLimit,
  };
  if (teamLimitProvided) updatePayload.team_limit = normalizedTeamLimit;

  // The free plan resets the billing columns. It drops our link to a subscription only when that subscription has ended
  // (Q9: a link to one Stripe still bills is never dropped — and such a club cannot reach this line). Kept, an ended
  // subscription's id beside an "active" status would read as live everywhere (checkout, moves, this rule).
  if (planId === 'tournament') {
    updatePayload.subscription_status = 'active';
    if (subscriptionEnded) updatePayload.stripe_subscription_id = null;
    updatePayload.subscription_period = null;
    updatePayload.current_period_end = null;
  }

  // ── Onto a Club band (Club Tier Stage 1b) ─────────────────────────────────────────────────
  // H02: the Club trial. An organization moved onto Club by an operator starts the same 90-day trial a
  // Club purchase starts (the plan's own trial length, platform overrides included) — unless it is already
  // paying on a live Stripe subscription, already on a Club band, or has had a trial before — one an
  // operator granted (the audit log) OR one it took itself through checkout (its Stripe history: Ask 4,
  // no second trial). The trial's end is the period end the billing page shows.
  const warnings: string[] = [];
  let clubTrialDays = 0;
  if (isClubPlan(planId) && current && !isClubPlan(current.plan_id)) {
    const payingLive = hasLiveSubscription({
      id: orgId,
      planId: current.plan_id as OrgPlan,
      stripeSubscriptionId: current.stripe_subscription_id,
      subscriptionStatus: current.subscription_status,
    });
    const { count: priorTrials } = await supabaseAdmin
      .from('platform_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('action', 'update_plan')
      .eq('field', 'club_trial');
    let subscribedBefore = false;
    const customerId = current.stripe_customer_id;
    if (!payingLive && (priorTrials ?? 0) === 0 && customerId && !customerId.startsWith('mock_')) {
      try {
        subscribedBefore = await hadSubscriptionBefore(customerId);
      } catch (stripeErr) {
        // Unknown history is not "no history": no trial, and the operator is told why.
        console.error('[platform-admin] subscription history read failed:', stripeErr);
        subscribedBefore = true;
        warnings.push('Plan saved without a Club trial — the payment provider could not be reached to check whether this organization has had one.');
      }
    }
    if (!payingLive && (priorTrials ?? 0) === 0 && !subscribedBefore) {
      clubTrialDays = input.trialDays ?? (await getPlanConfigOverride(planId)).trialDays;
      if (clubTrialDays > 0) {
        updatePayload.subscription_status = 'trialing';
        updatePayload.current_period_end = new Date(Date.now() + clubTrialDays * 86_400_000).toISOString();
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updatePayload)
    .eq('id', orgId);
  if (error) {
    console.error('[platform-admin] org plan update error:', error);
    throw new PlanUpdateError(error.message);
  }

  // The database half of any plan change — the same one a Stripe move and the webhook run: a custom team
  // limit set for the OLD plan is cleared (it would read as the new band's cap) unless this change sets
  // one, and ⚖ D6 a move onto Club revokes the Founding Season comp.
  let sideEffects = { clearedTeamLimit: false, revokedComps: 0 };
  try {
    sideEffects = await applyPlanChangeSideEffects({
      orgId,
      fromPlan: current?.plan_id ?? null,
      toPlan: planId,
      actor,
      keepTeamLimit: teamLimitProvided,
    });
  } catch (sideEffectErr) {
    console.error('[platform-admin] plan-change side effects failed:', sideEffectErr);
    warnings.push('Plan saved, but clearing the old custom team limit or ending the Founding Season offer failed — check both by hand.');
  }
  // A07: an operator bringing a CANCELLED organization back restores what the cancellation took.
  const reactivated = current?.subscription_status === 'canceled'
    && (updatePayload.subscription_status === 'active' || updatePayload.subscription_status === 'trialing');
  if (reactivated) {
    try {
      await restoreAfterReactivation(orgId, effectiveTournamentLimit);
    } catch (restoreErr) {
      console.error('[platform-admin] reactivation restore failed:', restoreErr);
      warnings.push('Plan saved, but restoring what the cancellation took (the public site, the tournaments) failed — the organization may still be suspended.');
    }
  }

  // Apply the new cap to the tournaments that ALREADY exist (audit 2026-08-06): the cap is only enforced
  // at creation, so without this a club dropped to a one-slot plan kept every live tournament forever.
  // Nothing is destroyed — the rows are retained and restored on re-upgrade.
  let archivedTournaments: { id: string; name: string }[] = [];
  let archiveWarning: string | undefined;
  if (current && isLowerPlan(current.plan_id as OrgPlan, planId)) {
    try {
      const archived = await archiveOverCapTournamentsForPlanChange({
        orgId,
        fromPlan: current.plan_id as OrgPlan,
        targetPlan: planId,
        actorEmail: actor,
        reason,
      });
      archivedTournaments = archived.map(t => ({ id: t.id, name: t.name }));
      if (archivedTournaments.length > 0) {
        await writePlatformAuditLog(actor, orgId, 'update_plan', 'archived_over_cap_tournaments',
          null, { count: archivedTournaments.length, tournaments: archivedTournaments, ...extra }, { reason });
      }
    } catch (archiveErr) {
      // The plan change itself already succeeded and must not be reported as a failure. Set a warning and
      // FALL THROUGH: an early return would skip the audit rows below, so a half-applied downgrade — the
      // one case where a human most needs the trail — would be the one case that left none.
      console.error('[platform-admin] over-cap tournament archive failed:', archiveErr);
      archiveWarning = 'Plan saved, but the over-cap tournaments could not be archived. '
        + 'This org is now over its tournament limit — archive them manually.';
    }
  }

  await writePlatformAuditLog(actor, orgId, input.audit.action, 'plan_and_limit',
    current
      ? {
          plan_id: current.plan_id,
          tournament_limit: currentEffectiveLimit,
          subscription_status: current.subscription_status,
          stripe_subscription_id: current.stripe_subscription_id,
          subscription_period: current.subscription_period,
          current_period_end: current.current_period_end,
        }
      : null,
    {
      plan_id: planId,
      tournament_limit: effectiveTournamentLimit,
      non_archived_tournaments: nonArchivedTournamentCount ?? 0,
      free_plan_billing_reset: planId === 'tournament',
      ...extra,
    }, { reason });
  if (current?.tournament_limit !== effectiveTournamentLimit) {
    await writePlatformAuditLog(actor, orgId, 'update_plan', 'tournament_limit',
      current?.tournament_limit, effectiveTournamentLimit, { reason });
  }
  if (sideEffects.clearedTeamLimit) {
    await writePlatformAuditLog(actor, orgId, 'update_plan', 'team_limit',
      current?.team_limit ?? null, null, { reason });
  }
  // ⚠ Keep this row's action + field exactly: the "no second trial" check above counts them.
  if (clubTrialDays > 0) {
    await writePlatformAuditLog(actor, orgId, 'update_plan', 'club_trial',
      null, { days: clubTrialDays, endsAt: updatePayload.current_period_end, ...extra }, { reason });
  }
  if (sideEffects.revokedComps > 0) {
    await writePlatformAuditLog(actor, orgId, 'update_plan', 'founding_comp_revoked',
      null, { rows: sideEffects.revokedComps, ...extra }, { reason });
  }
  if (teamLimitProvided && (current?.team_limit ?? null) !== normalizedTeamLimit) {
    await writePlatformAuditLog(actor, orgId, 'update_plan', 'team_limit',
      current?.team_limit ?? null, normalizedTeamLimit, { reason });
  }
  if (planId === 'tournament') {
    if (current?.subscription_status !== 'active') {
      await writePlatformAuditLog(actor, orgId, 'update_plan', 'subscription_status',
        current?.subscription_status, 'active', { reason });
    }
    if (current?.stripe_subscription_id && subscriptionEnded) {
      await writePlatformAuditLog(actor, orgId, 'update_plan', 'stripe_subscription_id',
        current.stripe_subscription_id, null, { reason });
    }
    if (current?.subscription_period) {
      await writePlatformAuditLog(actor, orgId, 'update_plan', 'subscription_period',
        current?.subscription_period, null, { reason });
    }
    if (current?.current_period_end) {
      await writePlatformAuditLog(actor, orgId, 'update_plan', 'current_period_end',
        current?.current_period_end, null, { reason });
    }
  }

  return {
    current: current ?? null,
    effectiveTournamentLimit,
    teamLimitProvided,
    normalizedTeamLimit,
    clubTrialDays,
    clearedTeamLimit: sideEffects.clearedTeamLimit,
    revokedComps: sideEffects.revokedComps,
    reactivated,
    archivedTournaments,
    ...(archiveWarning ? { archiveWarning } : {}),
    warnings,
  };
}
