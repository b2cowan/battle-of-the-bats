import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clubCanEmailInvoice, clubInvoiceLayout, invoiceFilename, invoiceStanding, paymentHow, periodLabel, type DealPayment } from '../../lib/club-sponsor-invoice.ts';
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
  recordedByName: 'Dana Ruiz', recordedAt: '2027-03-18T16:00:00Z', voided: null, card: null, ...over,
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

describe('walk §562’s five calls that asked for a build (owner 2026-11-23, each as recommended)', () => {
  it('call 3: a withdrawn invoice still downloads, saying “Withdrawn” as Paid in full does (no stamp), owing nothing, no How to pay', async () => {
    const withdrawnInput = { ...input(taxedInvoice), deal: { ...input(taxedInvoice).deal, withdrawnAt: '2027-03-10T15:00:00Z' } };
    const l = clubInvoiceLayout(withdrawnInput);
    assert.equal(l.withdrawnLabel, 'Mar 10, 2027');
    assert.equal(l.balance, '$0.00');
    assert.equal(l.invoiced, '$1,130.00', 'the paper still says what was invoiced');
    assert.equal(clubInvoiceLayout(input(taxedInvoice)).withdrawnLabel, null);
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const { buildClubSponsorInvoiceDoc } = await import('../../lib/export/pdf.ts');
    const text = Buffer.from(buildClubSponsorInvoiceDoc(jsPDF, autoTable, { ...l, settings: { ...DEFAULT_PDF_SETTINGS, showBranding: false } })
      .output('arraybuffer') as ArrayBuffer).toString('latin1');
    assert.match(text, /Withdrawn Mar 10, 2027/);
    assert.match(text, /This invoice was withdrawn\. Nothing is owed\./);
    assert.doesNotMatch(text, /HOW TO PAY|By cheque payable/);
    assert.match(stripComments(readSource('lib/club-sponsor-invoice-pdf.ts')), /withdrawnAt: deal\.state === 'withdrawn'/);
  });

  it('call 4: a club that can’t email never promises an email; the page and the sender ask one question', () => {
    assert.equal(clubCanEmailInvoice('200 Park Road', 'sponsors@club.ca'), true);
    assert.equal(clubCanEmailInvoice(null, 'sponsors@club.ca'), false, 'no mailing address');
    assert.equal(clubCanEmailInvoice('200 Park Road', '  '), false, 'no contact for sponsors');
    const page = stripComments(readSource('components/public/SponsorDealContent.tsx'));
    assert.match(page, /view\.clubCanEmail \? P\.cardOffLine\(view\.club\.name\) : P\.cardOffLineNoEmail/);
    assert.match(page, /view\.clubCanEmail \? P\.sendChequeNote : P\.sendChequeNoteNoEmail/);
    for (const w of [W.page.cardOffLineNoEmail, W.page.sendChequeNoteNoEmail, W.page.sendChequeNoteNoEmailPhone]) assert.doesNotMatch(w, /email/i);
    assert.match(stripComments(readSource('lib/sponsor-deal-view.ts')), /clubCanEmail: clubCanEmailInvoice\(settings\.mailingAddress, club\.contactEmail\)/);
    assert.match(stripComments(readSource('lib/sponsor-invoice-email.ts')), /!clubCanEmailInvoice\(mailingAddress, contactEmail\)/);
  });

  it('call 6: a revised invoice keeps its first figures, stamped the first time only, the functions’ alone', () => {
    const sql = readSource('supabase/migrations/529_a_revised_invoice_keeps_its_first_figures.sql');
    for (const c of ['amount', 'charge_tax', 'tax_kind', 'tax_rate', 'tax_amount', 'total']) {
      assert.match(sql, new RegExp(`original_${c} += CASE WHEN d\\.revised_on IS NULL THEN d\\.${c} +ELSE d\\.original_${c} +END`));
      assert.match(sql, new RegExp(`NEW\\.original_${c} IS DISTINCT FROM OLD\\.original_${c}`), `the guard holds original_${c}`);
    }
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.club_sponsor_deal_revise\([^)]*\) FROM PUBLIC, anon, authenticated;/);
  });

  it('call 7: a paid deal takes ONE logo later, from the receipt page, while it runs; never a replacement, never withdrawn', async () => {
    const { linkTakesLogo } = await import('../../lib/club-sponsorship-deals.ts');
    const today = '2027-05-01';
    assert.equal(linkTakesLogo({ state: 'invoiced', endsOn: '2027-08-31' }, true, today), true, 'before payment it may change');
    assert.equal(linkTakesLogo({ state: 'paid', endsOn: '2027-08-31' }, false, today), true, 'paid, never sent one: adds it');
    assert.equal(linkTakesLogo({ state: 'paid', endsOn: null }, false, today), true);
    assert.equal(linkTakesLogo({ state: 'paid', endsOn: '2027-08-31' }, true, today), false, 'a paid deal’s public logo is the club’s to change');
    assert.equal(linkTakesLogo({ state: 'paid', endsOn: '2027-04-30' }, false, today), false, 'the deal has ended');
    assert.equal(linkTakesLogo({ state: 'withdrawn', endsOn: null }, false, today), false);
    const route = stripComments(readSource('app/api/public/sponsorship/[token]/logo/route.ts'));
    assert.ok(route.indexOf('throttleSignupFiles(') < route.indexOf('linkTakesLogo('), 'throttled first');
    // The once-only rule is held in the write, so two uploads racing can't both publish.
    assert.match(stripComments(readSource('lib/club-sponsorship-deals-server.ts')),
      /\.neq\('state', 'withdrawn'\)\.or\('state\.neq\.paid,logo_sent_at\.is\.null'\)\.select\('id'\)/);
    assert.match(stripComments(readSource('components/public/SponsorDealContent.tsx')), /\{view\.takesLogo && \(\s*<section/);
  });

  it('GST/HST remitted stays off the budget plan (owner 2026-11-23); the ledger still files under it', () => {
    const writes = stripComments(readSource('lib/club-budget-writes.ts'));
    assert.match(writes, /if \(word\.ok && isPassedOnTax\(\{ budgetItemId: word\.item\.id \}\)\) return say\(400, 'tax_not_planned'\);/);
    assert.equal((writes.match(/await readPlanWord\(body\.itemId, orgId\)/g) ?? []).length, 2, 'adding a line and changing its word');
    assert.match(writes, /export async function readFiledUnder[\s\S]*?await readWord\(raw, orgId\)/, 'the ledger keeps the word');
    assert.match(stripComments(readSource('components/admin/kit/club/money/BudgetWindows.tsx')), /items: c\.items\.filter\(i => !isPassedOnTax\(\{ budgetItemId: i\.id \}\)\)/);
  });

  it('a pending GST/HST line is never scheduled as spending on Months: it rides the other-books row once', () => {
    assert.match(stripComments(readSource('lib/club-budget-report.ts')), /if \(!inYear\(l\.entryDate\) \|\| isPassedOnTax\(l\)\) continue;/);
    const pending = { amount: 130, entryType: 'expense' as const, status: 'pending' as const, bookKind: 'org', category: null, budgetItemId: '5b0d0529-0529-4c1b-8a50-7ea0507c0001' };
    assert.deepEqual(otherBooksMovement([pending], 'scheduled'), { moneyIn: 0, moneyOut: 130 });
  });

  it('call 8: GST/HST remitted lowers the cash but is never spending, nor Off-plan; the month’s balance still closes', async () => {
    const { GST_HST_REMITTED_ITEM_ID, spent, isPassedOnTax } = await import('../../lib/club-money-figures.ts');
    const remitted = { amount: 130, entryType: 'expense' as const, status: 'posted' as const, bookKind: 'org', category: null, budgetItemId: GST_HST_REMITTED_ITEM_ID };
    const gear = { ...remitted, amount: 40, budgetItemId: 'jerseys' };
    assert.equal(isPassedOnTax(remitted), true);
    assert.equal(countsAsActual(remitted), false);
    assert.equal(spent([remitted, gear]), 40, 'a remittance is not spending');
    const collected = { amount: 130, entryType: 'income' as const, status: 'posted' as const, bookKind: 'org', category: 'gst_hst_collected' };
    assert.deepEqual(otherBooksMovement([collected, remitted, gear], 'actual'), { moneyIn: 130, moneyOut: 130 });
    assert.ok(CLUB_ONLY_ITEM_IDS.includes(GST_HST_REMITTED_ITEM_ID));
    assert.equal(itemVisibleToTeam({ id: GST_HST_REMITTED_ITEM_ID, org_id: null }, 'org', 'team'), false);
    const sql = readSource('supabase/migrations/529_a_revised_invoice_keeps_its_first_figures.sql');
    assert.match(sql, new RegExp(`'${GST_HST_REMITTED_ITEM_ID}'::uuid, c\\.id, NULL, 'GST/HST remitted', 90, true, false, NULL, 'out'`));
  });
});
