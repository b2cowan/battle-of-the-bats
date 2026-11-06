import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getStripe } from '@/lib/stripe';
import { REFUND_WORDS, formatCents, isWholeCents, remainingCents } from '@/lib/console-money';
import { readClubCharge, stripeErrorFacts } from '@/lib/console-money-stripe';
import { READ_OPTS, creditTargetForCharge, planCreditNote } from '@/lib/console-money-credit';
import { clubStripeFacts } from '@/lib/console-money-store';
import { namedTaxLines } from '@/lib/billing-tax';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';

/**
 * The refund window's preview (GST/HST Stage 2 Part 6b, owner R1 2026-11-05): the amount typed, tax included, as the credit
 * note Stripe would make — the card figure (the nearest Stripe can make that is not above what was typed), the before-tax
 * figure and the tax it reverses, named. A charge that paid no invoice answers `note: 'none'` (R3). Reads only: no record, no
 * note, nothing sent; the refund itself plans the note again and refuses when Stripe's answer moved. The same power and the
 * same ownership check as the refund.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const noStore = { 'Cache-Control': 'no-store' };

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string; chargeId: string }> }) => {
  const auth = await requirePlatformPower('refund');
  if (auth.response) return auth.response;
  const { id, chargeId } = await params;
  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown };
  const refuse = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });

  const club = await clubStripeFacts(id);
  if (!club?.customerId || club.customerShared || !/^(ch|py)_[A-Za-z0-9]+$/.test(chargeId)) return refuse(404, REFUND_WORDS.notOurs);
  if (!isWholeCents(body.amountCents)) return refuse(400, REFUND_WORDS.amount);
  const cents = body.amountCents;

  const stripe = getStripe();
  try {
    const live = stripeKeyIsLive();
    const found = await readClubCharge(stripe, chargeId, club, live, null);
    if (!found) return refuse(404, REFUND_WORDS.notOurs);
    const credit = await creditTargetForCharge(stripe, found.paymentIntentId, { customerId: club.customerId, live });
    if (!credit.ok) return refuse(credit.status, credit.error);
    if (!credit.target) return NextResponse.json({ note: 'none', cardCents: cents }, { headers: noStore });
    const left = remainingCents(found.charge);
    if (cents > left) return refuse(409, `Only ${formatCents(left, found.charge.currency)} of this charge can still be refunded.`);
    const plan = await planCreditNote(stripe, credit.target, cents);
    if (!plan.ok) return refuse(plan.status, plan.error);
    const taxLines = await namedTaxLines(plan.taxes, rate => stripe.taxRates.retrieve(rate, {}, READ_OPTS));
    return NextResponse.json({
      note: 'credit_note', cardCents: plan.cardCents, beforeTaxCents: plan.beforeTaxCents, taxLines, capped: plan.capped,
      feeInvoice: credit.target.isFeeInvoice,
    }, { headers: noStore });
  } catch (err) {
    return stripeErrorFacts(err).definite ? refuse(409, REFUND_WORDS.noteNotWorkedOut) : refuse(503, REFUND_WORDS.noteReadFailed);
  }
}, { route: '/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/preview' });
