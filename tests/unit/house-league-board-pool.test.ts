import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  familiesOf, filterCounts, householdKey, matchesSearch, narrowPool, sortPool, type PoolFacts, type PoolPlayer,
} from '../../lib/house-league-board-pool.ts';

/** HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE A3–A6: the pool's search, filter, sort and households, as data. */

const kid = (id: string, first: string, last: string, extra: Partial<PoolPlayer> = {}): PoolPlayer => ({
  id, firstName: first, lastName: last, age: 10, owes: null,
  guardianFirstName: 'Pat', guardianLastName: last, guardianEmail: `${last.toLowerCase()}@example.com`, ...extra,
});

const pool = [
  kid('a', 'Avery', 'Macdonald', { age: 11, guardianEmail: ' Mac@Example.com ' }),
  kid('b', 'Nora', 'Macdonald', { age: 9, guardianEmail: 'mac@example.com' }),
  kid('c', 'Liam', 'Chen', { age: 10, owes: 165 }),
  kid('d', 'Jaya', 'Singh', { age: null, guardianEmail: '' }),
  kid('e', 'Mia', 'Singh', { age: 12, guardianFirstName: 'Ravi', guardianEmail: 'ravi@example.com' }),
];
const families = familiesOf(pool);
const facts = (over: Partial<PoolFacts> = {}): PoolFacts => ({
  ratings: new Map([['a', 4], ['c', 5]]), notes: { e: 'Peanut allergy' }, families, ...over,
});

describe('households (A6)', () => {
  it('are the same email, trimmed and lower-cased — never the surname', () => {
    assert.equal(householdKey(' Mac@Example.com '), 'mac@example.com');
    assert.deepEqual([...families.keys()], ['mac@example.com']);
    // Two Singhs with different (or no) emails are not a family.
    assert.equal(families.has('ravi@example.com'), false);
  });
  it('a child with no email stands alone', () => assert.equal(householdKey('  '), null));
});

describe('search (A3)', () => {
  it('finds a player by name, or a family by the parent’s name', () => {
    assert.ok(matchesSearch(pool[0], 'avery mac'));
    assert.ok(matchesSearch(pool[4], 'ravi'));
    assert.equal(matchesSearch(pool[2], 'ravi'), false);
  });
  it('ignores accents and case', () => assert.ok(matchesSearch(kid('x', 'Zoë', 'Lévesque'), 'zoe leves')));
});

describe('filter (A4)', () => {
  it('ticks are any-of, and counts are over the whole pool', () => {
    assert.deepEqual(narrowPool(pool, '', ['owing', 'notes'], facts()).map(p => p.id), ['c', 'e']);
    assert.deepEqual(filterCounts(pool, ['notRated', 'notes', 'owing', 'sibling'], facts()), { notRated: 3, notes: 1, owing: 1, sibling: 2 });
  });
  it('a reader with no notes gets no Notes match', () => {
    assert.deepEqual(narrowPool(pool, '', ['notes'], facts({ notes: null })), []);
  });
  it('search and filter narrow together', () => {
    assert.deepEqual(narrowPool(pool, 'mac', ['sibling'], facts()).map(p => p.id), ['a', 'b']);
  });
});

describe('sort (A5)', () => {
  const ids = (s: Parameters<typeof sortPool>[1]) => sortPool(pool, s, facts().ratings).map(p => p.id);
  it('last name, then first', () => assert.deepEqual(ids('last'), ['c', 'a', 'b', 'd', 'e']));
  it('rating: strongest first, not rated after the rated', () => assert.deepEqual(ids('rating'), ['c', 'a', 'b', 'd', 'e']));
  it('age: youngest first, no age last', () => assert.deepEqual(ids('age'), ['b', 'c', 'a', 'e', 'd']));
  it('family: a household’s children side by side', () => {
    const order = ids('family');
    assert.equal(Math.abs(order.indexOf('a') - order.indexOf('b')), 1);
  });
  it('family: a parent’s surname typed two ways does not split the household', () => {
    const mixed = [
      kid('a', 'Avery', 'Smith', { guardianLastName: 'Smith', guardianEmail: 'pat@x.com' }),
      kid('m', 'Mo', 'Smithers', { guardianLastName: 'Smithers', guardianEmail: 'mo@x.com' }),
      kid('b', 'Ben', 'Smyth', { guardianLastName: 'Smyth', guardianEmail: 'pat@x.com' }),
    ];
    const order = sortPool(mixed, 'family', new Map()).map(p => p.id);
    assert.equal(Math.abs(order.indexOf('a') - order.indexOf('b')), 1, order.join(' '));
  });
});
