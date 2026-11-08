import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildWorksheet, type FiledRead, type SalesRead, type WorksheetInput, type WorksheetSale } from '../../lib/gst-return-worksheet.ts';
import { filedCredits, freezeSources, parseSources, type GstReturnFiling } from '../../lib/gst-return-filing.ts';
import { AS_FILED_HEADER, asFiledFileRows, CREDITS_FILE_HEADER, creditsFileRows, filingsInside, packageWorksheetRows } from '../../lib/gst-package-files.ts';
import { CREDIT_STATE_WORDS, PACKAGE_FILES, worksheetCsvRows } from '../../lib/gst-return-worksheet-text.ts';
import { packageCsv } from '../../lib/bookkeeping-export.ts';
import { orgDayKey } from '../../lib/timezone.ts';

// GST/HST Stage 4b Session D: the accountant package's GST/HST files. The rows are the engine's worksheet and the filings' frozen
// records, worded; nothing here works a figure out, so every test builds a worksheet with the engine and reads the rows back.

const Y2027 = { from: '2027-01-01', to: '2027-12-31' };
const Y2028 = { from: '2028-01-01', to: '2028-12-31' };
const REG = '2026-09-26';
const noSales: SalesRead = { state: 'read', invoices: [], notes: [], recordStart: '2026-05-01' };
const expense = (over: Record<string, unknown> = {}) => ({
  expense_id: '60000000-0000-4000-8000-000000000001', revision: 1, expense_date: '2027-02-04', incurred_date: '2027-02-04', paid_date: '2027-02-04',
  supplier: 'Bell', category: 'Professional services', business_purpose: 'Phone', original_currency: 'CAD', original_cents: 11300, cad_cents: 11300,
  tax_cad_cents: 1300, tax_amount_known: true, tax_status: 'reviewed', business_use_percent: 100, payment_source: 'business_card', conversion_note: null,
  notes: null, change_reason: null, receipt_path: null, receipt_name: null, void_reason: null, created_at: '2027-02-04T16:00:00Z', created_by: 'owner',
  tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 1300 }], supplier_tax_number: '81234 5678 RT0001', supplier_registration: 'normal',
  purchase_kind: 'operating', number_unobtainable: false, ...over,
}) as never;
const heldBell = expense({ supplier_tax_number: null });
const bellWithNumber = expense({ revision: 2, created_at: '2028-05-03T14:00:00Z', change_reason: 'Number added' });
const sale = (id: string, issued: string, amount: number, tax: number): WorksheetSale => ({
  stripe_invoice_id: id, invoice_number: `FLH-${id}`, kind: 'subscription', buyer_kind: 'club', org_id: null, stripe_customer_id: 'cus_A',
  issued_at: issued, currency: 'cad', amount_before_tax_cents: amount, total_cents: amount + tax,
  tax_lines: [{ source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: 'ON', rate: 13,
    effective_rate: 13, taxable_cents: amount, cents: tax, taxability_reason: 'standard_rated', tax_rate_id: null, tax_behavior: 'exclusive' }],
  gst_hst_position: 'taxed', gst_hst_position_why: null, taxed_country: 'CA', taxed_region: 'ON', status: 'paid', paid_at: issued,
  voided_at: null, uncollectible_at: null, stripe_payment_intent_id: 'pi_A', fx_rate: 1, fx_rate_date: issued.slice(0, 10), cad_amount_before_tax_cents: amount,
});
const ws = (over: Partial<WorksheetInput>) => buildWorksheet({ period: Y2027, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [] }, ...over });
function fileIt(w: ReturnType<typeof buildWorksheet>, at: string, over: Partial<GstReturnFiling> = {}): GstReturnFiling {
  return {
    filingNo: 1, period: w.period, periodRevision: 1, filedOn: orgDayKey(at), registrationDate: w.registrationDate!,
    lines: Object.fromEntries(Object.entries(w.lines).map(([k, l]) => [k, l.cents!])) as GstReturnFiling['lines'],
    wholeDollars101: w.parts[101].wholeDollars!, partial: w.partial, openItems: w.unresolved.filter(u => u.affects.length).length,
    sources: parseSources(JSON.stringify(freezeSources(w)))!, reason: null, createdAt: at, createdBy: 'owner', ...over,
  };
}
const filedRead = (...filings: GstReturnFiling[]): FiledRead => ({ state: 'read', periods: filedCredits(filings, orgDayKey) });
const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('gst-hst-worksheet.csv: the Worksheet CSV for the package\'s dates', () => {
  const w = ws({ sales: { ...noSales, invoices: [sale('a', '2027-03-10T15:00:00Z', 10_000, 1_300)] }, expenses: { state: 'read', revisions: [expense()] } });
  it('is the Worksheet CSV\'s rows, header first, one row per line 101 to 109', () => {
    const rows = packageWorksheetRows(w);
    assert.deepEqual(rows[0], ['Line', 'Description', 'Amount (CAD)', 'Note']);
    assert.deepEqual(rows.slice(1, 9).map(r => r[0]), ['101', '103', '104', '105', '106', '107', '108', '109']);
    assert.deepEqual(rows.slice(0, 9), worksheetCsvRows(w).slice(0, 9), 'the same rows the screen\'s Worksheet CSV writes');
    assert.deepEqual(rows[1].slice(0, 3), ['101', 'Total sales and other revenues', '100']);
    assert.deepEqual(rows[2].slice(0, 3), ['103', 'GST/HST collected or collectible', '13.00']);
  });
  it('adds how many “Before you file” items are open, and nothing when none is', () => {
    assert.equal(packageWorksheetRows(w).some(r => /Before you file/.test(String(r[1]))), false);
    const open = ws({ expenses: { state: 'read', revisions: [heldBell] } });
    const last = packageWorksheetRows(open).at(-1)!;
    assert.equal(last[1], PACKAGE_FILES.openItems(1));
  });
  it('a line that can\'t be known is blank with its reason, never 0', () => {
    const unread = ws({ sales: { state: 'failed' }, expenses: { state: 'read', revisions: [expense()] } });
    const rows = packageWorksheetRows(unread);
    const line = (n: number) => rows.find(r => r[0] === String(n))!;
    assert.deepEqual([line(101)[2], line(101)[3]], ['', 'Not available: sales couldn’t be read']);
    assert.deepEqual([line(103)[2], line(109)[2]], ['', ''], 'the lines that need sales are blank, not 0.00');
    assert.equal(line(106)[2], '13.00', 'line 106 stands when only sales failed');
    const noFilings = buildWorksheet({ period: Y2027, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [expense()] }, filed: { state: 'failed' } });
    assert.deepEqual([packageWorksheetRows(noFilings).find(r => r[0] === '106')![2], packageWorksheetRows(noFilings).find(r => r[0] === '106')![3]],
      ['', 'Not available: your filed periods couldn’t be read']);
  });
  it('the sales the package read widely (every event, issued whenever) give the same lines as the narrower read', () => {
    const inPeriod = sale('a', '2027-03-10T15:00:00Z', 10_000, 1_300);
    const outside = { ...sale('b', '2026-11-04T15:00:00Z', 50_000, 6_500), paid_at: '2027-02-01T15:00:00Z' };
    const narrow = ws({ sales: { ...noSales, invoices: [inPeriod] } });
    const wide = ws({ sales: { ...noSales, invoices: [inPeriod, outside] } });
    assert.deepEqual(packageWorksheetRows(wide).slice(0, 9), packageWorksheetRows(narrow).slice(0, 9));
  });
});

describe('gst-hst-credits.csv: line 106\'s expenses and their state', () => {
  it('has the header, and one row per expense that fed line 106 with its state in words', () => {
    const counted = creditsFileRows(ws({ expenses: { state: 'read', revisions: [expense()] } }));
    assert.deepEqual(counted[0], [...CREDITS_FILE_HEADER]);
    assert.equal(counted.length, 2);
    assert.deepEqual(counted[1].slice(0, 12), ['This period', '60000000-0000-4000-8000-000000000001', 1, 'Bell', '2027-02-04', '2027-02-04', 'HST 13%',
      '13.00', '13.00', '', CREDIT_STATE_WORDS.counted, '']);
  });
  it('a held credit shows the figure it is waiting to count, in its own column, and counts 0.00 on the line', () => {
    const held = creditsFileRows(ws({ expenses: { state: 'read', revisions: [heldBell] } }))[1];
    assert.deepEqual([held[8], held[9], held[10]], ['0.00', '13.00', CREDIT_STATE_WORDS.held]);
  });
  it('a credit that cannot be claimed says why, and an expense with no GST/HST is not listed', () => {
    const simplified = creditsFileRows(ws({ expenses: { state: 'read', revisions: [expense({ supplier_registration: 'simplified' })] } }))[1];
    assert.deepEqual([simplified[8], simplified[10]], ['0.00', CREDIT_STATE_WORDS.not_claimable]);
    assert.equal(creditsFileRows(ws({ expenses: { state: 'read', revisions: [expense({ tax_lines: [{ type: 'pst', cents: 1300 }] })] } })).length, 1);
  });
  it('a credit released after its period was filed is carried: its own row, where it lands and the return that left it out', () => {
    const filed2027 = fileIt(ws({ expenses: { state: 'read', revisions: [heldBell] } }), '2028-04-20T15:00:00Z');
    const w2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [heldBell, bellWithNumber] }, filed: filedRead(filed2027) });
    const rows = creditsFileRows(w2028);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1].slice(0, 13), ['Carried from a filed return', '60000000-0000-4000-8000-000000000001', 2, 'Bell', '2027-02-04', '2028-05-03', '', '',
      '13.00', '', 'Counted on line 106 as a credit from an earlier period', '2028-05-03', '2027-01-01 to 2027-12-31']);
  });
  it('a credit counted now but not on the return filed for its dates says so, so the worksheet and the as-filed file reconcile', () => {
    const filed2027 = fileIt(ws({ expenses: { state: 'read', revisions: [heldBell] } }), '2028-04-20T15:00:00Z');
    const live2027 = ws({ expenses: { state: 'read', revisions: [heldBell, bellWithNumber] } });
    const [, row] = creditsFileRows(live2027, [filed2027] as never);
    assert.equal(row[10], CREDIT_STATE_WORDS.counted);
    assert.equal(row[13], 'Not on the return filed 2028-04-20 for 2027-01-01 to 2027-12-31: added or released after it was filed, so it counts on a later return');
    // The return that did claim it, or no filed return at all: no such note.
    const claimed = fileIt(live2027, '2028-06-01T15:00:00Z');
    assert.equal(creditsFileRows(live2027, [claimed] as never)[1][13], '');
    assert.equal(creditsFileRows(live2027)[1][13], '');
  });
  it('a credit now smaller than the filed return claimed is flagged as over-claimed (adjust the filed return)', () => {
    const filed = fileIt(ws({ expenses: { state: 'read', revisions: [bellWithNumber] } }), '2028-06-01T15:00:00Z');
    const lowered = expense({ revision: 3, created_at: '2028-07-01T14:00:00Z', business_use_percent: 50, change_reason: 'Half personal' });
    const row = creditsFileRows(ws({ expenses: { state: 'read', revisions: [bellWithNumber, lowered] } }), [filed] as never)[1];
    assert.equal(row[8], '6.50');
    assert.equal(row[13], '6.50 of the GST/HST is not claimable (business use or meals); 6.50 less than the return filed 2028-06-01 for 2027-01-01 to 2027-12-31 claimed: over-claimed, so adjust that filed return in My Business Account');
  });
  it('/review: a filing whose sources can\'t be read is never compared, so no "not on the return" note is guessed', () => {
    const unreadable = { ...fileIt(ws({ expenses: { state: 'read', revisions: [heldBell] } }), '2028-04-20T15:00:00Z'), sources: null };
    const live2027 = ws({ expenses: { state: 'read', revisions: [heldBell, bellWithNumber] } });
    assert.equal(creditsFileRows(live2027, [unreadable] as never)[1][13], '');
  });
  it('carries supplier names only: no supplier number, address or contact column', () => {
    const header = CREDITS_FILE_HEADER.join('|').toLowerCase();
    assert.doesNotMatch(header, /number|address|email|phone|contact|postal|tax id/);
    const row = creditsFileRows(ws({ expenses: { state: 'read', revisions: [expense()] } }))[1].join('|');
    assert.doesNotMatch(row, /81234/, 'the supplier\'s number is in expenses.csv, not repeated here');
  });
  it('a supplier typed as a formula is neutralised the way every package file is', () => {
    const csv = packageCsv(creditsFileRows(ws({ expenses: { state: 'read', revisions: [expense({ supplier: '=HYPERLINK("http://x")' })] } })));
    assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/);
    assert.doesNotMatch(csv, /,"=HYPERLINK/);
  });
});

describe('gst-hst-as-filed.csv: every revision of every return filed inside the package\'s dates', () => {
  const w = ws({ sales: { ...noSales, invoices: [sale('a', '2027-03-10T15:00:00Z', 10_000, 1_300)] }, expenses: { state: 'read', revisions: [expense()] } });
  const first = fileIt(w, '2028-04-20T15:00:00Z');
  const second = fileIt(w, '2028-05-10T15:00:00Z', { filingNo: 2, periodRevision: 2, reason: 'Amended with the supplier’s number' });
  const stub = fileIt(ws({ period: { from: '2026-09-26', to: '2026-12-31' } }), '2027-02-01T15:00:00Z', { filingNo: 0 });

  it('only the returns inside the dates are included, oldest period first, revisions in order; none = no file', () => {
    assert.deepEqual(filingsInside([second, first, stub] as never, Y2027).map(f => f.filingNo), [1, 2]);
    assert.deepEqual(filingsInside([second, first, stub] as never, { from: '2026-01-01', to: '2028-12-31' }).map(f => [f.period.from, f.periodRevision]),
      [['2026-09-26', 1], ['2027-01-01', 1], ['2027-01-01', 2]]);
    assert.deepEqual(filingsInside([first, second] as never, Y2028), [], 'a filed period outside the dates is not in the package');
    assert.deepEqual(filingsInside([], Y2027), []);
  });
  it('has the header, and one row per line (101 in whole dollars) then per source, each carrying the filing\'s number, revision, dates and reason', () => {
    const rows = asFiledFileRows([first, second] as never);
    assert.deepEqual(rows[0], [...AS_FILED_HEADER]);
    const forFirst = rows.filter(r => r[0] === 1);
    assert.deepEqual(forFirst.filter(r => r[8] === 'Line').map(r => [r[9], r[13]]),
      [[101, '100'], [103, '13.00'], [104, '0.00'], [105, '13.00'], [106, '13.00'], [107, '0.00'], [108, '13.00'], [109, '0.00']]);
    assert.deepEqual(forFirst[0].slice(0, 8), [1, 1, 'No', '2027-01-01', '2027-12-31', '2028-04-20', '2028-04-20', '']);
    const amended = rows.filter(r => r[0] === 2);
    assert.deepEqual(amended[0].slice(0, 8), [2, 2, 'Yes', '2027-01-01', '2027-12-31', '2028-05-10', '2028-05-10', 'Amended with the supplier’s number']);
    assert.ok(forFirst.every(r => r.length === AS_FILED_HEADER.length));
  });
  it('line 101 is written as filed in whole dollars; its note says so', () => {
    const l101 = asFiledFileRows([first] as never).find(r => r[8] === 'Line' && r[9] === 101)!;
    assert.deepEqual([l101[13], l101[14]], ['100', 'Whole dollars']);
  });
  it('the invoice, expense credit and open items behind the lines are listed as they were frozen', () => {
    const rows = asFiledFileRows([first] as never);
    const invoice = rows.find(r => String(r[8]).startsWith('Invoice'))!;
    assert.deepEqual([invoice[9], invoice[11], invoice[12], invoice[13]], ['FLH-a', '2027-03-10', '100.00', '13.00']);
    const credit = rows.find(r => String(r[8]).startsWith('Expense credit'))!;
    assert.deepEqual([credit[9], credit[10], credit[13], credit[14]], ['60000000-0000-4000-8000-000000000001', 'Bell · revision 1', '13.00', CREDIT_STATE_WORDS.counted]);
  });
  it('a refund is a positive figure with the word, never a minus sign (a leading minus would become text in a spreadsheet)', () => {
    const refund = fileIt(ws({ expenses: { state: 'read', revisions: [expense()] } }), '2028-04-20T15:00:00Z');
    assert.equal(refund.lines[109], -1300);
    const l109 = asFiledFileRows([refund] as never).find(r => r[8] === 'Line' && r[9] === 109)!;
    assert.deepEqual([l109[13], l109[14]], ['13.00', 'Refund']);
    const cells = asFiledFileRows([refund, first, second] as never).flat().map(String);
    assert.equal(cells.some(c => /^-/.test(c)), false);
  });
  it('a filing that was open or partial when filed says so on its Filing row, and holds no buyer or person', () => {
    const partial = fileIt(ws({ expenses: { state: 'read', revisions: [heldBell] } }), '2028-04-20T15:00:00Z');
    const row = asFiledFileRows([partial] as never).find(r => r[8] === 'Filing')!;
    assert.match(String(row[14]), /Filed with 1 item under “Before you file” open/);
    assert.doesNotMatch(AS_FILED_HEADER.join('|').toLowerCase(), /buyer|club|name|email|address/);
  });
});

describe('the package route: where the GST/HST files come from', () => {
  const route = readFileSync('app/api/platform-admin/bookkeeping/package/route.ts', 'utf8');
  it('builds the worksheet from the sales and ALL expense revisions it already read: no second read, no filtered expenses', () => {
    assert.match(route, /readPackageWorksheet\(\{ period: invoiceFile\.period, registration: invoiceFile\.registration, sales: invoiceFile\.sales, expenses: \{ state: 'read', revisions \} \}\)/);
    assert.doesNotMatch(code('app/api/platform-admin/bookkeeping/package/route.ts'), /readGstReturnWorksheet|readWorksheetSales|readWorksheetExpenses/);
  });
  it('writes the three files by name, the as-filed file only when a return was filed inside the dates, and one scope line each', () => {
    assert.match(route, /name: PACKAGE_FILES\.worksheet/);
    assert.match(route, /name: PACKAGE_FILES\.credits/);
    assert.match(route, /\.\.\.\(asFiled\.length \? \[\{ name: PACKAGE_FILES\.asFiled/);
    assert.match(route, /\.\.\.gstScope,/);
    assert.deepEqual([PACKAGE_FILES.worksheet, PACKAGE_FILES.credits, PACKAGE_FILES.asFiled], ['gst-hst-worksheet.csv', 'gst-hst-credits.csv', 'gst-hst-as-filed.csv']);
  });
  it('still writes no second sales file: the invoice file is the sales record', () => {
    assert.doesNotMatch(route, /gst-hst-sales\.csv/);
    assert.match(route, /name: INVOICE_FILE_NAME/);
  });
  it('the scope lines name each file once and say what is and is not in it', () => {
    const p = { from: '2027-01-01', to: '2027-12-31' };
    assert.match(PACKAGE_FILES.scope.worksheet(p), /^gst-hst-worksheet\.csv: lines 101 to 109 .* 2027-01-01 to 2027-12-31 .*“Not available” with its reason, never zero\./);
    assert.match(PACKAGE_FILES.scope.worksheet(p), /expense filters below do not narrow it/);
    assert.match(PACKAGE_FILES.scope.worksheet(p), /today’s figures; a return marked filed for the same dates keeps its own in gst-hst-as-filed.csv/);
    assert.doesNotMatch(PACKAGE_FILES.scope.worksheet(p), /not a reporting period/);
    assert.match(PACKAGE_FILES.scope.worksheet(p, true), /not a reporting period: choose the return’s dates/);
    assert.match(PACKAGE_FILES.scope.credits, /Changed since you filed lists it/);
    assert.match(CREDIT_STATE_WORDS.before_registration, /ask your accountant/);
    assert.match(PACKAGE_FILES.scope.credits, /^gst-hst-credits\.csv: /);
    assert.match(PACKAGE_FILES.scope.asFiled(1), /^gst-hst-as-filed\.csv: the return marked as filed/);
    assert.match(PACKAGE_FILES.scope.asFiled(2), /the 2 returns/);
    assert.match(PACKAGE_FILES.scope.noFiled, /no gst-hst-as-filed\.csv/);
    assert.match(PACKAGE_FILES.scope.beforeRecord, /not included/);
  });
});
