import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildWorksheet, type SalesRead, type WorksheetSale } from '../../lib/gst-return-worksheet.ts';
import {
  copyLinesText, formatWholeDollars, lineFigure, netTaxWords, RETURN_LINES, UNRESOLVED, UNRESOLVED_ORDER, worksheetCsvRows,
} from '../../lib/gst-return-worksheet-text.ts';
import { REPORT_VIEWS, REPORT_VIEW_LABELS } from '../../lib/bookkeeping-navigation.ts';

// GST/HST Stage 4b Session B: the Reports view's words and its guards. The rules are the engine's (gst-return-worksheet.test.ts);
// these tests hold what the screen SAYS about them and what it must never do.

const YEAR = { from: '2027-01-01', to: '2027-12-31' };
const empty: SalesRead = { state: 'read', invoices: [], notes: [], recordStart: '2026-05-01' };
const expense = (over: Record<string, unknown> = {}) => ({
  expense_id: '60000000-0000-4000-8000-000000000001', revision: 1, expense_date: '2027-02-04', incurred_date: '2027-02-04', paid_date: '2027-02-04',
  supplier: 'Hollis Law', category: 'Professional services', business_purpose: 'Terms', original_currency: 'CAD', original_cents: 11300, cad_cents: 11300,
  tax_cad_cents: 1300, tax_amount_known: true, tax_status: 'reviewed', business_use_percent: 100, payment_source: 'business_card', conversion_note: null,
  notes: null, change_reason: null, receipt_path: null, receipt_name: null, void_reason: null, created_at: '2027-02-04T16:00:00Z', created_by: 'owner',
  tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 1300 }], supplier_tax_number: '81234 5678 RT0001', supplier_registration: 'normal',
  purchase_kind: 'operating', number_unobtainable: false, ...over,
}) as never;
const sale = (amount: number, tax: number): WorksheetSale => ({
  stripe_invoice_id: `in_${amount}`, invoice_number: 'FLH-1', kind: 'subscription', buyer_kind: 'club', org_id: null, stripe_customer_id: 'cus_A',
  issued_at: '2027-03-10T15:00:00Z', currency: 'cad', amount_before_tax_cents: amount, total_cents: amount + tax,
  tax_lines: [{ source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: 'ON', rate: 13,
    effective_rate: 13, taxable_cents: amount, cents: tax, taxability_reason: 'standard_rated', tax_rate_id: null, tax_behavior: 'exclusive' }],
  gst_hst_position: 'taxed', gst_hst_position_why: null, taxed_country: 'CA', taxed_region: 'ON', status: 'paid', paid_at: '2027-03-10T15:05:00Z',
  voided_at: null, uncollectible_at: null, stripe_payment_intent_id: 'pi_A', fx_rate: 1, fx_rate_date: '2027-03-10', cad_amount_before_tax_cents: amount,
});

describe('the line captions are CRA\'s own headings (Instructions for preparing a GST/HST return, opened 2026-11-07)', () => {
  it('reads each line as CRA heads it, not the drawings\' paraphrases', () => {
    assert.deepEqual(Object.fromEntries(Object.entries(RETURN_LINES).map(([k, v]) => [k, v.caption])), {
      101: 'Total sales and other revenues',
      103: 'GST/HST collected or collectible',
      104: 'Adjustments to be added to the net tax',
      105: 'Total GST/HST and adjustments for the period',
      106: 'GST/HST paid or payable (ITCs)',
      107: 'Adjustments to be deducted when determining the net tax',
      108: 'Total ITCs and adjustments',
      109: 'Net tax',
    });
  });
});

describe('money in words, never a sign, never $0 for what is not known', () => {
  it('net tax says refund or you owe', () => {
    assert.equal(netTaxWords(-20_958), '$209.58 refund');
    assert.equal(netTaxWords(8_410), '$84.10 you owe');
    assert.equal(netTaxWords(0), '$0.00');
    assert.equal(formatWholeDollars(4700), '$4,700');
  });
  it('a refund: 109 in words on screen, in the copy and in the CSV, with no minus sign anywhere', () => {
    const w = buildWorksheet({ period: YEAR, registrationDate: '2026-09-26', sales: empty, expenses: { state: 'read', revisions: [expense()] } });
    assert.equal(lineFigure(w, 109), '$13.00 refund');
    assert.match(copyLinesText(w), /^109\tNet tax\t13\.00 refund$/m);
    const net = worksheetCsvRows(w).find(r => r[0] === '109')!;
    assert.deepEqual(net.slice(2), ['13.00', 'Refund; Calculated']);
    const amounts = [...copyLinesText(w).split('\n').map(l => l.split('\t')[2]), ...worksheetCsvRows(w).slice(1).map(r => r[2])];
    for (const a of amounts) assert.doesNotMatch(a, /^[-−]/, a);
  });
  it('sales unreadable: the sales lines are Not available everywhere (never 0), and 106 still stands', () => {
    const w = buildWorksheet({ period: YEAR, registrationDate: '2026-09-26', sales: { state: 'failed' }, expenses: { state: 'read', revisions: [expense()] } });
    for (const line of [101, 103, 104, 105, 107, 108, 109] as const) assert.equal(lineFigure(w, line), null, String(line));
    assert.equal(lineFigure(w, 106), '$13.00');
    const text = copyLinesText(w);
    assert.match(text, /^101\t[^\t]+\tNot available \(sales couldn’t be read\)$/m);
    assert.doesNotMatch(text, /^10[13]\t[^\t]+\t0/m);
    const csv = worksheetCsvRows(w);
    assert.equal(csv.find(r => r[0] === '103')![2], '', 'an unknown figure is an empty cell, not 0');
    assert.match(csv.find(r => r[0] === '103')![3], /^Not available/);
  });
  it('line 101 is whole dollars, once, in the copy and the CSV', () => {
    const w = buildWorksheet({ period: YEAR, registrationDate: '2026-09-26', sales: { ...empty, invoices: [sale(10_049, 1_306), sale(20_001, 2_600)] }, expenses: { state: 'read', revisions: [] } });
    assert.equal(lineFigure(w, 101), '$301');
    assert.match(copyLinesText(w), /^101\tTotal sales and other revenues\t301$/m);
    assert.match(copyLinesText(w), /^103\tGST\/HST collected or collectible\t39\.06$/m);
  });
  it('line 104 always says what it does not track', () => {
    const w = buildWorksheet({ period: YEAR, registrationDate: '2026-09-26', sales: empty, expenses: { state: 'read', revisions: [] } });
    assert.match(worksheetCsvRows(w).find(r => r[0] === '104')![3], /aren’t tracked here/);
  });
});

describe('"Before you file" has a sentence for every kind the engine lists', () => {
  it('every kind is worded and ordered', () => {
    const engine = readFileSync('lib/gst-return-worksheet.ts', 'utf8');
    const declared = [...engine.match(/export type UnresolvedKind =([\s\S]*?);/)![1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort();
    assert.deepEqual(Object.keys(UNRESOLVED).sort(), declared);
    assert.deepEqual([...UNRESOLVED_ORDER].sort(), declared);
  });
  it('the bare void says its tax stays in line 103 (it is NOT shown as reversed on 107)', () => {
    assert.match(UNRESOLVED.sale_voided_no_note.hint, /^Voided, no credit note: its tax stays in line 103/);
  });
});

describe('GUARD · the view', () => {
  const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const route = code('app/api/platform-admin/bookkeeping/gst-return/route.ts');
  const screen = ['app/platform-admin/bookkeeping/ReportsGstReturn.tsx', 'app/platform-admin/bookkeeping/GstReturnWindows.tsx', 'lib/gst-return-worksheet-text.ts'].map(code).join('\n');

  it('the route checks the Bookkeeping gate before it reads anything', () => {
    const get = route.slice(route.indexOf('export const GET'));
    assert.ok(get.indexOf('requireBookkeepingApi()') > 0, 'the gate is called');
    assert.ok(get.indexOf('requireBookkeepingApi()') < get.indexOf('readGstReturnWorksheet('), 'the gate comes before the worksheet read');
    assert.ok(get.indexOf('if (gate.response) return gate.response') < get.indexOf('readGstReturnWorksheet('), 'a refused caller returns first');
  });
  it('the route and the screen never read the invoice table, the whole-tax column, the refunded figure or the looks', () => {
    assert.doesNotMatch(route + screen, /platform_fee_invoices|tax_total_cents|refunded_cents|platform_charge_tax_looks|console-money-looks/);
  });
  it('the screen holds no tax rule: it never reaches the rules the engine owns', () => {
    assert.doesNotMatch(screen, /\b(isCanadianGstHst|toCad|expenseCredit|workOutCredit|summarizeTaxPaid|beforeRegistration|orgDayKey|judgeSales|resolveTaxState)\(|from '@\/lib\/charge-tax-record'|from '\.\/charge-tax-record'/);
    assert.doesNotMatch(screen, /buildWorksheet\(/, 'the screen is handed the worksheet; it never builds one');
  });
  it('shared customers reuse Stage 3\'s rule (no second one)', () => {
    assert.match(route, /import \{ visibleCustomers \} from '@\/lib\/console-money-sales-tax-wait'/);
    assert.doesNotMatch(route, /customerSharing|team_workspaces/);
  });
  it('the Overview shows nothing tax-related', () => {
    const client = code('app/platform-admin/bookkeeping/BookkeepingClient.tsx');
    const overview = client.slice(client.indexOf('function BookkeepingOverview'), client.indexOf('export default function BookkeepingClient'));
    assert.doesNotMatch(overview, /gst|GST|HST|ReportsGstReturn|worksheet|net tax/i);
  });
  it('Reports offers it as a View, with its own label', () => {
    assert.ok((REPORT_VIEWS as readonly string[]).includes('gst_return'));
    assert.equal(REPORT_VIEW_LABELS.gst_return, 'GST/HST return');
    assert.match(code('app/platform-admin/bookkeeping/BookkeepingClient.tsx'), /\{ key: 'gst_return', available: true, render: \(\) => <ReportsGstReturn/);
  });
  it('no "fiscal year" on the platform side', () => {
    assert.doesNotMatch(screen, /fiscal year/i);
  });
});
