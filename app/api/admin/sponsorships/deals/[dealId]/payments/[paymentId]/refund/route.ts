import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readDeal } from '@/lib/club-sponsorship-deals-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { refundLeft } from '@/lib/club-sponsor-invoice';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { refundSponsorCard } from '@/lib/online-payment-landing';
import { parsePrice } from '@/lib/club-sponsorships';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * REFUND A SPONSOR'S CARD PAYMENT (Board Ready Stage 6 Part 3b; the card-refund drawing's tab 2, RULED 2026-11-23). Body:
 * { all: true, reason } — all of what is left — or { amount, reason } — part of it. A reason either way (the business reads
 * it in the refund email). Never the processing fee (mig 530 caps the refund at the payment less the fee the sponsor paid).
 * Who: whoever records and voids (Sponsorships; ask 5, walk §562's ruling). Reads the launch switch like every refund door.
 * Answers 200 { state: 'succeeded' | 'pending' | 'failed', amount, endsDeal, emailedTo, message? }; 400/409 with the words.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string; paymentId: string }> };
const C = DEAL_WORDS.card;

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  if (!onlinePaymentsOn()) return refused(C.errRefundOff, 409, 'switch_off');
  const { org } = gate.ctx;
  const { dealId, paymentId } = await params;
  const deal = isUuid(dealId) && isUuid(paymentId) ? await readDeal(org.id, dealId) : null;
  const payment = deal?.payments.find(p => p.id === paymentId);
  if (!deal || !payment?.card || payment.voided) return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  const { left } = refundLeft(payment, deal.refunds);
  if (left <= 0) return refused(C.errNothingLeft, 409, 'nothing_left');

  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '';
  if (!reason) return refused(C.errReason, 400, 'reason');
  let amount: number | null = null;
  if (b.all !== true) {
    amount = parsePrice(b.amount);
    if (amount == null || amount <= 0 || Math.round(amount * 100) > Math.round(left * 100)) return refused(C.errAmount(left), 400, 'amount');
  }
  const by = await actorOf(gate.ctx);
  let r: Awaited<ReturnType<typeof refundSponsorCard>>;
  try {
    r = await refundSponsorCard({ orgId: org.id, paymentId, amount, reason, actorId: by.userId, actorName: by.name });
  } catch (e) {
    console.error('[sponsorships] a card refund could not be opened:', paymentId, e instanceof Error ? e.message : String(e));
    return refused(DEAL_WORDS.page.errFailed, 500, 'failed');
  }
  if (!r.ok) {
    if (r.why === 'nothing_left') return refused(C.errNothingLeft, 409, 'nothing_left');
    if (r.why === 'reason') return refused(C.errReason, 400, 'reason');
    if (r.why === 'amount') return refused(C.errAmount(left), 400, 'amount');
    if (r.why === 'disputed') return refused(C.errDisputed, 409, 'disputed');
    return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ state: r.state, amount: r.amount, endsDeal: r.endsDeal, emailedTo: r.emailedTo, ...(r.message ? { message: r.message } : {}) });
}, { route: '/api/admin/sponsorships/deals/[dealId]/payments/[paymentId]/refund' });
