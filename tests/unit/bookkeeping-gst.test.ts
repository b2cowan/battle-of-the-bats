import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  currentRegistrationDate, defaultPurchaseKind, needsSupplierNumber, resolveTaxState, sameSupplier, supplierPrefill,
  taxFromTotal, taxLinesMatchTotal, workOutCredit, type CreditInput,
} from '../../lib/bookkeeping-gst.ts';

// GST_HST_STAGE4_DRAWINGS.html tab 2, “What the credit sentence says, case by case”: one test per row.
const hollis: CreditInput = {
  lines: [{ type: 'hst13', cents: 7478 }], kind: 'operating', businessUsePercent: 100, receiptTotalCents: 65000,
  incurredDate: '2026-11-04', registration: 'normal', hasNumber: true, numberUnobtainable: false,
  registrationDate: '2026-09-26', supplier: 'Hollis Law',
};
const laptop: CreditInput = { ...hollis, lines: [{ type: 'hst13', cents: 19500 }], kind: 'capital', businessUsePercent: 70, receiptTotalCents: 169499, supplier: 'Best Buy' };

describe('the credit, row by row of the drawing', () => {
  it('Hollis Law, everyday cost, 100%: all of the HST', () => {
    const credit = workOutCredit(hollis);
    assert.deepEqual([credit.creditCents, credit.state, credit.figure, credit.tone, credit.countsOnReturn], [7478, 'counted', '$74.78', 'neutral', true]);
    assert.equal(credit.sentence, 'All of the HST, because business use is 90% or more.');
  });
  it('same, 50% business use: half', () => {
    const credit = workOutCredit({ ...hollis, businessUsePercent: 50 });
    assert.equal(credit.creditCents, 3739);
    assert.equal(credit.sentence, '50% of the HST, because business use is 50%.');
  });
  it('same, 8% business use: no credit', () => {
    const credit = workOutCredit({ ...hollis, businessUsePercent: 8 });
    assert.deepEqual([credit.creditCents, credit.state, credit.figure], [0, 'no_credit', 'No credit']);
    assert.equal(credit.sentence, 'Business use of 10% or less gets no credit.');
  });
  it('laptop, equipment you keep, 70%: all of the HST, no proration', () => {
    const credit = workOutCredit(laptop);
    assert.equal(credit.creditCents, 19500);
    assert.equal(credit.sentence, 'All of the HST, because equipment used more than 50% for the business gets the full credit.');
  });
  it('same laptop, 50%: none', () => {
    const credit = workOutCredit({ ...laptop, businessUsePercent: 50 });
    assert.deepEqual([credit.creditCents, credit.figure], [0, 'No credit']);
    assert.equal(credit.sentence, 'Equipment used 50% or less for the business gets no credit.');
  });
  it('client lunch, meal, 100%: half', () => {
    const credit = workOutCredit({ ...hollis, lines: [{ type: 'hst13', cents: 910 }], kind: 'meal', receiptTotalCents: 7910 });
    assert.equal(credit.creditCents, 455);
    assert.equal(credit.sentence, 'Half of the HST. Meals and entertainment get half.');
  });
  it('Canva on the simplified registration: no credit, amber, the refund path', () => {
    const credit = workOutCredit({ ...hollis, lines: [{ type: 'hst13', cents: 208 }], receiptTotalCents: 1808, registration: 'simplified', hasNumber: false, supplier: 'Canva' });
    assert.deepEqual([credit.creditCents, credit.state, credit.tone, credit.figure], [0, 'not_claimable', 'amber', 'No credit']);
    assert.equal(credit.sentence, 'Canva charged HST under CRA’s simplified registration, which can’t be claimed on your return. Give Canva your GST/HST number (usually in its billing settings) so it stops charging it, and ask for a refund of the $2.08. If you get one, correct this expense: remove the tax line and lower the amount by the refund.');
  });
  it('$650 with HST and no number: worked out, held, amber, and a register reason', () => {
    const credit = workOutCredit({ ...hollis, hasNumber: false });
    assert.deepEqual([credit.creditCents, credit.state, credit.tone, credit.figure, credit.countsOnReturn], [7478, 'held', 'amber', '$74.78', false]);
    assert.match(credit.sentence!, /^Waiting for the supplier’s number\. Receipts of \$100 or more need it/);
    assert.equal(needsSupplierNumber(credit), true);
  });
  it('same, “I can’t get the number” ticked: not claimed, no register reason', () => {
    const credit = workOutCredit({ ...hollis, hasNumber: false, numberUnobtainable: true });
    assert.deepEqual([credit.creditCents, credit.state, credit.figure, credit.countsOnReturn], [0, 'not_claimed', 'Not claimed', false]);
    assert.equal(credit.sentence, 'You chose not to claim this credit.');
    assert.equal(needsSupplierNumber(credit), false);
  });
  it('$42 with HST and no number: under $100 the number isn’t needed', () => {
    const tax = taxFromTotal(4200, 13);
    assert.equal(tax, 483);
    const credit = workOutCredit({ ...hollis, lines: [{ type: 'hst13', cents: tax }], receiptTotalCents: 4200, hasNumber: false });
    assert.deepEqual([credit.creditCents, credit.state, credit.countsOnReturn], [483, 'counted', true]);
    assert.equal(needsSupplierNumber(credit), false);
  });
  it('the $100 tier starts at exactly $100.00', () => {
    assert.equal(workOutCredit({ ...hollis, receiptTotalCents: 9999, hasNumber: false }).state, 'counted');
    assert.equal(workOutCredit({ ...hollis, receiptTotalCents: 10000, hasNumber: false }).state, 'held');
  });
  it('BC receipt, GST and PST: the GST only, PST stays part of the cost', () => {
    const credit = workOutCredit({ ...hollis, lines: [{ type: 'gst5', cents: 300 }, { type: 'pst', cents: 420 }], receiptTotalCents: 6720 });
    assert.equal(credit.creditCents, 300);
    assert.equal(credit.sentence, 'All of the GST, because business use is 90% or more. PST isn’t claimed on this return; it stays part of the cost.');
  });
  it('registration Not checked: counted, flagged for before you file', () => {
    const credit = workOutCredit({ ...hollis, registration: 'not_checked' });
    assert.deepEqual([credit.creditCents, credit.state, credit.registrationUnchecked, credit.countsOnReturn], [7478, 'counted', true, true]);
    assert.equal(credit.sentence, 'Counted for now. Check the supplier’s registration before you file.');
  });
  it('a service before the registration date: no credit, with the date', () => {
    const credit = workOutCredit({ ...hollis, incurredDate: '2026-09-25' });
    assert.deepEqual([credit.creditCents, credit.state, credit.figure], [0, 'before_registration', 'No credit']);
    assert.match(credit.sentence!, /^Bought before your GST\/HST registration began on September 26, 2026\./);
  });
  it('an expense saved before 4a: Type not set, amber, no credit until a type is chosen', () => {
    const state = resolveTaxState({ tax_cad_cents: 7478, tax_amount_known: true, tax_status: 'pending', tax_answer: null });
    assert.deepEqual(state, { answer: 'shown', lines: [{ type: 'unset', cents: 7478 }], legacy: true });
    const credit = workOutCredit({ ...hollis, lines: state.lines });
    assert.deepEqual([credit.creditCents, credit.state, credit.tone, credit.figure], [0, 'type_not_set', 'amber', 'Choose the tax type']);
    assert.equal(needsSupplierNumber(credit), false, 'never flagged in the register');
  });
});

describe('cases the drawing does not list', () => {
  it('a supplier marked Not registered that charged tax: no credit', () => {
    const credit = workOutCredit({ ...hollis, registration: 'not_registered' });
    assert.deepEqual([credit.creditCents, credit.state, credit.tone], [0, 'not_claimable', 'amber']);
  });
  it('simplified or not registered never asks for the number', () => {
    assert.equal(needsSupplierNumber(workOutCredit({ ...hollis, registration: 'simplified', hasNumber: false })), false);
    assert.equal(needsSupplierNumber(workOutCredit({ ...hollis, businessUsePercent: 5, hasNumber: false })), false, 'nothing to hold at 10% or less');
  });
  it('a PST-only receipt: no credit, says why', () => {
    const credit = workOutCredit({ ...hollis, lines: [{ type: 'pst', cents: 420 }] });
    assert.deepEqual([credit.state, credit.figure], ['not_gst_hst', 'No credit']);
    assert.equal(credit.sentence, 'PST isn’t claimed on this return; it stays part of the cost.');
  });
  it('no tax lines: nothing to say', () => {
    assert.deepEqual([workOutCredit({ ...hollis, lines: [] }).state, workOutCredit({ ...hollis, lines: [] }).sentence], ['no_tax', null]);
  });
  it('everyday cost thresholds sit at 90% and 10% exactly', () => {
    assert.equal(workOutCredit({ ...hollis, businessUsePercent: 90 }).creditCents, 7478);
    assert.equal(workOutCredit({ ...hollis, businessUsePercent: 89 }).creditCents, 6655); // 7478 × 0.89 = 6655.42
    assert.equal(workOutCredit({ ...hollis, businessUsePercent: 11 }).creditCents, 823); // 822.58
    assert.equal(workOutCredit({ ...hollis, businessUsePercent: 10 }).creditCents, 0);
  });
  it('equipment at 51% gets all of it', () => {
    assert.equal(workOutCredit({ ...laptop, businessUsePercent: 51 }).creditCents, 19500);
  });
  it('meals: tax × the everyday-cost rule × half', () => {
    const meal = { ...hollis, lines: [{ type: 'hst13' as const, cents: 910 }], kind: 'meal' as const, receiptTotalCents: 7910 };
    const half = workOutCredit({ ...meal, businessUsePercent: 50 });
    assert.equal(half.creditCents, 228); // 910 × 50% × 50% = 227.5 → half up
    assert.equal(half.sentence, 'Half of 50% of the HST, because business use is 50%. Meals and entertainment get half.');
    assert.equal(workOutCredit({ ...meal, businessUsePercent: 95 }).creditCents, 455);
    assert.equal(workOutCredit({ ...meal, businessUsePercent: 10 }).creditCents, 0);
  });
  it('GST and HST on one receipt are summed and called GST/HST', () => {
    const credit = workOutCredit({ ...hollis, lines: [{ type: 'gst5', cents: 100 }, { type: 'hst13', cents: 260 }], receiptTotalCents: 5000, businessUsePercent: 50 });
    assert.equal(credit.creditCents, 180);
    assert.equal(credit.sentence, '50% of the GST/HST, because business use is 50%.');
  });
});

describe('rounding: to the cent, half up, once, on the final credit only', () => {
  it('rounds the final figure, not each line', () => {
    // Two HST lines of 1 cent each at 50%: per-line rounding would give 1 + 1 = 2; the rule gives round(1.0) = 1.
    assert.equal(workOutCredit({ ...hollis, lines: [{ type: 'hst13', cents: 1 }, { type: 'hst15', cents: 1 }], receiptTotalCents: 100, businessUsePercent: 50 }).creditCents, 1);
    assert.equal(workOutCredit({ ...hollis, lines: [{ type: 'hst13', cents: 1 }], receiptTotalCents: 100, businessUsePercent: 50 }).creditCents, 1, '0.5 rounds up');
    assert.equal(workOutCredit({ ...hollis, lines: [{ type: 'hst13', cents: 3 }], receiptTotalCents: 100, businessUsePercent: 50 }).creditCents, 2, '1.5 rounds up');
  });
  it('works the tax out from a tax-included total', () => {
    assert.equal(taxFromTotal(65000, 13), 7478); // 7477.88
    assert.equal(taxFromTotal(169499, 13), 19500); // 19499.9
    assert.equal(taxFromTotal(10500, 5), 500);
    assert.equal(taxFromTotal(11500, 15), 1500);
    assert.equal(taxFromTotal(11400, 14), 1400);
  });
});

describe('the registration date', () => {
  const august = { ...hollis, incurredDate: '2026-08-15' };
  it('a service: nothing before the date, counted on and after it', () => {
    assert.equal(workOutCredit(august).state, 'before_registration');
    assert.equal(workOutCredit({ ...hollis, incurredDate: '2026-09-26' }).state, 'counted', 'the effective date itself counts');
  });
  it('equipment before the date: not computed, sends you to your accountant', () => {
    const credit = workOutCredit({ ...laptop, incurredDate: '2026-08-15' });
    assert.deepEqual([credit.creditCents, credit.state], [0, 'before_registration']);
    assert.match(credit.sentence!, /may qualify for a credit based on its value then\. It isn’t counted here; ask your accountant\.$/);
    assert.equal(workOutCredit({ ...laptop, incurredDate: '2026-09-26' }).creditCents, 19500);
  });
  it('changing the date re-works the credit on the next read', () => {
    const history = [{ revision: 1, effective_date: '2026-09-26' }];
    assert.equal(workOutCredit({ ...august, registrationDate: currentRegistrationDate(history)! }).creditCents, 0);
    const backdated = [...history, { revision: 2, effective_date: '2026-05-01' }];
    assert.equal(currentRegistrationDate(backdated), '2026-05-01');
    assert.equal(workOutCredit({ ...august, registrationDate: currentRegistrationDate(backdated)! }).creditCents, 7478);
    const andBack = [...backdated, { revision: 3, effective_date: '2026-09-26' }];
    assert.equal(workOutCredit({ ...august, registrationDate: currentRegistrationDate(andBack)! }).creditCents, 0);
    assert.equal(currentRegistrationDate([]), null);
  });
});

describe('expenses saved before 4a keep their meaning', () => {
  it('unknown stays Not sure yet (explicit false, or the old pending/zero rule)', () => {
    assert.equal(resolveTaxState({ tax_cad_cents: 0, tax_amount_known: false, tax_status: 'pending' }).answer, 'unknown');
    assert.equal(resolveTaxState({ tax_cad_cents: 0, tax_amount_known: null, tax_status: 'pending' }).answer, 'unknown');
  });
  it('known with no tax is No tax charged', () => {
    assert.equal(resolveTaxState({ tax_cad_cents: 0, tax_amount_known: true, tax_status: 'pending' }).answer, 'none');
    assert.equal(resolveTaxState({ tax_cad_cents: 0, tax_amount_known: null, tax_status: 'none' }).answer, 'none');
    assert.equal(resolveTaxState({ tax_cad_cents: 0, tax_amount_known: null, tax_status: 'reviewed' }).answer, 'none');
  });
  it('known with an amount is one Type not set line, whatever its review status', () => {
    for (const status of ['pending', 'reviewed'] as const) {
      assert.deepEqual(resolveTaxState({ tax_cad_cents: 1300, tax_amount_known: null, tax_status: status }).lines, [{ type: 'unset', cents: 1300 }]);
    }
  });
  it('a revision saved since 4a uses its own answer and lines', () => {
    const lines = [{ type: 'gst5' as const, cents: 300 }, { type: 'pst' as const, cents: 420 }];
    assert.deepEqual(resolveTaxState({ tax_cad_cents: 720, tax_status: 'pending', tax_answer: 'shown' }, lines), { answer: 'shown', lines, legacy: false });
    assert.deepEqual(resolveTaxState({ tax_cad_cents: 0, tax_status: 'none', tax_answer: 'none' }, lines).lines, []);
  });
});

describe('the sum rule', () => {
  it('lines must add up to the single tax amount', () => {
    assert.equal(taxLinesMatchTotal([{ type: 'gst5', cents: 300 }, { type: 'pst', cents: 420 }], 720), true);
    assert.equal(taxLinesMatchTotal([{ type: 'gst5', cents: 300 }], 720), false);
    assert.equal(taxLinesMatchTotal([], 0), true);
    assert.equal(taxLinesMatchTotal([{ type: 'gst5', cents: 0 }], 0), false, 'a zero line is never stored');
    assert.equal(taxLinesMatchTotal([{ type: 'vat' as never, cents: 100 }], 100), false);
    assert.equal(taxLinesMatchTotal([{ type: 'gst5', cents: 1.5 }], 1.5), false);
  });
});

describe('defaults and the supplier prefill', () => {
  it('kind of purchase starts from the category', () => {
    assert.equal(defaultPurchaseKind('Equipment & supplies'), 'capital');
    assert.equal(defaultPurchaseKind('Travel & meals'), 'operating', 'a taxi is not a meal');
    assert.equal(defaultPurchaseKind('Professional services'), 'operating');
  });
  it('the name match is exact, ignoring case and outer spaces only', () => {
    assert.equal(sameSupplier('  Hollis Law ', 'hollis law'), true);
    assert.equal(sameSupplier('Hollis Law LLP', 'Hollis Law'), false);
    assert.equal(sameSupplier('Hollis  Law', 'Hollis Law'), false);
  });
  it('fills from the latest active expense with that name that was saved since 4a', () => {
    const row = { void_reason: null, expense_date: '2026-10-01', created_at: '2026-10-01T00:00:00Z' };
    const rows = [
      { ...row, supplier: 'Hollis Law', incurred_date: '2026-10-01', supplier_registration: 'normal' as const, supplier_tax_number: '81234 5678 RT0001' },
      { ...row, supplier: 'hollis law', incurred_date: '2026-10-20', supplier_registration: 'not_checked' as const, supplier_tax_number: ' ' },
      { ...row, supplier: 'Hollis Law', incurred_date: '2026-11-01', supplier_registration: 'simplified' as const, supplier_tax_number: 'X', void_reason: 'Duplicate' },
      { ...row, supplier: 'Hollis Law', incurred_date: '2026-11-02', supplier_registration: null, supplier_tax_number: null },
      { ...row, supplier: 'Canva', incurred_date: '2026-11-03', supplier_registration: 'simplified' as const, supplier_tax_number: null },
    ];
    assert.deepEqual(supplierPrefill(rows, 'Hollis Law'), { registration: 'not_checked', number: null });
    assert.deepEqual(supplierPrefill(rows.slice(0, 1), ' HOLLIS LAW'), { registration: 'normal', number: '81234 5678 RT0001' });
    assert.equal(supplierPrefill(rows, 'Hollis'), null);
    assert.equal(supplierPrefill(rows, '  '), null);
  });
});
