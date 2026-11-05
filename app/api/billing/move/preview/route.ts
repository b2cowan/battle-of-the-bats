import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { previewMove, type QuotePlace } from '@/lib/plan-move';
import { authorizeMove, parseTargetPlan, refuseIfGated, refusalResponse } from '@/lib/plan-move-route';
import { previewClubCheckout } from '@/lib/workspace-upgrade-preview';
import { normalizeBillingCycle } from '@/lib/plan-config';
import { isPremiumToClub } from '@/lib/workspace-upgrade';
import { moveDirection } from '@/lib/plan-move-options';
import { ownPlanOf } from '@/lib/entitlement-grants';
import { billingAddressFromBody, requireBillingLocation, usSalesOpen } from '@/lib/billing-location-server';
import { checkBillingLocation, toStripeAddress } from '@/lib/billing-location';

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
 *
 * GST/HST Stage 2 Part 3: every figure to pay carries `tax` (lib/billing-tax.ts `QuoteTax`), and `amountDueToday` includes it.
 *   · A move up on a club's own subscription is quoted by the address on file, and asks for one first: no address answers
 *     `billing_address_required` (409), and the window offers the Billing address window.
 *   · "Start your club" sends the club's `billingAddress` as typed. A complete one is quoted for (never saved here: it is saved
 *     with the purchase); an incomplete or missing one answers `tax: { status: 'needs_address' }` and the figures wait.
 */
export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown; planKey?: unknown; billingCycle?: unknown; billingAddress?: unknown };
  const authorized = await authorizeMove(typeof body.orgSlug === 'string' ? body.orgSlug : undefined);
  if (!authorized.ok) return authorized.response;

  const toPlan = parseTargetPlan(body.planKey);
  if (!toPlan) return NextResponse.json({ error: 'Choose a plan to move to.', code: 'not_a_move' }, { status: 400 });
  const gated = await refuseIfGated(toPlan);
  if (gated) return gated;

  const { org } = authorized;
  const inPlace = isPremiumToClub(org.planId, toPlan);
  let place: QuotePlace = { kind: 'customer' };
  if (inPlace) {
    const typed = checkBillingLocation(billingAddressFromBody(body.billingAddress) ?? {}, { usSalesOpen: usSalesOpen() });
    place = typed.ok ? { kind: 'typed', address: toStripeAddress(typed.value) } : { kind: 'wait' };
  } else if (moveDirection(ownPlanOf(org), toPlan) === 'up') {
    const located = await requireBillingLocation({ kind: 'org', orgId: org.id, name: org.name, stripeCustomerId: org.stripeCustomerId ?? null });
    if (!located.ok) return located.response;
  }

  const preview = await previewMove(org, toPlan, place);
  if ('code' in preview && preview.code === 'no_live_subscription' && inPlace) {
    const checkout = await previewClubCheckout(org, toPlan as 'club' | 'club_large', normalizeBillingCycle(body.billingCycle), place);
    const response = 'code' in checkout ? refusalResponse(checkout) : Response.json({ ...preview, checkout }, { status: 409 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  if ('code' in preview) return refusalResponse(preview);
  return NextResponse.json(preview);
}, { route: '/api/billing/move/preview' });
