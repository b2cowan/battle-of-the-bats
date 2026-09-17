import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  directionLabel, firstDirection, nextSort, parseLibrarySort, serializeLibrarySort, sortLibraryRows,
  type LibrarySortColumn,
} from '../../lib/library-sort.ts';

/**
 * The practice library's sort (columns follow-up, owner ruling T3, 2026-09-17): what a click
 * means, where the empties go, and that the resting order is untouched until a coach asks.
 */

type Row = { name: string; minutes: number | null; planCount: number; lastPlannedAt: string | null };

const COLUMNS: readonly LibrarySortColumn<Row>[] = [
  { key: 'name', label: 'Drill', kind: 'text', get: r => r.name },
  { key: 'usually', label: 'Usually', kind: 'minutes', get: r => r.minutes },
  { key: 'plans', label: 'Plans', kind: 'count', get: r => r.planCount },
  { key: 'planned', label: 'Last planned', kind: 'date', get: r => r.lastPlannedAt },
];
const col = (key: string) => COLUMNS.find(c => c.key === key)!;

const rows: Row[] = [
  { name: 'Warm-up', minutes: 10, planCount: 6, lastPlannedAt: '2026-09-10T22:00:00Z' },
  { name: 'Footwork ladder', minutes: 15, planCount: 6, lastPlannedAt: '2026-09-15T22:00:00Z' },
  { name: 'Close control', minutes: null, planCount: 0, lastPlannedAt: null },
  { name: 'Probe drill', minutes: 20, planCount: 2, lastPlannedAt: '2026-05-19T22:00:00Z' },
  { name: 'Finishing', minutes: 0, planCount: 0, lastPlannedAt: null },
];
const names = (r: Row[]) => r.map(x => x.name);

describe('the first click gives the order a coach clicks for', () => {
  it('names A–Z, minutes shortest first, counts most first, dates newest first', () => {
    assert.equal(firstDirection('text'), 'asc');
    assert.equal(firstDirection('minutes'), 'asc');
    assert.equal(firstDirection('count'), 'desc');
    assert.equal(firstDirection('date'), 'desc');
  });

  it('a new column starts in its first direction; the same column turns round', () => {
    assert.deepEqual(nextSort(null, col('plans')), { key: 'plans', dir: 'desc' });
    assert.deepEqual(nextSort({ key: 'plans', dir: 'desc' }, col('plans')), { key: 'plans', dir: 'asc' });
    assert.deepEqual(nextSort({ key: 'plans', dir: 'asc' }, col('name')), { key: 'name', dir: 'asc' });
  });

  it('says the direction in words for the phone menu', () => {
    assert.equal(directionLabel('date', 'desc'), 'Newest first');
    assert.equal(directionLabel('count', 'asc'), 'Fewest first');
    assert.equal(directionLabel('minutes', 'asc'), 'Shortest first');
    assert.equal(directionLabel('text', 'desc'), 'Z–A');
  });
});

describe('the order', () => {
  it('no column chosen → the caller\'s order, untouched (the tab says nothing on its own)', () => {
    assert.deepEqual(names(sortLibraryRows(rows, null, COLUMNS)), names(rows));
  });

  it('counts most first, ties fall to the name, the never-planned at the foot in name order', () => {
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'plans', dir: 'desc' }, COLUMNS)),
      ['Footwork ladder', 'Warm-up', 'Probe drill', 'Close control', 'Finishing']);
  });

  it('turned round, the empties STILL sit at the foot — "fewest first" never puts a dash on top', () => {
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'plans', dir: 'asc' }, COLUMNS)),
      ['Probe drill', 'Footwork ladder', 'Warm-up', 'Close control', 'Finishing']);
  });

  it('dates newest first, no date last; oldest first keeps them last too', () => {
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'planned', dir: 'desc' }, COLUMNS)),
      ['Footwork ladder', 'Warm-up', 'Probe drill', 'Close control', 'Finishing']);
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'planned', dir: 'asc' }, COLUMNS)),
      ['Probe drill', 'Warm-up', 'Footwork ladder', 'Close control', 'Finishing']);
  });

  it('minutes shortest first; a zero or missing length is a dash and goes last', () => {
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'usually', dir: 'asc' }, COLUMNS)),
      ['Warm-up', 'Footwork ladder', 'Probe drill', 'Close control', 'Finishing']);
  });

  it('names Z–A', () => {
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'name', dir: 'desc' }, COLUMNS)),
      ['Warm-up', 'Probe drill', 'Footwork ladder', 'Finishing', 'Close control']);
  });

  it('does not mutate the caller\'s array and ignores a key the table does not have', () => {
    const copy = [...rows];
    sortLibraryRows(rows, { key: 'plans', dir: 'desc' }, COLUMNS);
    assert.deepEqual(rows, copy);
    assert.deepEqual(names(sortLibraryRows(rows, { key: 'tags', dir: 'asc' }, COLUMNS)), names(rows));
  });
});

describe('the remembered choice', () => {
  it('round-trips, and refuses a column the table lacks or a direction that is not one', () => {
    assert.deepEqual(parseLibrarySort(serializeLibrarySort({ key: 'planned', dir: 'desc' }), COLUMNS), { key: 'planned', dir: 'desc' });
    assert.equal(parseLibrarySort('tags:asc', COLUMNS), null);
    assert.equal(parseLibrarySort('plans:sideways', COLUMNS), null);
    assert.equal(parseLibrarySort('', COLUMNS), null);
    assert.equal(parseLibrarySort(null, COLUMNS), null);
    assert.equal(parseLibrarySort('plans', COLUMNS), null);
  });
});
