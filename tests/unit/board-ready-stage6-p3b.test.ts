import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clubInvoiceLayout, creditNoteLayout, invoiceStanding, paymentHow, refundEndsDeal, refundHasNote, refundNoteCancelled, refundedAway, refundLeft, refundTaxPart, refundedTotal,
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
  recordedByName: 'Paid by card', recordedAt: '2027-03-03T14:15:00Z', voided: null, returned: false, card: card(), ...over,
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
    // After the dispute writer (mig 532 gave it a sponsorship arm), a sponsorship's notices are its own, before the team's and league's.
    assert.ok(at("rpc('online_payment_dispute_apply'") < at("if (op.flow === 'sponsorship') { await afterSponsorDispute(org, op, d); return; }"));
    assert.ok(at("if (op.flow === 'sponsorship') { await afterSponsorDispute(org, op, d); return; }") < at('await raiseDisputed(org, op, d);'));
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
    // After the walk (fix 6): the notice is keyed on the REFUND itself, so a second refund that bounces raises its own.
    assert.match(readCode(LANDING), /eventType: 'card_refund_failed', subjectKey: 'sponsorRefundId', subjectId: refundId,/);
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

/**
 * AFTER THE WALK (§564, owner 2026-11-24): migration 531 and the code that answers it. The database half is a text pin, as 530's is;
 * the migration is proved by the dev probe once the owner has it applied.
 */
describe('Part 3b after the walk — migration 531', () => {
  const sql = readCode('supabase/migrations/531_a_sponsor_card_after_the_walk.sql');

  it('a card payment given back in full stops counting toward the invoice: the standing, the card landing and the cheque recording', () => {
    const cheque = pay({ id: 'c1', method: 'cheque', card: null, amount: 500, taxPart: 57.52, receivedOn: '2027-03-04' });
    assert.equal(invoiceStanding(1130, [pay(), cheque]).owing, 0);
    assert.equal(invoiceStanding(1130, [pay({ returned: true }), cheque]).owing, 630);
    assert.equal(invoiceStanding(1130, [pay({ returned: true }), cheque]).paidInFull, false);
    assert.match(sql, /WHERE deal_id = d\.id AND voided_at IS NULL AND returned_at IS NULL;/);          // the card landing's sum
    assert.match(sql, /WHERE deal_id = p_deal AND voided_at IS NULL AND returned_at IS NULL;/);          // the cheque recording's sum
    assert.match(readCode('lib/club-sponsorship-deals-server.ts'), /returned: r\.returned_at != null/);
  });

  it('a deal ends when the refund BOOKS and gives back the last of its money, from refunds that succeeded, not forecast at opening', () => {
    assert.match(sql, /v_full := club_sponsor_card_returned\(p\.id\) >= p\.amount - p\.fee_charged - p\.fee_tax;/);
    assert.match(sql, /v_ends := v_full AND NOT EXISTS \(/);
    assert.match(sql, /o\.id <> p\.id AND o\.voided_at IS NULL AND o\.returned_at IS NULL\);/);
    assert.match(sql, /IF v_ends IS DISTINCT FROM r\.ends_deal THEN UPDATE club_sponsor_deal_refunds SET ends_deal = v_ends/);
  });

  it('a payment given back in full while a cheque stands puts the deal back to Invoiced, and a failed refund undoes it', () => {
    assert.match(sql, /ELSIF v_full AND d\.state = 'paid' THEN/);
    assert.match(sql, /UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL/);
    assert.match(sql, /IF p\.returned_at IS NOT NULL AND club_sponsor_card_returned\(p\.id\) < p\.amount - p\.fee_charged - p\.fee_tax THEN/);
    assert.match(sql, /'dealEnded', v_was = 'succeeded' AND r\.ends_deal AND d\.state = 'withdrawn'/);
  });

  it('every refund on a taxed invoice carries a credit note, even one whose tax rounds to nothing; a failed one keeps its number', () => {
    assert.match(sql, /IF coalesce\(d\.tax_amount, 0\) > 0 THEN\s+v_seq := coalesce\(\(SELECT max\(x\.credit_seq\)/);
    assert.doesNotMatch(sql, /credit_seq = NULL/);
  });

  it('the online payment key is NO ACTION, and a payment that could not be recorded and was given back in full is refunded', () => {
    assert.match(sql, /ADD CONSTRAINT club_sponsor_deal_payments_online_payment_id_fkey FOREIGN KEY \(online_payment_id\) REFERENCES public\.online_payments\(id\);/);
    assert.match(sql, /p_refunded < v_op\.total_amount THEN\s+RETURN jsonb_build_object\('handled', false\)/);
    const landing = readCode(LANDING);
    assert.match(landing, /rpc\('club_sponsor_card_unlanded_refunded', \{ p_online_payment: op\.id, p_refunded: back \}\)/);
    assert.match(landing, /kinds: \['online_payment_not_recorded', 'card_refund_unmatched'\]/);
  });

  it('only an answer Stripe gave fails a refund; anything else stays pending, and the daily job settles the stuck ones', () => {
    const landing = readCode(LANDING);
    assert.match(landing, /\['StripeInvalidRequestError', 'StripeCardError', 'StripePermissionError'\]\.includes/);
    assert.match(landing, /if \(!stripeRefused\(e\)\) return \{ \.\.\.base, state: 'pending'/);
    assert.match(landing, /if \(stripeRefused\(e\)\) \{ await failSponsorRefund\(row\.id, e\);/);
    assert.match(landing, /export async function sweepStuckSponsorRefunds/);
    assert.match(landing, /\.find\(x => x\.metadata\?\.refund_id === row\.id\)/);
  });
});

/** Owner 2026-11-24 (walk §564's credit-note question): a booked refund that then did not reach the card keeps its note, cancelled. */
describe('Part 3b after the walk — a credit note kept and cancelled', () => {
  const bounced = () => refund({ status: 'failed', failedAt: '2027-03-25T09:00:00Z', succeededAt: null, refundedOn: null, booked: true });

  it('the note of a refund that bounced is still drawn, says it is cancelled, keeps its number, and does not reduce the invoice', () => {
    const r = bounced();
    const l = creditNoteLayout(input([pay()], [r]), r);
    assert.equal(l.number, '2027-014-C1');
    assert.equal(l.credit.title, 'Credit note, cancelled');
    assert.ok(l.credit.subtitle.includes('Cancelled Mar 25, 2027'));
    assert.match(l.credit.closing, /^This credit note is cancelled: the \$200\.00 refund did not reach the card, so invoice 2027-014 is not reduced by it/);
    assert.equal(l.credit.stats[2].n, '$1,130.00'); // paid, after refunds: the bounced one takes nothing off
    // /legal 2026-11-24: no line on a cancelled note reads as a tax reduction that stands, and its issue day is the day it was sent.
    assert.deepEqual(l.rows.map(x => x.description), ['Cancelled: Refund of the sponsorship: Division sponsor, U9', 'Cancelled: HST 13% refunded']);
    assert.ok(l.credit.subtitle.includes('Issued Mar 20, 2027'));
    const live = creditNoteLayout(input([pay()], [refund()]), refund());
    assert.equal(live.rows[1].description, 'HST 13% refunded');
  });

  it('only a note that was booked is kept: a refund that failed before it booked never had one', () => {
    // One rule, called by the download, the business's page and the note itself.
    assert.equal(refundHasNote(refund()), true);
    assert.equal(refundHasNote(bounced()), true);
    assert.equal(refundHasNote(refund({ status: 'failed', booked: false })), false);
    assert.equal(refundHasNote(refund({ status: 'pending', creditNumber: '2027-014-C2' })), false);
    assert.equal(refundNoteCancelled(bounced()), true);
    assert.equal(refundNoteCancelled(refund()), false);
    assert.match(readCode('lib/club-sponsor-invoice-pdf.ts'), /!refundHasNote\(refund\)/);
    assert.match(readCode('lib/sponsor-deal-view.ts'), /refundNoteCancelled\(r\) && !!r\.creditNumber/);
    assert.match(readCode('components/public/SponsorDealContent.tsx'), /view\.cancelledNotes\.map\(n => \(/);
  });

  it('the business is told once, only if it was told of the refund, and the notice failing cannot stop the email', () => {
    const email = readCode('lib/sponsor-invoice-email.ts');
    // Claimed on its own stamp (mig 533), released if the send does not go, and only for a refund that was emailed.
    assert.match(email, /\.eq\('status', 'failed'\)\.not\('emailed_at', 'is', null\)\.is\('cancel_emailed_at', null\)/);
    assert.match(email, /if \(result\.status !== 'sent'\) await release\(\);/);
    // Both are done from the failed state on every replay (a crash after the commit, or a failed send, loses nothing).
    assert.match(readCode(LANDING), /try \{ await raiseSponsorRefundFailed\(refundId\); \} finally \{ await emailDealRefundCancelled\(orgId, r\.dealId, refundId\); \}/);
    assert.match(readCode(LANDING), /hasRecentNotification\(r\.org_id as string, 'card_refund_failed', \{ sponsorRefundId: refundId \}/);
    assert.match(readCode(LANDING), /if \(r\?\.wasBooked\) \{/);
  });
});

/** After the walk, fix 8 (mig 532, /accounting 2026-11-24): a sponsor's card dispute is booked; fix 6: the notices say what the club can do. */
describe('Part 3b after the walk — a sponsor’s dispute and its notices', () => {
  const sql = readCode('supabase/migrations/532_a_sponsor_card_dispute_is_booked.sql');
  const landing = readCode(LANDING);

  it('a lost dispute reverses the receipt lines with no credit note, leaves the card fee and the dispute fee, puts the deal back to owing', () => {
    assert.match(sql, /IF p_amount IS NULL OR p_amount < v_op\.total_amount THEN RETURN jsonb_build_object\('already', true, 'partial', true\)/);
    assert.match(sql, /'club_sponsorship', 'sponsorship_deal'[\s\S]*?'gst_hst_collected', 'sponsorship_deal'/);
    assert.doesNotMatch(sql.slice(sql.indexOf('club_sponsor_card_dispute_lost'), sql.indexOf('club_sponsor_card_dispute_won')), /credit_seq|fee_cost_entry_id/);
    assert.match(sql, /UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL/);
    assert.match(sql, /returned_at = coalesce\(returned_at, now\(\)\)/);
  });

  it('a win puts it back beside the loss (nothing deleted) and the deal is Paid again', () => {
    assert.match(sql, /'Dispute won · '/);
    assert.match(sql, /IF v_paid >= d\.total THEN/);
  });

  it('the one dispute writer takes the deal’s lock before the payment’s, and a sponsorship is answered by its own functions', () => {
    const apply = sql.slice(sql.indexOf('online_payment_dispute_apply'));
    assert.ok(apply.indexOf('FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id FOR UPDATE') < apply.indexOf('SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE'));
    assert.match(sql, /club_sponsor_card_dispute_lost\(v_op\.id, p_amount\)/);
    assert.match(sql, /v_rev := club_sponsor_card_dispute_won\(v_op\.id\);/);
  });

  it('a payment whose dispute was lost refuses a refund, and a refund that fails later cannot lift the mark', () => {
    assert.match(sql, /IF p\.dispute_lost_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_disputed'/);
    assert.match(sql, /IF p\.returned_at IS NOT NULL AND p\.dispute_lost_at IS NULL AND club_sponsor_card_returned/);
    assert.match(landing, /msg\.includes\('disputed'\) \? 'disputed' : 'not_card'/);
  });

  it('the notices: a sponsor’s open dispute says answer it and do not refund; a loss says what the books did; a failed refund says what the club can do', () => {
    assert.match(landing, /SPONSOR_DISPUTE_WORDS\.openBody\(amount, disputeDue\(d\.due_by\)\)/);
    assert.match(landing, /d\.lost_booked_at \? SPONSOR_DISPUTE_WORDS\.lostLine\(amount, day\) : SPONSOR_DISPUTE_WORDS\.partialBody\(amount\)/);
    assert.match(readCode('lib/online-payment-words.ts'), /Refund it again from the payment, or send the money another way and record it in the Ledger\./);
    assert.doesNotMatch(readCode('lib/online-payment-words.ts').slice(readCode('lib/online-payment-words.ts').indexOf('export function sponsorRefundFailedNotice')).split('export const SPONSOR_DISPUTE_WORDS')[0], /Send the money another way, then record the refund\./);
  });

  it('what the business is told: no Stripe reference, and the arrival time is not promised', () => {
    // The refund block takes no Stripe code at all now (O-S6, owner 2026-11-24): not on the sponsor email, nor the family's, nor the team's.
    assert.match(readCode('lib/sponsor-invoice-email.ts'), /receiptNo: null, paidOn: payment\.receivedOn,/);
    for (const f of ['lib/sponsor-invoice-email.ts', 'lib/online-refund-email.ts', 'lib/online-payment-receipt.ts']) {
      assert.doesNotMatch(readCode(f), /reference: (refunds\[0\]|\(r\.stripe_refund_id|refund\.stripeRefundId|null)/, f);
    }
    assert.doesNotMatch(readCode('lib/club-sponsorship-deal-words.ts'), /It takes 5 to 10|arrives in 5 to 10/);
    assert.match(DEAL_WORDS.card.reachedSub, /^It can take 5 to 10 business days/);
  });

  it('an unlanded sponsor payment’s early refund reaches Sponsorships too, and is looked at once the payment lands', () => {
    assert.match(landing, /\.\.\.\(await sponsorshipPeople\(org\)\)\]\)\];/);
    assert.match(landing, /if \(!landed\.already\) await reconcileDashboardRefunds\(op\.stripe_account_id, op\.id\)/);
  });
});

/** After the walk, fix 9 (owner 2026-11-24): the smaller items, each pinned. */
describe('Part 3b after the walk — the smaller items', () => {
  const payRoute = readCode('app/api/public/sponsorship/[token]/pay/route.ts');
  const card = readCode('lib/sponsor-card-server.ts');

  it('a sponsor’s card page has its own throttles, one keyed on the link; the poll never re-lands a payment more than once a minute', () => {
    const t = readCode('lib/public-form-throttle.ts');
    assert.match(t, /export function throttleSponsorPay\(req: Request, token: string\)/);
    assert.match(t, /export function throttleSponsorPoll\(req: Request, token: string\)/);
    assert.match(t, /sponsorPayLinkLimiter\.take\(token\.slice\(0, 64\)\)/);
    assert.match(payRoute, /throttleSponsorPay\(req, token\)/);
    assert.match(payRoute, /throttleSponsorPoll\(req, token\)/);
    assert.doesNotMatch(payRoute, /throttlePublicForm/);
    assert.match(payRoute, /Date\.now\(\) - Date\.parse\(op\.updated_at as string\) > RETRY_LANDING_AFTER_MS\) \{\s+await landCheckoutSession/);
  });

  it('a page that completes while it is being closed is "paid", never a failure; a record that cannot be written closes the page', () => {
    assert.match(card, /await expireCheckout\(account, sessionId\)\.catch\(\(\) => undefined\);/);
    assert.match(card, /if \(still\?\.status === 'complete'\) return \{ ok: false, error: C\.errOpen, status: 409, code: 'paid' \};/);
    assert.match(card, /\.then\(r => !!r\.error, \(\) => true\);\s+if \(recordFailed\) \{[\s\S]*?expireCheckout\(p\.facts\.account\.stripeAccountId, session\.id\)\.catch/);
  });

  it('the refund route’s “up to” figure is re-read when the database caps the amount', () => {
    assert.match(readCode('app/api/admin/sponsorships/deals/[dealId]/payments/[paymentId]/refund/route.ts'), /if \(r\.why === 'amount'\) \{[\s\S]*?refundLeft\(freshPayment, fresh!\.refunds\)\.left/);
  });

  it('what can still go back is one rule in two languages: the figures in TypeScript and in SQL agree, to the cent', () => {
    // The SQL: amount less the fee the sponsor paid and its tax, less every refund not failed (mig 530 club_sponsor_card_refund_left).
    const sql = readSource(MIG);
    assert.match(sql, /SELECT p\.amount - p\.fee_charged - p\.fee_tax,/);
    assert.match(sql, /r\.status <> 'failed'\), 0\),/);
    const p = pay();
    const refunds = [refund({ id: 'a', amount: 200, taxPart: 23.01, status: 'succeeded' }), refund({ id: 'b', amount: 100, taxPart: 11.5, status: 'pending' }), refund({ id: 'c', amount: 50, taxPart: 5.75, status: 'failed' })];
    const l = refundLeft(p, refunds);
    assert.deepEqual([l.refundable, l.left], [1130, 830]); // 1130 − 200 − 100: the failed one gave nothing back
    assert.equal(l.taxLeft, 130 - 23.01 - 11.5);
  });

  it('a sponsor’s open page is counted and closed by every ending, as the team’s and the family’s are (the review thought it was not)', () => {
    const pages = readCode('lib/online-pay-pages.ts');
    assert.match(pages, /from\('online_payments'\)\.select\(OPEN_COLS\)\.eq\('org_id', orgId\)\.eq\('status', 'open'\);/); // no flow filter
    assert.match(pages, /select\('id', \{ count: 'exact', head: true \}\)\.eq\('org_id', orgId\)\.eq\('status', 'open'\)/);
  });

  it('a deal a refund ended is one fact: Withdrawn after a refund went through; a deal withdrawn after a lost dispute is not', () => {
    assert.equal(refundedAway({ state: 'withdrawn', refunds: [refund()] }), true);
    assert.equal(refundedAway({ state: 'withdrawn', refunds: [] }), false); // a lost dispute, then Withdraw: nothing was refunded
    assert.equal(refundedAway({ state: 'withdrawn', refunds: [refund({ status: 'failed' })] }), false);
    assert.equal(refundedAway({ state: 'paid', refunds: [refund()] }), false);
  });
});

/** The /review of 2026-11-24: the public page, the paper and the forecast after a payment was given back or lost. */
describe('Part 3b after the walk — the review’s fixes', () => {
  const cheque = () => pay({ id: 'c1', method: 'cheque', card: null, amount: 500, taxPart: 57.52, receivedOn: '2027-03-04' });

  it('a payment given back in full is still on the invoice’s paper, beside its refund; one the bank took back (no refund) is not', () => {
    const given = pay({ returned: true });
    const lost = pay({ returned: true });
    const withRefund = input([given], [refund({ amount: 1130, taxPart: 130, whole: true })]);
    const withoutRefund = input([lost], []);
    assert.equal(clubInvoiceLayout(withRefund).payments.length, 1);
    assert.equal(clubInvoiceLayout(withoutRefund).payments.length, 0);
  });

  it('the forecast of “this ends the deal” treats a payment given back or lost as holding nothing, as the database does', () => {
    const lost = pay({ id: 'a', returned: true });
    const second = pay({ id: 'b', amount: 1130, receivedOn: '2027-04-01' });
    assert.equal(refundEndsDeal([lost, second], [], 'b'), true);
    assert.equal(refundEndsDeal([pay({ id: 'a' }), second], [], 'b'), false);
    assert.equal(refundEndsDeal([cheque(), second], [], 'b'), false);
  });

  it('the sweep fails a refund only on Stripe’s answer to the REQUEST, never on an error from looking; a lost database write is never "failed"', () => {
    const landing = readCode(LANDING);
    const sweep = landing.slice(landing.indexOf('export async function sweepStuckSponsorRefunds'));
    assert.match(sweep, /try \{\s+refund = await refundToCard\(/);
    assert.match(sweep, /\} catch \(e\) \{\s+if \(stripeRefused\(e\)\) \{ await failSponsorRefund\(row\.id, e\); settled\+\+; \} else stillStuck\+\+;\s+continue;/);
    assert.match(sweep, /\} catch \{\s+stillStuck\+\+;/);
    assert.match(landing, /if \(error\) throw new Error\(error\.message\);\s+return message;/);
    assert.match(landing, /p_reason: refund\.failure_reason \?\? refund\.status \}\);\s+if \(error\) throw new Error\(error\.message\);/);
  });

  it('a bounced refund Stripe says failed AGAIN is settled again (the club’s notice and the business’s email finish), and a send that threw releases its stamp', () => {
    assert.match(readCode(LANDING), /if \(r\.status === 'failed' && refund\.status !== 'failed' && refund\.status !== 'canceled'\) continue;/);
    const email = readCode('lib/sponsor-invoice-email.ts');
    assert.equal((email.match(/await release\?\.\(\)\.catch\(\(\) => undefined\);/g) ?? []).length, 2);
    assert.match(DEAL_WORDS.card.emailCancelled('Club', '$10.00', null), /so your invoice is not reduced by it/);
    assert.doesNotMatch(DEAL_WORDS.card.emailCancelled('Club', '$10.00', null), /credit note/);
    assert.match(DEAL_WORDS.card.emailCancelled('Club', '$10.00', '2027-014-C1'), /credit note 2027-014-C1 is cancelled and your invoice/);
  });

  it('a sponsor’s card payment has no global throttle bucket a stranger could drain', () => {
    assert.doesNotMatch(readCode('lib/public-form-throttle.ts'), /sponsorPayGlobalLimiter/);
  });
});

/** The /simplify altitude review (2026-11-24): "holds money" was typed by hand in too many places; migration 533 closes the three that mattered. */
describe('Part 3b after the walk — migration 533, a payment that holds no money', () => {
  const sql = readCode('supabase/migrations/533_a_payment_that_holds_no_money.sql');

  it('Withdraw and Revise ignore a payment that was given back or lost, and the card landing’s paid-on day does too', () => {
    assert.match(sql, /WHERE p\.deal_id = OLD\.id AND p\.voided_at IS NULL AND p\.returned_at IS NULL\) THEN/);
    assert.match(sql, /WHERE deal_id = p_deal AND voided_at IS NULL AND returned_at IS NULL\) THEN/);
    assert.match(sql, /paid_on = \(SELECT max\(received_on\) FROM club_sponsor_deal_payments WHERE deal_id = d\.id AND voided_at IS NULL AND returned_at IS NULL\)/);
  });

  it('the cancelled-credit-note email has its own stamp, writable by the server', () => {
    assert.match(sql, /ADD COLUMN IF NOT EXISTS cancel_emailed_at timestamptz/);
    assert.match(sql, /GRANT UPDATE \(cancel_emailed_at\) ON public\.club_sponsor_deal_refunds TO service_role;/);
  });

  it('the paper lists every payment not voided, but only those that hold money count as paid; a credit note takes a refund off once', () => {
    const cheque = pay({ id: 'c1', method: 'cheque', card: null, amount: 500, taxPart: 57.52, receivedOn: '2027-03-04' });
    const given = pay({ id: 'p9', amount: 630, returned: true });
    const s = invoiceStanding(1130, [given, cheque]);
    assert.deepEqual([s.listed.length, s.live.length, s.paid, s.owing], [2, 1, 500, 630]);
    const r = refund({ paymentId: 'p9', amount: 630, taxPart: 72.48, whole: true, creditNumber: '2027-014-C1' });
    const note = creditNoteLayout(input([given, cheque], [r]), r);
    assert.equal(note.credit.stats[2].n, '$500.00'); // paid $1,130.00 of listed payments, less the $630.00 refund — not less twice
  });

  it('a lost dispute’s notice settles only when the loss was booked; a part dispute’s waits for Done; the reminder email is not sent for a sponsor', () => {
    const na = readCode('lib/needs-attention.ts');
    assert.match(na, /byId\.get\(meta\(r, 'onlineDisputeId'\) \?\? ''\)\?\.lost_booked_at && !out\.has\(r\.id\)/);
    assert.match(readCode(LANDING), /if \(op\.flow === 'sponsorship'\) continue;\s+const who = await disputeWho\(op\);/);
  });
});

/** Migration 534 (owner 2026-11-24, the /review's cases 1 and 2): a dispute won after the sponsor paid again, and a refund booked after a loss. */
describe('Part 3b after the walk — migration 534', () => {
  const sql = readCode('supabase/migrations/534_a_won_dispute_after_paying_again.sql');

  it('a refund that books after the bank took the payment back is booked as cash, but never ends the deal or moves its state', () => {
    assert.match(sql, /v_ends := v_full AND p\.dispute_lost_at IS NULL AND NOT EXISTS \(/);
    assert.match(sql, /ELSIF v_full AND p\.dispute_lost_at IS NULL AND d\.state = 'paid' THEN/);
  });

  it('a won dispute says how much now stands past the invoice, and the dispute row keeps it', () => {
    assert.match(sql, /v_extra := greatest\(0, v_paid - v_refunded - CASE WHEN d\.state = 'withdrawn' THEN 0 ELSE coalesce\(d\.total, 0\) END\);/);
    assert.match(sql, /'extra', v_extra\)/);
    assert.match(sql, /'extra', CASE WHEN v_op\.flow = 'sponsorship' THEN coalesce\(\(v_rev ->> 'extra'\)::numeric, 0\) ELSE 0 END/);
  });

  it('voiding a payment un-pays a deal only when what is left no longer covers the invoice', () => {
    assert.match(sql, /IF d\.state = 'paid' AND \(d\.total IS NULL OR v_left < d\.total\) THEN/);
    assert.match(sql, /ELSIF d\.state = 'paid' THEN\s+UPDATE club_sponsor_deals SET updated_at = now\(\),/);
  });

  it('the club is told once, on a kind of its own subject, and the notice clears when nothing stands past the invoice', () => {
    const landing = readCode(LANDING);
    assert.match(landing, /subjectKey: 'sponsorExtraDisputeId', subjectId: d\.id/);
    assert.match(landing, /d\.won_back_at && extraStanding > 0/);
    const na = readCode('lib/needs-attention.ts');
    assert.match(na, /if \(meta\(r, 'sponsorExtra'\)\) continue;/);
    assert.match(na, /if \(sum\(pays, id\) - sum\(refunds, id\) - asks <= 0\) out\.set\(r\.id, said\(W\.sponsorExtraBack\)\);/);
  });
});

/** Found while writing the after-walk walk: a deal that flips between Paid and owing must take its place on the club's site up or down, as a void does. */
describe('Part 3b after the walk — the place follows the deal', () => {
  const landing = readCode(LANDING);
  it('a lost or won dispute, a refund that puts a deal back to owing, and a refund that bounced all re-sync the place', () => {
    assert.match(landing, /if \(d\.lost_booked_at \|\| d\.won_back_at\) await syncSponsorPlace\(org\.id, dealId\);/);
    assert.match(landing, /if \(b\.endsDeal \|\| b\.owingAgain\) await syncSponsorPlace\(orgId, b\.dealId\);/);
    assert.match(landing, /await syncSponsorPlace\(orgId, r\.dealId\);/);
  });
  it('the payment row says so when the bank took the payment back', () => {
    assert.match(readCode('components/admin/kit/club/sponsorships/DealPaymentWindows.tsx'), /const takenBack = p\.returned && !p\.voided && !mine\.some\(r => r\.status === 'succeeded'\);/);
    assert.equal(DEAL_WORDS.card.chipTakenBack, 'Taken back');
  });
});
