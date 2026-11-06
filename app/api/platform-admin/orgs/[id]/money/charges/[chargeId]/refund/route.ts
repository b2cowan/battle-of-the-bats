import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getStripe } from '@/lib/stripe';
import { isDemoOrgId } from '@/lib/demo-org-server';
import { staffBelongsToClub } from '@/lib/staff-own-club';
import { consoleClock } from '@/lib/console-dates';
import { REFUND_WORDS } from '@/lib/console-money';
import { makeRefund, readClubCharge } from '@/lib/console-money-stripe';
import { creditTargetForCharge } from '@/lib/console-money-credit';
import { clubStripeFacts, refundStore } from '@/lib/console-money-store';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';

/**
 * Refund a club's subscription charge (Support console Stage 3, owner Q1–Q3 2026-10-26; drawings C, G, H). A money write,
 * in this order:
 *   1. the refund power (Super admin, Billing), checked before ANYTHING is read;
 *   2. every refusal, each a fixed sentence and zero writes: the charge must be exactly this club's (customer not empty,
 *      not shared, same mode); the wider "your own club"; a demo club; not paid, disputed, fully refunded; the amount
 *      whole cents, above zero, within Stripe's remainder, and the remainder the person saw; Billing's 6 months and
 *      sixth-in-24-hours; the reason (required, under 500, no card number);
 *   3–5. `makeRefund`: our record as started (or stop), one Stripe call keyed by it, the record completed, the audit entry.
 * The one call is a CREDIT NOTE when the charge paid an invoice (GST/HST Part 6b, owner R1–R3 2026-11-05): the invoice is
 * learned here, before anything is written, and the note is planned again inside `makeRefund` against the figures the window
 * previewed (the card figure and the before-tax figure). A charge that paid no invoice keeps the bare refund (R3).
 * The browser sends a charge (the address), an amount, the remainder it saw, a reason and whether the tab flagged the
 * charge as charged twice (it only chooses Stripe's reason between duplicate and requested-by-customer). The club is the
 * address's `[id]`, never the body. Only the original card can receive it: Stripe refunds nowhere else.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = { amountCents?: unknown; beforeTaxCents?: unknown; remainingSeenCents?: unknown; reason?: unknown; duplicate?: unknown };

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string; chargeId: string }> }) => {
  const auth = await requirePlatformPower('refund');
  if (auth.response) return auth.response;
  const { id, chargeId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const refuse = (status: number, error: string, field?: string) => NextResponse.json({ error, field, nothingSent: true }, { status });

  const club = await clubStripeFacts(id);
  if (!club?.customerId || club.customerShared || !/^(ch|py)_[A-Za-z0-9]+$/.test(chargeId)) return refuse(404, REFUND_WORDS.notOurs);

  const stripe = getStripe();
  const live = stripeKeyIsLive();
  // The charge with its customer (the email the own-club check compares) and its payment; the money tab's invoice words are not needed.
  let found;
  try {
    found = await readClubCharge(stripe, chargeId, club, live, null);
  } catch {
    return refuse(503, REFUND_WORDS.readFailed);
  }
  if (!found) return refuse(404, REFUND_WORDS.notOurs);
  const { charge, customerEmail, paymentIntentId } = found;
  // Which invoice the charge paid: none → a bare refund (R3); one → a credit note; more → refused, nothing sent.
  let credit;
  try {
    credit = await creditTargetForCharge(stripe, paymentIntentId, { customerId: club.customerId, live });
  } catch {
    return refuse(503, REFUND_WORDS.readFailed);
  }
  if (!credit.ok) return refuse(credit.status, credit.error);

  const [ownClub, demoClub] = await Promise.all([
    staffBelongsToClub(id, { id: auth.user.id, email: auth.user.email ?? '' }, { stripeCustomerEmail: customerEmail }),
    isDemoOrgId(id),
  ]);

  let outcome;
  try {
    outcome = await makeRefund(stripe, refundStore, {
      orgId: id,
      club,
      actor: { email: auth.user.email ?? '', role: auth.role },
      ownClub,
      demoClub,
      charge,
      invoice: credit.target,
      ask: { amountCents: body.amountCents, beforeTaxCents: body.beforeTaxCents, remainingSeenCents: body.remainingSeenCents, reason: body.reason },
      flaggedDuplicate: body.duplicate === true,
      live,
      now: new Date(),
      clock: consoleClock,
    });
  } catch {
    // A read of our own record failed before anything was written or sent.
    return refuse(500, REFUND_WORDS.recordFailed);
  }

  if (outcome.ok) return NextResponse.json({ ok: true, message: outcome.message, stripeRefundId: outcome.stripeRefundId, stripeCreditNoteId: outcome.stripeCreditNoteId });
  return NextResponse.json({ error: outcome.error, field: 'field' in outcome ? outcome.field : undefined, nothingSent: outcome.nothingSent }, { status: outcome.status });
}, { route: '/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund' });
