import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { attentionReasons, currentExpenses, matchesReviewFilter, type ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import { matchesExpenseFilters, type ExpenseFilters } from '../../lib/bookkeeping-filters.ts';
import { parseExpenseFilters, selectExpenseRevisions } from '../../lib/bookkeeping-export.ts';
import { expenseCredit, NUMBER_MISSING_REASON, purchaseTaxCell, taxSummary } from '../../lib/bookkeeping-gst.ts';

// GST/HST Stage 4a Session C: the register's fifth reason, and every path that reads it agreeing (build prompt Part 5).
const SEPT_26 = '2026-09-26';
const MAY_1 = '2026-05-01';

/** Hollis Law, $650.00 with HST $74.78, saved since 4a with no supplier number: the drawing's "number missing" record. */
const held: ExpenseRevision = {
  expense_id: '40000000-0000-4000-8000-000000000001', revision: 1, expense_date: '2026-11-04',
  incurred_date: '2026-11-04', paid_date: '2026-11-04', supplier: 'Hollis Law', category: 'Professional services',
  business_purpose: 'Terms of service review', original_currency: 'CAD', original_cents: 65000, cad_cents: 65000,
  tax_cad_cents: 7478, tax_amount_known: true, tax_status: 'pending', business_use_percent: 100, payment_source: 'personal',
  conversion_note: null, notes: null, change_reason: null, receipt_path: 'private/a', receipt_name: 'hollis.pdf',
  void_reason: null, created_at: '2026-11-04T16:00:00Z', created_by: 'owner',
  tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 7478 }], supplier_tax_number: null,
  supplier_registration: 'normal', purchase_kind: 'operating', number_unobtainable: false,
};
const id = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
const withNumber = { ...held, expense_id: id(2), supplier_tax_number: '81234 5678 RT0001' };
const underHundred = { ...held, expense_id: id(3), original_cents: 4200, cad_cents: 4200, tax_cad_cents: 483, tax_lines: [{ type: 'hst13' as const, cents: 483 }] };
const cantGet = { ...held, expense_id: id(4), number_unobtainable: true };
const simplified = { ...held, expense_id: id(5), supplier: 'Canva', supplier_registration: 'simplified' as const };
/** A service dated June 1: before Sept 26 (no credit, nothing to ask for), after May 1 (held, so asked for). */
const june = { ...held, expense_id: id(6), expense_date: '2026-06-01', incurred_date: '2026-06-01', paid_date: '2026-06-01' };
/** Saved before 4a: one amount, no type. Never flagged. */
const legacy: ExpenseRevision = { ...held, expense_id: id(7), tax_answer: null, tax_lines: [], supplier_registration: null, purchase_kind: null };
const voided = { ...held, expense_id: id(8), void_reason: 'Duplicate' };
const unchecked = { ...held, expense_id: id(9), supplier_registration: 'not_checked' as const, supplier_tax_number: '81234 5678 RT0001' };
const rows = [held, withNumber, underHundred, cantGet, simplified, june, legacy, voided, unchecked];
const all: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'all' };

const flagged = (registrationDate: string | null) =>
  currentExpenses(rows).filter(row => attentionReasons(row, registrationDate).includes(NUMBER_MISSING_REASON)).map(row => row.expense_id);

describe('the fifth reason: GST/HST number missing', () => {
  it('is said only for a credit that would count but waits on the number', () => {
    assert.deepEqual(attentionReasons(held, SEPT_26), [NUMBER_MISSING_REASON]);
    assert.deepEqual(flagged(SEPT_26), [held.expense_id]);
  });
  it('is not said under $100, with the number, after "I can’t get the number", for simplified, for a legacy amount or a void', () => {
    for (const row of [withNumber, underHundred, cantGet, simplified, legacy, voided]) {
      assert.deepEqual(attentionReasons(row, SEPT_26), [], row.expense_id);
    }
  });
  it('a supplier whose registration is Not checked is not flagged for that alone', () => {
    assert.deepEqual(attentionReasons(unchecked, SEPT_26), []);
  });
  it('follows the registration date: a June service is asked for its number only once the date moves to May 1', () => {
    assert.equal(attentionReasons(june, SEPT_26).includes(NUMBER_MISSING_REASON), false);
    assert.equal(attentionReasons(june, MAY_1).includes(NUMBER_MISSING_REASON), true);
  });
  it('says nothing before migration 006 (no registration date), so no credit is guessed', () => {
    assert.deepEqual(flagged(null), []);
  });
});

describe('the register count, the Needs attention filter and an "attention" export always agree', () => {
  for (const date of [SEPT_26, MAY_1, null]) {
    it(`with the registration date ${date ?? 'not on record'}`, () => {
      const counted = currentExpenses(rows).filter(row => !row.void_reason && attentionReasons(row, date).length > 0).map(row => row.expense_id).sort();
      const filtered = currentExpenses(rows).filter(row => matchesExpenseFilters(row, { ...all, review: 'attention' }, date)).map(row => row.expense_id).sort();
      const reviewed = currentExpenses(rows).filter(row => matchesReviewFilter(row, 'attention', date)).map(row => row.expense_id).sort();
      // The register's "Needs attention" link, as the export and package routes parse it.
      const fromAddress = parseExpenseFilters(new URLSearchParams({ attention: '1', status: 'active' }))!;
      const exported = [...new Set(selectExpenseRevisions(rows, fromAddress, date).map(row => row.expense_id))].sort();
      assert.deepEqual(filtered, counted);
      assert.deepEqual(reviewed, counted);
      assert.deepEqual(exported, counted);
    });
  }
  it('and the record agrees: a flagged row is exactly one whose worked-out credit is held', () => {
    for (const row of rows.filter(item => !item.void_reason)) {
      assert.equal(attentionReasons(row, SEPT_26).includes(NUMBER_MISSING_REASON), expenseCredit(row, SEPT_26)?.state === 'held', row.expense_id);
    }
  });
});

describe('the closed More details row and the record’s Purchase tax cell, as drawn', () => {
  it('says the tax by type and the credit', () => {
    assert.equal(taxSummary('shown', withNumber.tax_lines!, expenseCredit(withNumber, SEPT_26)), 'HST $74.78 · credit $74.78');
    assert.equal(taxSummary('none', [], null), 'No tax');
    assert.equal(taxSummary('unknown', [], null), 'Tax unknown');
    assert.equal(taxSummary('shown', held.tax_lines!, expenseCredit(held, SEPT_26)), 'HST $74.78 · credit $74.78 held');
  });
  it('one tax on one line; two taxes one per line with the total and status once (Ask 13 A)', () => {
    assert.deepEqual(purchaseTaxCell('shown', [{ type: 'hst13', cents: 7478 }], 'pending'), { lines: ['HST 13% · $74.78 · Pending review'], note: null });
    assert.deepEqual(purchaseTaxCell('shown', [{ type: 'gst5', cents: 300 }, { type: 'pst', cents: 420 }], 'pending'),
      { lines: ['GST 5% · $3.00', 'PST · $4.20'], note: '$7.20 in all · Pending review' });
    assert.deepEqual(purchaseTaxCell('shown', [{ type: 'unset', cents: 7478 }], 'pending'), { lines: ['Type not set · $74.78 · Pending review'], note: null });
    assert.deepEqual(purchaseTaxCell('none', [], 'none'), { lines: ['No tax charged'], note: null });
    assert.deepEqual(purchaseTaxCell('unknown', [], 'pending'), { lines: ['Not sure yet'], note: null });
  });
});

describe('the form posts Session B’s fields and nothing it must not', () => {
  const form = readFileSync('app/platform-admin/bookkeeping/ExpenseFormWindow.tsx', 'utf8');
  it('names every 4a field the expenses API reads', () => {
    for (const field of ['taxAnswer', 'taxLines', 'taxCadAmount', 'supplierTaxNumber', 'supplierRegistration', 'purchaseKind', 'numberUnobtainable']) {
      assert.match(form, new RegExp(`form\\.set\\('${field}'`), field);
    }
  });
  it('stops sending the old known flag, never sends a credit, and drops the old sentence', () => {
    assert.doesNotMatch(form, /taxAmountKnown/);
    assert.doesNotMatch(form, /form\.set\('credit/i);
    assert.doesNotMatch(form, /does not claim a tax credit/);
    assert.doesNotMatch(form, /I know the purchase tax amount/);
  });
});
