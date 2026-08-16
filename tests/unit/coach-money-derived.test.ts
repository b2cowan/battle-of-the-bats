/**
 * ⚠⚠ ONE ROW, ONE SOURCE (COACH_MONEY_IN_TAXONOMY_PLAN §4.1).
 *
 * Fundraisers and sponsors already report their own actuals and player rebates depend on them, so a
 * row those already answer for must refuse a typed income record — otherwise the same dollar is
 * counted twice and the season reads better than it is. These tests state where a derived total
 * lands and which rows are therefore closed to typing, because both answers are the kind a later
 * "surely we can just put it on the first line" reverses.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  placeDerivedActual, derivedIncomeKeys, taxonomyKey, type DerivedClaim,
} from '../../lib/coach-money-derived.ts';

const FUNDRAISING = 'cat-fundraising';
const DRIVE = 'item-drive';
const MERCH = 'item-merch';

function claim(over: Partial<DerivedClaim> = {}): DerivedClaim {
  return {
    source: 'fundraiser',
    categoryId: FUNDRAISING, categoryName: 'Fundraising',
    itemId: DRIVE, itemName: 'Fundraising drive',
    ...over,
  };
}

describe('placeDerivedActual — as deep as the plan actually agrees, and no deeper', () => {
  it('lands on the ITEM when every claiming line names the same one', () => {
    const at = placeDerivedActual([claim(), claim({ categoryName: 'Fundraising' })]);
    assert.equal(at.categoryId, FUNDRAISING);
    assert.equal(at.itemId, DRIVE);
    assert.equal(at.itemName, 'Fundraising drive');
  });

  it('falls back to the CATEGORY when the lines name two different items', () => {
    /* ⚠ THE HONEST ANSWER, not the convenient one. Nothing links a bottle drive to a budget item,
       so choosing between "Fundraising drive" and "Merchandise sales" for one $1,640 total would be
       confident-and-wrong data a coach could not detect. The visible gap is the nudge. */
    const at = placeDerivedActual([claim(), claim({ itemId: MERCH, itemName: 'Merchandise sales' })]);
    assert.equal(at.categoryId, FUNDRAISING);
    assert.equal(at.itemId, null);
  });

  it('lands nowhere when the lines are spread across categories', () => {
    const at = placeDerivedActual([claim(), claim({ categoryId: 'cat-other', categoryName: 'Events' })]);
    assert.equal(at.categoryId, null);
    assert.equal(at.itemId, null);
  });

  it('lands nowhere when nothing claims it — money raised against no plan at all', () => {
    assert.deepEqual(placeDerivedActual([]), {
      categoryId: null, categoryName: null, itemId: null, itemName: null,
    });
  });

  it('lands nowhere when the claiming lines carry no category (every pre-243 money-in line)', () => {
    // No backfill: lines written before this release name nothing, and must keep working.
    const at = placeDerivedActual([claim({ categoryId: null, categoryName: null, itemId: null, itemName: null })]);
    assert.equal(at.categoryId, null);
  });
});

describe('derivedIncomeKeys — which rows the money form must refuse', () => {
  it('closes the row the pool lands on', () => {
    const keys = derivedIncomeKeys([claim()]);
    assert.ok(keys.has(taxonomyKey(FUNDRAISING, DRIVE)));
  });

  it('closes BOTH claimed items AND the category bucket the pool falls back to', () => {
    // Two fundraising lines on two items: the pool sits in the category bucket, so a typed record
    // there would double-count — and so would one on either claimed item.
    const keys = derivedIncomeKeys([claim(), claim({ itemId: MERCH, itemName: 'Merchandise sales' })]);
    assert.ok(keys.has(taxonomyKey(FUNDRAISING, DRIVE)));
    assert.ok(keys.has(taxonomyKey(FUNDRAISING, MERCH)));
    assert.ok(keys.has(taxonomyKey(FUNDRAISING, null)));
  });

  it('leaves every other row open, including a sibling item in the same category', () => {
    const keys = derivedIncomeKeys([claim()]);
    assert.equal(keys.has(taxonomyKey(FUNDRAISING, MERCH)), false);
    assert.equal(keys.has(taxonomyKey('cat-tournaments', 'item-registration')), false);
  });

  it('closes nothing when the team plans no fundraising or sponsorship at all', () => {
    assert.equal(derivedIncomeKeys([]).size, 0);
  });

  it('places the two sources SEPARATELY rather than merging their claims', () => {
    /* ⚠ Drives and sponsors report two different totals. Merged, a fundraising figure would be
       placed using a sponsorship line's category — precise-looking and wrong. Here each lands on
       its own item, and both rows are closed to typing. */
    const claims = [
      claim(),
      claim({ source: 'sponsor', categoryId: 'cat-sponsorship', categoryName: 'Sponsorship', itemId: 'item-team-sponsor', itemName: 'Team sponsorship' }),
    ];
    assert.equal(placeDerivedActual(claims.filter(c => c.source === 'fundraiser')).itemId, DRIVE);
    assert.equal(placeDerivedActual(claims.filter(c => c.source === 'sponsor')).itemId, 'item-team-sponsor');
    // Merged they would place nowhere at all, which is what makes the split load-bearing.
    assert.equal(placeDerivedActual(claims).categoryId, null);

    const keys = derivedIncomeKeys(claims);
    assert.ok(keys.has(taxonomyKey(FUNDRAISING, DRIVE)));
    assert.ok(keys.has(taxonomyKey('cat-sponsorship', 'item-team-sponsor')));
  });
});
