import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clubInvoiceLayout, creditNoteLayout, paymentHow, refundEndsDeal, refundLeft, refundTaxPart, refundedTotal,
  type DealPayment, type DealRefund,
} from '../../lib/club-sponsor-invoice.ts';
import { sponsorCardFee } from '../../lib/online-payment-fee.ts';
import type { DealInvoice } from '../../lib/club-sponsorship-deals.ts';
import { bandCollected, countsAsActual, isFeeRefund } from '../../lib/club-money-figures.ts';
import { CLUB_ONLY_ITEM_IDS } from '../../lib/coach-budget-item-tiers.ts';
import { EMAIL_KINDS } from '../../lib/email-kinds.ts';
import { DEAL_WORDS } from '../../lib/club-sponsorship-deal-words.ts';
import { readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 6, PART 3b — A SPONSOR PAYS BY CARD, AND THE CLUB REFUNDS IT (plan BOARD_READY_PLAN.md §5 Stage 6; Part
 * 3's four owner calls 2026-11-23; round 2 tabs 1 and 2; the card-refund drawing, RULED 2026-11-23, all seven as
 * recommended; /accounting 2026-11-23: a refund on a taxed invoice needs a credit note). The drawn deal to the cent:
 * $1,130.00 by card with the club paying the $41.05 fee; $1,176.39 with the sponsor paying it ($41.05 + $5.34 HST), the club
 * receiving $1,135.34 and keeping $1,000.00 after its $135.34 HST; $1,036.50 with no tax. A part refund of $200.00 is
 * $176.99 of the sponsorship and $23.01 HST.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const C = DEAL_WORDS.card;
const MIG = 'supabase/migrations/530_a_sponsor_pays_by_card.sql';
const LANDING = 'lib/online-payment-landing.ts';

const card = (over: Partial<NonNullable<DealPayment['card']>> = {}): NonNullable<DealPayment['card']> => ({
  brand: 'visa', last4: '4242', paidAt: '2027-03-03T14:14:00Z', reference: 'pi_3QbX7rTz', feePaidBy: 'club', fee: 41.05, feeCharged: 0, feeTax: 0, ...over,
});
const pay = (over: Partial<DealPayment> = {}): DealPayment => ({
  id: 'p1', amount: 1130, taxPart: 130, receivedOn: '2027-03-03', method: 'card', reference: null, note: null,
  recordedByName: 'Paid by card', recordedAt: '2027-03-03T14:15:00Z', voided: null, card: card(), ...over,
});
const refund = (over: Partial<DealRefund> = {}): DealRefund => ({
  id: 'r1', paymentId: 'p1', amount: 200, taxPart: 23.01, whole: false, endsDeal: false, reason: 'The banner went up a month late.',
  status: 'succeeded', failureReason: null, refundedOn: '2027-03-20', succeededAt: '2027-03-24T10:40:00Z', failedAt: null,
  createdAt: '2027-03-20T18:05:00Z', createdByName: 'Dana Ruiz', stripeRefundId: 're_3QbX9kLm', emailedAt: '2027-03-20T18:06:00Z', booked: true,
  creditNumber: '2027-014-C1', ...over,
});
const invoice: DealInvoice = { number: '2027-014', issuedOn: '2027-03-03', dueOn: '2027-03-03', taxKind: 'HST', taxRate: 13, tax: 130, total: 1130 };
const input = (payments: DealPayment[], refunds: DealRefund[] = [], inv: DealInvoice = invoice, withdrawnAt: string | null = null) => ({
  club: { name: 'Riverdale Minor Ball', mailingAddress: '200 Park Road\nRiverdale ON K0A 1B0', gstHstNumber: '812345678RT0001', contactName: 'Dana Ruiz', contactEmail: 'sponsors@riverdaleminorball.ca' },
  howToPay: { etransferTo: 'treasurer@riverdaleminorball.ca', chequesPayableTo: null },
  deal: { packageName: 'Division sponsor', placeName: 'U9', bullets: [], endsOn: '2027-08-31', revisedOn: null, withdrawnAt },
  invoice: inv,
  billTo: { name: 'Harbour Dental', contactName: 'Frank Osei', address: null, email: 'frank@harbourdental.ca' },
  payments, refunds,
});

describe('the card fee, to the cent (round 2 tab 1; owner call (3))', () => {
  it('the sponsor pays it: $41.05 + $5.34 HST on $1,130.00 → $1,176.39; the club receives $1,135.34', () => {
    const f = sponsorCardFee(113000, 'sponsor', 13, false);
    assert.equal(f.feeCents, 4105);
    assert.equal(f.feeTaxCents, 534);
    assert.equal(f.totalCents, 117639);
    assert.equal(f.clubReceivesCents, 113534);
    assert.equal(f.baseCents, 113534, 'the fee’s HST is part of what the club keeps to send on, never of the fee');
    assert.equal(f.feePayer, 'family', 'the rail’s word for "the payer pays"');
    // The club keeps $1,000.00 after the $135.34 HST it owes.
    assert.equal(f.clubReceivesCents - (13000 + f.feeTaxCents), 100000);
  });

  it('no tax: $36.50 on $1,000.00, the business pays $1,036.50', () => {
    const f = sponsorCardFee(100000, 'sponsor', null, false);
    assert.equal(f.feeCents, 3650);
    assert.equal(f.feeTaxCents, 0);
    assert.equal(f.totalCents, 103650);
  });

  it('the club pays it (the default): the invoice to the cent; the fee is its Payment processing cost', () => {
    const f = sponsorCardFee(113000, 'club', 13, false);
    assert.equal(f.totalCents, 113000);
    assert.equal(f.feeCents, 4105);
    assert.equal(f.clubReceivesCents, 108895);
  });

  it('an invoice already issued: the club pays the fee whatever the Payouts row says (owner call (3))', () => {
    const f = sponsorCardFee(113000, 'sponsor', 13, true);
    assert.equal(f.totalCents, 113000);
    assert.equal(f.feeTaxCents, 0);
    assert.equal(f.feePayer, 'club');
  });

  it('the button and its note read as drawn', () => {
    assert.equal(C.sendCard(1176.39), 'Send and pay $1,176.39 by card');
    assert.equal(C.sendCheque, 'Send and get my invoice');
    assert.equal(C.feeNote(41.05, 5.34, 'HST'), 'Includes a $41.05 card processing fee and $5.34 HST on it.');
  });
});

describe('refunds to the card (the drawing’s tab 2; never the fee)', () => {
  it('a part refund of $200.00 is $176.99 of the sponsorship and $23.01 HST; $930.00 stays paid', () => {
    const p = pay();
    assert.equal(refundTaxPart(p, [], 200), 23.01);
    assert.deepEqual(refundLeft(p, []), { refundable: 1130, left: 1130, taxLeft: 130 });
    assert.deepEqual(refundLeft(p, [refund()]), { refundable: 1130, left: 930, taxLeft: 106.99 });
  });

  it('the refund that empties the payment takes the tax that is left, so the lines land exactly', () => {
    const p = pay();
    assert.equal(refundTaxPart(p, [refund()], 930), 106.99);
  });

  it('when the sponsor paid the fee, only $1,130.00 can go back (the fee and its HST never do)', () => {
    const p = pay({ amount: 1176.39, taxPart: 135.34, card: card({ feePaidBy: 'sponsor', feeCharged: 41.05, feeTax: 5.34 }) });
    assert.deepEqual(refundLeft(p, []), { refundable: 1130, left: 1130, taxLeft: 130 });
    assert.equal(refundTaxPart(p, [], 1130), 130);
    assert.match(C.refundLeadSponsor(1176.39, '2027-03-03', '2027-014', 1130, 46.39, 1130), /a \$46\.39 processing fee with its tax\. A refund never returns the fee, so up to \$1,130\.00 can go back\./);
  });

  it('a failed refund gave nothing back: it counts for nothing', () => {
    const p = pay();
    assert.equal(refundLeft(p, [refund({ status: 'failed' })]).left, 1130);
    assert.equal(refundedTotal([refund({ status: 'failed' }), refund({ id: 'r2', amount: 50 })]), 50);
  });

  it('all of it ends the deal only when no other payment holds money (a cheque never comes back by card)', () => {
    const p = pay();
    assert.equal(refundEndsDeal([p], [], 'p1'), true);
    const cheque = pay({ id: 'p2', method: 'cheque', reference: '004417', card: null, amount: 100, taxPart: 0 });
    assert.equal(refundEndsDeal([p, cheque], [], 'p1'), false);
    assert.equal(refundEndsDeal([p, { ...cheque, voided: { at: '2027-03-04', byName: 'Dana Ruiz', reason: 'Bounced' } }], [], 'p1'), true);
  });

  it('a card payment names its card; the window’s words', () => {
    assert.equal(paymentHow(pay()), 'Card, Visa •••• 4242');
    assert.equal(C.buttonEnd, 'Refund, end the deal and email');
    assert.equal(C.buttonAll(200), 'Refund $200.00 and email');
    assert.equal(C.chipFailed, 'Refund didn’t reach the card', 'the ONE wording');
  });
});

describe('the invoice and the credit note (ask 7; /accounting 2026-11-23)', () => {
  it('a fee the sponsor paid is its own row; the tax row carries its HST', () => {
    const inv: DealInvoice = { ...invoice, tax: 135.34, total: 1176.39, cardFee: 41.05, cardFeeTax: 5.34 };
    const l = clubInvoiceLayout(input([pay({ amount: 1176.39, taxPart: 135.34 })], [], inv));
    assert.deepEqual(l.rows.map(r => [r.description.split(' · ')[0], r.amount]), [
      ['Sponsorship: Division sponsor, U9', '$1,000.00'], ['Processing fee', '$41.05'], ['HST 13%', '$135.34'],
    ]);
    assert.equal(l.paidInFull, true);
  });

  it('the invoice lists the refund; refunded in full and withdrawn, it says Withdrawn and owes nothing', () => {
    const part = clubInvoiceLayout(input([pay()], [refund()]));
    assert.deepEqual(part.refunds, [['Mar 20, 2027', 'To Visa •••• 4242', '−$200.00']]);
    assert.equal(part.paidInFull, true);
    const whole = clubInvoiceLayout(input([pay()], [refund({ amount: 1130, taxPart: 130, whole: true, endsDeal: true })], invoice, '2027-03-20T18:05:00Z'));
    assert.ok(whole.withdrawnLabel, 'Withdrawn leads the subtitle');
    assert.equal(whole.paidInFull, false);
    assert.equal(whole.balance, '$0.00');
  });

  it('the credit note carries what the Memo prescribes: its title and number, the club’s GST/HST number, the business, the day, the tax and its rate', () => {
    const r = refund();
    const l = creditNoteLayout(input([pay()], [r]), r);
    assert.equal(l.credit.title, 'Credit note');
    assert.equal(l.number, '2027-014-C1');
    assert.deepEqual(l.credit.subtitle, ['No. 2027-014-C1', 'Issued Mar 20, 2027', 'For invoice 2027-014, issued Mar 3, 2027']);
    assert.equal(l.taxNumberLine, 'GST/HST no. 81234 5678 RT0001');
    assert.equal(l.billTo.name, 'Harbour Dental');
    assert.deepEqual(l.rows.map(x => [x.description, x.amount]), [
      ['Refund of the sponsorship: Division sponsor, U9', '$176.99'], ['HST 13% refunded', '$23.01'],
    ]);
    assert.deepEqual(l.credit.stats.map(x => x.n), ['$200.00', '$23.01', '$930.00']);
    assert.deepEqual(l.payments, []);
  });
});

describe('the books (the drawing’s tab 4)', () => {
  const line = (over: Record<string, unknown>) => ({ amount: 0, entryType: 'income' as const, status: 'posted' as const, bookKind: 'org', category: null as string | null, budgetItemId: null as string | null, sourceModule: 'sponsorship_deal', ...over });
  it('a refund’s sponsorship line nets Club sponsorship, never spending; its tax line counts nowhere', () => {
    const lines = [
      line({ amount: 1000, category: 'club_sponsorship', budgetItemId: '5b0d0528-0528-4c1b-8a50-7ea0507c0001' }),
      line({ amount: 176.99, entryType: 'expense', category: 'club_sponsorship', budgetItemId: '5b0d0528-0528-4c1b-8a50-7ea0507c0001' }),
      line({ amount: 23.01, entryType: 'expense', category: 'gst_hst_collected' }),
    ];
    assert.equal(isFeeRefund(lines[1]), true);
    assert.equal(countsAsActual(lines[2]), false);
    assert.equal(bandCollected(lines as never), 823.01);
  });

  it('the fee’s cost line is spending, and its word is club-only', () => {
    assert.equal(isFeeRefund({ entryType: 'expense', sourceModule: 'sponsorship_deal', category: null }), false);
    assert.ok(CLUB_ONLY_ITEM_IDS.includes('5b0d0530-0530-4c1b-8a50-7ea0507c0001'));
  });

  it('the refund email is its own kind (a transaction’s message, not an offer)', () => {
    assert.ok('club_sponsorship_refund' in EMAIL_KINDS);
  });
});

describe('the rail: a third flow, answered before every tournament-only path (kickoff: "a new flow changes each")', () => {
  const code = readCode(LANDING);
  it('the landing answers a sponsorship before the team landing, the dispute writer and the refund recorders', () => {
    const at = (needle: string) => { const i = code.indexOf(needle); assert.ok(i > 0, `missing: ${needle}`); return i; };
    assert.ok(at("if (op.flow === 'sponsorship') return landSponsorship(") < at("supabaseAdmin.rpc('online_payment_land', {"));
    assert.ok(at("if (op.flow === 'sponsorship') {\n    console.warn('[online-payment-landing] a sponsor disputed") < at("rpc('online_payment_dispute_apply'"));
    assert.ok(at("if (op.flow === 'sponsorship') { await applySponsorRefundEvent(op, refund); return; }") < at('else await recordTeamDashboardRefund(op, refund);'));
    assert.ok(at("if (op.landed_at && op.flow === 'sponsorship') { await afterSponsorLanding(op.id); return 'already'; }") < at('else await raiseOverpaid(op.id);'));
  });

  it('the migration: the flow, its shape and its guard arm; a card payment never voided; the fee never refunded', () => {
    const sql = readSource(MIG);
    assert.match(sql, /CHECK \(flow IN \('tournament_team', 'league_signup', 'sponsorship'\)\)/);
    assert.match(sql, /OR \(NEW\.flow = 'sponsorship' AND NEW\.sponsor_deal_id IS NULL\)/);
    assert.match(sql, /club_sponsor_card_payment_refund_only/);
    assert.match(sql, /p\.amount - p\.fee_charged - p\.fee_tax/, 'what can go back leaves out the fee and its tax');
    assert.match(sql, /IF v_op\.flow = 'sponsorship' THEN\s+-- ▶ 530\s+RETURN club_sponsor_cost_out/, 'Stripe’s extra on a sponsorship goes to the club’s book');
    for (const fn of ['club_sponsor_card_land', 'club_sponsor_card_refund_open', 'club_sponsor_card_refund_book', 'club_sponsor_card_refund_failed', 'club_sponsor_deal_issue']) {
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;\\s*GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role;`), `${fn}: service role only`);
    }
  });

  it('every sponsorship door reads the launch switch (absent, not broken, while it is off)', () => {
    assert.match(readCode('lib/sponsor-card-server.ts'), /if \(!onlinePaymentsOn\(\)\) return null;/);
    assert.match(readCode('app/api/public/sponsorship/[token]/pay/route.ts'), /if \(!onlinePaymentsOn\(\)\) return NextResponse\.json/);
    assert.match(readCode('app/api/admin/sponsorships/deals/[dealId]/payments/[paymentId]/refund/route.ts'), /if \(!onlinePaymentsOn\(\)\) return refused/);
  });
});

describe('/review 2026-11-23 — the rail’s edges', () => {
  it('a card page opened to issue the invoice is never handed to "Pay by card" on an invoice that went out another way', () => {
    const code = readCode('lib/sponsor-card-server.ts');
    assert.match(code, /const samePurpose = issues !== null && \(data\.sponsor_invoice != null\) === issues;/);
    assert.match(code, /if \(totalCents != null && samePurpose && session\.status === 'open'/);
    assert.match(code, /openPageFor\(p\.dealId, p\.fee\.totalCents, issues\)/);
  });

  it('withdrawing a deal closes its open card page first, as Send the invoice does', () => {
    const code = readCode('app/api/admin/sponsorships/deals/[dealId]/withdraw/route.ts');
    assert.ok(code.indexOf('closeSponsorCheckout(dealId)') > 0 && code.indexOf('closeSponsorCheckout(dealId)') < code.indexOf('withdrawDeal(org.id'));
  });

  it('no refund while the sponsor’s bank disputes the charge: Stripe is asked, and a failed read refuses', () => {
    const land = readCode(LANDING);
    const at = (needle: string) => { const i = land.indexOf(needle); assert.ok(i > 0, `missing: ${needle}`); return i; };
    assert.ok(at('refundBlockedByDispute(await listDisputes(') < at("rpc('club_sponsor_card_refund_open'"), 'asked before the refund is opened');
    assert.match(readCode('app/api/admin/sponsorships/deals/[dealId]/payments/[paymentId]/refund/route.ts'), /r\.why === 'disputed'\) return refused\(C\.errDisputed, 409, 'disputed'\)/);
  });

  it('a sponsor refund that came back waits on ITS refund, and clears when a later refund gave that much back', () => {
    assert.match(readCode(LANDING), /extra: \{ sponsorRefundId: refundId \}/);
    const na = readCode('lib/needs-attention.ts');
    assert.match(na, /const sponsorRefundId = meta\(r, 'sponsorRefundId'\);/);
    assert.match(na, /g\.created_at > failed\.created_at && Number\(g\.amount\) >= Number\(failed\.amount\)/);
  });

  it('a replay of a succeeded refund event finishes the place sync and the email (booking answers "already")', () => {
    const code = readCode(LANDING);
    assert.doesNotMatch(code, /r\.status === 'succeeded' && refund\.status === 'succeeded'\)\) continue;/);
    assert.match(code, /if \(r\.status === 'succeeded' && refund\.status !== 'succeeded' && refund\.status !== 'failed' && refund\.status !== 'canceled'\) continue;/);
  });

  it('the invoice both issuing doors hand the database is built once', () => {
    assert.match(readCode('app/api/public/sponsorship/[token]/route.ts'), /\.\.\.invoiceArg\(fig, issuedOn, settings\.paymentDueDays\)/);
    assert.match(readCode('app/api/admin/sponsorships/deals/[dealId]/send-invoice/route.ts'), /p_invoice: invoiceArg\(fig, issuedOn, settings\.paymentDueDays\)/);
  });
});

/** Review 2026-11-24: nothing may change a deal's invoice or terms while a card page can still be paid at the old figures. */
describe('Part 3b review — an open card page is closed before the invoice or the terms change', () => {
  it('the business choosing cheque or e-transfer closes the card page BEFORE the invoice is issued', () => {
    const route = readCode('app/api/public/sponsorship/[token]/route.ts');
    const close = route.indexOf('closeSponsorCheckout(deal.id)');
    const issue = route.indexOf("rpc('club_sponsor_deal_receive'");
    assert.ok(close > 0 && issue > 0 && close < issue, 'the close comes first');
    assert.match(route, /if \(closed === 'paid'\) return NextResponse\.json\(\{ error: DEAL_WORDS\.card\.errReceived/);
  });

  it('a club edit of the amount or tax closes the card page first, and refuses while it is being paid', () => {
    const route = readCode('app/api/admin/sponsorships/deals/[dealId]/route.ts');
    const close = route.indexOf('closeSponsorCheckout(dealId)');
    const change = route.indexOf('changeDealTerms(org.id');
    assert.ok(close > 0 && change > 0 && close < change, 'the close comes first');
    assert.match(route, /closed !== 'closed'\) return refused\(DEAL_WORDS\.card\.errCardPaying, 409/);
  });

  it('a failed refund tells the club the truth: only one that booked has voided lines', () => {
    assert.match(readCode('components/admin/kit/club/sponsorships/DealPaymentWindows.tsx'), /r\.booked \? C\.whatFailed\([^)]*\)[^:]*: C\.failedBody/);
    assert.match(readCode('lib/club-sponsorship-deals-server.ts'), /booked: r\.income_entry_id != null/);
  });
});
