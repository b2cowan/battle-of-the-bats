import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { openingBalanceFor, carriesProvenance, type SeasonCarryChoice } from '../../lib/season-carry';

/**
 * What a new season opens with when the coach rolls the year forward.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE THE FAILURE PATH SHIPPED WRONG (found by `/review` 2026-08-25 during
 * money centralization P3; write-up in Owner QA §104). The carry decision lived inline in
 * `startNextRepSeason`, which touches the database and so could not be unit-tested — and an
 * untestable decision is one nobody notices going wrong. A transient failure reading the closing
 * cash left the figure at its initialiser `0`, which then satisfied the `!== null` test that stamps
 * provenance, so the new season was recorded as *"carried from the 2025 Season: $0.00"* for a team
 * that may have closed holding thousands.
 *
 * ⚠ THE CLAIM THESE TESTS DEFEND IS NOT "the figure is right" — it is that **a failure and a real
 * zero are different facts**, and that only a figure the product WORKED OUT may name where it came
 * from. Both halves have to hold together: a null figure with a provenance stamp is the bug.
 */
describe('season carry-forward — a failure is not a measurement', () => {
  const ALL: SeasonCarryChoice = { mode: 'all' };
  const NONE: SeasonCarryChoice = { mode: 'none' };

  test('a FAILED closing-cash read carries NOTHING, not zero', () => {
    // null closingCents = the read threw, or was never attempted. Never "it closed at zero".
    assert.equal(openingBalanceFor(ALL, null), null);
  });

  test('and a failed read may NEVER claim provenance', () => {
    const opening = openingBalanceFor(ALL, null);
    assert.equal(carriesProvenance(ALL, opening), false,
      'a season must not say "carried from the 2025 Season" about a figure we failed to read');
  });

  test('a season that genuinely closed EMPTY carries a real $0 — and says where it came from', () => {
    // The distinction the bug collapsed: same number, different facts.
    const opening = openingBalanceFor(ALL, 0);
    assert.equal(opening, 0);
    assert.equal(carriesProvenance(ALL, opening), true);
  });

  test('a real closing balance is carried in dollars', () => {
    assert.equal(openingBalanceFor(ALL, 812_345), 8123.45);
    assert.equal(carriesProvenance(ALL, 8123.45), true);
  });

  test('carrying nothing on purpose is null, and claims no provenance', () => {
    const opening = openingBalanceFor(NONE, 999_99);
    assert.equal(opening, null, 'an explicit "carry nothing" ignores whatever the season closed at');
    assert.equal(carriesProvenance(NONE, opening), false);
  });

  test('a hand-typed amount is carried, but NEVER vouched for', () => {
    const choice: SeasonCarryChoice = { mode: 'amount', amount: 1500 };
    const opening = openingBalanceFor(choice, null);
    assert.equal(opening, 1500);
    assert.equal(carriesProvenance(choice, opening), false,
      '"carried from the 2025 Season" would be vouching for a figure the coach chose');
  });

  test('a hand-typed ZERO is a real figure, not "nothing carried"', () => {
    // ⚠ The same null-vs-zero trap one door along: a coach who deliberately types 0 has made a
    //   statement, and the register shows an opening line saying so.
    assert.equal(openingBalanceFor({ mode: 'amount', amount: 0 }, null), 0);
  });

  test('a hand-typed amount rounds through cents, not float arithmetic', () => {
    assert.equal(openingBalanceFor({ mode: 'amount', amount: 10.005 }, null), 10.01);
    assert.equal(openingBalanceFor({ mode: 'amount', amount: 0.1 + 0.2 }, null), 0.3);
  });

  test('⚠ no combination ever produces a null figure wearing a provenance stamp', () => {
    // The bug in one assertion: whatever the inputs, "we do not know" and "here is where it came
    // from" must never both be true.
    const choices: SeasonCarryChoice[] = [ALL, NONE, { mode: 'amount', amount: 0 }, { mode: 'amount', amount: 42 }];
    for (const choice of choices) {
      for (const closing of [null, 0, 5_00, 812_345]) {
        const opening = openingBalanceFor(choice, closing);
        if (opening === null) {
          assert.equal(carriesProvenance(choice, opening), false,
            `${choice.mode} + closing=${closing} produced a sourced null`);
        }
      }
    }
  });
});
