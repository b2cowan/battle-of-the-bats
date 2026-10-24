import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expenseCsv, parseExpenseFilters, selectExpenseRevisions } from '../../lib/bookkeeping-export.ts';
import { storedZip } from '../../lib/bookkeeping-zip.ts';
import type { ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';

const base: ExpenseRevision = {
  expense_id: '11111111-1111-4111-8111-111111111111', revision: 1,
  expense_date: '2026-05-01', supplier: '=Supplier', category: 'Software', business_purpose: 'Hosting',
  original_currency: 'CAD', original_cents: 113, cad_cents: 113, tax_cad_cents: 13,
  tax_status: 'pending', business_use_percent: 100, payment_source: 'personal',
  conversion_note: null, notes: null, change_reason: null,
  receipt_path: '11111111-1111-4111-8111-111111111111/receipt', receipt_name: 'invoice.pdf',
  void_reason: null, created_at: '2026-05-02T00:00:00Z', created_by: 'owner',
};

describe('bookkeeping accountant export', () => {
  it('filters by the latest revision but keeps every earlier revision and its receipt link', () => {
    const correction = { ...base, revision: 2, expense_date: '2026-06-01', supplier: 'Corrected', change_reason: 'Date and name' };
    const selected = selectExpenseRevisions([correction, base], { from: '2026-06-01', to: null, category: '', query: '', review: 'all' });
    assert.deepEqual(selected.map(row => row.revision), [1, 2]);
    const csv = expenseCsv(selected);
    assert.match(csv, /receipt\/11111111-1111-4111-8111-111111111111\/1/);
    assert.match(csv, /"'\=Supplier"/);
    assert.match(csv, /"superseded"/);
    assert.match(csv, /"current"/);
  });

  it('rejects invalid ranges', () => {
    assert.equal(parseExpenseFilters(new URLSearchParams('from=2026-11-01&to=2026-10-01')), null);
    assert.equal(parseExpenseFilters(new URLSearchParams('from=2026-02-30')), null);
    assert.equal(parseExpenseFilters(new URLSearchParams('review=unknown')), null);
  });

  it('keeps a filtered report and its revision export on the same active expense subset', () => {
    const personalUsd = { ...base, original_currency: 'USD' as const, original_cents: 100, conversion_note: 'Issuer invoice 2026-10-20' };
    const corrected = { ...personalUsd, revision: 2, cad_cents: 150, change_reason: 'Rate correction' };
    const business = { ...base, expense_id: '22222222-2222-4222-8222-222222222222', payment_source: 'business_bank' as const, receipt_path: null };
    const voided = { ...personalUsd, expense_id: '33333333-3333-4333-8333-333333333333', void_reason: 'Duplicate' };
    const selected = selectExpenseRevisions([personalUsd, corrected, business, voided], {
      from: null, to: null, category: '', query: '', review: 'personal',
    });
    assert.deepEqual(selected.map(row => [row.expense_id, row.revision]), [[personalUsd.expense_id, 1], [personalUsd.expense_id, 2]]);
    assert.match(expenseCsv(selected), /"personal"/);
    assert.doesNotMatch(expenseCsv(selected), /22222222-2222/);
    assert.doesNotMatch(expenseCsv(selected), /33333333-3333/);
  });

  it('writes a ZIP with a central directory and no unsafe entry paths', async () => {
    const chunks: Uint8Array[] = [];
    for await (const part of storedZip([{ name: 'receipt.pdf', load: async () => new Uint8Array([1, 2, 3]) }])) chunks.push(part);
    const bytes = Buffer.concat(chunks);
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
    assert.equal(bytes.readUInt16LE(bytes.length - 22 + 10), 1);
    await assert.rejects(async () => {
      for await (const part of storedZip([{ name: '../secret', load: async () => new Uint8Array() }])) void part;
    }, /Unsafe ZIP path/);
  });
});
