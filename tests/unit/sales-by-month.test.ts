import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { StoredTaxLine } from '../../lib/charge-tax-record.ts';
import { buildWorksheet, type SalesRead, type WorksheetNote, type WorksheetPeriod, type WorksheetSale } from '../../lib/gst-return-worksheet.ts';
import {
  buildSalesReport, INVOICE_FILE_HEADER, INVOICE_FILE_NAME, invoiceFileRows, periodMonths, SALES_CSV_HEADER, SALES_WORDS, salesCsvRows,
  salesEvents, type RefundsRead, type SalesRegistration,
} from '../../lib/sales-by-month.ts';
import { REPORT_VIEWS, REPORT_VIEW_LABELS } from '../../lib/bookkeeping-navigation.ts';

// Plans & pricing Stage 2 Part 4d/4e: Sales by month and the accountant package's ONE invoice file, proved on built fixtures
// (dev Stripe has no sales rows). Definitions: docs/agents/accounting/REVENUE_REPORT_DEFINITIONS.md.

const REG = '2026-09-26';
const PERIOD: WorksheetPeriod = { from: '2026-01-01', to: '2026-11-07' };
const CLUB = '00000000-0000-4000-8000-000000000001';

const hst = (taxable: number): StoredTaxLine => ({
  source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: null,
  rate: 13, effective_rate: 13, taxable_cents: taxable, cents: Math.round(taxable * 13 / 100), taxability_reason: 'standard_rated',
  tax_rate_id: null, tax_behavior: 'exclusive',
});
let n = 0;
function sale(over: Partial<WorksheetSale> & { issued_at: string }): WorksheetSale {
  const id = over.stripe_invoice_id ?? `in_${String(++n).padStart(6, '0')}`;
  const amount = over.amount_before_tax_cents ?? 10_000;
  const lines = over.tax_lines ?? [hst(amount)];
  const currency = over.currency ?? 'cad';
  return {
    stripe_invoice_id: id, invoice_number: `FLH-${id.slice(3)}`, kind: 'subscription', buyer_kind: 'club', org_id: CLUB,
    stripe_customer_id: 'cus_A', currency, amount_before_tax_cents: amount,
    total_cents: amount + lines.reduce((s, l) => s + l.cents, 0), tax_lines: lines, gst_hst_position: 'taxed', gst_hst_position_why: null,
    taxed_country: 'CA', taxed_region: 'ON', status: 'paid', paid_at: over.issued_at, voided_at: null, uncollectible_at: null,
    stripe_payment_intent_id: 'pi_A', fx_rate: currency === 'cad' ? 1 : null, fx_rate_date: currency === 'cad' ? over.issued_at.slice(0, 10) : null,
    cad_amount_before_tax_cents: currency === 'cad' ? amount : null,
    ...over,
  };
}
let m = 0;
function note(invoice: WorksheetSale, over: Partial<WorksheetNote> & { issued_at: string }): WorksheetNote {
  const before = over.amount_before_tax_cents ?? invoice.amount_before_tax_cents;
  const lines = over.tax_lines ?? [hst(before)];
  return {
    stripe_credit_note_id: `cn_${String(++m).padStart(6, '0')}`, stripe_invoice_id: invoice.stripe_invoice_id, note_number: `CN-${m}`,
    note_type: 'post_payment', currency: invoice.currency, amount_before_tax_cents: before,
    total_cents: before + lines.reduce((s, l) => s + l.cents, 0), tax_lines: lines, status: 'issued', ...over,
  };
}
const read = (invoices: WorksheetSale[], notes: WorksheetNote[] = [], recordStart: string | null = '2026-05-01') =>
  ({ state: 'read', invoices, notes, recordStart }) as Extract<SalesRead, { state: 'read' }>;
const SET: SalesRegistration = { state: 'set', date: REG };
const noRefunds: RefundsRead = { state: 'read', byInvoice: new Map() };
const worksheetFor = (period: WorksheetPeriod, sales: SalesRead, registrationDate: string | null = REG) =>
  buildWorksheet({ period, registrationDate, sales, expenses: { state: 'read', revisions: [] } });
const report = (sales: Extract<SalesRead, { state: 'read' }>, refunds: RefundsRead = noRefunds, period: WorksheetPeriod = PERIOD, registration: SalesRegistration = SET) =>
  buildSalesReport({ period, sales, registration, refunds, worksheet: worksheetFor(period, sales, registration.state === 'set' ? registration.date : null) });

// The drawing's year, in small: Aug and most of Sep before registration, a write-off, a bare void, a credit note, a USD sale not
// yet valued, a dashboard refund with no note, and an open November bill.
const aug = sale({ issued_at: '2026-08-12T15:00:00Z', amount_before_tax_cents: 94_000, tax_lines: [] });
const writeOff = sale({ issued_at: '2026-08-20T15:00:00Z', amount_before_tax_cents: 8_900, tax_lines: [], status: 'uncollectible', paid_at: null, stripe_payment_intent_id: null, uncollectible_at: '2026-09-25T15:00:00Z' });
const sepEarly = sale({ issued_at: '2026-09-20T15:00:00Z', amount_before_tax_cents: 98_000, tax_lines: [] });
const sepLate = sale({ issued_at: '2026-09-28T15:00:00Z', amount_before_tax_cents: 29_800 });
const voided = sale({ issued_at: '2026-09-29T15:00:00Z', amount_before_tax_cents: 3_900, status: 'void', paid_at: null, stripe_payment_intent_id: null, voided_at: '2026-09-30T15:00:00Z' });
const oct = sale({ issued_at: '2026-10-05T15:00:00Z', amount_before_tax_cents: 139_200, kind: 'premium', buyer_kind: 'person', org_id: null });
const octNote = note(oct, { issued_at: '2026-10-20T15:00:00Z', amount_before_tax_cents: 4_450 });
const usd = sale({ issued_at: '2026-10-10T15:00:00Z', amount_before_tax_cents: 10_000, currency: 'usd', tax_lines: [], kind: 'fee' });
const nov = sale({ issued_at: '2026-11-02T15:00:00Z', amount_before_tax_cents: 54_500, status: 'open', paid_at: null, stripe_payment_intent_id: null });
const YEAR = read([aug, writeOff, sepEarly, sepLate, voided, oct, usd, nov], [octNote]);
const refunds: RefundsRead = { state: 'read', byInvoice: new Map([[sepLate.stripe_invoice_id, 1_000]]) };

describe('Months · each event in the month it happened', () => {
  const r = report(YEAR, refunds);
  const month = (key: string) => r.months.find(x => x.month === key)!;
  it('lists the period’s months newest first; months wholly before May 1, 2026 read “Before our record starts”', () => {
    assert.deepEqual(r.months.map(x => x.month), ['2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']);
    assert.deepEqual(r.months.filter(x => x.beforeRecord).map(x => x.month), ['2026-04', '2026-03', '2026-02', '2026-01']);
    assert.equal(month('2026-11').wholeMonth, false);
    assert.equal(month('2026-10').wholeMonth, true);
  });
  it('marks registration from the stored date: before, part before (the month it falls in), then nothing', () => {
    assert.equal(month('2026-08').registration, 'before');
    assert.equal(month('2026-09').registration, 'part_before');
    assert.equal(month('2026-10').registration, null);
  });
  it('September: invoiced by issue day, the bare void off in its own month, the August bill written off in September (outside net sales)', () => {
    const f = month('2026-09').figures;
    assert.equal(f.invoiced, 98_000 + 29_800 + 3_900);
    assert.equal(f.voided, 3_900);
    assert.equal(f.net, 98_000 + 29_800);
    assert.equal(f.writtenOff, 8_900);
    assert.equal(f.beforeRegistration, 98_000);
    assert.equal(month('2026-08').figures.invoiced, 94_000 + 8_900, 'the written-off sale stays a sale in its own month');
    assert.equal(month('2026-08').figures.writtenOff, 0);
  });
  it('GST/HST: the void takes its tax off with it; a pre-registration sale with no tax adds none', () => {
    assert.equal(month('2026-09').figures.gstHst, hst(29_800).cents);
  });
  it('October: a credit note comes off in the month it was issued, before tax, its tax off the GST/HST', () => {
    const f = month('2026-10').figures;
    assert.equal(f.invoiced, 139_200, 'the USD sale with no rate yet is not in any CAD figure');
    assert.equal(f.creditNotes, 4_450);
    assert.equal(f.net, 139_200 - 4_450);
    assert.equal(f.gstHst, hst(139_200).cents - hst(4_450).cents);
  });
  it('Collected is every payment by its day, tax included; an open bill collects nothing', () => {
    assert.equal(month('2026-09').figures.collected, 98_000 + 29_800 + hst(29_800).cents);
    assert.equal(month('2026-11').figures.collected, 0);
    assert.equal(month('2026-11').figures.invoiced, 54_500);
  });
  it('a sale not yet valued in CAD is counted apart with its own-currency subtotal, never as $0', () => {
    assert.equal(r.unvalued.count, 1);
    assert.deepEqual(r.unvalued.byCurrency, [{ currency: 'usd', cents: 10_000, count: 1 }]);
    assert.equal(month('2026-10').unvalued, 1);
    assert.ok(month('2026-10').events.some(e => e.type === 'invoiced' && e.cad == null));
  });
  it('a refund made with no credit note is listed on its bill’s month, dated as not recorded, and never netted', () => {
    const sep = month('2026-09');
    const refund = sep.events.find(e => e.type === 'refund_no_note')!;
    assert.equal(refund.cents, 1_000);
    assert.equal(refund.dateNotRecorded, true);
    assert.equal(sep.refundsWithoutNote, 1);
    assert.equal(r.refundsWithoutNote.count, 1);
    assert.equal(sep.figures.net, 98_000 + 29_800, 'the refund is not taken off net sales');
  });
  it('splits a month by kind: plans, Coach Premium, fees billed back, one-off', () => {
    assert.deepEqual(month('2026-10').byKind.map(k => k.kind), ['premium', 'fee']);
    assert.equal(month('2026-10').byKind.find(k => k.kind === 'premium')!.figures.net, 139_200 - 4_450);
  });
  it('a month with nothing in it has no events (the screen says “No sales invoiced”, not $0)', () => {
    assert.equal(month('2026-07').events.length, 0);
    assert.equal(month('2026-07').beforeRecord, false);
  });
});

describe('The line-101 sentence · the engine’s own line 101, never recomputed', () => {
  it('reconciles on the drawing year: 101 = net sales + voids + credit notes − sales before registration', () => {
    const r = report(YEAR, refunds);
    const ws = worksheetFor(PERIOD, YEAR);
    assert.equal(r.reconciliation.state, 'reconciled');
    if (r.reconciliation.state !== 'reconciled') return;
    assert.equal(r.reconciliation.line101Cents, ws.lines[101].cents);
    assert.equal(r.reconciliation.wholeDollars, ws.parts[101].wholeDollars);
    assert.equal(r.totals.net + r.totals.voided + r.totals.creditNotes - r.totals.beforeRegistration, ws.lines[101].cents);
    assert.equal(r.reconciliation.beforeRegistration, 94_000 + 8_900 + 98_000);
  });
  it('the report’s invoiced less sales before registration is the engine’s own line 101 for every sub-period (a month, a quarter, a stub)', () => {
    for (const period of [{ from: '2026-09-01', to: '2026-09-30' }, { from: '2026-07-01', to: '2026-09-30' }, { from: '2026-09-27', to: '2026-10-21' }, { from: '2026-11-01', to: '2026-11-07' }]) {
      const r = report(YEAR, refunds, period);
      assert.equal(r.reconciliation.state, 'reconciled', JSON.stringify(period));
    }
  });
  it('holds when a void falls in a later period than its bill, and when a note and a void share a bill (nothing comes off twice)', () => {
    const late = sale({ issued_at: '2026-10-28T15:00:00Z', amount_before_tax_cents: 20_000, status: 'void', paid_at: null, stripe_payment_intent_id: null, voided_at: '2026-11-03T15:00:00Z' });
    const part = note(late, { issued_at: '2026-10-30T15:00:00Z', amount_before_tax_cents: 5_000, note_type: 'pre_payment' });
    const rows = read([late], [part]);
    const nov1 = report(rows, noRefunds, { from: '2026-11-01', to: '2026-11-30' });
    assert.equal(nov1.totals.voided, 15_000, 'the void takes off only what the note left');
    assert.equal(nov1.reconciliation.state, 'reconciled');
    const both = report(rows, noRefunds, { from: '2026-10-01', to: '2026-11-30' });
    assert.equal(both.totals.net, 0);
    assert.equal(both.reconciliation.state, 'reconciled');
  });
  it('a voided credit note never counts', () => {
    const bill = sale({ issued_at: '2026-10-02T15:00:00Z' });
    const r = report(read([bill], [note(bill, { issued_at: '2026-10-03T15:00:00Z', status: 'void' })]), noRefunds, { from: '2026-10-01', to: '2026-10-31' });
    assert.equal(r.totals.creditNotes, 0);
    assert.equal(r.totals.net, 10_000);
  });
  it('says “not available” with the engine’s reason when line 101 is (no registration date)', () => {
    const r = report(YEAR, refunds, PERIOD, { state: 'unset' });
    assert.deepEqual(r.reconciliation, { state: 'not_available', why: 'registration_unread' });
    assert.equal(r.months.find(x => x.month === '2026-08')!.registration, null, 'no chip when the date is not known');
  });
  it('the words: a whole-dollar 101 and each part signed as the drawing reads', () => {
    const r = report(YEAR, refunds);
    assert.equal(r.reconciliation.state, 'reconciled');
    if (r.reconciliation.state !== 'reconciled') return;
    const w = SALES_WORDS.reconciled(r.reconciliation);
    assert.match(w.title, /^Line 101 of the GST\/HST return for these dates reads \$\d[\d,]*\.$/);
    assert.match(w.body, /sales before registration −\$2,009\.00, voids, which line 101 does not take off \+\$39\.00, credit notes, which line 101 does not take off \(the return puts them on line 107\) \+\$44\.50/);
    assert.doesNotMatch(w.body, /voids it keeps/, '/accounting 2026-11-08: a void of an earlier bill was never in this 101');
  });
  it('shows line 101 before rounding when its cents are not whole dollars, so the parts add up visibly', () => {
    const odd = sale({ issued_at: '2026-10-02T15:00:00Z', amount_before_tax_cents: 10_040 });
    const r = report(read([odd]), noRefunds, { from: '2026-10-01', to: '2026-10-31' });
    assert.equal(r.reconciliation.state, 'reconciled');
    if (r.reconciliation.state !== 'reconciled') return;
    assert.match(SALES_WORDS.reconciled(r.reconciliation).title, /reads \$100 \(\$100\.40 before rounding to whole dollars\)\.$/);
  });
});

describe('The same rows as the return · the sales-report read is a superset the engine ignores', () => {
  it('the worksheet is identical from the return’s rows and from the wider rows (voided or paid in the period, issued earlier)', () => {
    const period = { from: '2026-10-01', to: '2026-10-31' };
    const earlierPaid = sale({ issued_at: '2026-09-28T15:00:00Z', status: 'paid', paid_at: '2026-10-04T15:00:00Z' });
    const earlierVoid = sale({ issued_at: '2026-09-29T15:00:00Z', status: 'void', paid_at: null, voided_at: '2026-10-02T15:00:00Z' });
    const returnRows = read([oct, usd], [octNote]);
    const wider = read([oct, usd, earlierPaid, earlierVoid], [octNote]);
    assert.deepEqual(worksheetFor(period, wider).lines, worksheetFor(period, returnRows).lines);
    assert.deepEqual(worksheetFor(period, wider).unresolved, worksheetFor(period, returnRows).unresolved);
    const r = report(wider, noRefunds, period);
    assert.equal(r.totals.voided, 10_000, 'October takes off September’s bill voided in October');
    assert.equal(r.reconciliation.state, 'reconciled');
  });
  it('the reader’s every_event rows read by void day and every payment day, through the same loader and columns', () => {
    const reader = readFileSync('lib/gst-return-worksheet-read.ts', 'utf8');
    assert.match(reader, /rows: SalesReadRows = 'return'/);
    assert.match(reader, /every \? salesWhere\('voided_at'\)/);
    assert.match(reader, /if \(column === 'paid_at' && !every\) q = q\.not\('uncollectible_at', 'is', null\)/);
    // The return's own combined read is untouched: it never reads the wider rows.
    assert.match(reader, /readWorksheetSales\(period\), readWorksheetExpenses\(\), readWorksheetRegistrationDate\(\), readWorksheetFilings\(\)/);
    const salesRead = readFileSync('lib/sales-by-month-read.ts', 'utf8');
    assert.match(salesRead, /readWorksheetSales\(period, live, 'every_event'\)/);
    assert.doesNotMatch(salesRead, /supabaseAdmin|\.from\(/, 'its only own reads go through the return reader’s byInvoice, for the refunded figure');
    assert.match(salesRead, /byInvoice<ChargeRefund>\('platform_charge_tax_records', 'stripe_invoice_id, refunded_cents'/);
    assert.match(salesRead, /notesPaidBackCents\(/, 'Stage 3’s rule for what the notes paid back, not a second one');
  });
});

describe('The Sales CSV · totals only', () => {
  const r = report(YEAR, refunds);
  const rows = salesCsvRows(r, true);
  it('one row per month oldest first, the period total, then the line-101 sentence', () => {
    assert.deepEqual(rows[0], SALES_CSV_HEADER);
    assert.equal(rows[1][0], 'Jan 2026');
    assert.equal(rows[11][0], 'Nov 2026');
    assert.equal(rows[12][0], 'Period total');
    assert.match(rows[13][1], /^Live sales\. Line 101 of the GST\/HST return/);
  });
  it('amounts are plain positive dollars; a month before our record is blank with its note', () => {
    const sep = rows.find(row => row[0] === 'Sep 2026')!;
    assert.deepEqual(sep.slice(3, 12), ['1317.00', '39.00', '0.00', '1278.00', (hst(29_800).cents / 100).toFixed(2), '1316.74', '89.00', '0.00', '980.00']);
    assert.match(sep[13], /Part before GST\/HST registration/);
    assert.match(sep[13], /refund\(s\) with no credit note/);
    const jan = rows[1];
    assert.deepEqual(jan.slice(3, 13), Array(10).fill(''));
    assert.equal(jan[13], SALES_WORDS.beforeRecord);
  });
  it('names no buyer', () => {
    assert.ok(!rows.flat().some(cell => /Coach|Club|cus_|in_/.test(cell)));
  });
});

describe('The accountant package’s ONE invoice file (owner ruling 2026-11-08)', () => {
  const names = { [CLUB]: 'Northshore Minor Baseball' };
  const rows = invoiceFileRows(PERIOD, YEAR, REG, refunds, names);
  const col = (name: string) => INVOICE_FILE_HEADER.indexOf(name);
  it('is one file, named once, with sales and GST/HST figures side by side and no address or postal code', () => {
    assert.equal(INVOICE_FILE_NAME, 'invoices-and-credit-notes.csv');
    assert.deepEqual(rows[0], INVOICE_FILE_HEADER);
    for (const c of ['Before tax', 'Total', 'GST/HST', 'Before tax (CAD)', 'GST/HST (CAD)', 'Bank of Canada rate', 'Province taxed']) assert.ok(col(c) >= 0, c);
    assert.ok(!INVOICE_FILE_HEADER.some(h => /address|postal|email|name of/i.test(h)));
  });
  it('one row per invoice and one per credit note, the note linked by its bill’s invoice number', () => {
    assert.equal(rows.filter(r => r[0] === 'Invoice').length, 8);
    const noteRow = rows.find(r => r[0] === 'Credit note')!;
    assert.equal(noteRow[col('Invoice number')], oct.invoice_number);
    assert.equal(noteRow[col('Credit note number')], octNote.note_number);
    assert.equal(noteRow[col('Before tax')], '44.50');
    assert.equal(noteRow[col('GST/HST (CAD)')], (hst(4_450).cents / 100).toFixed(2));
  });
  it('the buyer is the club’s name, or “Coach” for an individual', () => {
    assert.equal(rows.find(r => r[col('Invoice number')] === nov.invoice_number)![col('Buyer')], 'Northshore Minor Baseball');
    assert.equal(rows.find(r => r[0] === 'Invoice' && r[col('Invoice number')] === oct.invoice_number)![col('Buyer')], 'Coach');
    assert.ok(!rows.flat().includes(CLUB));
  });
  it('lists a bill issued earlier when it was paid, voided or written off in the period, and says which', () => {
    const late = invoiceFileRows({ from: '2026-09-01', to: '2026-09-30' }, YEAR, REG, refunds, names);
    const wo = late.find(r => r[col('Invoice number')] === writeOff.invoice_number)!;
    assert.equal(wo[col('Listed for')], 'Written off');
    assert.equal(wo[col('Status')], 'Written off');
    assert.equal(late.find(r => r[col('Invoice number')] === voided.invoice_number)![col('Listed for')], 'Issued; Voided');
  });
  it('a sale not yet valued says so instead of a CAD figure; a CAD sale is its own rate', () => {
    const u = rows.find(r => r[col('Invoice number')] === usd.invoice_number)!;
    assert.equal(u[col('Bank of Canada rate')], 'not yet read');
    assert.equal(u[col('Before tax (CAD)')], '');
    assert.equal(rows.find(r => r[col('Invoice number')] === nov.invoice_number)![col('Bank of Canada rate')], '1 (same currency)');
  });
  it('the refund with no credit note, and before-registration, are their own columns', () => {
    assert.equal(rows.find(r => r[col('Invoice number')] === sepLate.invoice_number)![col('Refunded with no credit note')], '10.00');
    assert.equal(rows.find(r => r[col('Invoice number')] === aug.invoice_number)![col('Before GST/HST registration')], 'Yes');
    assert.equal(invoiceFileRows(PERIOD, YEAR, REG, { state: 'failed' }, names).find(r => r[0] === 'Invoice')![col('Refunded with no credit note')], 'Could not be read');
  });
});

describe('GUARD · where it is wired', () => {
  const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('Sales is a Reports view, labelled “Sales”, in the page’s registry', () => {
    assert.ok((REPORT_VIEWS as readonly string[]).includes('sales'));
    assert.equal(REPORT_VIEW_LABELS.sales, 'Sales');
    assert.match(code('app/platform-admin/bookkeeping/BookkeepingClient.tsx'), /\{ key: 'sales', available: true, render: \(\) => <ReportsSales/);
  });
  it('the route checks the Bookkeeping gate before it reads anything', () => {
    const get = code('app/api/platform-admin/bookkeeping/sales/route.ts');
    assert.ok(get.indexOf('requireBookkeepingApi()') < get.indexOf('readSalesReport('));
    assert.ok(get.indexOf('if (gate.response) return gate.response') < get.indexOf('readSalesReport('));
  });
  it('the package carries the invoice file, refuses to go without its sales, and its scope note says sales and credit notes are in it', () => {
    const route = readFileSync('app/api/platform-admin/bookkeeping/package/route.ts', 'utf8');
    assert.match(route, /name: INVOICE_FILE_NAME/);
    assert.match(route, /Your sales could not be read; the package was not created/);
    assert.match(route, /payouts and bank reconciliation are not in this package; sales and credit notes are\./);
    assert.doesNotMatch(route, /Stripe income/);
    assert.match(route, /Stripe\u2019s fees to us are included only as the monthly expenses entered from Stripe\u2019s statement \(expenses\.csv\)/, '/accounting 2026-11-08: ruling 4 puts them in expenses.csv');
    assert.match(route, /uses the registration date on file: \$\{invoiceFile\.registration\.state === 'set'/, 'the date the file itself used');
    assert.doesNotMatch(route, /gst-hst-sales\.csv|sales\.csv'|credit-notes\.csv'/, 'one invoice file, never a second');
  });
  it('the month windows read nothing themselves and never call Stripe', () => {
    const screen = code('app/platform-admin/bookkeeping/ReportsSales.tsx');
    assert.doesNotMatch(screen, /stripe\.|api\.stripe\.com/i);
    assert.doesNotMatch(screen, /fetch\(/, 'its one read is the shared Reports reader');
    assert.match(screen, /useReportRead<SalesReportRead>\('\/api\/platform-admin\/bookkeeping\/sales'/);
  });
  it('salesEvents keeps only events inside the period', () => {
    const events = salesEvents({ from: '2026-10-01', to: '2026-10-31' }, YEAR, REG, refunds);
    assert.ok(events.every(e => e.on >= '2026-10-01' && e.on <= '2026-10-31'));
  });
  it('periodMonths clips the first and last month to the period', () => {
    assert.deepEqual(periodMonths({ from: '2026-11-15', to: '2027-01-03' }).map(x => [x.month, x.from, x.to, x.wholeMonth]),
      [['2026-11', '2026-11-15', '2026-11-30', false], ['2026-12', '2026-12-01', '2026-12-31', true], ['2027-01', '2027-01-01', '2027-01-03', false]]);
  });
});

describe('/accounting review 2026-11-08 · applied', () => {
  const wo = sale({ issued_at: '2026-10-02T15:00:00Z', amount_before_tax_cents: 20_000, status: 'paid', uncollectible_at: '2026-10-20T15:00:00Z', paid_at: '2026-11-04T15:00:00Z', stripe_payment_intent_id: 'pi_B' });
  const rows = read([wo]);
  it('a payment after a write-off is a recovery: its own figure, also inside Collected; the write-off stays in its month', () => {
    const r = report(rows, noRefunds, { from: '2026-10-01', to: '2026-11-30' });
    const oct2 = r.months.find(x => x.month === '2026-10')!;
    const nov2 = r.months.find(x => x.month === '2026-11')!;
    assert.equal(oct2.figures.writtenOff, 20_000);
    assert.equal(nov2.figures.recovered, 20_000 + hst(20_000).cents);
    assert.equal(nov2.figures.collected, 20_000 + hst(20_000).cents);
    assert.equal(nov2.events[0].type, 'recovered');
    assert.equal(r.totals.net, 20_000, 'neither the write-off nor the recovery moves net sales');
  });
  it('the invoice file: the GST/HST treatment, the written-off amount, and Recovered in "Listed for"', () => {
    const zr = sale({ issued_at: '2026-10-03T15:00:00Z', tax_lines: [], gst_hst_position: 'zero_rated', taxed_country: 'US', taxed_region: null });
    const file = invoiceFileRows({ from: '2026-10-01', to: '2026-11-30' }, read([wo, zr]), REG, noRefunds, null);
    const c = (name: string) => INVOICE_FILE_HEADER.indexOf(name);
    const w = file.find(r => r[c('Invoice number')] === wo.invoice_number)!;
    assert.equal(w[c('Written off (before tax)')], '200.00');
    assert.equal(w[c('Listed for')], 'Issued; Recovered; Written off');
    assert.equal(w[c('GST/HST treatment')], 'Taxed');
    assert.equal(file.find(r => r[c('Invoice number')] === zr.invoice_number)![c('GST/HST treatment')], 'Zero-rated');
    assert.ok(file.every(r => r.length === INVOICE_FILE_HEADER.length), 'every row has every column');
  });
  it('/review: a bill written off and then voided comes off once (the void), never also as a bad debt', () => {
    const bill = sale({ issued_at: '2026-09-02T15:00:00Z', status: 'void', paid_at: null, stripe_payment_intent_id: null,
      uncollectible_at: '2026-10-05T15:00:00Z', voided_at: '2026-11-03T15:00:00Z' });
    const r = report(read([bill]), noRefunds, { from: '2026-09-01', to: '2026-11-30' });
    assert.equal(r.totals.writtenOff, 0);
    assert.equal(r.totals.voided, 10_000);
    assert.equal(r.totals.net, 0);
    assert.equal(r.reconciliation.state, 'reconciled');
  });
  it('/review: a note after the void is not taken off twice', () => {
    const bill = sale({ issued_at: '2026-09-02T15:00:00Z', status: 'void', paid_at: null, voided_at: '2026-09-10T15:00:00Z' });
    const notes = [note(bill, { issued_at: '2026-09-05T15:00:00Z', amount_before_tax_cents: 3_000 }), note(bill, { issued_at: '2026-09-12T15:00:00Z', amount_before_tax_cents: 2_000 })];
    const r = report(read([bill], notes), noRefunds, { from: '2026-09-01', to: '2026-09-30' });
    assert.equal(r.totals.voided, 5_000);
    assert.equal(r.totals.net, 0);
  });
  it('/review: a club no longer on file says so; a failed names read says "Club"; never the record’s buyer name', () => {
    const c = (name: string) => INVOICE_FILE_HEADER.indexOf(name);
    const gone = invoiceFileRows({ from: '2026-11-01', to: '2026-11-30' }, read([nov]), REG, noRefunds, {});
    assert.equal(gone.find(r => r[0] === 'Invoice')![c('Buyer')], 'A club no longer on file');
    const unread = invoiceFileRows({ from: '2026-11-01', to: '2026-11-30' }, read([nov]), REG, noRefunds, null);
    assert.equal(unread.find(r => r[0] === 'Invoice')![c('Buyer')], 'Club');
    assert.doesNotMatch(readFileSync('lib/sales-by-month.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /buyer_name/);
  });
  it('the no-note refund sentence says it still reduces income, and only the GST/HST needs the credit note', () => {
    assert.match(SALES_WORDS.refunds(1), /still reduces your income in the month refunded/);
    assert.match(SALES_WORDS.refunds(1), /net sales here are overstated/);
    assert.doesNotMatch(SALES_WORDS.refunds(2), /a credit note is what reduces the sale/);
  });
});
