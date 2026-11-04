import type Stripe from 'stripe';
import { getStripe } from './stripe';
import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG, normalizeBillingCycle, type BillingCycle } from './plan-config';
import { getStripePriceId } from './stripe-prices';
import { foundingCompAppliesToPlan, revokeFoundingSeasonComp } from './founding-season';
import { writeGrowthEvent } from './platform-events';
import { MOVE_METADATA_KEY } from './plan-growth';
import { futureMoveAnswer, stripeCancelSignal, waitingState } from './plan-ending';
import { readPendingEnding } from './plan-ending-store';
import type { OrgPlan } from './types';
import { ownPlanOf } from './entitlement-grants';
import { PAYING_STATUSES } from './stripe-billing-state';
import { moveDirection, type MoveDirection } from './plan-move-options';
import { flipWorkspaceIntoClub, type WorkspaceFlipResult } from './workspace-flip';
import { trustedPreviewLines, type MovePreviewLine } from './plan-move-preview-lines';
import { inPlaceMetadata, parseClubName } from './workspace-upgrade';
import { workspaceCannotBecomeClub } from './workspace-upgrade-status';
import { restoreCoachesPortalRetainedRecords } from './portal-retained-restore';

/**
 * MOVING A PAYING ORGANIZATION BETWEEN PLANS — ONE SUBSCRIPTION, NEVER A SECOND CHECKOUT
 * (Club Tier Stage 1b; ⚖ D7 + Ask 4, owner 2026-09-25).
 *
 *   · UP (Tournament Plus → Club or Club · Association, Club → Club · Association): now, on the SAME
 *     subscription, prorated — the difference for the rest of the period is charged today. The
 *     figure comes from Stripe's own preview, never from our arithmetic, and the move is made with
 *     the preview's `proration_date` so the charge equals what the owner was shown.
 *   · UP from Premium (Coaches Portal → Club or Club · Association; Stage 4b): the same move, and the coach's portal then
 *     becomes the club in place (`applyPlanChangeSideEffects` → the workspace flip). Needs the club name; refused while the
 *     payment is failing. A coach with NO subscription (free days) is not moved — they buy Club at checkout on the same workspace.
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
  /** A Premium coach whose last payment failed: not moved onto Club until the payment method is fixed (Stage 4b). */
  | { code: 'payment_failing'; error: string }
  | { code: 'subscription_ending'; error: string; endsAt: string | null }
  /** The portal holds more than one team, or has already moved into another club: the flip would refuse AFTER the charge, so it is refused before (Stage 4b). */
  | { code: 'cannot_become_club'; error: string }
  /** A Coaches Portal becoming the club needs the name the coach typed (Stage 4b); `error` is a sentence the screen can show. */
  | { code: 'club_name_invalid'; error: string }
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
      /**
       * Stripe's own breakdown of `amountDueToday` — the new plan for the rest of the period, the credit for unused time on the old
       * one — when every line can be trusted (lib/plan-move-preview-lines.ts); `null` means show the total alone. charges − credits
       * = amountDueToday, always.
       */
      lines: MovePreviewLine[] | null;
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

const LIVE_STATUSES = PAYING_STATUSES;

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
  const direction = moveDirection(ownPlanOf(org), toPlan);
  if (!direction) {
    return { ok: false, refusal: { code: 'not_a_move', error: 'That plan change isn’t a move between plans.' } };
  }
  const live = await loadLiveSubscription(org);
  if ('code' in live) return { ok: false, refusal: live };

  // Owner, Stage 4b Part 3: keep the coach's decision to leave until they explicitly keep Premium — generalised to EVERY plan
  // and both directions by Plans end at renewal (decision 5, owner 2026-11-01). While a cancel waits, an up move would
  // charge a proration on a plan that still ends, and a down move would build a schedule on a subscription set to cancel.
  // Keep {Plan} first. Either Stripe signal counts (G8); the refusal is the one rule for a subscription's future.
  const ending = stripeCancelSignal(live.sub);
  // Stage 2: the same Stripe signal is a waiting move to the free plan when our row says so — the refusal names it. And
  // our row alone refuses too (Part B /billing, 2026-11-04): a click whose Stripe answer was lost leaves the row waiting
  // with no flag yet, and a move then would run over the waiting change.
  const waiting = await readPendingEnding(org.id).catch(() => null);
  if (ending.scheduled || waiting) {
    const endsAt = ending.endsAt ?? waiting?.effectiveAt ?? null;
    const answer = futureMoveAnswer('plan_move', { ownPlan: ownPlanOf(org), ...waitingState(waiting), pending: true, pendingEndsAt: endsAt });
    if (answer.answer === 'refuse') return { ok: false, refusal: { code: 'subscription_ending', error: answer.reason, endsAt } };
  }

  // Stage 4b: a Premium coach moves onto Club only on a subscription that is paying. A failing payment is allowed to be MOVED by
  // the paying set (`past_due` counts as live), but the flip refuses anything not settled — so the swap would charge Club's price
  // and leave the portal as it was. Refuse it up front, in plain words, before any price is shown or any charge is made.
  if (ownPlanOf(org) === 'team' && (org.subscriptionStatus === 'past_due' || live.sub.status === 'past_due')) {
    return {
      ok: false,
      refusal: { code: 'payment_failing', error: 'Your last payment didn’t go through. Update your payment method first, then move to Club.' },
    };
  }

  // The flip refuses a portal that holds more than one team or has moved into another club — by name, AFTER the charge. Ask first.
  if (direction === 'up' && ownPlanOf(org) === 'team') {
    const blocked = await workspaceCannotBecomeClub(org.id);
    if (blocked) return { ok: false, refusal: { code: 'cannot_become_club', error: blocked } };
  }

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

export async function unitAmount(priceId: string): Promise<{ amount: number; currency: string }> {
  const price = await getStripe().prices.retrieve(priceId);
  return { amount: price.unit_amount ?? 0, currency: price.currency };
}

export function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

/** What a move would do, before the owner confirms it. */
export async function previewMove(org: MoveOrg, toPlan: OrgPlan): Promise<MovePreview | MoveRefusal> {
  const checked = await validateMove(org, toPlan);
  if (!checked.ok) return checked.refusal;
  const { direction, live, priceId } = checked;
  try {
    if (direction === 'down') {
      const next = await unitAmount(priceId);
      return {
        direction, toPlan, billingCycle: live.billingCycle,
        effectiveAt: isoFromUnix(live.item.current_period_end),
        nextAmount: next.amount, currency: next.currency,
      };
    }
    const prorationDate = Math.floor(Date.now() / 1000);
    // The price lookup and the invoice preview don't depend on each other.
    const [next, invoice] = await Promise.all([
      unitAmount(priceId),
      getStripe().invoices.createPreview({
        customer: typeof live.sub.customer === 'string' ? live.sub.customer : live.sub.customer.id,
        subscription: live.sub.id,
        subscription_details: {
          items: [{ id: live.item.id, price: priceId }],
          proration_behavior: 'always_invoice',
          proration_date: prorationDate,
        },
      }),
    ]);
    return {
      direction, toPlan, billingCycle: live.billingCycle,
      amountDueToday: invoice.amount_due,
      currency: invoice.currency,
      prorationDate,
      nextAmount: next.amount,
      renewsAt: isoFromUnix(live.item.current_period_end),
      lines: trustedPreviewLines(invoice, { fromPriceId: live.item.price.id, toPriceId: priceId, fromPlan: ownPlanOf(org), toPlan }),
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
 *   · ⚖ D6: a move onto a Club band revokes the Founding Season comp, and
 *   · Stage 4b: a move onto a Club band turns a standalone Coaches Portal into the club, in place (`flipWorkspaceIntoClub`).
 * Idempotent: a second call with the same plans changes nothing. Call it AFTER the plan is written.
 */
export async function applyPlanChangeSideEffects(p: {
  orgId: string;
  fromPlan: OrgPlan | string | null;
  toPlan: OrgPlan | string;
  actor: string;
  keepTeamLimit?: boolean;
  /** The club name the coach typed, for a Coaches Portal becoming the club (Stage 4b Part 2). Absent keeps the organization's name. */
  clubName?: string | null;
}): Promise<{ clearedTeamLimit: boolean; revokedComps: number; workspaceFlip: WorkspaceFlipResult }> {
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
  // 12d-2 (ask 11): a move onto a plan without online payments closes the club's open pay pages on the move date (the
  // webhook's flip for a scheduled down-move, the operator's change). After the comp revoke, so the plan read is final.
  // Loaded here, not at the top: the endings module is server-only, and this one is loaded by unit tests.
  // Never throws: a load that fails outside the app (a script, a test runner) must not undo a plan already written.
  if (p.fromPlan !== p.toPlan) {
    try {
      const { closePagesIfPaymentsEnded } = await import('./online-payment-endings');
      await closePagesIfPaymentsEnded(p.orgId, `plan move (${p.actor})`);
    } catch (e) {
      console.error('[plan-move] couldn’t close the open pay pages:', e instanceof Error ? e.message : String(e));
    }
  }
  // Plan & billing Stage 4b: a standalone Coaches Portal that is now on Club becomes the club, in place (lib/workspace-flip.ts).
  // Asked on EVERY call, not only when `fromPlan` was the portal's: a retried event arrives with the plan already written, and
  // the flip is what finishes the job. An ordinary club answers "not a workspace" without a write. Last, so a database failure
  // here (which throws, and the webhook lets Stripe retry) never leaves the steps above undone.
  const workspaceFlip = await flipWorkspaceIntoClub({ orgId: p.orgId, plan: p.toPlan, actor: p.actor, clubName: p.clubName });
  // A portal that CANCELLED Premium and now buys Club filed its tournaments and account as retained records; the club must get them
  // back, or the retention sweep warns and then purges a paying customer's data. Asked on a retried event too ('already_flipped'):
  // the restore only touches rows still retained, so a repeat is a no-op, and a failure here throws so Stripe retries.
  if (workspaceFlip.status === 'flipped' || workspaceFlip.status === 'already_flipped') {
    await restoreCoachesPortalRetainedRecords(p.orgId, workspaceFlip.workspaceId);
  }
  return { clearedTeamLimit, revokedComps, workspaceFlip };
}

export type MoveResult =
  /** `finishing`: Stripe has moved the subscription (the money is taken) but a database step has not completed — the next billing event finishes it. */
  | { direction: 'up'; toPlan: OrgPlan; movedAt: string; finishing?: true }
  | { direction: 'down'; toPlan: OrgPlan; scheduled: ScheduledMove };

/**
 * Makes the move. For an UP move pass the preview's `prorationDate` so the charge equals it.
 * A Premium coach's portal moving onto Club (Stage 4b) also passes `clubName`: it is REQUIRED there (refused before Stripe is
 * touched), put on the subscription's metadata so a webhook retry can read it back, and handed to the flip.
 */
export async function applyMove(
  org: MoveOrg,
  toPlan: OrgPlan,
  opts: { prorationDate?: number; actor: string; clubName?: string | null },
): Promise<MoveResult | MoveRefusal> {
  let clubName: string | null = null;
  if (ownPlanOf(org) === 'team' && moveDirection('team', toPlan)) {
    const named = parseClubName(opts.clubName);
    if (!named.ok) return { code: 'club_name_invalid', error: named.error };
    clubName = named.name;
  }
  const checked = await validateMove(org, toPlan);
  if (!checked.ok) return checked.refusal;
  const { direction, live, priceId } = checked;
  const stripe = getStripe();
  const baseMetadata = { orgId: org.id, planKey: toPlan, billingCycle: live.billingCycle, [MOVE_METADATA_KEY]: direction };
  const metadata = clubName ? inPlaceMetadata(baseMetadata, clubName) : baseMetadata;

  try {
    if (direction === 'up') {
      // A move UP replaces any down-move waiting at renewal — release it first, or the schedule
      // would take the club back down at the period's end. (The one rule for a subscription's future: this is the customer
      // choosing a new plan, and it never meets a waiting cancel — validateMove refuses every move while one waits.)
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
        // A declined proration charge must leave the subscription exactly as it was. Stripe's default ('allow_incomplete') swaps the
        // price anyway and marks it past due — and a Premium portal would then become the club, for good, on an unpaid subscription.
        payment_behavior: 'error_if_incomplete',
        metadata,
      });

      // The growth half of the Billing events card, written as soon as Stripe has moved: the webhook skips
      // its own upgrade event for this move (it carries our marker), so this is the only record of it and
      // must not wait on the database steps below. Throw-proof, so it can never undo a move Stripe made.
      await writeGrowthEvent({
        source: 'app',
        sourceEventId: `${live.sub.id}:move_up:${toPlan}:${prorationDate}`,
        orgId: org.id,
        previousPlanId: ownPlanOf(org),
        previousStatus: org.subscriptionStatus ?? null,
        previousSubscriptionId: org.stripeSubscriptionId ?? null,
        planId: toPlan,
        status: org.subscriptionStatus ?? null,
        metadata: { stripeSubscriptionId: live.sub.id, billingCycle: live.billingCycle, actor: opts.actor },
      });

      // From here the money has moved, so a database step that throws must not read as "Nothing was changed": the coach would try
      // again, and every try writes another growth event. The move is made; the webhook (it reads the club name from the
      // subscription's metadata, set above) finishes what is left, and `finishing` tells the screen so.
      try {
        // The webhook will write the same plan from the new price; writing it here too means the
        // owner's next screen already shows the new band.
        const { error } = await supabaseAdmin
          .from('organizations')
          .update({ plan_id: toPlan, tournament_limit: PLAN_CONFIG[toPlan].tournamentLimit })
          .eq('id', org.id);
        if (error) throw error;
        const { workspaceFlip } = await applyPlanChangeSideEffects({ orgId: org.id, fromPlan: ownPlanOf(org), toPlan, actor: opts.actor, clubName });
        // A refused flip (the payment not settled yet, or a rare conflict staff are told about) is finished by the next billing event.
        return { direction, toPlan, movedAt: new Date().toISOString(), ...(workspaceFlip.status === 'refused' ? { finishing: true as const } : {}) };
      } catch (afterStripe) {
        console.error('[plan-move] the subscription moved but a database step did not finish; the billing event will:', afterStripe);
        return { direction, toPlan, movedAt: new Date().toISOString(), finishing: true };
      }
    }

    // DOWN — at renewal. One schedule per subscription: reuse the one that exists (ours), or build it. Never while a cancel
    // waits (refused above); Keep {Plan} rebuilds a move the cancel carried through here (lib/plan-ending.ts, G1).
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

/** Keep the current band: cancels a down-move waiting at renewal. True when one was cancelled. A waiting cancel has already
 *  released any schedule (the move it carried lives on its row), so this finds none then and drops nothing. */
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
