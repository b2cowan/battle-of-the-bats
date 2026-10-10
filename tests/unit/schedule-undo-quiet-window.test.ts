import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseNotices, type NoticeGameNow, type QueuedNotice } from '../../lib/schedule-change-classify.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';

/**
 * Tournament admin redesign Stage 3, Part 4 — the schedule's Undo (A36) says "Undo it before then and nobody is told".
 * That rests on the sweep's collapse: the notices a team has not been sent yet are read together, and a game that
 * ends the batch where it began tells nobody. Proven here before the screens rely on it.
 *
 * Found proving it: the rule held for a MOVE only. A cancel undone inside the window sent "back on" to followers who
 * never heard it was off, and a reinstatement undone sent "cancelled" again to followers who already knew.
 */

const NOW = Date.parse(zonedWallClockToUtc('2026-10-09', '12:00')!);
const PUBLISHED = new Set(['u13']);
let seq = 0;
const notice = (over: Partial<QueuedNotice>): QueuedNotice => ({
  id: `n${++seq}`, game_id: 'g1', kind: 'moved', was_date: '2026-10-10', was_time: '16:00:00', was_location: 'Lions Park — Diamond 2',
  created_at: `2026-10-09T16:${String(seq).padStart(2, '0')}:00Z`, ...over,
});
const game = (over: Partial<NoticeGameNow>): NoticeGameNow => ({
  id: 'g1', game_date: '2026-10-10', game_time: '16:00:00', location: 'Lions Park — Diamond 2', status: 'scheduled', division_id: 'u13', ...over,
});
const sweep = (notices: QueuedNotice[], now: NoticeGameNow) => collapseNotices(notices, new Map([[now.id, now]]), PUBLISHED, NOW);

describe('an Undo inside the quiet window tells nobody', () => {
  test('moved, then put back', () => {
    const moved = notice({ kind: 'moved' });
    const back = notice({ kind: 'moved', was_time: '17:00:00' });
    assert.deepEqual(sweep([moved, back], game({})), []);
  });
  test('moved to another diamond, then put back', () => {
    const moved = notice({ kind: 'moved' });
    const back = notice({ kind: 'moved', was_location: 'Lions Park — Diamond 3' });
    assert.deepEqual(sweep([back, moved], game({})), [], 'whatever order the claim returns the rows in');
  });
  test('cancelled, then reinstated', () => {
    const cancelled = notice({ kind: 'cancelled' });
    const restored = notice({ kind: 'restored' });
    assert.deepEqual(sweep([cancelled, restored], game({})), []);
  });
  test('reinstated, then cancelled again (followers already knew it was off)', () => {
    const restored = notice({ kind: 'restored' });
    const cancelled = notice({ kind: 'cancelled' });
    assert.deepEqual(sweep([restored, cancelled], game({ status: 'cancelled' })), []);
  });
});

describe('a change that stands is still told — once', () => {
  test('moved and moved again: one message, measured from where it began', () => {
    const out = sweep([notice({ kind: 'moved' }), notice({ kind: 'moved', was_time: '17:00:00' })], game({ game_time: '18:00:00' }));
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, 'moved');
    assert.equal(out[0].was.time, '16:00:00');
  });
  test('cancelled: told', () => {
    assert.equal(sweep([notice({ kind: 'cancelled' })], game({ status: 'cancelled' }))[0]?.kind, 'cancelled');
  });
  test('cancelled, reinstated at a NEW time: told (it is not where it began)', () => {
    const out = sweep([notice({ kind: 'cancelled' }), notice({ kind: 'restored' })], game({ game_time: '18:00:00' }));
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, 'restored');
  });
  test('a reinstatement alone (the cancel was sent earlier): told it is back on', () => {
    assert.equal(sweep([notice({ kind: 'restored' })], game({}))[0]?.kind, 'restored');
  });
});

describe('the gates the collapse keeps', () => {
  test('a division pulled back to draft since: nothing', () => {
    assert.deepEqual(collapseNotices([notice({})], new Map([['g1', game({ game_time: '18:00:00' })]]), new Set(), NOW), []);
  });
  test('a game already played, or already started: nothing', () => {
    assert.deepEqual(sweep([notice({})], game({ game_time: '18:00:00', status: 'completed' })), []);
    assert.deepEqual(sweep([notice({})], game({ game_date: '2026-10-09', game_time: '11:00:00' })), []);
  });
});
