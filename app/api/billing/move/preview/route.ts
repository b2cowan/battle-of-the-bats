import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { previewMove } from '@/lib/plan-move';
import { authorizeMove, parseTargetPlan, refuseIfGated, refusalResponse } from '@/lib/plan-move-route';
import { previewClubCheckout } from '@/lib/workspace-upgrade-preview';
import { normalizeBillingCycle } from '@/lib/plan-config';
import { isPremiumToClub } from '@/lib/workspace-upgrade';

/**
 * POST /api/billing/move/preview — { orgSlug, planKey } → what the move would do, before the owner
 * confirms it (Ask 4, Stage 1b specimen 7).
 *
 *   up   → { direction:'up', amountDueToday, currency, prorationDate, nextAmount, renewsAt, … }
 *          amountDueToday is STRIPE'S preview of the prorated charge — never our arithmetic. Send
 *          `prorationDate` back to POST /api/billing/move so the charge equals this figure.
 *   down → { direction:'down', effectiveAt, nextAmount, … } — takes effect at the next renewal,
 *          no credit.
 *
 *          `lines` (Stage 4b) is Stripe's own breakdown — [{ kind:'charge'|'credit', plan, amount }] — or null when any line
 *          cannot be trusted; charges minus credits = amountDueToday. Null: show the total alone.
 *
 * Refusals (4xx, `{ code, error, … }`): `not_a_move`, `no_live_subscription` (use checkout),
 * `band_too_small` (+ activeTeams, teamLimit — archive first), `payment_failing` (a Premium coach whose last payment failed),
 * `cannot_become_club` (a Premium portal that holds more than one team, or has already moved into another club),
 * `price_missing`, `plan_not_on_sale` (403 while gated), `stripe_error` (502), and for a Premium owner (Stage 4b)
 * `subscription_ending` (the subscription is set to end: keep Premium first).
 *
 * Premium → Club with no live subscription (`no_live_subscription`, 409) also carries `checkout`: a read-only quote of what checkout
 * would charge for the `billingCycle` sent (default monthly) — the trial decision, due today, first charge. Nothing is created in Stripe.
 */
export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown; planKey?: unknown; billingCycle?: unknown };
  const authorized = await authorizeMove(typeof body.orgSlug === 'string' ? body.orgSlug : undefined);
  if (!authorized.ok) return authorized.response;

  const toPlan = parseTargetPlan(body.planKey);
  if (!toPlan) return NextResponse.json({ error: 'Choose a plan to move to.', code: 'not_a_move' }, { status: 400 });
  const gated = await refuseIfGated(toPlan);
  if (gated) return gated;

  const preview = await previewMove(authorized.org, toPlan);
  if ('code' in preview && preview.code === 'no_live_subscription' && isPremiumToClub(authorized.org.planId, toPlan)) {
    const checkout = await previewClubCheckout(authorized.org, toPlan as 'club' | 'club_large', normalizeBillingCycle(body.billingCycle));
    const response = 'code' in checkout ? refusalResponse(checkout) : Response.json({ ...preview, checkout }, { status: 409 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  if ('code' in preview) return refusalResponse(preview);
  return NextResponse.json(preview);
}, { route: '/api/billing/move/preview' });
