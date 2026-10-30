import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attentionReasons, currentExpenses, type ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import { expenseFilterParams, matchesExpenseFilters, matchesExpenseSearch, type ExpenseFilters } from '../../lib/bookkeeping-filters.ts';
import { parseExpenseFilters, selectExpenseRevisions, selectOwnerMovementRevisions } from '../../lib/bookkeeping-export.ts';
import { expensePeriodRange, expenseRegisterSelection } from '../../lib/bookkeeping-register.ts';
import type { OwnerMovementRevision } from '../../lib/bookkeeping-owner-movements.ts';

const cad: ExpenseRevision = {
  expense_id: '10000000-0000-4000-8000-000000000001', revision: 1, expense_date: '2026-10-27',
  incurred_date: '2026-10-27', paid_date: '2026-10-28', supplier: 'S1 Hosting', category: 'Software', business_purpose: 'Platform hosting',
  original_currency: 'CAD', original_cents: 120000, cad_cents: 120000, business_use_percent: 25,
  tax_cad_cents: 1300, tax_amount_known: true, tax_status: 'pending', payment_source: 'personal',
  conversion_note: null, notes: null, change_reason: null, receipt_path: 'private/path', receipt_name: 'receipt.pdf',
  void_reason: null, created_at: '2026-10-27T16:00:00Z', created_by: 'owner',
};
const usd: ExpenseRevision = { ...cad, expense_id: '10000000-0000-4000-8000-000000000002', supplier: 'S1 Overseas',
  original_currency: 'USD', original_cents: 4559, cad_cents: 6412, business_use_percent: 75, tax_cad_cents: 200,
  payment_source: 'business_card', conversion_source: 'card_statement' };
const legacy: ExpenseRevision = { ...cad, expense_id: '10000000-0000-4000-8000-000000000003', expense_date: '2026-05-01',
  incurred_date: null, paid_date: null, category: 'Other', tax_amount_known: false, tax_cad_cents: 0, receipt_path: null };
const voidBefore: ExpenseRevision = { ...usd, expense_id: '10000000-0000-4000-8000-000000000004' };
const voided = { ...voidBefore, revision: 2, void_reason: 'Duplicate', change_reason: 'Duplicate' };
const corrected = { ...cad, revision: 2, original_cents: 130000, cad_cents: 130000, change_reason: 'Corrected total' };
const history = [cad, corrected, usd, legacy, voidBefore, voided];
const all: ExpenseFilters = { from: null, to: null, category: '', query: '', review: 'all' };
const ids = (rows: ExpenseRevision[]) => [...new Set(rows.map(row => row.expense_id))].sort();

describe('Bookkeeping shared attention and amount matching', () => {
  it('uses precisely the four ruled reasons and never includes a void or a known pending tax amount alone', () => {
    assert.deepEqual(attentionReasons({ ...legacy, original_currency: 'USD', conversion_note: 'Card statement 2026-10-27' }),
      ['Receipt missing', 'Tax amount unknown', 'USD source not picked', 'Dates to review']);
    assert.deepEqual(attentionReasons(cad), []);
    assert.deepEqual(attentionReasons(usd), []);
    assert.deepEqual(attentionReasons({ ...legacy, void_reason: 'Duplicate' }), []);
  });
  it('matches exact business, CAD, original and known tax amounts using the shared money parser', () => {
    for (const query of ['300', '$300.00', '1,200', '$1,200.00', '13.00']) assert.equal(matchesExpenseSearch(cad, query), true, query);
    for (const query of ['45.59', '$64.12', '48.09', '2.00']) assert.equal(matchesExpenseSearch(usd, query), true, query);
    for (const query of ['45.5', '12,50', '-45.59', '9,99']) assert.equal(matchesExpenseSearch(usd, query), false, query);
    assert.equal(matchesExpenseSearch(legacy, '$0.00'), false, 'an unknown tax value is not confirmed zero');
    assert.equal(matchesExpenseSearch({ ...legacy, tax_amount_known: true }, '$0.00'), true);
    assert.equal(matchesExpenseSearch({ ...cad, cad_cents: 113, business_use_percent: 50 }, '0.57'), true);
    assert.equal(matchesExpenseSearch(cad, '  HOSTING  '), true);
  });
  it('retains legacy date rows explicitly and excludes voided rows from Active and attention', () => {
    const month = { ...all, from: '2026-10-01', to: '2026-10-31', status: 'active' as const };
    assert.deepEqual(ids(selectExpenseRevisions(history, month)), [cad.expense_id, usd.expense_id, legacy.expense_id]);
    assert.deepEqual(ids(selectExpenseRevisions(history, { ...month, dateStatus: 'confirmed' })), [cad.expense_id, usd.expense_id]);
    assert.deepEqual(ids(selectExpenseRevisions(history, { ...month, review: 'attention' })), [legacy.expense_id]);
    assert.deepEqual(ids(selectExpenseRevisions(history, { ...month, status: 'voided', review: 'attention' })), []);
    assert.deepEqual(selectExpenseRevisions(history, { ...all, status: 'voided' }).map(row => row.revision), [1, 2]);
  });
  it('screen and export select identical current ids and retain the selected records whole revision histories', () => {
    const filters: ExpenseFilters[] = [all, { ...all, status: 'active' }, { ...all, status: 'voided' },
      { ...all, query: '$325.00' }, { ...all, query: '45.59' }, { ...all, category: 'Other' },
      { ...all, paymentSource: 'business_card', status: 'active' }, { ...all, review: 'attention' }];
    for (const filter of filters) {
      const screen = currentExpenses(history).filter(row => matchesExpenseFilters(row, filter));
      const exported = selectExpenseRevisions(history, filter);
      assert.deepEqual(ids(exported), ids(screen), JSON.stringify(filter));
      for (const row of screen) assert.deepEqual(exported.filter(item => item.expense_id === row.expense_id).map(item => item.revision),
        history.filter(item => item.expense_id === row.expense_id).map(item => item.revision));
    }
    assert.deepEqual(selectExpenseRevisions([cad, corrected], { ...all, query: '1,200' }), [], 'an earlier amount never selects a corrected expense');
  });
  it('validates status and attention query values, preserving legacy all-status exports when status is absent', () => {
    assert.equal(parseExpenseFilters(new URLSearchParams())?.status, 'all');
    for (const query of ['status=bad', 'attention=yes', 'review=bad', 'from=2026-10-31&to=2026-10-01']) assert.equal(parseExpenseFilters(new URLSearchParams(query)), null);
    const filter = { ...all, status: 'active' as const, paymentSource: 'personal', query: '$1,200', review: 'attention' as const };
    const parsed = parseExpenseFilters(expenseFilterParams(filter))!;
    assert.equal(parsed.status, 'active'); assert.equal(parsed.review, 'attention'); assert.equal(parsed.query, '$1,200');
    assert.equal(parseExpenseFilters(new URLSearchParams('attention=1'))?.review, 'attention');
  });
  it('applies the existing linked-reimbursement package rule to narrowed status/attention views', () => {
    const contribution: OwnerMovementRevision = { movement_id: '20000000-0000-4000-8000-000000000001', revision: 1,
      movement_date: '2026-10-27', movement_kind: 'owner_contribution', amount_cents: 1000, linked_expense_id: null,
      source_reference: null, note: null, change_reason: null, void_reason: null, created_at: cad.created_at, created_by: 'owner' };
    const reimbursement: OwnerMovementRevision = { ...contribution, movement_id: '20000000-0000-4000-8000-000000000002',
      movement_kind: 'expense_reimbursement', linked_expense_id: cad.expense_id };
    assert.equal(selectOwnerMovementRevisions([contribution, reimbursement], all, [cad]).length, 2);
    assert.deepEqual(selectOwnerMovementRevisions([contribution, reimbursement], { ...all, status: 'active' }, [cad]), [reimbursement]);
    assert.deepEqual(selectOwnerMovementRevisions([contribution, reimbursement], { ...all, review: 'attention' }, [legacy]), []);
  });
});

describe('Bookkeeping register periods', () => {
  it('defaults to Active and a complete calendar month, including its final day and leap days', () => {
    const { period, filters } = expenseRegisterSelection(new URLSearchParams(), '2028-02-12');
    assert.equal(period, 'month'); assert.equal(filters?.status, 'active');
    assert.equal(filters?.from, '2028-02-01'); assert.equal(filters?.to, '2028-02-29');
    assert.equal(expensePeriodRange('month', '2026-10-30').label, 'October 2026');
    assert.equal(expensePeriodRange('last_month', '2026-01-01').to, '2025-12-31');
  });
  it('round-trips custom filters, refuses an invalid range, and clears period bounds for All dates', () => {
    const query = new URLSearchParams('period=custom&from=2026-10-03&to=2026-10-20&status=voided&q=18.08&category=Other');
    const { filters } = expenseRegisterSelection(query, '2026-10-30');
    assert.equal(filters?.from, '2026-10-03'); assert.equal(filters?.to, '2026-10-20'); assert.equal(filters?.status, 'voided');
    assert.equal(filters?.query, '18.08'); assert.equal(filters?.category, 'Other');
    query.set('from', '2026-10-31'); assert.equal(expenseRegisterSelection(query, '2026-10-30').filters, null);
    query.set('period', 'all'); assert.equal(expenseRegisterSelection(query, '2026-10-30').filters?.from, null);
  });
});
