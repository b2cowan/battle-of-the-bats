import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { buildWorksheet, type FiledRead, type SalesRead, type WorksheetInput, type WorksheetSale } from '../../lib/gst-return-worksheet.ts';
import {
  carryContext, changedSinceFiled, checkFiling, filedCredits, filingFor, freezeSources, latestFilings, linesKey, parseSources, type ChangeKind,
  type FilingRefusal, type GstReturnFiling,
} from '../../lib/gst-return-filing.ts';
import { changeSentence, copyLinesText, FILING, refusalWords, worksheetCsvRows } from '../../lib/gst-return-worksheet-text.ts';
import { orgDayKey } from '../../lib/timezone.ts';

// GST/HST Stage 4b Session C: "Mark as filed". The freeze, the rules for marking a period, "Changed since you filed", and the
// engine's "Credits from earlier periods" (ruling 12; CRA's route for a late ITC is a later return, GST_HST_RETURN_LINES.md §10).

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
/** Bell, $13.00 HST, HELD at first (no number), then the number added on May 3, 2028 (revision 2). */
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

/** A filing exactly as the route builds it, from a worksheet. */
function fileIt(w: ReturnType<typeof buildWorksheet>, at: string, over: Partial<GstReturnFiling> = {}): GstReturnFiling {
  return {
    filingNo: 1, period: w.period, periodRevision: 1, filedOn: orgDayKey(at), registrationDate: w.registrationDate!,
    lines: Object.fromEntries(Object.entries(w.lines).map(([k, l]) => [k, l.cents!])) as GstReturnFiling['lines'],
    wholeDollars101: w.parts[101].wholeDollars!, partial: w.partial, openItems: w.unresolved.filter(u => u.affects.length).length,
    sources: parseSources(JSON.stringify(freezeSources(w)))!, reason: null, createdAt: at, createdBy: 'owner', ...over,
  };
}
const filedRead = (...filings: GstReturnFiling[]): FiledRead => ({ state: 'read', periods: filedCredits(filings, orgDayKey) });
/** "Changed since you filed" for `filed`, with every filing on record (default: just this one), as the route calls it. */
const cmp = (filed: Parameters<typeof changedSinceFiled>[0], live: ReturnType<typeof buildWorksheet>, all: GstReturnFiling[] = [filed as GstReturnFiling]) =>
  changedSinceFiled(filed, live, carryContext(all, orgDayKey));

describe('the engine with no filings is exactly the engine before Session C', () => {
  it('every line, part and Before-you-file item is unchanged when the filings input is empty or absent', () => {
    const input: Partial<WorksheetInput> = { sales: { ...noSales, invoices: [sale('a', '2027-03-10T15:00:00Z', 10_000, 1_300)] }, expenses: { state: 'read', revisions: [heldBell, expense({ expense_id: '60000000-0000-4000-8000-000000000002' })] } };
    const before = ws(input);
    const empty = ws({ ...input, filed: { state: 'read', periods: [] } });
    assert.deepEqual(empty.lines, before.lines);
    assert.deepEqual(empty.unresolved, before.unresolved);
    assert.deepEqual(empty.parts[106].earlierCredits, []);
    assert.deepEqual(before.parts[106].earlierCredits, []);
  });
});

describe('"Credits from earlier periods" (ruling 12): a credit released after its period was filed lands on a later return, once', () => {
  const filed2027 = fileIt(ws({ expenses: { state: 'read', revisions: [heldBell] } }), '2028-04-20T15:00:00Z');
  const revisions = [heldBell, bellWithNumber];

  it('the filing froze the held credit at 0 (it did not count then)', () => {
    assert.equal(filed2027.lines[106], 0);
    assert.equal(filed2027.sources.credits[0].state, 'held');
  });
  it('lands on 2028\'s line 106 as an earlier-period credit (the number was added May 3, 2028)', () => {
    const w = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    assert.equal(w.lines[106].cents, 1300);
    assert.deepEqual(w.parts[106].earlierCredits.map(c => [c.supplier, c.cents, c.landsOn, c.filedPeriod.to]), [['Bell', 1300, '2028-05-03', '2027-12-31']]);
    assert.equal(w.parts[106].credits.length, 0, 'it is not one of 2028\'s own expenses');
  });
  it('not on the filed period itself, nor on any other later period', () => {
    const own = buildWorksheet({ period: Y2027, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    assert.deepEqual(own.parts[106].earlierCredits, []);
    assert.equal(own.lines[106].cents, 1300, 'the filed period\'s TODAY figures count it in place (Changed since you filed says so)');
    const y2029 = buildWorksheet({ period: { from: '2029-01-01', to: '2029-12-31' }, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    assert.deepEqual(y2029.parts[106].earlierCredits, []);
  });
  it('never twice: once 2028 is filed with it, it is claimed, and the 2027 credit is not carried again', () => {
    const w2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    const filed2028 = fileIt(w2028, '2029-04-15T15:00:00Z', { filingNo: 2 });
    assert.equal(filed2028.sources.earlierCredits[0].cents, 1300);
    const y2029 = buildWorksheet({ period: { from: '2029-01-01', to: '2029-12-31' }, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027, filed2028) });
    assert.deepEqual(y2029.parts[106].earlierCredits, [], 'claimed by the 2028 filing, so not carried again');
  });
  it('the return that carried it keeps it: 2028\'s own figures today still hold it, so nothing reads as changed', () => {
    const w2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    const filed2028 = fileIt(w2028, '2029-04-15T15:00:00Z', { filingNo: 2 });
    const today2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027, filed2028) });
    assert.equal(today2028.lines[106].cents, 1300);
    assert.deepEqual(cmp(filed2028, today2028, [filed2027, filed2028]), { state: 'compared', lines: [], changes: [] });
  });
  it('review: a later edit of a carried expense does not move it out of the return that carried it', () => {
    const w2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    const filed2028 = fileIt(w2028, '2029-04-15T15:00:00Z', { filingNo: 2 });
    const edited = [...revisions, expense({ revision: 3, created_at: '2029-08-15T12:00:00Z', notes: 'note fixed' })];
    const today2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: edited }, filed: filedRead(filed2027, filed2028) });
    assert.equal(today2028.lines[106].cents, 1300, 'still on 2028');
    assert.deepEqual(cmp(filed2028, today2028, [filed2027, filed2028]), { state: 'compared', lines: [], changes: [] }, 'never a false "no longer counts"');
    const y2029 = buildWorksheet({ period: { from: '2029-01-01', to: '2029-12-31' }, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: edited }, filed: filedRead(filed2027, filed2028) });
    assert.deepEqual(y2029.parts[106].earlierCredits, [], 'and not carried twice');
  });
  it('review: a credit that rises after it was carried keeps the carried part and lands the rest later', () => {
    const w2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    const filed2028 = fileIt(w2028, '2029-04-15T15:00:00Z', { filingNo: 2 });
    const bigger = [...revisions, expense({ revision: 3, created_at: '2029-08-15T12:00:00Z', tax_cad_cents: 1800, original_cents: 11800, cad_cents: 11800, tax_lines: [{ type: 'hst13', cents: 1800 }] })];
    const today2028 = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: bigger }, filed: filedRead(filed2027, filed2028) });
    assert.equal(today2028.lines[106].cents, 1300);
    const y2029 = buildWorksheet({ period: { from: '2029-01-01', to: '2029-12-31' }, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: bigger }, filed: filedRead(filed2027, filed2028) });
    assert.deepEqual(y2029.parts[106].earlierCredits.map(c => [c.cents, c.landsOn]), [[500, '2029-08-15']]);
  });
  it('review: a credit released with no new revision lands after the MOST RECENT filing, never in a period filed without it', () => {
    const jan = { from: '2028-01-01', to: '2028-01-31' };
    const feb = { from: '2028-02-01', to: '2028-02-29' };
    const janExpense = expense({ incurred_date: '2028-01-10', paid_date: '2028-01-10', expense_date: '2028-01-10', created_at: '2028-01-10T12:00:00Z' });
    const filedJan = fileIt(buildWorksheet({ period: jan, registrationDate: '2028-03-01', sales: noSales, expenses: { state: 'read', revisions: [janExpense] } }), '2028-02-01T15:00:00Z');
    const filedFeb = fileIt(buildWorksheet({ period: feb, registrationDate: '2028-03-01', sales: noSales, expenses: { state: 'read', revisions: [janExpense] }, filed: filedRead(filedJan) }), '2028-04-10T15:00:00Z', { filingNo: 2 });
    assert.equal(filedJan.lines[106], 0, 'before the registration date then');
    // The registration date moves earlier after both filings: Jan's credit now counts, and must land after April 10, not in February.
    const febToday = buildWorksheet({ period: feb, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [janExpense] }, filed: filedRead(filedJan, filedFeb) });
    assert.deepEqual(febToday.parts[106].earlierCredits, []);
    const apr = buildWorksheet({ period: { from: '2028-04-01', to: '2028-04-30' }, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [janExpense] }, filed: filedRead(filedJan, filedFeb) });
    assert.deepEqual(apr.parts[106].earlierCredits.map(c => [c.cents, c.landsOn]), [[1300, '2028-04-10']]);
  });
  it('review: "Copy lines" and the CSV say when 106 includes credits from earlier periods', () => {
    const w = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: filedRead(filed2027) });
    assert.match(copyLinesText(w), /^106\t[^\t]+\t13\.00 \(includes \$13\.00 credits from earlier periods\)$/m);
    assert.match(worksheetCsvRows(w).find(r => r[0] === '106')![3], /Includes \$13\.00 credits from earlier periods/);
  });
  it('a credit already counted in the filing never reappears', () => {
    const counted = fileIt(ws({ expenses: { state: 'read', revisions: [expense()] } }), '2028-04-20T15:00:00Z');
    const later = expense({ revision: 2, created_at: '2028-06-01T12:00:00Z', notes: 'renamed' });
    const w = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [expense(), later] }, filed: filedRead(counted) });
    assert.deepEqual(w.parts[106].earlierCredits, []);
  });
  it('a revision saved BEFORE the filing that counts more now (a registration-date change) lands on the day the period was filed', () => {
    const before = fileIt(ws({ registrationDate: '2027-06-01', expenses: { state: 'read', revisions: [expense()] } }), '2028-04-20T15:00:00Z');
    assert.equal(before.lines[106], 0, 'before the registration date then');
    const w = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions: [expense()] }, filed: filedRead(before) });
    assert.deepEqual(w.parts[106].earlierCredits.map(c => c.landsOn), ['2028-04-20']);
  });
  it('unreadable filings make line 106 Not available (never a silent short 106); the sales lines stand', () => {
    const w = buildWorksheet({ period: Y2028, registrationDate: REG, sales: noSales, expenses: { state: 'read', revisions }, filed: { state: 'failed' } });
    assert.equal(w.lines[106].cents, null);
    assert.equal(w.lines[106].notAvailable, 'filings_unread');
    assert.equal(w.lines[103].cents, 0);
    assert.ok(w.failures.includes('filings_unread'));
  });
});

describe('Changed since you filed', () => {
  it('a credit released after filing: line 106 moved, "claim it on a later return", and where it lands', () => {
    const filed = fileIt(ws({ expenses: { state: 'read', revisions: [heldBell] } }), '2028-04-20T15:00:00Z');
    const live = ws({ expenses: { state: 'read', revisions: [heldBell, bellWithNumber] } });
    const c = cmp(filed, live);
    assert.equal(c.state, 'compared');
    if (c.state !== 'compared') return;
    assert.deepEqual(c.lines.map(l => [l.line, l.filed, l.today]), [[106, 0, 1300], [108, 0, 1300], [109, 0, -1300]]);
    assert.deepEqual(c.changes.map(ch => [ch.kind, ch.effect, ch.cents, ch.released, ch.landsOn]), [['credit_more', 'later_return', 1300, true, '2028-05-03']]);
    assert.equal(changeSentence(c.changes[0]),
      '$13.00 credit released: Bell’s number added May 3, 2028. Claim it on a later return: it shows on line 106 as “Credits from earlier periods” on the return that covers May 3, 2028.');
  });
  it('a sale recorded after filing: adjust the filed return', () => {
    const filed = fileIt(ws({}), '2028-04-20T15:00:00Z');
    const live = ws({ sales: { ...noSales, invoices: [sale('late', '2027-11-02T15:00:00Z', 10_000, 1_300)] } });
    const c = cmp(filed, live);
    assert.ok(c.state === 'compared' && c.changes.some(ch => ch.kind === 'sale_added' && ch.effect === 'adjust_filed' && ch.cents === 1300));
  });
  it('a credit that went down: over-claimed, adjust the filed return', () => {
    const filed = fileIt(ws({ expenses: { state: 'read', revisions: [expense()] } }), '2028-04-20T15:00:00Z');
    const live = ws({ expenses: { state: 'read', revisions: [expense(), expense({ revision: 2, void_reason: 'Duplicate', created_at: '2028-05-01T12:00:00Z' })] } });
    const c = cmp(filed, live);
    assert.ok(c.state === 'compared' && c.changes.some(ch => ch.kind === 'credit_less' && ch.effect === 'adjust_filed' && ch.cents === 1300));
  });
  it('nothing changed: no lines, no changes', () => {
    const w = ws({ expenses: { state: 'read', revisions: [expense()] } });
    const c = cmp(fileIt(w, '2028-04-20T15:00:00Z'), w);
    assert.deepEqual(c, { state: 'compared', lines: [], changes: [] });
  });
  it('cannot compare when a line is Not available today, or the sources are unreadable', () => {
    const filed = fileIt(ws({}), '2028-04-20T15:00:00Z');
    assert.deepEqual(cmp(filed, ws({ sales: { state: 'failed' } })), { state: 'unknown', why: 'lines_not_available' });
    assert.deepEqual(cmp({ ...filed, sources: null }, ws({})), { state: 'unknown', why: 'sources_unreadable' });
  });
  it('every kind of change has a sentence that says what to do', () => {
    const kinds: ChangeKind[] = ['sale_added', 'sale_removed', 'sale_changed', 'note_added', 'note_removed', 'write_off_added', 'write_off_removed',
      'recovery_added', 'recovery_removed', 'credit_more', 'credit_less', 'earlier_credit_less', 'answer_added'];
    const declared = [...readFileSync('lib/gst-return-filing.ts', 'utf8').match(/export type ChangeKind =([\s\S]*?);/)![1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort();
    assert.deepEqual([...kinds].sort(), declared);
    for (const kind of kinds) {
      const s = changeSentence({ kind, effect: 'info', cents: 500, invoiceNumber: 'FLH-9', supplier: 'Bell', on: '2027-05-01', savedOn: '2028-05-03', landsOn: '2028-05-03' });
      assert.ok(s.length > 20 && !/undefined|null/.test(s), `${kind}: ${s}`);
    }
  });
});

describe('the rules for marking a period', () => {
  const w = ws({ expenses: { state: 'read', revisions: [expense()] } });
  const ok = { worksheet: w, filings: [], filedOn: '2028-04-20', today: '2028-05-01', expectedRevision: 0, reason: '', shownLines: linesKey(w) };
  /** The same request, for another worksheet the question showed. */
  const on = (worksheet: ReturnType<typeof buildWorksheet>) => ({ ...ok, worksheet, shownLines: linesKey(worksheet) });
  const why = (r: ReturnType<typeof checkFiling>) => r.ok ? 'ok' : r.refusal.why;

  it('marks a period that has ended, filed after its last day', () => {
    assert.deepEqual(checkFiling(ok), { ok: true, periodRevision: 1 });
  });
  it('refuses while any line is Not available (nothing can be frozen from an unknown)', () => {
    const r = checkFiling(on(ws({ sales: { state: 'failed' } })));
    assert.equal(why(r), 'not_available');
    assert.match(refusalWords((r as { refusal: FilingRefusal }).refusal), /^Lines 101, 103, 104, 105, 107, 108 and 109 can’t be worked out/);
  });
  it('warns, never blocks, on Before-you-file items and a partial period', () => {
    const open = ws({ expenses: { state: 'read', revisions: [heldBell] } });
    assert.ok(open.unresolved.length > 0);
    assert.equal(why(checkFiling(on(open))), 'ok');
    const partial = ws({ sales: { ...noSales, recordStart: null } });
    assert.ok(partial.partial);
    assert.equal(why(checkFiling(on(partial))), 'ok');
  });
  it('review: refuses when the figures the server works out are not the ones the question showed (it never saves the browser\'s)', () => {
    const shown = ws({ expenses: { state: 'read', revisions: [heldBell] } });
    assert.equal(why(checkFiling({ ...ok, shownLines: linesKey(shown) })), 'figures_changed');
    assert.equal(why(checkFiling({ ...ok, shownLines: '' })), 'figures_changed');
  });
  it('refuses a period that has not ended, a filed-on date inside it or in the future', () => {
    assert.equal(why(checkFiling({ ...ok, today: '2027-12-31' })), 'not_ended');
    assert.equal(why(checkFiling({ ...ok, filedOn: '2027-12-31' })), 'filed_on_too_early');
    assert.equal(why(checkFiling({ ...ok, filedOn: '2028-05-02' })), 'filed_on_future');
    assert.equal(why(checkFiling({ ...ok, filedOn: 'soon' })), 'filed_on_invalid');
  });
  it('overlapping periods are refused; identical dates are a new revision with a required reason', () => {
    const first = fileIt(w, '2028-04-20T15:00:00Z');
    const half = ws({ period: { from: '2027-07-01', to: '2028-06-30' } });
    assert.equal(why(checkFiling({ ...on(half), filings: [first], today: '2028-08-01', filedOn: '2028-07-15' })), 'overlaps');
    assert.equal(why(checkFiling({ ...ok, filings: [first], expectedRevision: 1 })), 'reason_missing');
    assert.deepEqual(checkFiling({ ...ok, filings: [first], expectedRevision: 1, reason: 'Amended: Bell’s number' }), { ok: true, periodRevision: 2 });
    assert.equal(why(checkFiling({ ...ok, filings: [first], expectedRevision: 0, reason: 'x' })), 'changed', 'someone filed it in between');
  });
  it('the latest revision shows and the history stays', () => {
    const first = fileIt(w, '2028-04-20T15:00:00Z');
    const second = fileIt(w, '2028-06-01T15:00:00Z', { filingNo: 2, periodRevision: 2, reason: 'Amended' });
    const found = filingFor([second, first], Y2027);
    assert.equal(found.state, 'filed');
    if (found.state === 'filed') { assert.equal(found.latest.periodRevision, 2); assert.equal(found.history.length, 2); }
    assert.deepEqual(latestFilings([first, second]).map(f => f.periodRevision), [2]);
  });
  it('every refusal has words', () => {
    const all: FilingRefusal[] = [{ why: 'not_available', lines: [106] }, { why: 'not_ended' }, { why: 'filed_on_invalid' }, { why: 'filed_on_too_early' },
      { why: 'filed_on_future' }, { why: 'overlaps', with: Y2027 }, { why: 'changed', current: 1 }, { why: 'reason_missing' }, { why: 'reason_too_long' },
      { why: 'figures_changed' }, { why: 'busy' }];
    for (const r of all) assert.ok(refusalWords(r).length > 10, r.why);
    assert.equal(FILING.chip('2028-04-20'), 'FILED APRIL 20, 2028');
  });
});

describe('the stored form', () => {
  it('sources round-trip, and an unknown format is refused rather than guessed', () => {
    const s = freezeSources(ws({ expenses: { state: 'read', revisions: [heldBell] } }));
    assert.deepEqual(parseSources(JSON.stringify(s)), s);
    assert.equal(parseSources(JSON.stringify({ ...s, v: 2 })), null);
    assert.equal(parseSources('not json'), null);
  });
});

describe('GUARD · Mark as filed', () => {
  const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const route = code('app/api/platform-admin/bookkeeping/gst-return/filings/route.ts');
  const post = route.slice(route.indexOf('export const POST'));

  it('the gate runs before any read, in both the list and the filing', () => {
    for (const handler of [route.slice(route.indexOf('export const GET'), route.indexOf('export const POST')), post]) {
      const gate = handler.indexOf('if (gate.response) return gate.response');
      assert.ok(gate > 0 && handler.indexOf('requireBookkeepingApi()') < gate);
      for (const read of ['listGstReturnFilings(', 'readGstReturnWorksheet(', 'hasGstReturnFilingsTable(']) {
        if (handler.includes(read)) assert.ok(gate < handler.indexOf(read), `${read} after the gate`);
      }
    }
  });
  it('a figure sent by the browser is never read: the body gives only the period, the filed-on date, a reason and a revision', () => {
    assert.doesNotMatch(post, /input\.[a-zA-Z]+/, 'no field is read past the one destructuring');
    assert.match(post, /const \{ from: rawFrom, to: rawTo, filedOn: rawFiledOn, reason: rawReason, shownLines: rawShown, expectedRevision \} = input;/);
    assert.match(post, /shownLines: text\(rawShown\) \}\)/, 'the shown fingerprint goes only to the comparison in checkFiling');
    assert.equal((post.match(/rawShown/g) ?? []).length, 2, 'and nowhere else');
    assert.match(post, /readGstReturnWorksheet\(\{ from, to \}\)/, 'the server works the worksheet out itself');
    assert.match(post, /sources: freezeSources\(worksheet\)/);
    assert.doesNotMatch(post, /input\.(lines|worksheet|sources|cents)|body\.lines/);
  });
  it('append-only: no update or delete anywhere near the filings table, no PATCH or DELETE route', () => {
    const store = readFileSync('lib/bookkeeping-store.ts', 'utf8');
    assert.doesNotMatch(store, /UPDATE\s+bookkeeping\.gst_return_filings|DELETE\s+FROM\s+bookkeeping\.gst_return_filings/i);
    assert.doesNotMatch(route, /export const (PATCH|PUT|DELETE)/);
    const sql = readFileSync('scripts/bookkeeping-aws/007_gst_return_filings.sql', 'utf8');
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').map(v => v.trim()).filter(Boolean)) {
      assert.match(statement, /^(CREATE TABLE IF NOT EXISTS bookkeeping\.gst_return_filings |REVOKE ALL ON bookkeeping\.gst_return_filings FROM PUBLIC$|GRANT SELECT, INSERT ON bookkeeping\.gst_return_filings TO bookkeeping_app$)/);
    }
    assert.doesNotMatch(sql, /\b(UPDATE|DELETE|DROP)\b/);
  });
  it('schema.sql declares the same table as 007', () => {
    const body = (text: string) => text.match(/CREATE TABLE (?:IF NOT EXISTS )?bookkeeping\.gst_return_filings \(([\s\S]*?)\n\);/)![1].trim();
    assert.equal(body(readFileSync('scripts/bookkeeping-aws/schema.sql', 'utf8')), body(readFileSync('scripts/bookkeeping-aws/007_gst_return_filings.sql', 'utf8')));
  });
  it('the runner is the development cluster only', () => {
    const runner = readFileSync('scripts/bookkeeping-dsql-filings-migration.mjs', 'utf8');
    assert.match(runner, /restricted to the local development bookkeeping database/);
    assert.match(runner, /007_gst_return_filings\.sql/);
  });
  it('the filed state reaches no other screen: not the Overview, not Money', () => {
    const client = code('app/platform-admin/bookkeeping/BookkeepingClient.tsx');
    const overview = client.slice(client.indexOf('function BookkeepingOverview'), client.indexOf('export default function BookkeepingClient'));
    assert.doesNotMatch(overview, /filing|filed|GstReturnFiling/i);
  });
});
