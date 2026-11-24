import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readDealPayments, voidDealPayment } from '@/lib/club-sponsorship-deals-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';

/**
 * VOID A PAYMENT (Board Ready Stage 6 Part 3a; round 1 tab 7: "A wrong payment is voided from the deal, which leaves the
 * line marked void with its reason, as bills and requests already do"). Body: { reason }. Its General-ledger lines are
 * marked void (mig 528 `club_sponsor_deal_payment_void`), and a paid deal is owing again (its logo comes down unless the
 * logo line is ticked). The payment stays on record, voided.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string; paymentId: string }> };
const D = DEAL_WORDS.deal;

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId, paymentId } = await params;
  const notFound = () => NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (!isUuid(dealId) || !isUuid(paymentId)) return notFound();
  // The payment must be this deal's (the URL names both; the database checks the club).
  const payment = (await readDealPayments(org.id, dealId)).find(p => p.id === paymentId);
  if (!payment) return notFound();
  if (payment.voided) return refused(D.errAlreadyVoid, 409, 'already_void');
  // A card payment is never voided (mig 530): it is refunded. The window shows Refund for it; this answers a hand-made call plainly.
  if (payment.card) return refused(DEAL_WORDS.card.errVoidCard, 409, 'card_payment');
  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (!reason || reason.length > 300) return refused(D.errReason);
  const r = await voidDealPayment(org.id, paymentId, await actorOf(gate.ctx), reason);
  if (!r.ok) {
    if (r.why === 'year_closed') return refused(D.errYearClosedVoid, 409, 'year_closed');
    if (r.why === 'refused') return refused(D.errReason);
    return refused(D.errAlreadyVoid, 409, 'already_void');
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/deals/[dealId]/payments/[paymentId]/void' });
