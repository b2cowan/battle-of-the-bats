import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { duplicateExpenses } from '../../lib/bookkeeping-duplicates.ts';
import { redactExpenseRevisions, type ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import { bookkeepingAddress, bookkeepingTransferPlace } from '../../lib/bookkeeping-navigation.ts';

const row: ExpenseRevision = { expense_id: '10000000-0000-4000-8000-000000000001', revision: 1, expense_date: '2026-10-20',
  incurred_date: '2026-10-20', paid_date: '2026-10-20', supplier: 'S1 Hosting', category: 'Other', business_purpose: 'Hosting',
  original_currency: 'USD', original_cents: 1000, cad_cents: 1400, tax_cad_cents: 0, tax_amount_known: false, tax_status: 'pending',
  business_use_percent: 50, payment_source: 'business_card', conversion_note: 'Original note', conversion_source: 'card_statement', conversion_rate: 1.4,
  notes: null, receipt_path: 'private/first', receipt_name: 'same-name.pdf', void_reason: null, change_reason: null,
  created_at: '2026-10-20T12:00:00Z', created_by: 'owner' };
describe('expense record duplicate warning', () => {
  it('matches full CAD, trimmed case-insensitive supplier and exactly seven incurred days in either direction', () => {
    for (const date of ['2026-10-13', '2026-10-20', '2026-10-27']) assert.equal(duplicateExpenses([row], ' s1 HOSTING ', 1400, date).length, 1, date);
    for (const date of ['2026-10-12', '2026-10-28', '2026-11-19', 'bad']) assert.equal(duplicateExpenses([row], row.supplier, 1400, date).length, 0, date);
    for (const amount of [700, 1000, 1401, null]) assert.equal(duplicateExpenses([row], row.supplier, amount, '2026-10-20').length, 0);
  });
  it('uses only the latest active revision and excludes the corrected record and uncertain legacy dates', () => {
    assert.equal(duplicateExpenses([row], row.supplier, 1400, '2026-10-20', row.expense_id).length, 0);
    assert.equal(duplicateExpenses([row, { ...row, revision: 2, void_reason: 'S1 void' }], row.supplier, 1400, '2026-10-20').length, 0);
    assert.equal(duplicateExpenses([row, { ...row, revision: 2, cad_cents: 1500 }], row.supplier, 1400, '2026-10-20').length, 0);
    assert.equal(duplicateExpenses([{ ...row, incurred_date: null }], row.supplier, 1400, '2026-10-20').length, 0);
  });
});
describe('receipt attachment evidence', () => {
  it('derives the original upload revision using the private immutable object key before redacting every path', () => {
    const correction = { ...row, revision: 2, created_at: '2026-10-22T12:00:00Z' };
    const replacement = { ...row, revision: 3, receipt_path: 'private/replacement', created_at: '2026-10-23T12:00:00Z' };
    const result = redactExpenseRevisions([replacement, correction, row]);
    assert.equal(result[0].receipt_attached_at, replacement.created_at);
    assert.equal(result[1].receipt_attached_at, row.created_at);
    assert.equal(result[2].receipt_attached_at, row.created_at);
    assert.ok(result.every(item => item.receipt_path === '[private]'));
    assert.equal(redactExpenseRevisions([{ ...row, receipt_path: null }])[0].receipt_attached_at, null);
  });
});
describe('owner-transfer window addresses', () => {
  it('supports Add and requires a movement for Correct/Void without changing expense addresses', () => {
    assert.deepEqual(bookkeepingTransferPlace(new URLSearchParams('transfer=add')), { movement: null, form: 'add' });
    for (const form of ['correct', 'void']) {
      const url = new URL(bookkeepingAddress(new URLSearchParams('view=ledger'), { movement: row.expense_id, transfer: form as 'correct' | 'void' }), 'http://localhost');
      assert.deepEqual(bookkeepingTransferPlace(url.searchParams), { movement: row.expense_id, form });
      assert.deepEqual(bookkeepingTransferPlace(new URLSearchParams('movement=bad&transfer=' + form)), { movement: null, form: null });
    }
  });
});
