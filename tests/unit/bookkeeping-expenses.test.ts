import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { businessCents, csvCell, currentExpenses, hasValidConversionEvidence, isExpenseDate, matchesReviewFilter, parseCents, redactExpenseRevision, summarizeExpenses, type ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';

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
      count: 0, recordedSpendCents: 0, pendingTaxCents: 0, byCategory: [],
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
  it('isolates active missing receipts and requires a valid USD source and date', () => {
    const noReceipt = { ...base, expense_id: '22222222-2222-4222-8222-222222222222', receipt_path: null, receipt_name: null };
    const usd = { ...noReceipt, expense_id: '33333333-3333-4333-8333-333333333333', original_currency: 'USD' as const, conversion_note: 'Bank of Canada rate 2026-10-22' };
    const badUsd = { ...usd, conversion_note: 'Bank of Canada 2026-02-30' };
    const voided = { ...badUsd, expense_id: '33333333-3333-4333-8333-333333333333', void_reason: 'Duplicate' };
    assert.equal(matchesReviewFilter(noReceipt, 'missing_receipt'), true);
    assert.equal(matchesReviewFilter(usd, 'missing_conversion'), false);
    assert.equal(matchesReviewFilter(badUsd, 'missing_conversion'), true);
    assert.equal(matchesReviewFilter(voided, 'missing_conversion'), false);
    assert.equal(hasValidConversionEvidence('Bank of Canada rate 2026-10-22'), true);
    assert.equal(hasValidConversionEvidence('exchange rate 2026-10-22'), false);
    assert.equal(hasValidConversionEvidence('2026-10-22'), false);
    assert.equal(hasValidConversionEvidence('Bank of Canada 2026-02-30'), false);
    assert.equal(summarizeExpenses([noReceipt, badUsd, voided]).missingReceiptCount, 2);
    assert.equal(summarizeExpenses([noReceipt, badUsd, voided]).missingConversionCount, 1);
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
