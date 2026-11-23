import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readDeal, recordDealPayment } from '@/lib/club-sponsorship-deals-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { canRecordPayment } from '@/lib/club-sponsorship-deals';
import { isClubMoneyMethod } from '@/lib/club-money-words';
import { parsePrice } from '@/lib/club-sponsorships';
import { emailDealInvoice } from '@/lib/sponsor-invoice-email';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';

/**
 * RECORD A PAYMENT (Board Ready Stage 6 Part 3a; round 1 tab 7: "the ledger's Add an entry, cut down to what a deal
 * needs"). Body: { amount, receivedOn, method, reference?, note? }. A part payment is allowed and leaves the rest owing; the
 * amount can't pass what is owing. In one transaction (mig 528 `club_sponsor_deal_pay`): the sponsorship line under
 * Sponsorship › Club sponsorship and the tax under GST/HST collected on the club's General ledger, the payment, and Paid
 * when nothing is left — then the logo goes up (ask 5) and the "Paid in full" receipt is emailed (the paid invoice, ask 10).
 * Answers 200 { state, receipt: 'emailed' | 'not_emailed' | null }.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ dealId: string }> };
const D = DEAL_WORDS.deal;

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { dealId } = await params;
  const deal = isUuid(dealId) ? await readDeal(org.id, dealId) : null;
  if (!deal) return NextResponse.json({ error: SPONSORSHIPS_WORDS.say.notFound, code: 'not_found' }, { status: 404 });
  if (!canRecordPayment(deal) || !deal.invoice) return refused(D.errNotOwing, 409, 'not_owing');
  const owing = Math.round((deal.invoice.total - deal.paidAmount) * 100) / 100;

  const b = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const amount = parsePrice(b.amount);
  if (amount == null || amount <= 0 || amount > owing) return refused(D.errRecordAmount(owing), 400, 'amount');
  const today = tournamentToday();
  const receivedOn = typeof b.receivedOn === 'string' ? b.receivedOn.trim() : '';
  if (!isCalendarDate(receivedOn) || receivedOn > today) return refused(D.errRecordDate, 400, 'receivedOn');
  const method = b.method;
  if (!isClubMoneyMethod(method)) return refused(D.errRecordHow, 400, 'method');
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

  const r = await recordDealPayment(org.id, dealId, await actorOf(gate.ctx), {
    amount, receivedOn, method, reference: text(b.reference, 60), note: text(b.note, 300),
  });
  if (!r.ok) {
    if (r.why === 'year_closed') return refused(D.errYearClosed, 409, 'year_closed');
    if (r.why === 'refused') return refused(D.errRecordAmount(owing), 400, 'amount');
    return refused(D.errNotOwing, 409, 'not_owing');
  }
  let receipt: 'emailed' | 'not_emailed' | null = null;
  if (r.state === 'paid') receipt = (await emailDealInvoice(org.id, org.slug, dealId, 'paid')) ? 'emailed' : 'not_emailed';
  return NextResponse.json({ state: r.state, receipt });
}, { route: '/api/admin/sponsorships/deals/[dealId]/payments' });
