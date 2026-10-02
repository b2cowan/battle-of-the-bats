import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { copyLineup, sourceBattingOrder, type LineupCopySource } from '../../lib/lineup-copy.ts';
import type { LineupPlayerRow, LineupSeedEntry } from '../../lib/lineup-grid.ts';
import type { RepLineupMode, RepRosterPlayer } from '../../lib/types.ts';

/**
 * Copy from (owner rulings 2026-10-02 — docs/projects/active/COACH_LINEUP_COPY_FROM_GAME_PLAN.md §4).
 * "Batting order" moves players into the source's order and leaves this game's positions alone;
 * "Order and positions" is EVERYTHING, pitcher included (D2). Either way the copy is AS IS (D3): a
 * player the coach took out of this game comes back, a player who left the team is skipped.
 */
const player = (id: string, first = id): RepRosterPlayer =>
  ({ id, playerFirstName: first, playerLastName: 'Test' } as unknown as RepRosterPlayer);
const row = (id: string, positions: Record<string, string> = {}, extra: Partial<LineupPlayerRow> = {}): LineupPlayerRow =>
  ({ player: player(id), battingOrder: '', starter: true, inningPositions: positions, notes: '', ...extra });
const entry = (playerId: string, battingOrder: number | null, inningPositions: Record<string, string> = {}, starter = true): LineupSeedEntry =>
  ({ playerId, battingOrder, starter, inningPositions });
const pool = (...ids: string[]) => new Map(ids.map(id => [id, player(id)]));
const order = (rows: LineupPlayerRow[]) => rows.map(r => r.player.id);
const source = (entries: LineupSeedEntry[], lineupMode: RepLineupMode = 'everyone_bats', inningCount = 7): LineupCopySource =>
  ({ lineupMode, inningCount, entries });

describe('sourceBattingOrder', () => {
  it('reads the numbered slots in order, then the unnumbered (nine-player subs) as saved', () => {
    const ordered = sourceBattingOrder([entry('sub1', null), entry('c', 3), entry('a', 1), entry('sub2', null), entry('b', 2)]);
    assert.deepEqual(ordered.map(e => e.playerId), ['a', 'b', 'c', 'sub1', 'sub2']);
  });
});

describe('copyLineup — Order and positions (everything)', () => {
  it('copies the order and every inning, the pitcher included, and takes the source’s format and innings', () => {
    const result = copyLineup({
      current: [row('a'), row('b'), row('c')],
      currentMode: 'everyone_bats', currentInnings: 6,
      source: source([entry('b', 1, { 1: 'P', 2: 'P' }), entry('a', 2, { 1: 'C', 7: 'LF' }), entry('c', 3, { 1: 'Bench' })], 'everyone_bats', 7),
      what: 'everything', admissible: pool('a', 'b', 'c'),
    });
    assert.deepEqual(order(result.rows), ['b', 'a', 'c']);
    assert.deepEqual(result.rows.map(r => r.battingOrder), ['1', '2', '3']);
    assert.deepEqual(result.rows[0].inningPositions, { 1: 'P', 2: 'P' }, 'the pitcher comes across (D2)');
    assert.deepEqual(result.rows[1].inningPositions, { 1: 'C', 7: 'LF' });
    assert.equal(result.inningCount, 7);
    assert.equal(result.lineupMode, 'everyone_bats');
  });
  it('drops positions past the copied inning count', () => {
    const result = copyLineup({
      current: [row('a')], currentMode: 'everyone_bats', currentInnings: 7,
      source: source([entry('a', 1, { 1: 'SS', 6: 'SS', 7: 'P' })], 'everyone_bats', 6),
      what: 'everything', admissible: pool('a'),
    });
    assert.deepEqual(result.rows[0].inningPositions, { 1: 'SS', 6: 'SS' });
  });
  it('keeps this game’s players who were not in the source, at the bottom, with no positions', () => {
    const result = copyLineup({
      current: [row('extra', { 1: 'CF' }), row('a')],
      currentMode: 'everyone_bats', currentInnings: 7,
      source: source([entry('a', 1, { 1: 'C' })]),
      what: 'everything', admissible: pool('a', 'extra'),
    });
    assert.deepEqual(order(result.rows), ['a', 'extra']);
    assert.deepEqual(result.rows[1].inningPositions, {}, 'they had no positions in the copied lineup');
  });
  it('brings back a rostered player the coach had taken out of this game (copy as is)', () => {
    const result = copyLineup({
      current: [row('a')], currentMode: 'everyone_bats', currentInnings: 7,
      source: source([entry('gone-from-this-game', 1, { 1: '2B' }), entry('a', 2)]),
      what: 'everything', admissible: pool('a', 'gone-from-this-game'),
    });
    assert.deepEqual(order(result.rows), ['gone-from-this-game', 'a']);
    assert.deepEqual(result.skippedPlayerIds, []);
  });
  it('skips a player this game cannot hold — someone who left the team, or a call-up not brought', () => {
    const result = copyLineup({
      current: [row('a')], currentMode: 'everyone_bats', currentInnings: 7,
      source: source([entry('left-the-team', 1, { 1: 'SS' }), entry('a', 2)]),
      what: 'everything', admissible: pool('a'),
    });
    assert.deepEqual(order(result.rows), ['a']);
    assert.deepEqual(result.skippedPlayerIds, ['left-the-team']);
  });
  it('a nine-player source keeps its subs as subs and never starts more than nine', () => {
    const starters = Array.from({ length: 9 }, (_, i) => entry(`s${i}`, i + 1, { 1: 'C' }));
    const result = copyLineup({
      current: [row('mine')], currentMode: 'everyone_bats', currentInnings: 7,
      source: source([...starters, entry('sub', null, {}, false)], 'nine_player', 7),
      what: 'everything', admissible: pool('mine', 'sub', ...starters.map(e => e.playerId)),
    });
    assert.equal(result.lineupMode, 'nine_player');
    assert.equal(result.rows.filter(r => r.starter).length, 9);
    assert.equal(result.rows.find(r => r.player.id === 'sub')?.battingOrder, '');
    assert.equal(result.rows.find(r => r.player.id === 'mine')?.starter, false, 'not in the copied lineup, so not starting');
  });
  it('never copies a player’s note — notes are about that day', () => {
    const result = copyLineup({
      current: [row('a', {}, { notes: 'Leaves at 5' })], currentMode: 'everyone_bats', currentInnings: 7,
      source: source([{ ...entry('a', 1), notes: 'Saturday only' }]),
      what: 'everything', admissible: pool('a'),
    });
    assert.equal(result.rows[0].notes, 'Leaves at 5', 'this game’s note stays; the source’s does not ride along');
  });
});

describe('copyLineup — Batting order only', () => {
  it('reorders the players and leaves each one’s positions on THIS game with them', () => {
    const result = copyLineup({
      current: [row('a', { 1: 'P' }), row('b', { 1: 'C' }), row('c')],
      currentMode: 'everyone_bats', currentInnings: 6,
      source: source([entry('c', 1, { 1: 'SS' }), entry('a', 2, { 1: 'LF' }), entry('b', 3)], 'nine_player', 7),
      what: 'order', admissible: pool('a', 'b', 'c'),
    });
    assert.deepEqual(order(result.rows), ['c', 'a', 'b']);
    assert.deepEqual(result.rows.map(r => r.inningPositions), [{}, { 1: 'P' }, { 1: 'C' }], 'the source’s positions never come across');
    assert.equal(result.lineupMode, 'everyone_bats', 'this game’s format stays');
    assert.equal(result.inningCount, 6, 'and its innings');
  });
  it('this game’s players not in the source keep their positions, at the bottom', () => {
    const result = copyLineup({
      current: [row('extra', { 2: 'RF' }), row('a')], currentMode: 'everyone_bats', currentInnings: 7,
      source: source([entry('a', 1)]),
      what: 'order', admissible: pool('a', 'extra'),
    });
    assert.deepEqual(order(result.rows), ['a', 'extra']);
    assert.deepEqual(result.rows[1].inningPositions, { 2: 'RF' });
  });
  it('who starts follows the source only when both games are nine-player', () => {
    const current = [row('a', {}, { starter: true }), row('b', {}, { starter: false })];
    const nineSource = source([entry('b', 1, {}, true), entry('a', null, {}, false)], 'nine_player');
    const both = copyLineup({ current, currentMode: 'nine_player', currentInnings: 7, source: nineSource, what: 'order', admissible: pool('a', 'b') });
    assert.deepEqual(both.rows.map(r => [r.player.id, r.starter]), [['b', true], ['a', false]]);
    const everyoneSource = source([entry('b', 1), entry('a', 2)], 'everyone_bats');
    const mixed = copyLineup({ current, currentMode: 'nine_player', currentInnings: 7, source: everyoneSource, what: 'order', admissible: pool('a', 'b') });
    assert.deepEqual(mixed.rows.map(r => [r.player.id, r.starter]), [['a', true], ['b', false]], 'this game’s format decides');
  });
});
