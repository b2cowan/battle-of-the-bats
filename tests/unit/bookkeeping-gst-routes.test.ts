/**
 * GST/HST Stage 4a, Session B: the expense route's tax section and the registration date API, loaded as shipped
 * with a fake store. The rules themselves are pinned in bookkeeping-gst.test.ts; this proves the plumbing uses them.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import type { ExpenseRevision } from '../../lib/bookkeeping-expenses.ts';
import type { GstRegistrationRevision } from '../../lib/bookkeeping-store.ts';

const EXPENSES = 'app/api/platform-admin/bookkeeping/expenses/route.ts';
const REGISTRATION = 'app/api/platform-admin/bookkeeping/gst-registration/route.ts';
const saved: ExpenseRevision = {
  expense_id: '10000000-0000-4000-8000-000000000009', revision: 1, expense_date: '2026-11-04',
  incurred_date: '2026-11-04', paid_date: '2026-11-04', supplier: 'Hollis Law', category: 'Professional fees', business_purpose: 'Terms review',
  original_currency: 'CAD', original_cents: 65000, cad_cents: 65000, tax_cad_cents: 7478, tax_amount_known: true,
  tax_status: 'pending', business_use_percent: 100, payment_source: 'personal', conversion_note: null, conversion_source: null, conversion_rate: null,
  notes: null, change_reason: null, receipt_path: 'private/key', receipt_name: 'invoice.pdf', void_reason: null,
  created_at: '2026-11-04T12:00:00Z', created_by: 'owner',
};

function fields(extra: Record<string, string> = {}) {
  const form = new FormData();
  const values: Record<string, string> = { incurredDate: '2026-11-04', paidDate: '2026-11-04', supplier: 'Hollis Law', category: 'Professional fees',
    businessPurpose: 'Terms review', originalCurrency: 'CAD', originalAmount: '650.00', cadAmount: '650.00', taxCadAmount: '74.78',
    taxStatus: 'pending', businessUsePercent: '100', paymentSource: 'personal',
    taxAnswer: 'shown', taxLines: JSON.stringify([{ type: 'hst13', cents: 7478 }]), supplierTaxNumber: '',
    supplierRegistration: 'normal', purchaseKind: 'operating', numberUnobtainable: 'false', ...extra };
  for (const [key, value] of Object.entries(values)) if (value !== '\u0000') form.set(key, value);
  return form;
}

function expensesRoute(previous: ExpenseRevision | null = null, gstReady = true) {
  const inserted: ExpenseRevision[] = [];
  const load = billingTestLoader({
    'next/server': { NextRequest, NextResponse },
    '@/lib/bookkeeping-access': { requireBookkeepingApi: async () => ({ auth: { user: { id: 'owner' } } }) },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/bookkeeping-store': {
      latestExpenseRevision: async () => previous, listExpenseRevisions: async () => previous ? [previous] : [],
      hasExpenseDateColumns: async () => true, hasExpenseTaxColumn: async () => true, hasExpenseConversionColumns: async () => true,
      hasOwnerMovementTable: async () => false, listOwnerMovementRevisions: async () => [],
      hasGstTaxSchema: async () => gstReady, gstRegistrationDate: async () => gstReady ? '2026-09-26' : null,
      insertExpenseRevision: async (row: ExpenseRevision) => { inserted.push(row); return { ...row, created_at: 'now' }; },
      putReceipt: async () => {}, deleteReceipt: async () => {},
    },
  });
  const handlers = load(EXPENSES) as { POST: (req: NextRequest) => Promise<Response>; GET: () => Promise<Response> };
  const post = (form: FormData) => handlers.POST(new NextRequest('http://localhost/api/platform-admin/bookkeeping/expenses', { method: 'POST', body: form }));
  return { post, get: () => handlers.GET(), inserted };
}

describe('expense route · the GST/HST tax section', () => {
  it('saves the answer, lines and supplier facts, and works the credit out itself', async () => {
    const api = expensesRoute();
    const response = await api.post(fields({ supplierTaxNumber: '  81234 5678 RT0001 ' }));
    assert.equal(response.status, 201);
    const row = api.inserted[0];
    assert.equal(row.tax_answer, 'shown'); assert.deepEqual(row.tax_lines, [{ type: 'hst13', cents: 7478 }]);
    assert.equal(row.tax_amount_known, true); assert.equal(row.supplier_tax_number, '81234 5678 RT0001');
    assert.equal(row.supplier_registration, 'normal'); assert.equal(row.purchase_kind, 'operating'); assert.equal(row.number_unobtainable, false);
    const body = await response.json();
    assert.equal(body.credit.state, 'counted'); assert.equal(body.credit.creditCents, 7478);
  });
  it('never reads or stores a credit the client sends', async () => {
    const api = expensesRoute();
    const response = await api.post(fields({ creditCents: '999999', credit: '9999.99', credit_cad: '9999.99' }));
    assert.equal(response.status, 201);
    assert.ok(!Object.keys(api.inserted[0]).some(key => key.startsWith('credit')), 'no credit field reaches the store');
    assert.equal((await response.json()).credit.creditCents, 7478);
  });
  it('refuses lines that do not add up to the tax amount, and a shown answer with no amount', async () => {
    for (const extra of [{ taxLines: JSON.stringify([{ type: 'hst13', cents: 7000 }]) },
      { taxLines: JSON.stringify([{ type: 'gst5', cents: 3250 }, { type: 'pst', cents: 4000 }]) },
      { taxLines: '[]', taxCadAmount: '0.00' }, { taxLines: JSON.stringify([{ type: 'hst13', cents: 0 }]) }] as Record<string, string>[]) {
      const api = expensesRoute();
      const response = await api.post(fields(extra));
      assert.equal(response.status, 400, JSON.stringify(extra)); assert.equal(api.inserted.length, 0);
      assert.equal((await response.json()).field, 'taxLines');
    }
    const api = expensesRoute();
    assert.equal((await api.post(fields({ taxLines: JSON.stringify([{ type: 'gst5', cents: 3250 }, { type: 'pst', cents: 4228 }]) }))).status, 201);
  });
  it('gives “No tax charged” and “Not sure yet” no lines and $0, and keeps today’s status rule for unknown', async () => {
    const none = expensesRoute();
    assert.equal((await none.post(fields({ taxAnswer: 'none', taxLines: '[]', taxCadAmount: '0.00', taxStatus: 'none' }))).status, 201);
    assert.deepEqual([none.inserted[0].tax_answer, none.inserted[0].tax_lines, none.inserted[0].tax_amount_known], ['none', [], true]);
    const unknown = expensesRoute();
    assert.equal((await unknown.post(fields({ taxAnswer: 'unknown', taxLines: '\u0000', taxCadAmount: '0.00' }))).status, 201);
    assert.deepEqual([unknown.inserted[0].tax_answer, unknown.inserted[0].tax_lines, unknown.inserted[0].tax_amount_known], ['unknown', [], false]);
    for (const extra of [{ taxAnswer: 'none', taxCadAmount: '74.78' }, { taxAnswer: 'unknown', taxLines: '[]', taxCadAmount: '0.00', taxStatus: 'reviewed' },
      { taxAnswer: 'unknown', taxLines: '[]', taxCadAmount: '74.78' }] as Record<string, string>[]) {
      const api = expensesRoute();
      assert.equal((await api.post(fields(extra))).status, 400, JSON.stringify(extra)); assert.equal(api.inserted.length, 0);
    }
  });
  it('never blocks a save over a missing number, registration or kind', async () => {
    const api = expensesRoute();
    const response = await api.post(fields({ supplierRegistration: '', purchaseKind: '', numberUnobtainable: '\u0000' }));
    assert.equal(response.status, 201);
    assert.deepEqual([api.inserted[0].supplier_tax_number, api.inserted[0].supplier_registration, api.inserted[0].purchase_kind], [null, null, null]);
    // $650 with no number: held, not refused. Registration not stated reads Not checked; kind starts from the category.
    assert.equal((await response.json()).credit.state, 'held');
  });
  it('refuses values that only a stale page could send', async () => {
    for (const extra of [{ taxAnswer: 'maybe' }, { taxLines: 'not json' }, { taxLines: JSON.stringify([{ type: 'vat', cents: 7478 }]) },
      { taxLines: JSON.stringify([{ type: 'unset', cents: 7478 }]) }, { supplierRegistration: 'registered' }, { purchaseKind: 'meal-ish' },
      { numberUnobtainable: 'yes' }, { supplierTaxNumber: 'x'.repeat(41) }] as Record<string, string>[]) {
      const api = expensesRoute();
      assert.equal((await api.post(fields(extra))).status, 400, JSON.stringify(extra)); assert.equal(api.inserted.length, 0);
    }
  });
  it('drops “I can’t get the number” when a number is on hand', async () => {
    const api = expensesRoute();
    assert.equal((await api.post(fields({ supplierTaxNumber: '81234 5678 RT0001', numberUnobtainable: 'true' }))).status, 201);
    assert.equal(api.inserted[0].number_unobtainable, false);
  });
  it('lets a correction of a pre-4a expense keep “Type not set”, and nothing else', async () => {
    const legacy = { ...saved, tax_lines: [] };
    const correction = { expenseId: saved.expense_id, expectedRevision: '1', changeReason: 'Supplier spelling',
      taxLines: JSON.stringify([{ type: 'unset', cents: 7478 }]) };
    const api = expensesRoute(legacy);
    assert.equal((await api.post(fields(correction))).status, 201);
    assert.deepEqual(api.inserted[0].tax_lines, [{ type: 'unset', cents: 7478 }]);
    const typed = expensesRoute({ ...saved, tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 7478 }] });
    assert.equal((await typed.post(fields(correction))).status, 400);
  });
  it('keeps the pre-4a form working, but never lets it overwrite 4a tax details', async () => {
    const legacyForm = fields({ taxAnswer: '\u0000', taxLines: '\u0000', supplierTaxNumber: '\u0000', supplierRegistration: '\u0000',
      purchaseKind: '\u0000', numberUnobtainable: '\u0000', taxAmountKnown: 'true' });
    const api = expensesRoute();
    assert.equal((await api.post(legacyForm)).status, 201);
    assert.deepEqual([api.inserted[0].tax_answer, api.inserted[0].tax_lines], [null, []]);
    const newer = expensesRoute({ ...saved, tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 7478 }] });
    legacyForm.set('expenseId', saved.expense_id); legacyForm.set('expectedRevision', '1'); legacyForm.set('changeReason', 'Old page');
    assert.equal((await newer.post(legacyForm)).status, 409); assert.equal(newer.inserted.length, 0);
  });
  it('pauses saving while migration 006 is not applied, and still lists expenses without a credit', async () => {
    const api = expensesRoute(saved, false);
    const response = await api.post(fields());
    assert.equal(response.status, 503); assert.equal(api.inserted.length, 0);
    const list = await (await api.get()).json();
    assert.equal(list.gstSchemaReady, false); assert.equal(list.registrationDate, null);
    assert.equal(list.expenses.length, 1);
  });
  it('sends today’s registration date (every screen works each credit out from it) and no stored or pre-worked credit', async () => {
    const list = await (await expensesRoute({ ...saved, tax_answer: 'shown', tax_lines: [{ type: 'hst13', cents: 7478 }],
      supplier_tax_number: '81234 5678 RT0001', supplier_registration: 'normal' }).get()).json();
    assert.equal(list.gstSchemaReady, true); assert.equal(list.registrationDate, '2026-09-26');
    assert.equal('credits' in list, false);
  });
});

function registrationRoute(history: GstRegistrationRevision[], gstReady = true, authorized = true, insertErrorCode?: string) {
  const inserted: Omit<GstRegistrationRevision, 'created_at'>[] = [];
  const load = billingTestLoader({
    'next/server': { NextRequest, NextResponse },
    '@/lib/bookkeeping-access': { requireBookkeepingApi: async () => authorized
      ? { auth: { user: { id: '20000000-0000-4000-8000-000000000001' } } }
      : { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) } },
    '@/lib/observability': { withObservability: (handler: unknown) => handler },
    '@/lib/bookkeeping-store': {
      hasGstTaxSchema: async () => gstReady, listGstRegistrationRevisions: async () => history,
      insertGstRegistrationRevision: async (row: Omit<GstRegistrationRevision, 'created_at'>) => {
        if (insertErrorCode) throw Object.assign(new Error('refused'), { code: insertErrorCode });
        inserted.push(row); return { ...row, created_at: 'now' };
      },
    },
  });
  const handlers = load(REGISTRATION) as { GET: () => Promise<Response>; POST: (req: NextRequest) => Promise<Response> };
  const post = (body: unknown, origin?: string) => handlers.POST(new NextRequest('http://localhost/api/platform-admin/bookkeeping/gst-registration', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) } }));
  return { get: () => handlers.GET(), post, inserted };
}

const first: GstRegistrationRevision = { revision: 1, effective_date: '2026-09-26', reason: 'First entry',
  created_at: '2026-11-06T00:00:00Z', created_by: '00000000-0000-0000-0000-000000000000' };

describe('registration date API', () => {
  it('reads the current date and its history, newest first', async () => {
    const second = { ...first, revision: 2, effective_date: '2026-05-01', reason: 'CRA approved the backdate' };
    const body = await (await registrationRoute([second, first]).get()).json();
    assert.equal(body.schemaReady, true); assert.equal(body.current.effective_date, '2026-05-01'); assert.equal(body.history.length, 2);
    assert.deepEqual(await (await registrationRoute([], false).get()).json(), { schemaReady: false, current: null, history: [] });
  });
  it('saves a change as a new revision with its reason, and stores nothing else', async () => {
    const api = registrationRoute([first]);
    const response = await api.post({ effectiveDate: '2026-05-01', reason: '  CRA approved the backdate ', expectedRevision: 1, credits: 123 });
    assert.equal(response.status, 201);
    assert.deepEqual(api.inserted, [{ revision: 2, effective_date: '2026-05-01', reason: 'CRA approved the backdate',
      created_by: '20000000-0000-4000-8000-000000000001' }]);
    assert.deepEqual((await response.json()).history.map((row: GstRegistrationRevision) => row.revision), [2, 1]);
  });
  it('requires a reason and a real date, and refuses a no-change save and a stale page', async () => {
    for (const [body, status, field] of [
      [{ effectiveDate: '2026-05-01', reason: '   ', expectedRevision: 1 }, 400, 'reason'],
      [{ effectiveDate: '2026-02-30', reason: 'Backdate', expectedRevision: 1 }, 400, 'effectiveDate'],
      [{ effectiveDate: '2026-09-26', reason: 'Same date', expectedRevision: 1 }, 400, 'effectiveDate'],
      [{ effectiveDate: '2026-05-01', reason: 'x'.repeat(501), expectedRevision: 1 }, 400, 'reason'],
      [{ effectiveDate: '2026-05-01', reason: 'Backdate', expectedRevision: 2 }, 409, undefined],
      [{ effectiveDate: '2026-05-01', reason: 'Backdate' }, 400, undefined],
    ] as const) {
      const api = registrationRoute([first]);
      const response = await api.post(body);
      assert.equal(response.status, status, JSON.stringify(body)); assert.equal((await response.json()).field, field);
      assert.equal(api.inserted.length, 0);
    }
  });
  it('a save that loses a race is a 409, whether the key or DSQL optimistic concurrency refused it (Session E /review)', async () => {
    const body = { effectiveDate: '2026-05-01', reason: 'Backdate', expectedRevision: 1 };
    for (const code of ['23505', '40001']) assert.equal((await registrationRoute([first], true, true, code).post(body)).status, 409, code);
    assert.equal((await registrationRoute([first], true, true, '57014').post(body)).status, 500);
  });
  it('is owner-only, same-origin, and paused before migration 006', async () => {
    const outsider = registrationRoute([first], true, false);
    assert.equal((await outsider.get()).status, 404);
    assert.equal((await outsider.post({ effectiveDate: '2026-05-01', reason: 'Backdate', expectedRevision: 1 })).status, 404);
    const crossSite = registrationRoute([first]);
    assert.equal((await crossSite.post({ effectiveDate: '2026-05-01', reason: 'Backdate', expectedRevision: 1 }, 'https://evil.example')).status, 403);
    const paused = registrationRoute([first], false);
    assert.equal((await paused.post({ effectiveDate: '2026-05-01', reason: 'Backdate', expectedRevision: 1 })).status, 503);
    assert.equal(crossSite.inserted.length + paused.inserted.length + outsider.inserted.length, 0);
  });
});
