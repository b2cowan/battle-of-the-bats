import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { valueLines } from '../../lib/platform-audit-diff.ts';

const changedText = (lines: { text: string; changed: boolean }[]) => lines.filter(l => l.changed).map(l => l.text.trim());

describe('audit entry value lines', () => {
  it('marks only the keys that differ, on both sides', () => {
    const old = { plan_id: 'tournament', team_limit: null, tournament_limit: 1 };
    const next = { plan_id: 'club', reason: 'UAT setup', team_limit: 15, tournament_limit: 9999 };
    assert.deepEqual(changedText(valueLines(old, next)), ['"plan_id": "tournament",', '"team_limit": null,', '"tournament_limit": 1']);
    assert.deepEqual(changedText(valueLines(next, old)), ['"plan_id": "club",', '"reason": "UAT setup",', '"team_limit": 15,', '"tournament_limit": 9999']);
  });

  it('leaves a key that did not move alone', () => {
    const lines = valueLines({ a: 1, b: 2 }, { a: 1, b: 3 });
    assert.deepEqual(changedText(lines), ['"b": 2']);
    assert.equal(lines[0].text, '{');
    assert.equal(lines[lines.length - 1].text, '}');
  });

  it('a nested value is one block, tinted whole, with valid commas', () => {
    const lines = valueLines({ a: { x: 1, y: [1, 2] }, b: 1 }, { a: { x: 2 }, b: 1 });
    assert.equal(lines.filter(l => l.changed).length, 7);
    assert.equal(lines.map(l => l.text).join('\n'), JSON.stringify({ a: { x: 1, y: [1, 2] }, b: 1 }, null, 2));
  });

  it('an empty side is "-", and it is a change only when the other side has something', () => {
    assert.deepEqual(valueLines(null, 15), [{ text: '-', changed: true }]);
    assert.deepEqual(valueLines(null, null), [{ text: '-', changed: false }]);
    assert.deepEqual(valueLines(15, null), [{ text: '15', changed: true }]);
  });

  it('an object against nothing is all changed', () => {
    const lines = valueLines({ days: 90 }, null);
    assert.deepEqual(changedText(lines), ['"days": 90']);
  });

  it('a plain string is shown as typed, line by line', () => {
    assert.deepEqual(valueLines('a\nb', 'a'), [{ text: 'a', changed: true }, { text: 'b', changed: true }]);
  });
});
