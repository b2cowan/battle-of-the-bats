import type Stripe from 'stripe';
import { getStripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG, normalizeBillingCycle, type BillingCycle } from './plan-config';
import { getStripePriceId } from './stripe-prices';
import { foundingCompAppliesToPlan, revokeFoundingSeasonComp } from './founding-season';
import type { OrgPlan } from './types';

/**
 * MOVING A PAYING ORGANIZATION BETWEEN PLANS — ONE SUBSCRIPTION, NEVER A SECOND CHECKOUT
 * (Club Tier Stage 1b; ⚖ D7 + Ask 4, owner 2026-09-25).
 *
 *   · UP (Tournament Plus → Club or Club · Association, Club → Club · Association): now, on the SAME
 *     subscription, prorated — the difference for the rest of the period is charged today. The
 *     figure comes from Stripe's own preview, never from our arithmetic, and the move is made with
 *     the preview's `proration_date` so the charge equals what the owner was shown.
 *   · DOWN (Club · Association → Club): at the next renewal, with no credit, through a Stripe
 *     subscription schedule (two phases: the current price to the period's end, then the smaller
 *     price; released afterwards). REFUSED while the club has more active teams than the smaller
 *     band holds — the team cap is what defines the band.
 *   · NO SECOND TRIAL. A move changes the price of the subscription the org already has; a trialing
 *     subscription keeps the trial it already had and no move ever starts one.
 *
 * Before this, a paying org that bought another plan opened a SECOND Stripe subscription (A06): the
 * checkout never looked for the first one, and the webhook keys the org on its Stripe customer.
 *
 * This module holds the Stripe + database halves. WHO may move and WHETHER a plan is on sale are
 * the routes' questions (owner-only `billing`; the one gating source) — asked before any of this.
 * No `server-only` import: the Stripe sandbox verification script drives these functions directly.
 */

export type MoveDirection = 'up' | 'down';

/** The moves Ask 4 covers. Anything else (a downgrade to a tournament tier, League) is not a move. */
const MOVES: Partial<Record<OrgPlan, Partial<Record<OrgPlan, MoveDirection>>>> = {
  tournament_plus: { club: 'up', club_large: 'up' },
  club: { club_large: 'up' },
  club_large: { club: 'down' },
};

export function moveDirection(from: OrgPlan, to: OrgPlan): MoveDirection | null {
  return MOVES[from]?.[to] ?? null;
}

export type MoveOrg = {
  id: string;
  planId: OrgPlan;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
};

/** The refusals, as codes the screen can offer the right door for. */
export type MoveRefusal =
  | { code: 'not_a_move'; error: string }
  | { code: 'no_live_subscription'; error: string }
  | { code: 'price_missing'; error: string }
  | { code: 'band_too_small'; error: string; activeTeams: number; teamLimit: number }
  | { code: 'stripe_error'; error: string };

export type MovePreview =
  | {
      direction: 'up';
      toPlan: OrgPlan;
      billingCycle: BillingCycle;
      /** What Stripe will charge today, in cents — the prorated difference for the rest of the period. */
      amountDueToday: number;
      currency: string;
      /** Pass back unchanged to `applyMove` so the charge equals this preview. Unix seconds. */
      prorationDate: number;
      /** The new price per period, in cents, from the renewal onwards. */
      nextAmount: number;
      /** When the current period ends (the date the new price first renews), ISO. */
      renewsAt: string | null;
    }
  | {
      direction: 'down';
      toPlan: OrgPlan;
      billingCycle: BillingCycle;
      /** The day the smaller band takes effect — the next renewal. No credit before then. ISO. */
      effectiveAt: string | null;
      nextAmount: number;
      currency: string;
    };

export type ScheduledMove = { toPlan: OrgPlan; effectiveAt: string | null; scheduleId: string };

const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);
const MOVE_METADATA_KEY = 'flhq_plan_move';

type LiveSub = { sub: Stripe.Subscription; item: Stripe.SubscriptionItem; billingCycle: BillingCycle };

/**
 * A pure read of "is this org paying on a live STRIPE subscription?" — the fact checkout refuses on
 * (A06), the operator's Club trial skips on (H02), and a move needs. A dev mock subscription
 * (`mock_…`) is not one: Stripe has never heard of it, so there is nothing to move and the mock
 * checkout must keep working.
 */
export function hasLiveSubscription(org: MoveOrg): boolean {
  return !!org.stripeSubscriptionId
    && !org.stripeSubscriptionId.startsWith('mock_')
    && LIVE_STATUSES.has(org.subscriptionStatus ?? '');
}

async function loadLiveSubscription(org: MoveOrg): Promise<LiveSub | MoveRefusal> {
  if (!hasLiveSubscription(org)) {
    return {
      code: 'no_live_subscription',
      error: 'This organization has no subscription to change. Choose a plan from the plan page instead.',
    };
  }
  try {
    const sub = await getStripe().subscriptions.retrieve(org.stripeSubscriptionId!, { expand: ['schedule'] });
    const item = sub.items.data[0];
    if (!item || !LIVE_STATUSES.has(sub.status)) {
      return { code: 'no_live_subscription', error: 'This organization’s subscription is no longer active.' };
    }
    const interval = item.price.recurring?.interval;
    return { sub, item, billingCycle: normalizeBillingCycle(interval === 'year' ? 'annual' : 'monthly') };
  } catch (error) {
    console.error('[plan-move] subscription retrieve failed:', error);
    return { code: 'stripe_error', error: 'We couldn’t reach the payment provider. Try again in a moment.' };
  }
}

async function activeTeamCount(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_archived', false);
  if (error) throw error;
  return count ?? 0;
}

async function validateMove(org: MoveOrg, toPlan: OrgPlan): Promise<
  | { ok: true; direction: MoveDirection; live: LiveSub; priceId: string }
  | { ok: false; refusal: MoveRefusal }
> {
  const direction = moveDirection(org.planId, toPlan);
  if (!direction) {
    return { ok: false, refusal: { code: 'not_a_move', error: 'That plan change isn’t a move between plans.' } };
  }
  const live = await loadLiveSubscription(org);
  if ('code' in live) return { ok: false, refusal: live };

  if (direction === 'down') {
    const teamLimit = PLAN_CONFIG[toPlan].teamLimit;
    const activeTeams = await activeTeamCount(org.id);
    if (activeTeams > teamLimit) {
      return {
        ok: false,
        refusal: {
          code: 'band_too_small',
          error: `${PLAN_CONFIG[toPlan].label} holds ${teamLimit} teams and this club has ${activeTeams} active. Archive ${activeTeams - teamLimit} first, then come back.`,
          activeTeams,
          teamLimit,
        },
      };
    }
  }

  // The SAME billing cycle: a monthly Club moves to a monthly Club · Association.
  const priceId = await getStripePriceId(toPlan, live.billingCycle);
  if (!priceId) {
    return {
      ok: false,
      refusal: { code: 'price_missing', error: `${PLAN_CONFIG[toPlan].label} isn’t set up for ${live.billingCycle} billing yet.` },
    };
  }
  return { ok: true, direction, live, priceId };
}

async function unitAmount(priceId: string): Promise<{ amount: number; currency: string }> {
  const price = await getStripe().prices.retrieve(priceId);
  return { amount: price.unit_amount ?? 0, currency: price.currency };
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

/** What a move would do, before the owner confirms it. */
export async function previewMove(org: MoveOrg, toPlan: OrgPlan): Promise<MovePreview | MoveRefusal> {
  const checked = await validateMove(org, toPlan);
  if (!checked.ok) return checked.refusal;
  const { direction, live, priceId } = checked;
  try {
    const next = await unitAmount(priceId);
    if (direction === 'down') {
      return {
        direction, toPlan, billingCycle: live.billingCycle,
        effectiveAt: isoFromUnix(live.item.current_period_end),
        nextAmount: next.amount, currency: next.currency,
      };
    }
    const prorationDate = Math.floor(Date.now() / 1000);
    const invoice = await getStripe().invoices.createPreview({
      customer: typeof live.sub.customer === 'string' ? live.sub.customer : live.sub.customer.id,
      subscription: live.sub.id,
      subscription_details: {
        items: [{ id: live.item.id, price: priceId }],
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
      },
    });
    return {
      direction, toPlan, billingCycle: live.billingCycle,
      amountDueToday: invoice.amount_due,
      currency: invoice.currency,
      prorationDate,
      nextAmount: next.amount,
      renewsAt: isoFromUnix(live.item.current_period_end),
    };
  } catch (error) {
    console.error('[plan-move] preview failed:', error);
    return { code: 'stripe_error', error: 'We couldn’t get the price for this change from the payment provider. Try again in a moment.' };
  }
}

/**
 * The database half of ANY plan change — called by `applyMove` for an immediate move, by the
 * billing webhook when Stripe changes the plan (a scheduled down-move reaching its renewal), and by
 * the platform-admin plan route when an operator changes it:
 *   · a CUSTOM team limit is cleared on a band change (it was set for the old band and would read as
 *     the new band's cap — the Club Repackaging fast-follow) — unless the same change sets the new
 *     band's cap (`keepTeamLimit`, an operator's custom deal), and
 *   · ⚖ D6: a move onto a Club band revokes the Founding Season comp.
 * Idempotent: a second call with the same plans changes nothing. Call it AFTER the plan is written.
 */
export async function applyPlanChangeSideEffects(p: {
  orgId: string;
  fromPlan: OrgPlan | string | null;
  toPlan: OrgPlan | string;
  actor: string;
  keepTeamLimit?: boolean;
}): Promise<{ clearedTeamLimit: boolean; revokedComps: number }> {
  let clearedTeamLimit = false;
  if (p.fromPlan && p.fromPlan !== p.toPlan && !p.keepTeamLimit) {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update({ team_limit: null })
      .eq('id', p.orgId)
      .not('team_limit', 'is', null)
      .select('id');
    if (error) throw error;
    clearedTeamLimit = (data?.length ?? 0) > 0;
  }
  const revokedComps = foundingCompAppliesToPlan(p.toPlan)
    ? 0
    : await revokeFoundingSeasonComp(p.orgId, p.actor);
  return { clearedTeamLimit, revokedComps };
}

export type MoveResult =
  | { direction: 'up'; toPlan: OrgPlan; movedAt: string }
  | { direction: 'down'; toPlan: OrgPlan; scheduled: ScheduledMove };

/** Makes the move. For an UP move pass the preview's `prorationDate` so the charge matches it. */
export async function applyMove(
  org: MoveOrg,
  toPlan: OrgPlan,
  opts: { prorationDate?: number; actor: string },
): Promise<MoveResult | MoveRefusal> {
  const checked = await validateMove(org, toPlan);
  if (!checked.ok) return checked.refusal;
  const { direction, live, priceId } = checked;
  const stripe = getStripe();
  const metadata = { orgId: org.id, planKey: toPlan, billingCycle: live.billingCycle, [MOVE_METADATA_KEY]: direction };

  try {
    if (direction === 'up') {
      // A move UP replaces any down-move waiting at renewal — release it first, or the schedule
      // would take the club back down at the period's end.
      const existing = scheduleOf(live.sub);
      if (existing) await stripe.subscriptionSchedules.release(existing.id);

      const nowSec = Math.floor(Date.now() / 1000);
      const periodStart = live.item.current_period_start;
      const prorationDate = opts.prorationDate
        && opts.prorationDate <= nowSec
        && (!periodStart || opts.prorationDate >= periodStart)
        ? opts.prorationDate
        : nowSec;
      await stripe.subscriptions.update(live.sub.id, {
        items: [{ id: live.item.id, price: priceId }],
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
        metadata,
      });

      // The webhook will write the same plan from the new price; writing it here too means the
      // owner's next screen already shows the new band.
      const { error } = await supabaseAdmin
        .from('organizations')
        .update({ plan_id: toPlan, tournament_limit: PLAN_CONFIG[toPlan].tournamentLimit })
        .eq('id', org.id);
      if (error) throw error;
      await applyPlanChangeSideEffects({ orgId: org.id, fromPlan: org.planId, toPlan, actor: opts.actor });
      return { direction, toPlan, movedAt: new Date().toISOString() };
    }

    // DOWN — at renewal. One schedule per subscription: reuse the one that exists (ours), or build it.
    const existing = scheduleOf(live.sub);
    const schedule = existing
      ?? await stripe.subscriptionSchedules.create({ from_subscription: live.sub.id });
    // The phase running NOW keeps its start. A reused schedule already holds the down phase after it
    // (the same move asked twice), so "the last phase" would move the running one into the future.
    const currentStart = schedule.current_phase?.start_date ?? schedule.phases[0]?.start_date;
    const periodEnd = live.item.current_period_end;
    const updated = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      metadata,
      phases: [
        {
          items: [{ price: live.item.price.id, quantity: live.item.quantity ?? 1 }],
          start_date: currentStart ?? 'now',
          end_date: periodEnd,
        },
        {
          items: [{ price: priceId, quantity: live.item.quantity ?? 1 }],
          // No credit: the club keeps the larger band until the renewal, then renews smaller.
          proration_behavior: 'none',
          duration: { interval: live.billingCycle === 'annual' ? 'year' : 'month', interval_count: 1 },
        },
      ],
    });
    return {
      direction,
      toPlan,
      scheduled: { toPlan, effectiveAt: isoFromUnix(periodEnd), scheduleId: updated.id },
    };
  } catch (error) {
    console.error('[plan-move] move failed:', error);
    return { code: 'stripe_error', error: 'The payment provider didn’t accept the change. Nothing was changed — try again in a moment.' };
  }
}

function scheduleOf(sub: Stripe.Subscription): Stripe.SubscriptionSchedule | null {
  return sub.schedule && typeof sub.schedule !== 'string' ? sub.schedule : null;
}

/** Subscriptions Stripe created but that never started — a checkout abandoned at the card step. */
const NEVER_STARTED = new Set(['incomplete', 'incomplete_expired']);

/**
 * Has this Stripe customer ever HELD a subscription (a trial counts — it is what a second trial
 * would repeat)? The no-second-trial fact (Ask 4), asked by checkout and by the operator's Club
 * trial (H02) alike. Not counted: a subscription that never started, and a Founding Season
 * next-season choice (`choiceKind` — a promise to pay, not a subscription they used).
 */
export async function hadSubscriptionBefore(customerId: string): Promise<boolean> {
  // Every page of the history, not the newest twenty: an old subscription is still a used trial.
  for await (const sub of getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
    if (!sub.metadata?.choiceKind && !NEVER_STARTED.has(sub.status)) return true;
  }
  return false;
}

/** The down-move waiting at renewal, if any (for the billing page's "moves to Club on …" line). */
export async function getScheduledMove(org: MoveOrg): Promise<ScheduledMove | null> {
  const live = await loadLiveSubscription(org);
  if ('code' in live) return null;
  const schedule = scheduleOf(live.sub);
  if (!schedule || schedule.metadata?.[MOVE_METADATA_KEY] !== 'down') return null;
  const toPlan = schedule.metadata?.planKey as OrgPlan | undefined;
  if (!toPlan || !(toPlan in PLAN_CONFIG)) return null;
  return { toPlan, effectiveAt: isoFromUnix(live.item.current_period_end), scheduleId: schedule.id };
}

/** Keep the current band: cancels a down-move waiting at renewal. True when one was cancelled. */
export async function cancelScheduledMove(org: MoveOrg): Promise<boolean | MoveRefusal> {
  const scheduled = await getScheduledMove(org);
  if (!scheduled) return false;
  try {
    await getStripe().subscriptionSchedules.release(scheduled.scheduleId);
    return true;
  } catch (error) {
    console.error('[plan-move] cancel scheduled move failed:', error);
    return { code: 'stripe_error', error: 'We couldn’t reach the payment provider. Try again in a moment.' };
  }
}
