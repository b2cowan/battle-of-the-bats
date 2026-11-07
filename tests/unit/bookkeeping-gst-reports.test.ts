import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { currentExpenses, hasConfirmedDates, matchesReviewFilter, summarizeExpenses, REVIEW_FILTERS, type ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import { expenseFilterParams, matchesExpenseFilters, type ExpenseFilters } from '../../lib/bookkeeping-filters.ts';
import { parseExpenseFilters, selectExpenseRevisions } from '../../lib/bookkeeping-export.ts';
import { isTaxReviewPending, summarizeTaxPaid, TAX_PAID_NOTE, taxPaidRowLabel, TAX_TYPES, taxTypesPaid } from '../../lib/bookkeeping-gst.ts';

// GST/HST Stage 4a Session D, Part 6: Reports' "Purchase tax paid", its doors, and the Review view "Tax review pending".
const SEPT_26 = '2026-09-26';
const id = (n: number) => `50000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const hst: ExpenseRevision = {
  expense_id: id(1), revision: 1, expense_date: '2026-11-04', incurred_date: '2026-11-04', paid_date: '2026-11-04',
  supplier: 'Hollis Law', category: 'Professional services', business_purpose: 'Terms review', original_currency: 'CAD',
  original_cents: 65000, cad_cents: 65000, tax_cad_cents: 7478, tax_amount_known: true, tax_status: 'pending',
  business_use_percent: 50, payment_source: 'business_card', conversion_note: null, notes: null, change_reason: null,
  receipt_path: 'private/a', receipt_name: 'a.pdf', void_reason: null, created_at: '2026-11-04T16:00:00Z', created_by: 'owner',
  tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 7478 }], supplier_tax_number: '81234 5678 RT0001',
  supplier_registration: 'normal', purchase_kind: 'operating', number_unobtainable: false,
};
/** A BC receipt: GST 5% + PST 7% on $200. */
const bc = { ...hst, expense_id: id(2), supplier: 'Vancouver Print', cad_cents: 22400, original_cents: 22400, tax_cad_cents: 2400,
  tax_lines: [{ type: 'gst5' as const, cents: 1000 }, { type: 'pst' as const, cents: 1400 }], tax_status: 'reviewed' as const };
const canva = { ...hst, expense_id: id(3), supplier: 'Canva', cad_cents: 1680, original_cents: 1680, tax_cad_cents: 180,
  tax_lines: [{ type: 'hst13' as const, cents: 180 }], supplier_registration: 'simplified' as const };
const unknown = { ...hst, expense_id: id(4), tax_answer: 'unknown' as const, tax_lines: [], tax_cad_cents: 0, tax_amount_known: false };
const noTax = { ...hst, expense_id: id(5), tax_answer: 'none' as const, tax_lines: [], tax_cad_cents: 0, tax_status: 'none' as const };
/** Saved before 4a with an amount: one line of "Type not set". */
const legacy = { ...hst, expense_id: id(6), tax_answer: null, tax_lines: [], tax_cad_cents: 1300, supplier_registration: null, purchase_kind: null };
const nova = { ...hst, expense_id: id(7), tax_cad_cents: 1500, tax_lines: [{ type: 'hst15' as const, cents: 1500 }] };
const voided = { ...hst, expense_id: id(8), void_reason: 'Duplicate' };
const rows: ExpenseRevision[] = [hst, bc, canva, unknown, noTax, legacy, nova, voided];

describe('Reports · Purchase tax paid', () => {
  const summary = summarizeExpenses(rows.filter(hasConfirmedDates)).taxPaid;

  it('reports the FULL tax on each receipt, never the business-use share (/accounting 2026-11-06)', () => {
    assert.equal(summary.rows.find(row => row.type === 'hst13')!.cents, 7478 + 180);
    assert.match(TAX_PAID_NOTE, /in full/);
  });

  it('the GST/HST rows add up to the band, and simplified sellers are a part of it', () => {
    const gstHstRows = summary.rows.filter(row => TAX_TYPES[row.type].gstHst);
    assert.equal(gstHstRows.reduce((total, row) => total + row.cents, 0), summary.gstHstCents);
    assert.equal(summary.gstHstCents, 7478 + 1000 + 180 + 1500);
    assert.equal(summary.gstHstCount, 4);
    assert.deepEqual([summary.simplifiedCents, summary.simplifiedCount], [180, 1]);
    assert.ok(summary.simplifiedCents <= summary.gstHstCents);
    assert.equal(summary.unknownCount, 1);
  });

  it('shows only types paid, in the drawn order, and keeps "Type not set" while any exist', () => {
    assert.deepEqual(summary.rows.map(row => row.label), ['GST 5%', 'HST 13%', 'HST 15%', 'PST · part of the cost', 'Type not set']);
    assert.deepEqual(summary.rows.find(row => row.type === 'pst'), { type: 'pst', label: 'PST · part of the cost', count: 1, cents: 1400 });
    assert.ok(!summarizeTaxPaid([hst, bc]).rows.some(row => row.type === 'unset'));
    assert.deepEqual((Object.keys(TAX_TYPES) as (keyof typeof TAX_TYPES)[]).map(taxPaidRowLabel),
      ['GST 5%', 'HST 13%', 'HST 14%', 'HST 15%', 'PST · part of the cost', 'QST', 'Other', 'Type not set']);
  });

  it('a BC two-tax receipt counts once in the band and in both its rows; PST is not in the band', () => {
    const one = summarizeTaxPaid([bc]);
    assert.deepEqual([one.gstHstCents, one.gstHstCount], [1000, 1]);
    assert.deepEqual(one.rows.map(row => [row.type, row.count, row.cents]), [['gst5', 1, 1000], ['pst', 1, 1400]]);
  });

  it('uses the same rows as By category: active, current revisions only', () => {
    const corrected = { ...hst, revision: 2, tax_cad_cents: 100, tax_lines: [{ type: 'hst13' as const, cents: 100 }] };
    const revised = summarizeExpenses([hst, corrected]).taxPaid;
    assert.equal(revised.gstHstCents, 100);
    assert.equal(summarizeExpenses([voided]).taxPaid.gstHstCount, 0);
  });
});

describe('Reports · a tax-type row is a door, and the export follows it', () => {
  it('each type row filters to the expenses that paid that type', () => {
    assert.deepEqual(taxTypesPaid(bc), ['gst5', 'pst']);
    assert.deepEqual(taxTypesPaid(legacy), ['unset']);
    assert.deepEqual(taxTypesPaid(unknown), []);
    const pst: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'all', taxType: 'pst' };
    assert.deepEqual(currentExpenses(rows).filter(row => matchesExpenseFilters(row, pst, SEPT_26)).map(row => row.expense_id), [bc.expense_id]);
  });

  it('the screen, the address and the export agree on a tax type', () => {
    const screen: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'all', dateStatus: 'confirmed', taxType: 'hst13', status: 'active' };
    const parsed = parseExpenseFilters(expenseFilterParams(screen))!;
    assert.equal(parsed.taxType, 'hst13');
    const onScreen = currentExpenses(rows).filter(row => matchesExpenseFilters(row, screen, SEPT_26)).map(row => row.expense_id).sort();
    const exported = [...new Set(selectExpenseRevisions(rows, parsed, SEPT_26).map(row => row.expense_id))].sort();
    assert.deepEqual(exported, onScreen);
    assert.deepEqual(onScreen, [hst.expense_id, canva.expense_id].sort());
  });

  it('a Reports door exports what its line list shows: active expenses only, and Reset filters clears a tax type (Session E /review)', () => {
    const client = readFileSync('app/platform-admin/bookkeeping/BookkeepingClient.tsx', 'utf8');
    assert.match(client, /reportRows = useMemo\(\(\) => datedVisible\.filter\(row => !row\.void_reason/);
    assert.match(client, /dateStatus: 'confirmed', status: 'active' \} : screen/);
    const register = readFileSync('app/platform-admin/bookkeeping/ExpensesRegister.tsx', 'utf8');
    assert.match(register, /function clearFilters\(\) \{[^}]*taxType: null/);
    assert.match(register, /filters\.taxType && `\$\{taxPaidRowLabel\(filters\.taxType\)\} · `/);
  });

  it('refuses a tax type it does not know', () => {
    assert.equal(parseExpenseFilters(new URLSearchParams({ taxType: 'vat' })), null);
    assert.equal(parseExpenseFilters(new URLSearchParams())!.taxType, undefined);
  });
});

describe('Review view · Tax review pending', () => {
  it('is an amount shown on the receipt whose review is pending (a pre-4a amount too)', () => {
    assert.equal(isTaxReviewPending(hst), true);
    assert.equal(isTaxReviewPending(bc), false); // reviewed
    assert.equal(isTaxReviewPending(unknown), false); // pending, but nothing to review yet
    assert.equal(isTaxReviewPending(noTax), false);
    assert.equal(isTaxReviewPending(legacy), true);
    assert.equal(matchesReviewFilter(voided, 'tax_pending', SEPT_26), false);
  });

  it('the screen and an export agree, and the parser accepts every Review view value', () => {
    assert.ok(REVIEW_FILTERS.includes('tax_pending'));
    for (const review of REVIEW_FILTERS) assert.ok(parseExpenseFilters(new URLSearchParams({ review })), review);
    const screen: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'tax_pending' };
    const parsed = parseExpenseFilters(expenseFilterParams(screen))!;
    assert.equal(parsed.review, 'tax_pending');
    const onScreen = currentExpenses(rows).filter(row => matchesExpenseFilters(row, screen, SEPT_26)).map(row => row.expense_id).sort();
    const exported = [...new Set(selectExpenseRevisions(rows, parsed, SEPT_26).map(row => row.expense_id))].sort();
    assert.deepEqual(exported, onScreen);
    assert.deepEqual(onScreen, [hst.expense_id, canva.expense_id, legacy.expense_id, nova.expense_id].sort());
  });
});

describe('No credit figure on Reports or the Overview (ruling 3)', () => {
  const client = readFileSync('app/platform-admin/bookkeeping/BookkeepingClient.tsx', 'utf8');
  const overview = client.slice(client.indexOf('function BookkeepingOverview'), client.indexOf('export default function BookkeepingClient'));

  it('the Overview renders no tax figure and no tax word', () => {
    assert.ok(overview.length > 500, 'the Overview source was found');
    assert.doesNotMatch(overview, /GST|HST|credit|tax_cad|taxPaid|tax_lines|Tax/i);
  });

  it('Reports never works out a credit', () => {
    assert.doesNotMatch(client, /expenseCredit|workOutCredit|creditCents|countsOnReturn/);
    assert.doesNotMatch(client, /Purchase tax recorded/);
  });

  it('the Review view offers Tax review pending, and Change date re-reads after saving', () => {
    assert.match(client, /<option value="tax_pending">Tax review pending<\/option>/);
    assert.match(client, /<GstRegistrationQuestion[\s\S]*?onSaved=\{\(\) => \{[^}]*void load\(\)/);
    assert.match(client, /disabled=\{!gstSchemaReady\}/);
    const question = readFileSync('app/platform-admin/bookkeeping/GstRegistrationQuestion.tsx', 'utf8');
    assert.match(question, /expectedRevision: history\[0\]\.revision/);
    assert.match(question, /response\.status === 409\) await readHistory\(\)\.then\(setHistory\)/);
  });
});
