import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roomNeighbours } from '../../lib/room-neighbours';

type Row = { id: string; name: string; overdue: boolean };
const rows: Row[] = [
  { id: 'a', name: 'Ice rentals — fall block', overdue: true },
  { id: 'b', name: 'League registration', overdue: false },
  { id: 'c', name: 'Gym rental — winter', overdue: true },
  { id: 'd', name: 'Tournament entry — Fall Classic', overdue: false },
];
const byId = (r: Row) => r.id;
const byName = (r: Row) => r.name;

describe('roomNeighbours — the walk a room offers', () => {
  it('names both neighbours and the 1-based position for a record in the middle', () => {
    const n = roomNeighbours(rows, 'b', byId, byName);
    assert.deepEqual(n, {
      prev: { id: 'a', label: 'Ice rentals — fall block' },
      next: { id: 'c', label: 'Gym rental — winter' },
      index: 2,
      total: 4,
    });
  });

  it('disables the ends rather than wrapping', () => {
    assert.equal(roomNeighbours(rows, 'a', byId, byName).prev, null);
    assert.equal(roomNeighbours(rows, 'd', byId, byName).next, null);
    assert.equal(roomNeighbours(rows, 'd', byId, byName).index, 4);
  });

  it('walks the list AS FILTERED — a room opened from "overdue only" skips the rows it hid', () => {
    const overdue = rows.filter(r => r.overdue);
    const n = roomNeighbours(overdue, 'a', byId, byName);
    assert.equal(n.next?.id, 'c');
    assert.equal(n.total, 2);
    assert.equal(n.index, 1);
  });

  it('answers honestly when the open record is not in the walked list (a filter removed it)', () => {
    const n = roomNeighbours(rows.filter(r => r.id !== 'b'), 'b', byId, byName);
    assert.deepEqual(n, { prev: null, next: null, index: 0, total: 3 });
  });

  it('treats no open record as no walk', () => {
    assert.deepEqual(roomNeighbours(rows, null, byId, byName), { prev: null, next: null, index: 0, total: 4 });
  });
});
