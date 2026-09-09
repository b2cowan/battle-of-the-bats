/**
 * THE CATEGORY IS THE SHELF (owner ruling 2026-09-09).
 *
 * A money-in budget line reports under the CATEGORY it was filed in, on every surface — the plan
 * list, the by-period grid, both plan files and Budget vs. Actual's Months view — exactly as a cost
 * line already did on the Statement. Until then the plan grouped money in by its stored KIND and
 * Months by its SOURCE, so one concession stand filed under Tournaments read under "Other income" on
 * two screens and under "Tournaments" on a third. These pin the one helper every surface now shares.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  categoryGroupOf, compareCategoryGroups, groupByCategory, categoryIdOfKey, categoryKey, NO_CATEGORY_LABEL,
} from '../../lib/coach-budget-rollup.ts';

describe('categoryGroupOf — a money-in line is grouped by its category', () => {
  it('keys by the category ID, exactly as the statement keys it', () => {
    const g = categoryGroupOf({ categoryId: 'cat-tournaments', categoryName: 'Tournaments' });
    assert.equal(g.key, categoryKey('cat-tournaments', 'Tournaments'));
    assert.equal(g.name, 'Tournaments');
    assert.equal(g.categoryId, 'cat-tournaments');
  });

  it('two categories sharing a NAME stay two groups — a club\'s own "Fundraising" is not the platform\'s', () => {
    const a = categoryGroupOf({ categoryId: 'cat-platform', categoryName: 'Fundraising' });
    const b = categoryGroupOf({ categoryId: 'cat-club', categoryName: 'Fundraising' });
    assert.notEqual(a.key, b.key);
    assert.equal(a.name, b.name);
  });

  it('a legacy line with no category lands in the nameless bucket under the one spelling', () => {
    const g = categoryGroupOf({ categoryId: null, categoryName: null });
    assert.equal(g.key, categoryKey(null, null));
    assert.equal(g.name, NO_CATEGORY_LABEL);
    // …however the absence is spelled.
    assert.equal(categoryGroupOf({}).key, g.key);
    assert.equal(categoryGroupOf({ categoryName: '   ' }).key, g.key);
  });

  it('a name-only line (no id) keys by its name, so two such lines share a group', () => {
    const a = categoryGroupOf({ categoryName: 'Typed By Hand' });
    const b = categoryGroupOf({ categoryName: 'typed by hand' });
    assert.equal(a.key, b.key);
  });
});

describe('compareCategoryGroups — the picker\'s order, then the name, nameless last', () => {
  const order = new Map([['cat-tournaments', 1], ['cat-sponsorship', 10], ['cat-fundraising', 9]]);
  const cmp = compareCategoryGroups(order);
  const g = (categoryId: string | null, categoryName: string | null) => categoryGroupOf({ categoryId, categoryName });

  it('sorts by sort order when both are known', () => {
    const sorted = [g('cat-sponsorship', 'Sponsorship'), g('cat-tournaments', 'Tournaments'), g('cat-fundraising', 'Fundraising')]
      .sort(cmp).map(x => x.name);
    assert.deepEqual(sorted, ['Tournaments', 'Fundraising', 'Sponsorship']);
  });

  it('a category the picker does not list sorts after the ones it does, alphabetically among its kind', () => {
    const sorted = [g('cat-zeta', 'Zeta'), g('cat-alpha', 'Alpha'), g('cat-tournaments', 'Tournaments')]
      .sort(cmp).map(x => x.name);
    assert.deepEqual(sorted, ['Tournaments', 'Alpha', 'Zeta']);
  });

  it('the nameless bucket is always last', () => {
    const sorted = [g(null, null), g('cat-zeta', 'Zeta'), g('cat-tournaments', 'Tournaments')]
      .sort(cmp).map(x => x.name);
    assert.deepEqual(sorted, ['Tournaments', 'Zeta', NO_CATEGORY_LABEL]);
  });

  it('with no order at all it is alphabetical — the file with no picker behind it', () => {
    const sorted = [g('b', 'Beta'), g('a', 'Alpha')].sort(compareCategoryGroups()).map(x => x.name);
    assert.deepEqual(sorted, ['Alpha', 'Beta']);
  });
});

describe('categoryIdOfKey — the inverse of an id key, so no reader parses the prefix itself', () => {
  it('returns the id behind an id key and null for anything else', () => {
    assert.equal(categoryIdOfKey(categoryKey('cat-1', 'Facilities')), 'cat-1');
    assert.equal(categoryIdOfKey(categoryKey(null, 'Typed By Hand')), null);
    assert.equal(categoryIdOfKey(categoryKey(null, null)), null);
    assert.equal(categoryIdOfKey(null), null);
  });
});

describe('groupByCategory — the one shape every by-category list reads', () => {
  const order = new Map([['cat-t', 1], ['cat-s', 10], ['cat-f', 9]]);
  const lines = [
    { id: 'a', categoryId: 'cat-s', categoryName: 'Sponsorship', totalAmount: 500 },
    { id: 'b', categoryId: 'cat-t', categoryName: 'Tournaments', totalAmount: 400 },
    { id: 'c', categoryId: 'cat-f', categoryName: 'Fundraising', totalAmount: 800 },
    { id: 'd', categoryId: 'cat-t', categoryName: 'Tournaments', totalAmount: 250 },
    { id: 'e', categoryId: null, categoryName: null, totalAmount: 10 },
  ];

  it('buckets by category identity and orders the buckets the way the picker does, nameless last', () => {
    const groups = groupByCategory(lines, categoryGroupOf, order);
    assert.deepEqual(groups.map(g => g.ref.name), ['Tournaments', 'Fundraising', 'Sponsorship', NO_CATEGORY_LABEL]);
    assert.deepEqual(groups.map(g => g.items.map(l => l.id)), [['b', 'd'], ['c'], ['a'], ['e']]);
  });

  it('keeps line order inside a bucket — the plan list never re-sorts a coach\'s money-in rows', () => {
    const [tournaments] = groupByCategory(lines, categoryGroupOf, order);
    assert.deepEqual(tournaments.items.map(l => l.id), ['b', 'd']);
  });

  it('two same-named categories stay two buckets', () => {
    const groups = groupByCategory([
      { categoryId: 'cat-platform', categoryName: 'Fundraising' },
      { categoryId: 'cat-club', categoryName: 'Fundraising' },
    ], categoryGroupOf);
    assert.equal(groups.length, 2);
  });
});
