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

/** One cell of an exported CSV, by data row index and column name (every cell is quoted, and these test values hold no commas). */
function cell(csv: string, row: number, column: string): string {
  const [head, ...rows] = csv.replace('﻿', '').trim().split('\r\n');
  const names = head.split(',').map(name => JSON.parse(name));
  return JSON.parse(rows[row].split(',')[names.indexOf(column)]);
}

describe('bookkeeping accountant export', () => {
  it('exports source and derived rate while leaving legacy conversion columns blank', () => {
    const usd = { ...base, original_currency: 'USD' as const, conversion_source: 'card_statement' as const, conversion_rate: 1.40644878262777 };
    const current = expenseCsv([usd]);
    assert.match(current, /"conversion_note","conversion_source","conversion_rate"/);
    assert.match(current, /"card_statement","1\.40644878262777"/);
    const legacy = expenseCsv([base]).split('\r\n')[1];
    assert.doesNotMatch(legacy, /undefined|NaN/);
  });
  it('filters by the latest revision but keeps every earlier revision and its receipt link', () => {
    const correction = { ...base, revision: 2, expense_date: '2026-06-01', supplier: 'Corrected', change_reason: 'Date and name' };
    const selected = selectExpenseRevisions([correction, base], { from: '2026-06-01', to: null, category: '', query: '', review: 'all' }, '2026-09-26');
    assert.deepEqual(selected.map(row => row.revision), [1, 2]);
    const csv = expenseCsv(selected);
    assert.match(csv, /receipt\/11111111-1111-4111-8111-111111111111\/1/);
    assert.match(csv, /"'\=Supplier"/);
    assert.match(csv, /"superseded"/);
    assert.match(csv, /"current"/);
  });

  it('flattens tax lines by type and works the credit out on export, for the current active revision only', () => {
    const header = expenseCsv([]).replace('﻿', '').split('\r\n')[0];
    assert.match(header, /"tax_status","tax_answer","gst_cad","hst_cad","hst_rate","pst_cad","qst_cad","other_cad","supplier_tax_number","supplier_registration","purchase_kind","credit_cad","credit_state","business_use_percent"/);
    const bc: ExpenseRevision = { ...base, incurred_date: '2026-10-01', paid_date: '2026-10-01', cad_cents: 11200, original_cents: 11200, tax_cad_cents: 1200,
      tax_answer: 'shown', tax_lines: [{ type: 'gst5', cents: 500 }, { type: 'pst', cents: 700 }], supplier_tax_number: '123456789 RT0001',
      supplier_registration: 'normal', purchase_kind: 'operating', number_unobtainable: false };
    const csv = expenseCsv([bc], undefined, '2026-09-26');
    assert.deepEqual(['gst_cad', 'hst_cad', 'hst_rate', 'pst_cad', 'qst_cad', 'other_cad'].map(column => cell(csv, 0, column)), ['5.00', '', '', '7.00', '', '']);
    assert.deepEqual(['supplier_tax_number', 'supplier_registration', 'purchase_kind', 'credit_cad', 'credit_state'].map(column => cell(csv, 0, column)),
      ['123456789 RT0001', 'normal', 'operating', '5.00', 'counted']);
    const hst = { ...bc, tax_cad_cents: 1456, tax_lines: [{ type: 'hst13' as const, cents: 1300 }, { type: 'hst15' as const, cents: 156 }] };
    assert.deepEqual(['hst_cad', 'hst_rate'].map(column => cell(expenseCsv([hst], undefined, '2026-09-26'), 0, column)), ['14.56', '13/15']);
    // A held credit keeps its figure, as on the record; Not checked is counted and says so.
    const held = { ...bc, supplier_tax_number: null };
    assert.deepEqual(['credit_cad', 'credit_state'].map(column => cell(expenseCsv([held], undefined, '2026-09-26'), 0, column)), ['5.00', 'held']);
    const unchecked = { ...bc, supplier_registration: 'not_checked' as const };
    assert.equal(cell(expenseCsv([unchecked], undefined, '2026-09-26'), 0, 'credit_state'), 'counted_registration_unchecked');
    // The registration date is read, never stored: moving it after the purchase removes the credit.
    assert.deepEqual(['credit_cad', 'credit_state'].map(column => cell(expenseCsv([bc], undefined, '2026-10-02'), 0, column)), ['0.00', 'before_registration']);
    // Superseded and voided revisions carry no credit; neither does storage without a registration date.
    const corrected = { ...bc, revision: 2, change_reason: 'Number added' };
    const history = expenseCsv([bc, corrected], undefined, '2026-09-26');
    assert.deepEqual([cell(history, 0, 'credit_cad'), cell(history, 0, 'credit_state'), cell(history, 1, 'credit_state')], ['', '', 'counted']);
    assert.equal(cell(expenseCsv([{ ...bc, void_reason: 'Duplicate' }], undefined, '2026-09-26'), 0, 'credit_cad'), '');
    assert.equal(cell(expenseCsv([bc]), 0, 'credit_state'), '');
  });
  it('maps a pre-4a revision through the legacy rule, so nothing old changes meaning', () => {
    const one = (row: ExpenseRevision, column: string) => cell(expenseCsv([row], undefined, '2026-09-26'), 0, column);
    const known = { ...base, tax_amount_known: true };
    assert.deepEqual(['tax_answer', 'recorded_tax_cad', 'gst_cad', 'hst_cad', 'credit_state'].map(column => one(known, column)), ['shown', '0.13', '', '', 'type_not_set']);
    assert.deepEqual(['tax_answer', 'credit_state'].map(column => one({ ...base, tax_cad_cents: 0, tax_amount_known: false }, column)), ['unknown', 'no_tax']);
    assert.deepEqual(['tax_answer', 'credit_state'].map(column => one({ ...base, tax_cad_cents: 0, tax_status: 'none' }, column)), ['none', 'no_tax']);
    assert.doesNotMatch(expenseCsv([base], undefined, '2026-09-26'), /undefined|NaN|null/);
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
    }, '2026-09-26');
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
