import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import { summarizeTaxPaid } from '../../lib/bookkeeping-gst.ts';
import { zeroRatedLine, type StoredTaxLine } from '../../lib/charge-tax-record.ts';
import {
  backfillCompleteMarker, buildWorksheet, WORKSHEET_NOTE_COLUMNS, WORKSHEET_SALE_COLUMNS,
  type ExpensesRead, type SalesRead, type WorksheetInput, type WorksheetNote, type WorksheetSale,
} from '../../lib/gst-return-worksheet.ts';

// GST/HST Stage 4b Session A: the return worksheet's rules, proved on built fixtures (dev Stripe has no sales rows).
// Rulings: docs/projects/active/GST_HST_STAGE4B_BUILD_PROMPT.md; tax rules: docs/agents/accounting/GST_HST_RETURN_LINES.md §7-§8.

const REG = '2026-09-26';
const YEAR = { from: '2027-01-01', to: '2027-12-31' };

const line = (taxType: string, rate: number, taxable: number, cents: number, extra: Partial<StoredTaxLine> = {}): StoredTaxLine => ({
  source: 'stripe', name: taxType.toUpperCase(), tax_type: taxType, jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA',
  region: null, rate, effective_rate: rate, taxable_cents: taxable, cents, taxability_reason: 'standard_rated', tax_rate_id: null, tax_behavior: 'exclusive',
  ...extra,
});
const hst = (rate: number, taxable: number) => line('hst', rate, taxable, Math.round(taxable * rate / 100));
const gst = (taxable: number) => line('gst', 5, taxable, Math.round(taxable * 5 / 100));
const pst = (taxable: number) => line('pst', 7, taxable, Math.round(taxable * 7 / 100), { name: 'PST', jurisdiction: 'British Columbia', jurisdiction_level: 'state' });

let n = 0;
const iid = () => `in_${String(++n).padStart(6, '0')}`;
function sale(over: Partial<WorksheetSale> = {}): WorksheetSale {
  const id = over.stripe_invoice_id ?? iid();
  const amount = over.amount_before_tax_cents ?? 10_000;
  const lines = over.tax_lines ?? [hst(13, amount)];
  const currency = over.currency ?? 'cad';
  return {
    stripe_invoice_id: id, invoice_number: `FLH-${id.slice(3)}`, kind: 'subscription', buyer_kind: 'club', org_id: '00000000-0000-4000-8000-000000000001',
    stripe_customer_id: 'cus_A', issued_at: '2027-03-10T15:00:00Z', currency, amount_before_tax_cents: amount,
    total_cents: amount + lines.reduce((s, l) => s + l.cents, 0), tax_lines: lines, gst_hst_position: 'taxed', gst_hst_position_why: null,
    taxed_country: 'CA', taxed_region: 'ON', status: 'paid', paid_at: '2027-03-10T15:05:00Z', voided_at: null, uncollectible_at: null,
    stripe_payment_intent_id: 'pi_A', fx_rate: currency === 'cad' ? 1 : 1.4, fx_rate_date: '2027-03-10',
    cad_amount_before_tax_cents: currency === 'cad' ? amount : Math.round(amount * (over.fx_rate ?? 1.4)),
    ...over,
  };
}
let m = 0;
function note(invoice: WorksheetSale, over: Partial<WorksheetNote> = {}): WorksheetNote {
  const lines = over.tax_lines ?? invoice.tax_lines;
  const before = over.amount_before_tax_cents ?? invoice.amount_before_tax_cents;
  return {
    stripe_credit_note_id: `cn_${String(++m).padStart(6, '0')}`, stripe_invoice_id: invoice.stripe_invoice_id, note_number: `CN-${m}`,
    note_type: 'post_payment', issued_at: '2027-04-02T15:00:00Z', currency: invoice.currency, amount_before_tax_cents: before,
    total_cents: before + lines.reduce((s, l) => s + l.cents, 0), tax_lines: lines, status: 'issued', ...over,
  };
}

const expense = (id: number, over: Partial<ExpenseRevision> = {}): ExpenseRevision => ({
  expense_id: `60000000-0000-4000-8000-0000000000${String(id).padStart(2, '0')}`, revision: 1, expense_date: '2027-02-04',
  incurred_date: '2027-02-04', paid_date: '2027-02-04', supplier: 'Hollis Law', category: 'Professional services', business_purpose: 'Terms',
  original_currency: 'CAD', original_cents: 5650, cad_cents: 5650, tax_cad_cents: 650, tax_amount_known: true, tax_status: 'reviewed',
  business_use_percent: 100, payment_source: 'business_card', conversion_note: null, notes: null, change_reason: null, receipt_path: null,
  receipt_name: null, void_reason: null, created_at: '2027-02-04T16:00:00Z', created_by: 'owner', tax_answer: 'shown',
  tax_lines: [{ type: 'hst13', cents: 650 }], supplier_tax_number: '81234 5678 RT0001', supplier_registration: 'normal',
  purchase_kind: 'operating', number_unobtainable: false, ...over,
});

const read = (invoices: WorksheetSale[], notes: WorksheetNote[] = [], recordStart: string | null = '2026-05-01'): SalesRead =>
  ({ state: 'read', invoices, notes, recordStart });
const noExpenses: ExpensesRead = { state: 'read', revisions: [] };
const build = (over: Partial<WorksheetInput> & { sales: SalesRead }) =>
  buildWorksheet({ period: YEAR, registrationDate: REG, expenses: noExpenses, ...over });
const kinds = (w: ReturnType<typeof build>) => w.unresolved.map(u => u.kind);

describe('Lines 101 and 103 · CAD, the provinces, and what is not GST/HST', () => {
  const on = sale({ amount_before_tax_cents: 240_000 });
  const ns = sale({ amount_before_tax_cents: 30_000, tax_lines: [hst(14, 30_000)], taxed_region: 'NS' });
  const nb = sale({ amount_before_tax_cents: 20_000, tax_lines: [hst(15, 20_000)], taxed_region: 'NB' });
  const ab = sale({ amount_before_tax_cents: 60_000, tax_lines: [gst(60_000)], taxed_region: 'AB' });
  const bc = sale({ amount_before_tax_cents: 50_000, tax_lines: [gst(50_000), pst(50_000)], taxed_region: 'BC' });
  const w = build({ sales: read([on, ns, nb, ab, bc]) });

  it('101 sums the before-tax amounts; 103 sums only the Canadian GST/HST lines (PST never)', () => {
    assert.equal(w.lines[101].cents, 400_000);
    assert.equal(w.parts[101].wholeDollars, 4_000);
    assert.equal(w.lines[103].cents, 31_200 + 4_200 + 3_000 + 3_000 + 2_500);
    assert.ok(w.lines[101].complete && w.lines[103].complete);
  });
  it('folds 103 into place and rate: "Ontario · HST 13% on $2,400.00"', () => {
    const ontario = w.parts[103].groups.find(g => g.region === 'ON')!;
    assert.deepEqual([ontario.taxType, ontario.rate, ontario.taxableCad, ontario.cents, ontario.invoices], ['hst', 13, 240_000, 31_200, 1]);
    const bcGroup = w.parts[103].groups.find(g => g.region === 'BC')!;
    assert.deepEqual([bcGroup.taxType, bcGroup.rate, bcGroup.cents], ['gst', 5, 2_500]);
    assert.equal(w.parts[103].groups.length, 5);
    const twoLines = sale({ tax_lines: [hst(13, 5_000), hst(13, 5_000)] });
    assert.equal(build({ sales: read([twoLines]) }).parts[103].groups[0].invoices, 1);
    assert.equal(w.parts[103].groups.reduce((s, g) => s + g.cents, 0), w.lines[103].cents);
  });
  it('the calculated lines are 103 + 104, 106 + 107, and 105 − 108', () => {
    assert.equal(w.lines[105].cents, w.lines[103].cents);
    assert.equal(w.lines[109].cents, w.lines[105].cents! - w.lines[108].cents!);
    assert.ok(w.lines[105].calculated && w.lines[108].calculated && w.lines[109].calculated && !w.lines[103].calculated);
  });
});

describe('USD · valued at the Bank of Canada rate already on the record', () => {
  it('a zero-rated US sale is in 101 at its CAD value, nothing in 103, and the memo names it', () => {
    const us = sale({ currency: 'usd', fx_rate: 1.4, amount_before_tax_cents: 10_000, tax_lines: [zeroRatedLine(10_000)], gst_hst_position: 'zero_rated', taxed_country: 'US', taxed_region: 'WA' });
    const w = build({ sales: read([us]) });
    assert.equal(w.lines[101].cents, 14_000);
    assert.equal(w.lines[103].cents, 0);
    assert.equal(w.parts[101].zeroRatedCad, 14_000);
    assert.equal(w.parts[103].groups.length, 0);
  });
  it('a foreign sale with no rate read is in neither line, is listed, and leaves both incomplete', () => {
    const noRate = sale({ currency: 'usd', fx_rate: null, fx_rate_date: null, cad_amount_before_tax_cents: null, tax_lines: [zeroRatedLine(10_000)], gst_hst_position: 'zero_rated' });
    const w = build({ sales: read([noRate, sale()]) });
    assert.equal(w.lines[101].cents, 10_000);
    assert.equal(w.lines[103].cents, 1_300);
    assert.deepEqual(kinds(w), ['sale_no_rate']);
    assert.equal(w.lines[101].complete, false);
    assert.equal(w.lines[103].complete, false);
    assert.equal(w.lines[106].complete, true);
  });
  it('two Canadian lines on one foreign invoice: converted once per invoice, the rounding residue on the larger line', () => {
    const two = sale({ currency: 'usd', fx_rate: 1.35, tax_lines: [line('gst', 5, 6_660, 333), line('gst', 5, 6_660, 333)] });
    const w = build({ sales: read([two]) });
    assert.equal(w.lines[103].cents, 899); // 666 × 1.35 = 899.1, not 2 × round(449.55) = 900
    assert.equal(w.parts[103].invoices[0].lines.reduce((s, l) => s + l.cadCents!, 0), 899);
  });
});

describe('Rounding · per invoice, and 101 once on the sum', () => {
  it('rounds each invoice to the cent before adding (three × 135.5 = 408, never 406.5 → 407)', () => {
    const three = [1, 2, 3].map(() => sale({ currency: 'usd', fx_rate: 1.355, amount_before_tax_cents: 769, tax_lines: [hst(13, 769)] }));
    assert.equal(three[0].tax_lines[0].cents, 100);
    assert.equal(build({ sales: read(three) }).lines[103].cents, 408);
  });
  it('whole dollars on 101 once on the sum ($10.49 + $10.49 = $21, not $10 + $10)', () => {
    const w = build({ sales: read([sale({ amount_before_tax_cents: 1_049 }), sale({ amount_before_tax_cents: 1_049 })]) });
    assert.equal(w.lines[101].cents, 2_098);
    assert.equal(w.parts[101].wholeDollars, 21);
  });
});

describe('Sales by ISSUE date · paid or not, by the Ontario day', () => {
  it('an unpaid and a failed invoice still owe their tax', () => {
    const open = sale({ status: 'open', paid_at: null, stripe_payment_intent_id: null });
    const failed = sale({ status: 'open', paid_at: null, stripe_payment_intent_id: null, issued_at: '2027-06-01T15:00:00Z' });
    assert.equal(build({ sales: read([open, failed]) }).lines[103].cents, 2_600);
  });
  it('11:30 p.m. on December 31 in Ontario is December 31, though it is already January 1 in UTC', () => {
    const late = sale({ issued_at: '2028-01-01T04:30:00Z' });
    assert.equal(build({ sales: read([late]) }).lines[103].cents, 1_300);
    assert.equal(build({ sales: read([late]), period: { from: '2028-01-01', to: '2028-12-31' } }).lines[103].cents, 0);
  });
});

describe('A missing answer stays visible', () => {
  it('lists every missing sale (the engine never sees a "looked at" mark), and 103 is not complete', () => {
    const missing = sale({ gst_hst_position: 'missing', gst_hst_position_why: 'canadian_buyer_not_charged', tax_lines: [], stripe_customer_id: 'cus_SHARED' });
    const w = build({ sales: read([missing, sale()]) });
    assert.deepEqual(kinds(w), ['sale_missing_answer']);
    assert.equal(w.unresolved[0].why, 'canadian_buyer_not_charged');
    assert.equal(w.lines[101].cents, 20_000);
    assert.equal(w.lines[103].complete, false);
    assert.equal(w.lines[101].complete, true);
  });
});

describe('Voids · a bare void earns no line 107 (/accounting 2026-11-07)', () => {
  it('a voided invoice stays in 101 and 103 and is listed; 107 is untouched', () => {
    const voided = sale({ status: 'void', voided_at: '2027-03-20T15:00:00Z', paid_at: null, stripe_payment_intent_id: null });
    const w = build({ sales: read([voided]) });
    assert.equal(w.lines[101].cents, 10_000);
    assert.equal(w.lines[103].cents, 1_300);
    assert.equal(w.lines[107].cents, 0);
    assert.deepEqual(kinds(w), ['sale_voided_no_note']);
    assert.deepEqual(w.unresolved[0].affects, []);
  });
  it('a void with a credit note reaches 107 through the note, and is not listed', () => {
    const voided = sale({ status: 'void', voided_at: '2027-03-20T15:00:00Z', paid_at: null, stripe_payment_intent_id: null });
    const w = build({ sales: read([voided], [note(voided, { note_type: 'pre_payment', issued_at: '2027-03-19T15:00:00Z' })]) });
    assert.equal(w.lines[107].cents, 1_300);
    assert.equal(w.lines[103].cents, 1_300);
    assert.deepEqual(kinds(w), []);
  });
});

describe('Credit notes · line 107 in the note\'s own period, 103 stays gross', () => {
  const inv = sale({ issued_at: '2026-12-10T15:00:00Z' });
  const half = note(inv, { amount_before_tax_cents: 5_000, tax_lines: [hst(13, 5_000)], issued_at: '2027-02-02T15:00:00Z' });
  it('a note in 2027 on a 2026 sale reduces 2027\'s 107, not 103', () => {
    const w = build({ sales: read([inv], [half]) });
    assert.equal(w.lines[103].cents, 0);
    assert.equal(w.lines[107].cents, 650);
    assert.equal(w.parts[107].creditNotes[0].noteId, half.stripe_credit_note_id);
    assert.equal(w.parts[101].creditNotesIssuedCad, 5_000);
    assert.equal(w.lines[101].cents, 0);
    const y2026 = build({ sales: read([inv], [half]), period: { from: '2026-01-01', to: '2026-12-31' } });
    assert.equal(y2026.lines[103].cents, 1_300);
    assert.equal(y2026.lines[107].cents, 0);
  });
  it('a voided credit note is excluded', () => {
    const voided = { ...half, status: 'void' as const };
    assert.equal(build({ sales: read([inv], [voided]) }).lines[107].cents, 0);
  });
  it('a USD note\'s tax is valued at the ORIGINAL invoice\'s rate, never its own day\'s', () => {
    const usd = sale({ currency: 'usd', fx_rate: 1.4, amount_before_tax_cents: 10_000, tax_lines: [gst(10_000)] });
    const back = note(usd, { tax_lines: [gst(10_000)], issued_at: '2027-05-05T15:00:00Z' });
    const w = build({ sales: read([usd], [back]) });
    assert.equal(w.lines[103].cents, 700);
    assert.equal(w.lines[107].cents, 700);
    assert.ok(!(WORKSHEET_NOTE_COLUMNS as readonly string[]).some(c => c.startsWith('cad_') || c.startsWith('fx_')));
  });
  it('a note whose invoice has no record is listed, never guessed onto 107', () => {
    const orphan = note(sale(), { issued_at: '2027-05-05T15:00:00Z' });
    const w = build({ sales: read([], [orphan]) });
    assert.equal(w.lines[107].cents, 0);
    assert.deepEqual(kinds(w), ['note_without_sale']);
    assert.equal(w.lines[107].complete, false);
  });
});

describe('Bad debts · written off on 107, recovered on 104', () => {
  const unpaid = { status: 'uncollectible' as const, paid_at: null, stripe_payment_intent_id: null };
  it('a write-off relieves the whole GST/HST in the period of uncollectible_at, on its own sub-line', () => {
    const off = sale({ ...unpaid, issued_at: '2026-11-10T15:00:00Z', uncollectible_at: '2027-01-12T15:00:00Z' });
    const w = build({ sales: read([off]) });
    assert.equal(w.lines[103].cents, 0);
    assert.equal(w.lines[107].cents, 1_300);
    assert.equal(w.parts[107].badDebts.length, 1);
    assert.equal(w.parts[107].creditNotes.length, 0);
  });
  it('relief = GST/HST × written off ÷ total, after a pre-payment credit note cut what was owed', () => {
    const off = sale({ ...unpaid, uncollectible_at: '2027-04-12T15:00:00Z' });
    const cut = note(off, { note_type: 'pre_payment', amount_before_tax_cents: 4_000, tax_lines: [hst(13, 4_000)], issued_at: '2027-04-01T15:00:00Z' });
    const w = build({ sales: read([off], [cut]) });
    assert.equal(w.parts[107].creditNotes[0].cents, 520);
    assert.deepEqual(w.parts[107].badDebts[0].share, { writtenOff: 6_780, total: 11_300 });
    assert.equal(w.parts[107].badDebts[0].cents, 780); // 1,300 × 6,780 ÷ 11,300
    assert.equal(w.lines[107].cents, 1_300);
  });
  it('a write-off after a part payment is listed, not guessed', () => {
    const partPaid = sale({ status: 'uncollectible', paid_at: null, stripe_payment_intent_id: 'pi_PART', uncollectible_at: '2027-04-12T15:00:00Z' });
    const w = build({ sales: read([partPaid]) });
    assert.equal(w.lines[107].cents, 0);
    assert.deepEqual(kinds(w), ['write_off_share_unknown']);
    assert.equal(w.lines[107].complete, false);
    assert.equal(w.lines[108].complete, false);
  });
  it('a recovered write-off puts the relief back on 104 in the period it was paid', () => {
    const back = sale({ issued_at: '2026-10-10T15:00:00Z', uncollectible_at: '2026-11-15T15:00:00Z', status: 'paid', paid_at: '2027-02-20T15:00:00Z', stripe_payment_intent_id: 'pi_LATE' });
    const y2026 = build({ sales: read([back]), period: { from: '2026-01-01', to: '2026-12-31' } });
    assert.equal(y2026.lines[107].cents, 1_300);
    const y2027 = build({ sales: read([back]) });
    assert.equal(y2027.lines[104].cents, 1_300);
    assert.equal(y2027.lines[107].cents, 0);
    assert.equal(y2027.lines[105].cents, 1_300);
  });
  it('a write-off and its recovery in one period net to zero on one return', () => {
    const both = sale({ uncollectible_at: '2027-04-15T15:00:00Z', status: 'paid', paid_at: '2027-06-01T15:00:00Z', stripe_payment_intent_id: 'pi_LATE' });
    const w = build({ sales: read([both]) });
    assert.equal(w.lines[104].cents, 1_300);
    assert.equal(w.lines[107].cents, 1_300);
    assert.equal(w.lines[109].cents, w.lines[103].cents);
  });
  it('a credit note after the write-off, then the payment: the recovery adds back only the tax on what was paid (s.231(3))', () => {
    const inv = sale({ uncollectible_at: '2027-04-01T15:00:00Z', status: 'paid', paid_at: '2027-06-01T15:00:00Z', stripe_payment_intent_id: 'pi_LATE' });
    const cut = note(inv, { note_type: 'pre_payment', issued_at: '2027-05-01T15:00:00Z', amount_before_tax_cents: 5_000, tax_lines: [hst(13, 5_000)] });
    const w = build({ sales: read([inv], [cut]) });
    assert.equal(w.lines[107].cents, 1_300); // the write-off took it all; the later note had nothing left (listed as capped)
    assert.equal(w.lines[104].cents, 650);   // 1,300 × (11,300 − 5,650) ÷ 11,300
    assert.equal(w.lines[107].cents! - w.lines[104].cents!, 650);
  });
  it('a write-off whose share exceeds what is left after a tax-only note is capped, and listed', () => {
    const inv = sale({ status: 'uncollectible', paid_at: null, stripe_payment_intent_id: null, uncollectible_at: '2027-05-01T15:00:00Z' });
    const taxOnly = note(inv, { note_type: 'pre_payment', issued_at: '2027-04-01T15:00:00Z', amount_before_tax_cents: 1_000, tax_lines: [hst(13, 10_000)] });
    const w = build({ sales: read([inv], [taxOnly]) });
    const off = w.parts[107].badDebts[0];
    assert.equal(off.wouldBe, 1_035); // 1,300 × 9,000 ÷ 11,300
    assert.equal(off.cents, 0);
    assert.equal(off.capped, true);
    assert.equal(w.lines[107].cents, 1_300);
    assert.deepEqual(kinds(w), ['relief_capped']);
  });
  it('a recovery of a foreign write-off with no rate is listed on 104, never silently $0', () => {
    const usd = sale({ currency: 'usd', fx_rate: null, fx_rate_date: null, cad_amount_before_tax_cents: null, issued_at: '2026-10-10T15:00:00Z',
      uncollectible_at: '2026-11-01T15:00:00Z', status: 'paid', paid_at: '2027-02-01T15:00:00Z', stripe_payment_intent_id: 'pi_LATE' });
    const w = build({ sales: read([usd]) });
    assert.deepEqual(w.unresolved.map(u => [u.kind, u.affects]), [['relief_no_rate', [104]]]);
    assert.equal(w.lines[104].complete, false);
  });
  it('relief never exceeds the invoice\'s GST/HST: a second full credit note is capped at 0 and listed; the write-off has nothing left', () => {
    const inv = sale({ status: 'uncollectible', paid_at: null, stripe_payment_intent_id: null, uncollectible_at: '2027-05-01T15:00:00Z' });
    const full = note(inv, { note_type: 'pre_payment', issued_at: '2027-04-01T15:00:00Z', amount_before_tax_cents: 10_000, tax_lines: [hst(13, 10_000)] });
    // A second full note after it, made by mistake: nothing more reaches 107.
    const again = note(inv, { note_type: 'pre_payment', issued_at: '2027-04-20T15:00:00Z', amount_before_tax_cents: 10_000, tax_lines: [hst(13, 10_000)] });
    const w = build({ sales: read([inv], [full, again]) });
    assert.equal(w.lines[107].cents, 1_300);
    const capped = w.unresolved.filter(u => u.kind === 'relief_capped');
    assert.equal(capped.length, 1);
    assert.equal(capped[0].cents, 1_300);
    assert.equal(w.parts[107].creditNotes[1].capped, true);
    assert.equal(w.parts[107].badDebts[0].cents, 0); // nothing owed was left to write off
  });
});

describe('The registration date · a sale before it sits outside the return', () => {
  const early = sale({ issued_at: '2026-09-10T15:00:00Z', gst_hst_position: 'missing', gst_hst_position_why: 'canadian_buyer_not_charged', tax_lines: [] });
  const period = { from: '2026-01-01', to: '2026-12-31' };
  it('is not in 101 or 103, is not "missing", and is listed for information only', () => {
    const w = build({ sales: read([early, sale({ issued_at: '2026-10-10T15:00:00Z' })]), period });
    assert.equal(w.lines[101].cents, 10_000);
    assert.deepEqual(kinds(w), ['sale_before_registration']);
    assert.deepEqual(w.unresolved[0].affects, []);
    assert.equal(w.lines[103].complete, true);
  });
  it('moves in when 4a\'s date moves earlier, and then its missing answer is listed', () => {
    const w = build({ sales: read([early]), period, registrationDate: '2026-09-01' });
    assert.equal(w.lines[101].cents, 10_000);
    assert.deepEqual(kinds(w), ['sale_missing_answer']);
  });
  it('a credit note on a sale outside the return reduces nothing (its tax was never reported)', () => {
    const outside = sale({ issued_at: '2026-09-10T15:00:00Z' });
    const w = build({ sales: read([outside], [note(outside, { issued_at: '2026-10-02T15:00:00Z' })]), period });
    assert.equal(w.lines[107].cents, 0);
  });
});

describe('Honest states · Not available, partial, nothing sold', () => {
  const credits: ExpensesRead = { state: 'read', revisions: [expense(1)] };
  it('A · sales unreadable: every sales line and the totals read Not available, line 106 still stands', () => {
    const w = build({ sales: { state: 'failed' }, expenses: credits });
    for (const n of [101, 103, 104, 105, 107, 108, 109] as const) {
      assert.equal(w.lines[n].cents, null, `line ${n}`);
      assert.equal(w.lines[n].notAvailable, 'sales_unread');
    }
    assert.equal(w.lines[106].cents, 650);
    assert.deepEqual(w.failures, ['sales_unread']);
    assert.equal(w.nothingSold, false);
  });
  it('the reverse · expenses unreadable: 106, 108 and 109 read Not available, the sales lines stand', () => {
    const w = build({ sales: read([sale()]), expenses: { state: 'failed', why: 'too_many' } });
    assert.equal(w.lines[103].cents, 1_300);
    assert.equal(w.lines[105].cents, 1_300);
    for (const n of [106, 108, 109] as const) assert.equal(w.lines[n].notAvailable, 'expenses_too_many');
    assert.equal(w.parts[106].notOnReturn, null);
  });
  it('the registration date unread: nothing can be split, so every line is Not available (never $0)', () => {
    const w = build({ sales: read([sale()]), expenses: credits, registrationDate: null });
    assert.ok(Object.values(w.lines).every(l => l.cents === null && l.notAvailable === 'registration_unread'));
  });
  it('B · nothing sold: zeros are true, 101 is $0, and the refund comes from credits alone', () => {
    const w = build({ sales: read([]), expenses: credits });
    assert.equal(w.nothingSold, true);
    assert.equal(w.lines[101].cents, 0);
    assert.equal(w.parts[101].wholeDollars, 0);
    assert.equal(w.lines[103].cents, 0);
    assert.ok(w.lines[103].complete);
    assert.equal(w.lines[109].cents, -650);
  });
  it('C · the period starts before the record does: the sales lines and the totals are partial, 106 is not', () => {
    const w = build({ sales: read([sale()], [], '2027-02-12'), expenses: credits });
    assert.equal(w.partial, true);
    assert.equal(w.salesRecordStart, '2027-02-12');
    for (const n of [101, 103, 104, 105, 107, 108, 109] as const) assert.equal(w.lines[n].partial, true, `line ${n}`);
    assert.equal(w.lines[106].partial, false);
    assert.equal(w.lines[103].complete, false);
    assert.equal(w.nothingSold, false);
  });
  it('C · where the record starts is unknown: partial too', () => {
    assert.equal(build({ sales: read([], [], null) }).partial, true);
  });
  it('not partial when the record starts before the registration date (the return only begins there)', () => {
    const w = build({ sales: read([], [], '2026-05-01'), period: { from: '2026-01-01', to: '2026-12-31' } });
    assert.equal(w.partial, false);
    assert.equal(w.nothingSold, true);
  });
});

describe('Line 106 · 4a\'s credits, and the bridge from Reports\' tax paid', () => {
  const rows = [
    expense(1),                                                                                                  // counted 650
    expense(2, { supplier: 'Client lunch', purchase_kind: 'meal', tax_cad_cents: 910, tax_lines: [{ type: 'hst13', cents: 910 }] }), // 455 + 455 share
    expense(3, { supplier: 'Canva', supplier_registration: 'simplified', tax_cad_cents: 208, tax_lines: [{ type: 'hst13', cents: 208 }] }),
    expense(4, { supplier: 'Staples', cad_cents: 11_300, supplier_tax_number: null, tax_cad_cents: 1_300, tax_lines: [{ type: 'hst13', cents: 1_300 }] }), // held
    expense(5, { supplier: 'Anthropic', supplier_registration: 'not_checked', tax_cad_cents: 260, tax_lines: [{ type: 'hst13', cents: 260 }] }),
    expense(6, { tax_answer: 'unknown', tax_lines: [], tax_cad_cents: 0, tax_amount_known: false }),
    expense(7, { tax_answer: null, tax_lines: [], tax_cad_cents: 1_300, supplier_registration: null, purchase_kind: null }), // type not set
    expense(8, { incurred_date: '2026-12-31', expense_date: '2026-12-31' }),                                     // another period
    expense(9, { void_reason: 'Duplicate' }),
    expense(10, { incurred_date: null, paid_date: null, tax_answer: null, tax_lines: [], tax_cad_cents: 500, supplier_registration: null }), // dates to review
    expense(11, { incurred_date: '2026-09-01', expense_date: '2026-09-01' }),
  ];
  const w = build({ sales: read([]), expenses: { state: 'read', revisions: rows } });
  it('an unconfirmed expense dated in another year is not listed in this one (it could not belong here)', () => {
    const otherYear = expense(12, { incurred_date: '2025-03-01', expense_date: '2025-03-01', paid_date: null });
    const thisYear = expense(13, { incurred_date: '2027-03-01', expense_date: '2027-03-01', paid_date: null });
    const v = build({ sales: read([]), expenses: { state: 'read', revisions: [otherYear, thisYear] } });
    assert.deepEqual(v.unresolved.map(u => u.expenseId), [thisYear.expense_id]);
  });
  it('counts only the counted credits', () => {
    assert.equal(w.lines[106].cents, 650 + 455 + 260);
    assert.equal(w.lines[106].complete, false);
  });
  it('lists held, tax unknown, supplier not checked, type not set and dates to review', () => {
    assert.deepEqual(kinds(w).sort(), ['credit_held', 'dates_to_review', 'registration_unchecked', 'tax_unknown', 'type_not_set']);
    assert.equal(w.unresolved.find(u => u.kind === 'credit_held')!.cents, 1_300);
  });
  it('the bridge closes: GST/HST paid − simplified − share not claimable − held = 106, and paid agrees with Reports', () => {
    const b = w.parts[106].notOnReturn!;
    const reports = summarizeTaxPaid(rows.filter(r => !r.void_reason && r.incurred_date && r.incurred_date >= YEAR.from && r.incurred_date <= YEAR.to));
    assert.equal(b.gstHstPaid.cents, reports.gstHstCents);
    assert.equal(b.simplified.cents, 208);
    assert.equal(b.held.cents, 1_300);
    assert.equal(b.shareNotClaimable.cents, 455);
    const out = b.simplified.cents + b.notRegistered.cents + b.beforeRegistration.cents + b.shareNotClaimable.cents + b.held.cents + b.notClaimed.cents + b.typeNotSet.cents;
    assert.equal(b.gstHstPaid.cents - out, w.lines[106].cents);
  });
  it('Session B: each listed expense names the steps it sits in, and each step\'s total is the sum of its expenses (the window filters by it)', () => {
    const b = w.parts[106].notOnReturn!;
    for (const step of ['simplified', 'notRegistered', 'beforeRegistration', 'shareNotClaimable', 'held', 'notClaimed'] as const) {
      const items = w.parts[106].credits.filter(c => c.notOnReturn[step] != null);
      assert.equal(items.reduce((sum, c) => sum + c.notOnReturn[step]!, 0), b[step].cents, step);
      assert.equal(items.length, b[step].count, `${step} count`);
    }
    assert.equal(w.parts[106].credits.filter(c => c.state === 'counted').reduce((sum, c) => sum + c.creditCents, 0), w.lines[106].cents);
  });
  it('Session B review: the "Tax type not set" step is the sum of the type-not-set items that carry bridgeCents (a pure unset expense carries none)', () => {
    const mixed = expense(14, { supplier: 'Mixed', tax_cad_cents: 1_010, tax_lines: [{ type: 'hst13', cents: 910 }, { type: 'unset', cents: 100 }] });
    const v = build({ sales: read([]), expenses: { state: 'read', revisions: [expense(7, { tax_answer: null, tax_lines: [], tax_cad_cents: 1_300, supplier_registration: null, purchase_kind: null }), mixed] } });
    const items = v.unresolved.filter(u => u.kind === 'type_not_set');
    assert.equal(items.length, 2);
    const carrying = items.filter(u => u.bridgeCents != null);
    const b = v.parts[106].notOnReturn!;
    assert.equal(carrying.reduce((sum, u) => sum + u.bridgeCents!, 0), b.typeNotSet.cents);
    assert.equal(carrying.length, b.typeNotSet.count);
    assert.equal(b.typeNotSet.cents, 910);
  });
});

describe('GUARD · what the worksheet reads', () => {
  const engine = readFileSync('lib/gst-return-worksheet.ts', 'utf8');
  const reader = readFileSync('lib/gst-return-worksheet-read.ts', 'utf8');
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('never reads platform_fee_invoices, the whole-tax columns, the refunded figure or the looked-at marks', () => {
    for (const [name, src] of [['engine', engine], ['reader', reader]] as const) {
      assert.doesNotMatch(code(src), /platform_fee_invoices|tax_total_cents|refunded_cents|platform_charge_tax_looks|console-money-looks|judgeSales|console-money-sales-store/, name);
    }
  });
  it('reads the invoice and note columns from the engine\'s lists only, with no whole-tax column in them', () => {
    assert.ok(!WORKSHEET_SALE_COLUMNS.some(c => /tax_total|refunded/.test(c)));
    assert.ok(!WORKSHEET_NOTE_COLUMNS.some(c => /tax_total|refund/.test(c)));
    assert.match(reader, /WORKSHEET_SALE_COLUMNS\.join/);
    assert.doesNotMatch(code(reader), /select\('\*'\)/);
  });
  it('the sales read has no row cap: every page, ordered on a unique key', () => {
    assert.doesNotMatch(code(reader), /\.limit\((?!1\))/);
    assert.match(reader, /readAllPages/);
  });
  it('the "backfill complete" marker is a JSON string (never an array: postgrest-js would write a Postgres array literal) in this mode', () => {
    const marker = backfillCompleteMarker(true);
    assert.equal(typeof marker, 'string');
    assert.deepEqual(JSON.parse(marker), [{ step: 'tax_records_backfill', ok: true, result: { complete: true, live: true } }]);
    assert.equal(JSON.parse(backfillCompleteMarker(false))[0].result.live, false);
    assert.match(reader, /\.contains\('new_value', backfillCompleteMarker\(live\)\)/);
    assert.doesNotMatch(code(reader), /\.contains\([^)]*\[/);
    // The job writes the same keys it is matched on: the step name, complete and the mode.
    const job = readFileSync('lib/charge-tax-record-server.ts', 'utf8');
    assert.match(job, /complete: failed === 0 && invoices\.left === 0 && notes\.left === 0, live \}/);
    assert.match(readFileSync('app/api/platform-admin/stripe-fees-daily/route.ts', 'utf8'), /run\('tax_records_backfill', \(\) => backfillChargeTaxRecords\(now\)\)/);
  });
  it('the registration-date rule is Stage 3\'s, not a second one', () => {
    assert.match(engine, /import \{ beforeRegistration \} from '\.\/console-money-sales'/);
    assert.match(engine, /expenseCredit\(row, registration\)/);
  });
});
