import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SEEDED_PAYMENT_METHODS, mergePaymentMethods } from '../../lib/payment-methods.ts';

/**
 * The whole point of the payment-method list is that a club stops accumulating three spellings of
 * one method (owner review 2026-08-15, Q5). These tests pin the two behaviours that promise
 * delivers on — case-folding, and seeding — plus the one it deliberately does NOT.
 */
describe('payment methods — the club vocabulary', () => {
  test('an unused club still gets the common methods, in order', () => {
    const options = mergePaymentMethods([]);
    assert.deepEqual(options.map(o => o.name), [...SEEDED_PAYMENT_METHODS]);
    assert.ok(options.every(o => o.seeded && o.count === 0));
  });

  test('casing variants collapse into one option carrying the combined count', () => {
    const options = mergePaymentMethods([
      { name: 'E-Transfer', count: 9 },
      { name: 'e-transfer', count: 4 },
      { name: 'E-TRANSFER', count: 1 },
    ]);
    const transfer = options.filter(o => o.name.toLowerCase() === 'e-transfer');
    assert.equal(transfer.length, 1, 'three casings must not become three options');
    assert.equal(transfer[0].count, 14);
  });

  test('a used value matching a seed is shown in the SEED casing, not the typed one', () => {
    // The club has only ever typed it lowercase; the picker should still offer our canonical form,
    // which is how the next entry lands clean without anything being rewritten behind them.
    const options = mergePaymentMethods([{ name: 'cheque', count: 3 }]);
    const cheque = options.find(o => o.name.toLowerCase() === 'cheque');
    assert.equal(cheque?.name, 'Cheque');
    assert.equal(cheque?.seeded, true);
  });

  test('what the club actually uses outranks what we suggest', () => {
    const options = mergePaymentMethods([
      { name: 'Cash', count: 2 },
      { name: 'Interac at the rink', count: 7 },
    ]);
    // Most-used first, then the rest of the seeds — so the answer a coach probably wants is the
    // one their thumb lands on.
    assert.equal(options[0].name, 'Interac at the rink');
    assert.equal(options[1].name, 'Cash');
    assert.ok(options.slice(2).every(o => o.count === 0));
  });

  test("a club's own method is kept verbatim and marked as not ours", () => {
    const options = mergePaymentMethods([{ name: 'Money order', count: 1 }]);
    const own = options.find(o => o.name === 'Money order');
    assert.equal(own?.seeded, false, 'free text must survive exactly as entered');
  });

  test('DIFFERENT SPELLINGS ARE NOT MERGED — only casing is', () => {
    // Deliberate. Deciding that "e transfer" and "e-transfer" mean the same method is a guess, and
    // a money field must never silently rewrite what someone recorded. Cleaning up history is a
    // separate, explicit job.
    const options = mergePaymentMethods([
      { name: 'e transfer', count: 5 },
      { name: 'etransfer', count: 2 },
    ]);
    assert.ok(options.some(o => o.name === 'e transfer'));
    assert.ok(options.some(o => o.name === 'etransfer'));
  });

  test('blank and whitespace-only stored values are dropped, never offered', () => {
    const options = mergePaymentMethods([{ name: '   ', count: 4 }, { name: '', count: 2 }]);
    assert.deepEqual(options.map(o => o.name), [...SEEDED_PAYMENT_METHODS]);
  });

  test('a stored value with stray whitespace matches its trimmed twin', () => {
    const options = mergePaymentMethods([{ name: ' Cash ', count: 3 }, { name: 'Cash', count: 2 }]);
    const cash = options.filter(o => o.name === 'Cash');
    assert.equal(cash.length, 1);
    assert.equal(cash[0].count, 5);
  });

  test('the seed list never appears twice, however it was used', () => {
    const options = mergePaymentMethods(
      SEEDED_PAYMENT_METHODS.map(s => ({ name: s.toUpperCase(), count: 1 })),
    );
    assert.equal(options.length, SEEDED_PAYMENT_METHODS.length);
  });
});
