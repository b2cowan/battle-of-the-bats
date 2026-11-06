import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import type { OwnerMovementRevision } from '../../lib/bookkeeping-owner-movements.ts';

const expense: ExpenseRevision = {
  expense_id: '10000000-0000-4000-8000-000000000001', revision: 2, expense_date: '2026-10-27',
  incurred_date: '2026-10-27', paid_date: '2026-10-28', supplier: 'S1 Void contract', category: 'Other', business_purpose: 'Synthetic purchase',
  original_currency: 'CAD', original_cents: 2000, cad_cents: 2000, tax_cad_cents: 0, tax_amount_known: true,
  tax_status: 'none', business_use_percent: 100, payment_source: 'business_card', conversion_note: null, conversion_source: null, conversion_rate: null,
  notes: 'Keep this note', change_reason: 'Previous correction', receipt_path: 'private/key', receipt_name: 'receipt.pdf', void_reason: null,
  created_at: '2026-10-27T12:00:00Z', created_by: 'owner',
};
const movement: OwnerMovementRevision = {
  movement_id: '20000000-0000-4000-8000-000000000001', revision: 2, movement_date: '2026-10-27',
  movement_kind: 'owner_draw', amount_cents: 2000, linked_expense_id: null, source_reference: 'S1 transfer', note: 'Keep this note',
  change_reason: 'Previous correction', void_reason: null, created_at: expense.created_at, created_by: 'owner',
};
function expenseForm(row = expense) {
  const form = new FormData();
  const values = { expenseId: row.expense_id, expectedRevision: String(row.revision), expenseDate: row.expense_date,
    incurredDate: row.incurred_date ?? '', paidDate: row.paid_date ?? '', supplier: row.supplier, category: row.category,
    businessPurpose: row.business_purpose, originalCurrency: row.original_currency, originalAmount: (row.original_cents / 100).toFixed(2),
    cadAmount: (row.cad_cents / 100).toFixed(2), taxCadAmount: (row.tax_cad_cents / 100).toFixed(2), taxAmountKnown: String(row.tax_amount_known ?? ''),
    taxStatus: row.tax_status, businessUsePercent: String(row.business_use_percent), paymentSource: row.payment_source,
    conversionNote: row.conversion_note ?? '', conversionSource: row.conversion_source ?? '', conversionRate: String(row.conversion_rate ?? ''),
    notes: row.notes ?? '', hasReceipt: String(Boolean(row.receipt_path)), receiptName: row.receipt_name ?? '',
    taxAnswer: row.tax_answer ?? '', taxLines: JSON.stringify(row.tax_lines ?? []), supplierTaxNumber: row.supplier_tax_number ?? '',
    supplierRegistration: row.supplier_registration ?? '', purchaseKind: row.purchase_kind ?? '', numberUnobtainable: String(row.number_unobtainable ?? ''),
    changeReason: 'S1 void', voidReason: 'S1 void' };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}
function transferBody(row = movement) {
  return { movementId: row.movement_id, expectedRevision: row.revision, movementDate: row.movement_date,
    movementKind: row.movement_kind, amount: (row.amount_cents / 100).toFixed(2), linkedExpenseId: row.linked_expense_id,
    sourceReference: row.source_reference, note: row.note, changeReason: 'S1 void', voidReason: 'S1 void' };
}
function route(file: string, previous: ExpenseRevision | OwnerMovementRevision, reimbursed = false, gstReady = true) {
  const inserted: Record<string, unknown>[] = [];
  let uploaded = 0;
  const load = billingTestLoader({
    'next/server': { NextRequest, NextResponse },
    '@/lib/bookkeeping-access': { requireBookkeepingApi: async () => ({ auth: { user: { id: 'owner' } } }) },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/bookkeeping-store': {
      latestExpenseRevision: async () => previous, latestOwnerMovementRevision: async () => previous,
      hasExpenseDateColumns: async () => true, hasExpenseTaxColumn: async () => true, hasExpenseConversionColumns: async () => true,
      hasOwnerMovementTable: async () => true, hasGstTaxSchema: async () => gstReady, gstRegistrationDate: async () => '2026-09-26',
      listExpenseRevisions: async () => [{ ...expense, payment_source: 'personal' }],
      listOwnerMovementRevisions: async () => reimbursed ? [{ ...movement, movement_kind: 'expense_reimbursement', linked_expense_id: expense.expense_id }] : [],
      insertExpenseRevision: async (row: Record<string, unknown>) => { inserted.push(row); return { ...row, created_at: 'now' }; },
      insertOwnerMovementRevision: async (row: Record<string, unknown>) => { inserted.push(row); return { ...row, created_at: 'now' }; },
      putReceipt: async () => { uploaded++; }, deleteReceipt: async () => {},
    },
  });
  const handlers = load(file) as { POST: (req: NextRequest) => Promise<Response> };
  return { post: (body: FormData | object) => handlers.POST(new NextRequest('http://localhost/api/platform-admin/bookkeeping/test', {
    method: 'POST', ...(body instanceof FormData ? { body } : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  })), inserted, uploads: () => uploaded };
}
describe('immutable expense void route', () => {
  it('refuses changed values before writing or uploading a receipt', async () => {
    for (const [field, value] of [['cadAmount', '25.00'], ['supplier', 'Changed supplier'], ['incurredDate', '2026-10-26'],
      ['businessUsePercent', '50'], ['taxStatus', 'pending'], ['notes', 'Changed'], ['receiptName', 'changed.pdf'], ['conversionRate', '1.4']]) {
      const api = route('app/api/platform-admin/bookkeeping/expenses/route.ts', expense);
      const form = expenseForm(); form.set(field, value); if (field === 'cadAmount') form.set('originalAmount', value);
      const response = await api.post(form);
      assert.equal(response.status, 409, field); assert.equal(api.inserted.length, 0, field);
    }
    const api = route('app/api/platform-admin/bookkeeping/expenses/route.ts', expense);
    const form = expenseForm(); form.set('receipt', new File(['%PDF-synthetic'], 'new.pdf', { type: 'application/pdf' }));
    assert.equal((await api.post(form)).status, 409); assert.equal(api.uploads(), 0); assert.equal(api.inserted.length, 0);
  });
  it('preserves legacy dates, unknown tax, unpicked USD evidence and receipt exactly', async () => {
    const legacy = { ...expense, incurred_date: null, paid_date: null, original_currency: 'USD' as const, original_cents: 1400,
      conversion_note: 'Original legacy note', tax_amount_known: null, tax_status: 'pending' as const, conversion_rate: null };
    const api = route('app/api/platform-admin/bookkeeping/expenses/route.ts', legacy);
    assert.equal((await api.post(expenseForm(legacy))).status, 201);
    const saved = api.inserted[0];
    for (const key of Object.keys(legacy).filter(key => !['revision', 'change_reason', 'void_reason', 'created_at', 'created_by'].includes(key)))
      assert.deepEqual(saved[key], legacy[key as keyof ExpenseRevision], key);
    assert.equal(saved.revision, 3); assert.equal(saved.void_reason, 'S1 void');
  });
  it('carries the GST/HST tax lines and every 4a field into the void unchanged (BKX-5.9)', async () => {
    const gst: ExpenseRevision = { ...expense, cad_cents: 11300, original_cents: 11300, tax_cad_cents: 1300, tax_status: 'pending',
      tax_answer: 'shown', tax_lines: [{ type: 'gst5', cents: 500 }, { type: 'pst', cents: 800 }], supplier_tax_number: null,
      supplier_registration: 'not_checked', purchase_kind: 'capital', number_unobtainable: true };
    const api = route('app/api/platform-admin/bookkeeping/expenses/route.ts', gst);
    assert.equal((await api.post(expenseForm(gst))).status, 201);
    for (const key of ['tax_answer', 'tax_lines', 'supplier_tax_number', 'supplier_registration', 'purchase_kind', 'number_unobtainable', 'tax_cad_cents'])
      assert.deepEqual(api.inserted[0][key], gst[key as keyof ExpenseRevision], key);
    for (const [field, value] of [['taxLines', JSON.stringify([{ type: 'hst13', cents: 1300 }])], ['taxAnswer', 'unknown'],
      ['supplierTaxNumber', '123456789 RT0001'], ['supplierRegistration', 'normal'], ['purchaseKind', 'operating'], ['numberUnobtainable', 'false']]) {
      const changed = route('app/api/platform-admin/bookkeeping/expenses/route.ts', gst);
      const form = expenseForm(gst); form.set(field, value);
      assert.equal((await changed.post(form)).status, 409, field); assert.equal(changed.inserted.length, 0, field);
    }
  });
  it('pauses a void, rather than failing it, while migration 006 is not applied', async () => {
    const api = route('app/api/platform-admin/bookkeeping/expenses/route.ts', expense, false, false);
    const response = await api.post(expenseForm());
    assert.equal(response.status, 503); assert.equal(api.inserted.length, 0);
    assert.match((await response.json()).error, /storage is being updated/);
  });
  it('retains stale-revision and linked-reimbursement refusals', async () => {
    const api = route('app/api/platform-admin/bookkeeping/expenses/route.ts', expense);
    const stale = expenseForm(); stale.set('expectedRevision', '1'); assert.equal((await api.post(stale)).status, 409);
    const personal = { ...expense, payment_source: 'personal' as const };
    const linked = route('app/api/platform-admin/bookkeeping/expenses/route.ts', personal, true);
    assert.equal((await linked.post(expenseForm(personal))).status, 409); assert.equal(linked.inserted.length, 0);
  });
});
describe('immutable owner-transfer void route', () => {
  it('refuses altered amounts, kind/link, date, reference and note rather than bypassing the repayment check', async () => {
    for (const changes of [{ amount: '9999.00' }, { movementDate: '2026-10-26' }, { note: 'Changed' }, { sourceReference: 'Changed' },
      { movementKind: 'expense_reimbursement', linkedExpenseId: expense.expense_id, amount: '9999.00' }]) {
      const api = route('app/api/platform-admin/bookkeeping/owner-movements/route.ts', movement);
      assert.equal((await api.post({ ...transferBody(), ...changes })).status, 409, JSON.stringify(changes)); assert.equal(api.inserted.length, 0);
    }
  });
  it('voids an unchanged transfer without reinterpreting its historical values', async () => {
    const api = route('app/api/platform-admin/bookkeeping/owner-movements/route.ts', movement);
    assert.equal((await api.post(transferBody())).status, 201);
    for (const key of ['movement_date', 'movement_kind', 'amount_cents', 'linked_expense_id', 'source_reference', 'note'])
      assert.equal(api.inserted[0][key], movement[key as keyof OwnerMovementRevision], key);
  });
  it('preserves historical whitespace instead of trimming it into a different void revision', async () => {
    const legacy = { ...movement, source_reference: '  Original bank reference  ', note: '  Original note  ' };
    const api = route('app/api/platform-admin/bookkeeping/owner-movements/route.ts', legacy);
    assert.equal((await api.post(transferBody(legacy))).status, 201);
    assert.equal(api.inserted[0].source_reference, legacy.source_reference);
    assert.equal(api.inserted[0].note, legacy.note);
  });
});
