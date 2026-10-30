/**
 * The accountant-review fixes (owner rulings 2026-10-25, BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md §11):
 *   C1 owner transfers save — the route's ID check refused every real id;
 *   C2 a refusal names its field, with the house wording;
 *   C3 Permanently delete is gone everywhere (void is the only way out, R1);
 *   C4 the Sources preview has no tab;
 *   C5 Last month, Last quarter and Last calendar year are ranges the exports accept.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { CONVERSION_SOURCE_HINT, isRecordId, parseCents, RECEIPT_MESSAGE, validateExpenseFields, type ExpenseFieldInput } from '../../lib/bookkeeping-expenses.ts';
import { validateOwnerMovementInput } from '../../lib/bookkeeping-owner-movements.ts';
import { parseExpenseFilters, reportPeriodRange } from '../../lib/bookkeeping-export.ts';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const QA_ID = 'b2026102-3000-4000-8000-000000000001';

describe('C1 · owner transfers save', () => {
  it('accepts a browser-made id and the seeded QA id, and refuses malformed ones', () => {
    for (let i = 0; i < 50; i++) assert.ok(isRecordId(crypto.randomUUID()));
    assert.ok(isRecordId(QA_ID));
    // The shape the old route check demanded: no fourth `-xxxx` group.
    assert.equal(isRecordId('b2026102-3000-4000-8000000000000001'), false);
    assert.equal(isRecordId('not-an-id'), false);
    assert.equal(isRecordId(undefined), false);
  });

  it('passes a contribution, a draw and a reimbursement with a real linked expense', () => {
    const common = { movementId: crypto.randomUUID(), movementDate: '2026-10-20', amount: '250.00' };
    for (const movementKind of ['owner_contribution', 'owner_draw'] as const) {
      const checked = validateOwnerMovementInput({ ...common, movementKind, linkedExpenseId: null });
      assert.ok('value' in checked, `${movementKind} refused: ${JSON.stringify(checked)}`);
    }
    const repaid = validateOwnerMovementInput({ ...common, movementKind: 'expense_reimbursement', linkedExpenseId: QA_ID });
    assert.ok('value' in repaid && repaid.value.linkedExpenseId === QA_ID);
  });

  it('reads ids in lowercase, as stored, and takes a revision only as a whole number (review 2026-10-26)', () => {
    const upper = validateOwnerMovementInput({ movementId: QA_ID.toUpperCase(), movementKind: 'expense_reimbursement', movementDate: '2026-10-20', amount: '5.00', linkedExpenseId: QA_ID.toUpperCase() });
    assert.ok('value' in upper && upper.value.movementId === QA_ID && upper.value.linkedExpenseId === QA_ID);
    const base = { movementId: QA_ID, movementKind: 'owner_draw', movementDate: '2026-10-20', amount: '5.00', linkedExpenseId: null };
    for (const expectedRevision of [true, null, '1', 0, 1.5]) assert.ok(!('value' in validateOwnerMovementInput({ ...base, expectedRevision })), String(expectedRevision));
    assert.ok('value' in validateOwnerMovementInput({ ...base, expectedRevision: 2 }));
  });

  it('the route reads the shared check, not a private pattern of its own', () => {
    const route = read('app/api/platform-admin/bookkeeping/owner-movements/route.ts');
    assert.match(route, /validateOwnerMovementInput\(input\)/);
    assert.doesNotMatch(route, /\[89ab\]/, 'no hand-written UUID pattern in the route');
    assert.doesNotMatch(read('app/api/platform-admin/bookkeeping/expenses/route.ts'), /\[89ab\]/);
  });
});

describe('C2 · a refusal names its field', () => {
  const ok: ExpenseFieldInput = {
    incurredDate: '2026-10-16', paidDate: '2026-10-16', voidingLegacy: false, supplier: 'Hosting', category: 'Other',
    businessPurpose: 'Platform hosting', originalCurrency: 'CAD', originalCents: 12000, cadCents: 12000, taxCents: 0,
    taxAmountKnown: 'false', taxStatus: 'pending', businessUse: 100, paymentSource: 'business_card',
    conversionNote: null, hasConversionNote: false, notes: '', hasNotes: true,
    isCorrection: false, changeReason: null, isVoid: false, voidReason: null,
  };

  it('a complete CAD purchase passes', () => assert.equal(validateExpenseFields(ok), null));

  it('says the house words for each case and names the field', () => {
    assert.deepEqual(validateExpenseFields({ ...ok, originalCents: 0, cadCents: 0 }), { field: 'originalAmount', error: 'Enter an amount above $0.00.' });
    assert.deepEqual(validateExpenseFields({ ...ok, originalCents: null }), { field: 'originalAmount', error: 'Use numbers like 1200.00.' });
    assert.deepEqual(validateExpenseFields({ ...ok, taxAmountKnown: 'true', taxCents: 12001 }), { field: 'taxCadAmount', error: "Purchase tax can't be more than the amount." });
    assert.deepEqual(validateExpenseFields({ ...ok, originalCurrency: 'USD', cadCents: 16500, conversionNote: 'Card statement 2026-10-16', hasConversionNote: true }), { field: 'conversionSource', error: CONVERSION_SOURCE_HINT });
    assert.equal(validateExpenseFields({ ...ok, originalCurrency: 'USD', cadCents: 16500, conversionSource: 'card_statement', conversionNote: '', hasConversionNote: true }), null);
    assert.equal(validateExpenseFields({ ...ok, cadCents: 0 })?.field, 'originalAmount', 'a CAD purchase has one amount field');
  });

  it('reads 1,200.00 and $1,200.00, and refuses the ambiguous 12,50', () => {
    assert.equal(parseCents('1,200.00'), 120000);
    assert.equal(parseCents('$1,200.00'), 120000);
    assert.equal(parseCents('$1,234,567'), 123456700);
    assert.equal(parseCents('$45'), 4500);
    for (const bad of ['12,50', '1,20', '1200,00', ',100', '$-5', '1,2000.00']) assert.equal(parseCents(bad), null, bad);
  });

  it('owner transfers name the date, amount and linked expense', () => {
    const base = { movementId: crypto.randomUUID(), movementKind: 'owner_draw', movementDate: '2026-10-20', amount: '10.00', linkedExpenseId: null };
    assert.equal((validateOwnerMovementInput({ ...base, movementDate: '2026-02-30' }) as { field?: string }).field, 'movementDate');
    assert.deepEqual(validateOwnerMovementInput({ ...base, amount: '0' }), { field: 'amount', error: 'Enter an amount above $0.00.' });
    assert.deepEqual(validateOwnerMovementInput({ ...base, amount: '12,50' }), { field: 'amount', error: 'Use numbers like 1200.00.' });
    assert.equal((validateOwnerMovementInput({ ...base, movementKind: 'expense_reimbursement' }) as { field?: string }).field, 'linkedExpenseId');
  });

  it('an oversized receipt is refused in the browser and gets the receipt words from the server', () => {
    assert.equal(RECEIPT_MESSAGE, 'Receipt must be a PDF, JPEG or PNG under 10 MB.');
    const route = read('app/api/platform-admin/bookkeeping/expenses/route.ts');
    assert.doesNotMatch(route, /'Invalid form'/);
    assert.match(route, /content-length[\s\S]{0,120}MAX_RECEIPT_BYTES/);
    assert.match(read('app/platform-admin/bookkeeping/ExpenseFormWindow.tsx'), /receipt\.size > MAX_RECEIPT_BYTES/);
  });
});

describe('C3 · Permanently delete is gone (R1)', () => {
  it('no route, store function or screen can delete a record', () => {
    assert.doesNotMatch(read('app/api/platform-admin/bookkeeping/expenses/route.ts'), /export const DELETE/);
    assert.doesNotMatch(read('lib/bookkeeping-store.ts'), /DELETE FROM|deleteExpenseRevisions/);
    for (const screen of ['BookkeepingClient.tsx', 'OwnerLedger.tsx']) {
      const source = read(`app/platform-admin/bookkeeping/${screen}`);
      assert.doesNotMatch(source, /Permanently delete|Delete permanently|method: 'DELETE'/, screen);
    }
  });
});

describe('C4 · Sources has no tab', () => {
  it('the tab row lists the four ruled sections and not Sources', () => {
    const navigation = read('lib/bookkeeping-navigation.ts');
    assert.match(navigation, /BOOKKEEPING_VIEWS = \['overview', 'expenses', 'ledger', 'reports'\]/);
    assert.match(read('app/platform-admin/bookkeeping/BookkeepingClient.tsx'), /BOOKKEEPING_VIEWS\.map\(section =>/);
  });
});

describe('C5 · named report periods', () => {
  it('computes last month, last quarter and last calendar year across year ends and leap years', () => {
    assert.deepEqual(reportPeriodRange('last_month', '2026-10-25'), { from: '2026-09-01', to: '2026-09-30', label: 'Last month · September 2026' });
    assert.deepEqual(reportPeriodRange('last_month', '2026-01-04'), { from: '2025-12-01', to: '2025-12-31', label: 'Last month · December 2025' });
    assert.equal(reportPeriodRange('last_month', '2028-03-10').to, '2028-02-29');
    assert.deepEqual(reportPeriodRange('last_quarter', '2026-10-25'), { from: '2026-07-01', to: '2026-09-30', label: 'Last quarter · July to September 2026' });
    assert.deepEqual(reportPeriodRange('last_quarter', '2026-02-14'), { from: '2025-10-01', to: '2025-12-31', label: 'Last quarter · October to December 2025' });
    assert.deepEqual(reportPeriodRange('last_year', '2026-10-25'), { from: '2025-01-01', to: '2025-12-31', label: 'Last calendar year · 2025' });
  });

  it('every named range is one the Export CSV and Accountant package accept', () => {
    for (const today of ['2026-01-01', '2026-03-31', '2026-10-25', '2028-03-01', '2026-12-31']) {
      for (const period of ['month', 'year', 'last_month', 'last_quarter', 'last_year'] as const) {
        const { from, to } = reportPeriodRange(period, today);
        assert.ok(parseExpenseFilters(new URLSearchParams({ from, to })), `${period} on ${today}: ${from}..${to}`);
      }
    }
  });
});
