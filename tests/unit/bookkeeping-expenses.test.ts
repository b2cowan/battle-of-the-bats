import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasUnsetTaxType, validateExpenseTaxFields } from '../../lib/bookkeeping-expenses.ts';
import { expenseCredit } from '../../lib/bookkeeping-gst.ts';
import { businessCents, csvCell, currentExpenses, expenseConversionRate, isConversionSource, isExpenseDate, lastConversionSource, matchesReviewFilter, parseCents, redactExpenseRevision, summarizeExpenses, type ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';

const base: ExpenseRevision = {
  expense_id: '11111111-1111-4111-8111-111111111111', revision: 1,
  expense_date: '2026-05-01', supplier: 'Hosting', category: 'Software', business_purpose: 'Platform hosting',
  original_currency: 'CAD', original_cents: 113, cad_cents: 113, tax_cad_cents: 13,
  tax_status: 'pending', business_use_percent: 50, payment_source: 'personal',
  conversion_note: null, notes: null, change_reason: null, receipt_path: 'private/object', receipt_name: 'invoice.pdf',
  void_reason: null, created_at: '2026-05-02T00:00:00Z', created_by: 'owner',
};

describe('proprietor expense revisions', () => {
  it('uses only the latest revision and drops a void from totals without losing history', () => {
    const corrected = { ...base, revision: 2, cad_cents: 213, change_reason: 'Corrected total' };
    assert.equal(currentExpenses([corrected, base])[0].revision, 2);
    assert.equal(summarizeExpenses([base, corrected]).recordedSpendCents, 107);
    const voided = { ...corrected, revision: 3, void_reason: 'Duplicate' };
    assert.deepEqual(summarizeExpenses([base, corrected, voided]), {
      count: 0, recordedSpendCents: 0, pendingTaxCents: 0, byCategory: [], bySupplier: [], unknownTaxCount: 0,
      taxByStatus: [['pending', 0], ['reviewed', 0], ['none', 0]], byPaymentSource: [],
      missingReceiptCount: 0, missingConversionCount: 0, personallyPaidCents: 0,
    });
  });
  it('rounds business share once in cents and keeps purchase tax pending', () => {
    assert.equal(businessCents(base), 57);
    assert.equal(summarizeExpenses([base]).pendingTaxCents, 7);
  });
  it('applies business use consistently to tax and payment-source reports', () => {
    const reviewed = { ...base, expense_id: '22222222-2222-4222-8222-222222222222', tax_status: 'reviewed' as const, payment_source: 'business_card' as const, tax_cad_cents: 21 };
    const summary = summarizeExpenses([base, reviewed]);
    assert.equal(summary.recordedSpendCents, 114);
    assert.equal(summary.pendingTaxCents, 7);
    assert.deepEqual(summary.taxByStatus, [['pending', 7], ['reviewed', 11], ['none', 0]]);
    assert.equal(summary.personallyPaidCents, 57);
    assert.deepEqual(summary.byPaymentSource, [['business_card', 57], ['personal', 57]]);
  });
  it('isolates active missing receipts and requires an explicit USD source without guessing from legacy notes', () => {
    const noReceipt = { ...base, expense_id: '22222222-2222-4222-8222-222222222222', receipt_path: null, receipt_name: null };
    const usd = { ...noReceipt, expense_id: '33333333-3333-4333-8333-333333333333', original_currency: 'USD' as const, conversion_source: 'bank_of_canada' as const, conversion_note: null };
    const badUsd = { ...usd, conversion_source: null, conversion_note: 'Bank of Canada rate 2026-10-22' };
    const voided = { ...badUsd, expense_id: '33333333-3333-4333-8333-333333333333', void_reason: 'Duplicate' };
    assert.equal(matchesReviewFilter(noReceipt, 'missing_receipt', '2026-09-26'), true);
    assert.equal(matchesReviewFilter(usd, 'missing_conversion', '2026-09-26'), false);
    assert.equal(matchesReviewFilter(badUsd, 'missing_conversion', '2026-09-26'), true);
    assert.equal(matchesReviewFilter(voided, 'missing_conversion', '2026-09-26'), false);
    assert.equal(isConversionSource('card_statement'), true);
    for (const invalid of [null, '', 'Card statement', 'anything', 'constructor', '__proto__']) assert.equal(isConversionSource(invalid), false);
    assert.equal(summarizeExpenses([noReceipt, badUsd, voided]).missingReceiptCount, 2);
    assert.equal(summarizeExpenses([noReceipt, badUsd, voided]).missingConversionCount, 1);
  });
  it('derives a positive rate from receipt cents, including the supported amount extremes', () => {
    assert.equal(expenseConversionRate(4559, 6412), 1.40644878262777);
    assert.equal(expenseConversionRate(1000, 1400), 1.4);
    assert.ok(expenseConversionRate(99_999_999_999, 1)! > 0);
    assert.equal(expenseConversionRate(1, 99_999_999_999), 99_999_999_999);
    for (const invalid of [0, -1, 1.5, NaN, Infinity]) {
      assert.equal(expenseConversionRate(invalid, 100), null);
      assert.equal(expenseConversionRate(100, invalid), null);
    }
  });
  it('remembers the most recently saved USD source for the chosen payment source only', () => {
    const old = { ...base, original_currency: 'USD' as const, conversion_source: 'bank_statement' as const };
    const latest = { ...old, created_at: '2026-10-30T10:00:00Z', conversion_source: 'card_statement' as const };
    const other = { ...latest, created_at: '2026-10-30T11:00:00Z', payment_source: 'other' as const, conversion_source: 'invoice_cad' as const };
    assert.equal(lastConversionSource([other, old, latest], 'personal'), 'card_statement');
    assert.equal(lastConversionSource([other, old, latest], 'other'), 'invoice_cad');
    assert.equal(lastConversionSource([other, old, { ...latest, void_reason: 'Duplicate' }], 'personal'), 'bank_statement');
    assert.equal(lastConversionSource([{ ...old, conversion_source: null }], 'personal'), '');
  });
  it('keeps the storage path out of browser data and protects CSV formulas', () => {
    assert.equal(redactExpenseRevision(base).receipt_path, '[private]');
    assert.equal(csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
    assert.equal(csvCell('Normal "supplier"'), '"Normal ""supplier"""');
  });
  it('rejects fractional-cent amounts and calendar overflow dates', () => {
    assert.equal(parseCents('12.345'), null);
    assert.equal(parseCents('12.30'), 1230);
    assert.equal(isExpenseDate('2026-02-30'), false);
    assert.equal(isExpenseDate('2026-10-23'), true);
  });
});

describe('GST/HST Stage 4a · the tax section of a save', () => {
  const input = (extra: Partial<Parameters<typeof validateExpenseTaxFields>[0]> = {}) => validateExpenseTaxFields({
    taxAnswer: 'shown', taxLines: JSON.stringify([{ type: 'gst5', cents: 5 }, { type: 'pst', cents: 8 }]), taxCents: 13,
    supplierTaxNumber: null, hasSupplierTaxNumber: false, supplierRegistration: 'not_checked', purchaseKind: 'operating',
    numberUnobtainable: 'false', allowUnsetType: false, ...extra,
  });
  it('accepts lines that add up to the tax amount, and derives the legacy known flag from the answer', () => {
    const checked = input();
    assert.ok('value' in checked);
    assert.deepEqual(checked.value.tax_lines, [{ type: 'gst5', cents: 5 }, { type: 'pst', cents: 8 }]);
    assert.equal(checked.value.tax_amount_known, true);
    const unknown = input({ taxAnswer: 'unknown', taxLines: null, taxCents: 0 });
    assert.ok('value' in unknown); assert.equal(unknown.value.tax_amount_known, false);
  });
  it('refuses lines that do not add up, and lines on an answer that has none', () => {
    assert.deepEqual(input({ taxCents: 14 }), { field: 'taxLines', error: "The tax lines don't add up to the tax amount. Reload the page and try again." });
    assert.deepEqual(input({ taxLines: '[]' }), { field: 'taxLines', error: 'Enter the tax amount.' });
    assert.ok(!('value' in input({ taxAnswer: 'none' })));
    assert.ok(!('value' in input({ taxAnswer: 'none', taxLines: '[]', taxCents: 5 })));
    assert.ok('value' in input({ taxAnswer: 'none', taxLines: '[]', taxCents: 0 }));
    assert.ok(!('value' in input({ taxLines: JSON.stringify(Array.from({ length: 11 }, () => ({ type: 'other', cents: 1 }))), taxCents: 11 })));
  });
  it('lets “Type not set” through only where the saved expense already had it', () => {
    const unset = JSON.stringify([{ type: 'unset', cents: 13 }]);
    assert.ok(!('value' in input({ taxLines: unset })));
    assert.ok('value' in input({ taxLines: unset, allowUnsetType: true }));
    assert.equal(hasUnsetTaxType({ ...base, tax_amount_known: true }), true);
    assert.equal(hasUnsetTaxType({ ...base, tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 13 }] }), false);
    assert.equal(hasUnsetTaxType({ ...base, tax_cad_cents: 0, tax_amount_known: false }), false);
  });
  it('stores blank supplier facts as not stated, and drops “can’t get the number” when one is given', () => {
    const blank = input({ supplierTaxNumber: '', hasSupplierTaxNumber: true, supplierRegistration: '', purchaseKind: '', numberUnobtainable: '' });
    assert.ok('value' in blank);
    assert.deepEqual([blank.value.supplier_tax_number, blank.value.supplier_registration, blank.value.purchase_kind, blank.value.number_unobtainable],
      [null, null, null, false]);
    const both = input({ supplierTaxNumber: '123456789 RT0001', hasSupplierTaxNumber: true, numberUnobtainable: 'true' });
    assert.ok('value' in both); assert.equal(both.value.number_unobtainable, false);
    assert.deepEqual(input({ supplierTaxNumber: null, hasSupplierTaxNumber: true }), { field: 'supplierTaxNumber', error: 'Keep the number to 40 characters.' });
  });
});

describe('GST/HST Stage 4a · a saved revision’s credit', () => {
  const row: ExpenseRevision = { ...base, incurred_date: '2026-10-01', cad_cents: 65000, original_cents: 65000, tax_cad_cents: 7478,
    business_use_percent: 100, category: 'Equipment & supplies', tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 7478 }] };
  it('reads an unstated registration as Not checked and an unstated kind from the category', () => {
    const credit = expenseCredit({ ...row, supplier_tax_number: '123456789 RT0001' }, '2026-09-26');
    assert.equal(credit?.state, 'counted'); assert.equal(credit?.registrationUnchecked, true); assert.equal(credit?.creditCents, 7478);
    // Equipment you keep at 50% use gets nothing; an everyday cost at 50% gets half.
    assert.equal(expenseCredit({ ...row, supplier_tax_number: 'n', business_use_percent: 50 }, '2026-09-26')?.creditCents, 0);
    assert.equal(expenseCredit({ ...row, supplier_tax_number: 'n', business_use_percent: 50, purchase_kind: 'operating' }, '2026-09-26')?.creditCents, 3739);
  });
  it('holds a $100+ credit with no number, clears it as not claimed, and needs a registration date', () => {
    assert.equal(expenseCredit(row, '2026-09-26')?.state, 'held');
    assert.equal(expenseCredit({ ...row, number_unobtainable: true }, '2026-09-26')?.state, 'not_claimed');
    assert.equal(expenseCredit(row, null), null);
    assert.equal(expenseCredit({ ...row, tax_answer: null, tax_lines: undefined, tax_amount_known: true }, '2026-09-26')?.state, 'type_not_set');
  });
});
