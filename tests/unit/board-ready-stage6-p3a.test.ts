import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clubInvoiceLayout, invoiceFilename, invoiceStanding, paymentHow, periodLabel, type DealPayment } from '../../lib/club-sponsor-invoice.ts';
import { canRecordPayment, canRevise, canWithdraw, dealFigures, type DealInvoice } from '../../lib/club-sponsorship-deals.ts';
import { countsAsActual, bandCollected, otherBooksMovement } from '../../lib/club-money-figures.ts';
import { fileLine, GST_HST_COLLECTED_ID, SOURCE_MODULE } from '../../lib/club-ledger.ts';
import { CLUB_ONLY_ITEM_IDS, itemVisibleToTeam } from '../../lib/coach-budget-item-tiers.ts';
import { EMAIL_KINDS } from '../../lib/email-kinds.ts';
import { DEAL_WORDS as W } from '../../lib/club-sponsorship-deal-words.ts';
import { DEFAULT_PDF_SETTINGS } from '../../lib/export/pdf.ts';
import { readCode, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 6, PART 3a — THE INVOICE, RECORDING A PAYMENT AND THE BOOKS (owner calls 2026-11-23, plan
 * BOARD_READY_PLAN.md §5 Stage 6; round 1 tabs 6 and 7, round 2 tab 2). The drawn deal to the cent: $1,000 + HST 13% →
 * $1,130.00 by cheque; $1,000.00 with no tax. (The card's figures — $1,176.39, $1,135.34 — are Part 3b's.)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const CLUB_SPONSORSHIP_ITEM = '5b0d0528-0528-4c1b-8a50-7ea0507c0001';

const taxedInvoice: DealInvoice = { number: '2027-014', issuedOn: '2027-03-03', dueOn: '2027-04-02', taxKind: 'HST', taxRate: 13, tax: 130, total: 1130 };
const untaxedInvoice: DealInvoice = { number: '2027-015', issuedOn: '2027-03-03', dueOn: '2027-04-02', taxKind: null, taxRate: null, tax: 0, total: 1000 };
const pay = (over: Partial<DealPayment> = {}): DealPayment => ({
  id: 'p1', amount: 1130, taxPart: 130, receivedOn: '2027-03-18', method: 'cheque', reference: '004417', note: null,
  recordedByName: 'Dana Ruiz', voided: null, ...over,
});
const input = (invoice: DealInvoice, payments: DealPayment[] = []) => ({
  club: { name: 'Riverdale Minor Ball', mailingAddress: '200 Park Road\nRiverdale ON K0A 1B0', gstHstNumber: '812345678RT0001', contactName: 'Dana Ruiz', contactEmail: 'sponsors@riverdaleminorball.ca' },
  howToPay: { etransferTo: 'treasurer@riverdaleminorball.ca', chequesPayableTo: null },
  deal: { packageName: 'Division sponsor', placeName: 'U9', bullets: ['Your logo on the U9 division’s pages on our website', 'A field banner at Riverdale Park'], endsOn: '2027-08-31', revisedOn: null },
  invoice,
  billTo: { name: 'Harbour Dental', contactName: 'Frank Osei', address: '41 Harbour Street, Riverdale ON K0A 1C2', email: 'frank@harbourdental.ca' },
  payments,
});

describe('the invoice, to the drawing (round 1 tab 6, round 2 tab 2: the coach recipe)', () => {
  it('the drawn deal: $1,000 + HST 13% is $1,130.00, the sponsorship and the HST each a row, the number at the top', () => {
    const fig = dealFigures({ amount: 1000, chargeTax: true, registered: true, province: 'ON', on: '2027-03-03' });
    assert.equal(fig.total, 1130);
    assert.equal(fig.tax, 130);
    const l = clubInvoiceLayout(input(taxedInvoice));
    assert.deepEqual(l.rows.map(r => [r.description, r.amount]), [
      ['Sponsorship: Division sponsor, U9 · Mar 3 to Aug 31, 2027', '$1,000.00'],
      ['HST 13%', '$130.00'],
    ]);
    assert.deepEqual(l.rows[0].sub, input(taxedInvoice).deal.bullets, 'the deliverables are listed under the line');
    assert.equal(l.invoiced, '$1,130.00');
    assert.equal(l.balance, '$1,130.00');
    assert.equal(l.taxNumberLine, 'GST/HST no. 81234 5678 RT0001');
    assert.equal(l.paidInFull, false);
  });

  it('no tax: one row, $1,000.00, no tax words or number at all (round 1 "NO TAX WORDS")', () => {
    const l = clubInvoiceLayout(input(untaxedInvoice));
    assert.equal(l.rows.length, 1);
    assert.equal(l.invoiced, '$1,000.00');
    assert.equal(l.taxNumberLine, null);
  });

  it('the paid invoice IS the receipt: Paid in full, its day, the payment as it arrived (ask 10)', () => {
    const l = clubInvoiceLayout(input(taxedInvoice, [pay()]));
    assert.equal(l.paidInFull, true);
    assert.equal(l.paidInFullLabel, 'Mar 18, 2027');
    assert.equal(l.balance, '$0.00');
    assert.deepEqual(l.payments, [['Mar 18, 2027', 'Cheque 004417', '$1,130.00']]);
  });

  it('a voided payment counts for nothing; a part payment reads Balance due', () => {
    const l = clubInvoiceLayout(input(taxedInvoice, [pay({ amount: 500, taxPart: 57.52 }), pay({ id: 'p2', voided: { at: 'x', byName: 'D', reason: 'bounced' } })]));
    assert.equal(l.paid, '$500.00');
    assert.equal(l.balance, '$630.00');
    assert.equal(l.partPaid, true);
    assert.deepEqual(invoiceStanding(1130, [pay({ amount: 1130, voided: { at: 'x', byName: 'D', reason: 'r' } })]).paidInFull, false);
  });

  it('the PDF prints the club, the tax number only when taxed, and never FieldLogicHQ as supplier', async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const { buildClubSponsorInvoiceDoc } = await import('../../lib/export/pdf.ts');
    const text = (inv: DealInvoice, payments: DealPayment[] = []) => Buffer.from(
      buildClubSponsorInvoiceDoc(jsPDF, autoTable, { ...clubInvoiceLayout(input(inv, payments)), settings: { ...DEFAULT_PDF_SETTINGS, showBranding: false } }).output('arraybuffer') as ArrayBuffer,
    ).toString('latin1');
    const taxed = text(taxedInvoice);
    assert.match(taxed, /GST\/HST no\. 81234 5678 RT0001/);
    assert.match(taxed, /HST 13%/);
    assert.match(taxed, /By cheque payable to Riverdale Minor Ball/);
    assert.doesNotMatch(taxed, /FieldLogicHQ/);
    const plain = text(untaxedInvoice);
    assert.doesNotMatch(plain, /GST|HST/);
    assert.match(text(taxedInvoice, [pay()]), /Paid in full Mar 18, 2027/);
    for (const t of [taxed, plain]) assert.doesNotMatch(t, /donation|gift|tax receipt/i);
  });

  it('the coach invoice keeps R2: no tax number, one Description row (the shared page, never a tax switch on it)', () => {
    const code = stripComments(readCode('lib/export/pdf.ts'));
    assert.match(code, /export function buildSponsorInvoiceDoc[\s\S]*?rows: \[\{ description, amount \}\], taxNumberLine: null/);
  });

  it('small helpers', () => {
    assert.equal(paymentHow({ method: 'etransfer', reference: null }), 'E-transfer');
    assert.equal(periodLabel('2026-12-01', '2027-08-31'), 'Dec 1, 2026 to Aug 31, 2027');
    assert.equal(invoiceFilename('2027-014', 'Harbour Dental Ltd.'), 'invoice-2027-014-harbour-dental-ltd.pdf');
  });
});

describe('money on a deal locks it (owner defaults 2026-11-23)', () => {
  const d = { state: 'invoiced' as const, invoice: taxedInvoice };
  it('Withdraw and the revised invoice wait for a payment to be voided; Record a payment needs an invoice', () => {
    assert.equal(canWithdraw({ ...d, paidAmount: 0 }), true);
    assert.equal(canWithdraw({ ...d, paidAmount: 500 }), false);
    assert.equal(canRevise({ ...d, paidAmount: 0 }), true);
    assert.equal(canRevise({ ...d, paidAmount: 0.01 }), false);
    assert.equal(canRevise({ state: 'paid', paidAmount: 1130 }), false);
    assert.equal(canRecordPayment(d), true);
    assert.equal(canRecordPayment({ state: 'offered', invoice: null }), false);
  });
});

describe('the books (round 1 tab 7)', () => {
  const line = (over: Record<string, unknown>) => ({
    amount: 130, entryType: 'income' as const, status: 'posted' as const, bookKind: 'org', category: 'gst_hst_collected',
    sourceModule: SOURCE_MODULE.sponsorshipDeal, budgetCategoryId: null, budgetCategoryName: null, budgetItemId: null, budgetItemName: null, ...over,
  });
  it('GST/HST collected is its own word, and no budget figure counts it (it is the club’s to pass on)', () => {
    assert.equal(fileLine(line({}))?.categoryId, GST_HST_COLLECTED_ID);
    assert.equal(fileLine(line({}))?.categoryName, 'GST/HST collected');
    assert.equal(countsAsActual(line({})), false);
    const sponsorship = line({ amount: 1000, category: 'club_sponsorship', budgetCategoryId: 'c', budgetCategoryName: 'Sponsorship', budgetItemId: CLUB_SPONSORSHIP_ITEM, budgetItemName: 'Club sponsorship' });
    assert.equal(countsAsActual(sponsorship), true);
    assert.equal(bandCollected([line({}), sponsorship]), 1000, 'Collected is the sponsorship, not its tax');
    assert.equal(fileLine(sponsorship)?.byItsSource, true, 'filed by the deal that wrote it');
  });

  it('Club sponsorship is off every team’s picker (a team’s sponsorships stay the team’s, 2026-11-06)', () => {
    assert.ok(CLUB_ONLY_ITEM_IDS.includes(CLUB_SPONSORSHIP_ITEM));
    assert.equal(itemVisibleToTeam({ id: CLUB_SPONSORSHIP_ITEM, org_id: null }, 'org', 'team'), false);
    assert.equal(itemVisibleToTeam({ id: 'another', org_id: null }, 'org', 'team'), true);
    assert.match(readSource('lib/club-sponsor-invoice.ts') + readSource('supabase/migrations/528_a_club_records_a_sponsors_payment.sql'), new RegExp(CLUB_SPONSORSHIP_ITEM));
  });
});

describe('migration 528 holds the money in the database', () => {
  const sql = readSource('supabase/migrations/528_a_club_records_a_sponsors_payment.sql');
  it('payments are read-only to the server; every write is a function, none open to a browser', () => {
    assert.match(sql, /GRANT SELECT ON public\.club_sponsor_deal_payments TO service_role;/);
    assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE)[^;]*club_sponsor_deal_payments/);
    for (const f of ['club_sponsor_deal_pay', 'club_sponsor_deal_payment_void', 'club_sponsor_deal_revise']) {
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${f}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`));
    }
  });
  it('the last payment takes the tax that is left, so the two lines land on the invoice exactly', () => {
    assert.match(sql, /WHEN p_amount = v_owing THEN d\.tax_amount - v_tax_paid/);
  });
  it('the guard: Paid only from a payment, no withdraw with money on it, an issued invoice’s figures only as a revision', () => {
    for (const m of ['club_sponsor_deal_paid_by_a_payment_only', 'club_sponsor_deal_has_a_payment', 'club_sponsor_deal_invoice_figures']) assert.match(sql, new RegExp(m));
  });
});

describe('the invoice and receipt emails (owner call (2): a link, no attachment; not offers)', () => {
  const code = stripComments(readSource('lib/sponsor-invoice-email.ts'));
  it('their own kinds, the club as sender, no unsubscribe (a live deal’s invoice still goes), never Communications', () => {
    assert.ok('club_sponsorship_invoice' in EMAIL_KINDS && 'club_sponsorship_receipt' in EMAIL_KINDS);
    assert.match(code, /kind: moment === 'paid' \? 'club_sponsorship_receipt' : 'club_sponsorship_invoice'/);
    assert.doesNotMatch(code, /unsubscribe|club-group-email|email-sender|attachments/i);
  });
  it('the business is told by email now, so the page says so (/legal: the pay block and the help change together)', () => {
    assert.equal(W.page.sendChequeNote, 'Your invoice comes by email, with how to pay.');
    assert.equal(W.page.cardOffLine('Riverdale Minor Ball'), 'Riverdale Minor Ball will email your invoice with how to pay by cheque or e-transfer. You won’t be charged on this page.');
    assert.match(W.callout.invoiced('2027-014', 1130, '2027-03-03', '2027-04-02', true), /was emailed Mar 3 and is due Apr 2/);
  });
  it('the GST/HST collected is no budget figure but is cash: the month’s balance carries it, so Cash closes on Cash on hand', () => {
    const tax = { amount: 130, entryType: 'income' as const, status: 'posted' as const, bookKind: 'org', category: 'gst_hst_collected' };
    const income = { ...tax, amount: 1000, category: 'club_sponsorship' };
    assert.deepEqual(otherBooksMovement([tax, income], 'actual'), { moneyIn: 130, moneyOut: 0 });
    assert.equal(countsAsActual(tax), false);
    assert.equal(countsAsActual(income), true);
  });
  it('the business’s invoice download is throttled and opens only its own deal', () => {
    const route = stripComments(readSource('app/api/public/sponsorship/[token]/invoice/route.ts'));
    assert.ok(route.indexOf('throttleSignupFiles(') < route.indexOf('dealForLink('));
  });
});
