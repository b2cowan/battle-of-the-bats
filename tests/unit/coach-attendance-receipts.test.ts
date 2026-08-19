/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ATTENDANCE RECEIPTS — the records behind a fraction (Reports Portal P2, 2026-08-19)
 *
 * Two things are being protected here, and only one of them is arithmetic:
 *
 *   1. **A no-reply is never an absence.** The whole report rests on it: `known` excludes no-reply,
 *      so a receipt list that counted silence would contradict the very number it explains — and,
 *      worse, would tell a coach a child missed a session nobody ever marked them for.
 *   2. **Nothing here ranks.** The owner ruled on 2026-08-19 that this table keeps roster order and
 *      wears no "missed most" flag. A `.sort()` by absence count added to this module would put the
 *      leaderboard back one layer down, where no screen review would see it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeAttendanceReceipts,
  type AttendanceMarkRecord,
} from '../../lib/coach-attendance-receipts.ts';

const PLAYERS = [{ id: 'p1' }, { id: 'p2' }];

const mark = (
  playerId: string,
  eventId: string,
  day: string,
  status: AttendanceMarkRecord['status'],
  kind: AttendanceMarkRecord['kind'] = 'practice',
  label = 'Practice',
): AttendanceMarkRecord => ({ eventId, day, label, kind, playerId, status });

describe('computeAttendanceReceipts', () => {
  it('lists a player’s absences most recent first, with the words the receipt shows', () => {
    const out = computeAttendanceReceipts({
      players: PLAYERS,
      records: [
        mark('p1', 'e1', '2026-07-01', 'absent', 'practice', 'Tuesday practice'),
        mark('p1', 'e3', '2026-08-05', 'absent', 'game', 'vs Thunder'),
        mark('p1', 'e2', '2026-07-15', 'absent', 'practice', 'Tuesday practice'),
      ],
    });
    const r = out.get('p1')!;
    assert.deepEqual(r.absences.map(a => a.day), ['2026-08-05', '2026-07-15', '2026-07-01']);
    assert.deepEqual(r.absences.map(a => a.label), ['vs Thunder', 'Tuesday practice', 'Tuesday practice']);
    assert.deepEqual(r.absences.map(a => a.kind), ['game', 'practice', 'practice']);
  });

  /** ⚠ The rule the whole report rests on. `known` excludes no-reply, so a receipt list that
   *  counted it would contradict the fraction it exists to explain. */
  it('never counts a no-reply as a miss', () => {
    const out = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('p1', 'e1', '2026-07-01', 'unknown')],
    });
    assert.deepEqual(out.get('p1')!.absences, []);
  });

  it('counts late as attended, not missed — same as the roll-up', () => {
    const out = computeAttendanceReceipts({
      players: PLAYERS,
      records: [
        mark('p1', 'e1', '2026-07-01', 'late'),
        mark('p1', 'e2', '2026-07-02', 'attending'),
      ],
    });
    assert.deepEqual(out.get('p1')!.absences, []);
  });

  /** Every row gets the same affordance, so every row needs an answer — including the clean ones. */
  it('includes a player who has missed nothing, with an empty list', () => {
    const out = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('p1', 'e1', '2026-07-01', 'absent')],
    });
    assert.ok(out.has('p2'), 'a player with a clean record must still be present');
    assert.deepEqual(out.get('p2')!.absences, []);
    assert.equal(out.get('p2')!.sameWeekday, null);
  });

  it('names the weekday only when EVERY absence falls on it, and there are at least two', () => {
    // 2026-07-07, -14, -21 are all Tuesdays.
    const allTuesdays = computeAttendanceReceipts({
      players: PLAYERS,
      records: [
        mark('p1', 'e1', '2026-07-07', 'absent'),
        mark('p1', 'e2', '2026-07-14', 'absent'),
        mark('p1', 'e3', '2026-07-21', 'absent'),
      ],
    });
    assert.equal(allTuesdays.get('p1')!.sameWeekday, 'Tuesday');

    const mixed = computeAttendanceReceipts({
      players: PLAYERS,
      records: [
        mark('p1', 'e1', '2026-07-07', 'absent'),
        mark('p1', 'e2', '2026-07-16', 'absent'), // Thursday
      ],
    });
    assert.equal(mixed.get('p1')!.sameWeekday, null);

    const single = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('p1', 'e1', '2026-07-07', 'absent')],
    });
    assert.equal(single.get('p1')!.sameWeekday, null, 'one absence is not a pattern');
  });

  it('drops a mark for someone not on the roster it was given', () => {
    const out = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('ghost', 'e1', '2026-07-01', 'absent')],
    });
    assert.equal(out.has('ghost'), false, 'an unnamed receipt is no receipt');
    assert.equal(out.size, 2);
  });

  it('ignores a mark with no calendar day rather than dating it "undefined"', () => {
    const out = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('p1', 'e1', '', 'absent')],
    });
    assert.deepEqual(out.get('p1')!.absences, []);
  });

  /** Two sessions on one calendar day (a practice after a game, a double-header). The query has no
   *  ORDER BY, so without the tie-break the two would land in whatever order Postgres returned. */
  it('orders two absences on the same day deterministically', () => {
    const first = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('p1', 'aaa', '2026-07-01', 'absent'), mark('p1', 'zzz', '2026-07-01', 'absent')],
    });
    const reversed = computeAttendanceReceipts({
      players: PLAYERS,
      records: [mark('p1', 'zzz', '2026-07-01', 'absent'), mark('p1', 'aaa', '2026-07-01', 'absent')],
    });
    assert.deepEqual(
      first.get('p1')!.absences.map(a => a.eventId),
      reversed.get('p1')!.absences.map(a => a.eventId),
      'the same records in a different input order must produce the same receipt order',
    );
  });

  it('handles no records and an empty roster without throwing', () => {
    assert.equal(computeAttendanceReceipts({ players: PLAYERS, records: [] }).size, 2);
    assert.equal(computeAttendanceReceipts({ players: [], records: [] }).size, 0);
  });
});

/**
 * ⚠⚠ **THE RANKING RULING, GUARDED IN SOURCE** (owner, 2026-08-19).
 *
 * The approved mockup drew this table sortable with a "Missed most practices" badge on a named
 * child; the owner declined both, and the reason is the same one behind
 * `memory/decision_playing_time_vocabulary.md` — a support read that orders children by who turns
 * up least is a leaderboard however neutrally it is drawn.
 *
 * A behavioural test cannot catch the reversal, because "worst first" is one `.sort()` in a module
 * whose unit tests would all still pass. So the source is asserted directly: neither the module nor
 * the panel may order players by absence count, and neither may grow a flag class.
 */
describe('the attendance report does not rank children', () => {
  const MODULE = readFileSync(join(process.cwd(), 'lib', 'coach-attendance-receipts.ts'), 'utf8');
  const PANEL = readFileSync(
    join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'attendance', 'panel.tsx'),
    'utf8',
  );
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('the receipts module sorts records, never players', () => {
    // The ONE sort it may hold is the receipt ordering, which is by calendar day. Anything else —
    // `absences.length`, a `missed` count, a row comparison — is the leaderboard coming back.
    const sorts = code(MODULE).match(/\.sort\([^\n]*/g) ?? [];
    assert.equal(
      sorts.length, 1,
      `coach-attendance-receipts holds ${sorts.length} sorts; it may hold exactly one, the receipt `
      + 'ordering. Ranking players by absence count is what the owner ruled out on 2026-08-19 — take '
      + 'it back to them rather than adding it here, where no screen review would see it.',
    );
    assert.match(
      sorts[0], /\bday\b/,
      'the receipts module\'s one sort no longer orders by calendar day. If it now orders PLAYERS, '
      + 'that is the ranking the owner declined (2026-08-19).',
    );
  });

  it('the panel offers no sort affordance and pins no badge on a player', () => {
    const src = code(PANEL);
    assert.equal(
      /onClick=\{[^}]*setSort|sortBy|toggleSort/.test(src), false,
      'the attendance table grew a sort control. Roster order is the only order (standing ruling, '
      + 're-affirmed by the owner 2026-08-19 against the P2 mockup).',
    );
    assert.equal(
      /Missed most|missedMost|flagWarn/i.test(src), false,
      'the attendance table grew a "missed most" flag. The owner declined it: every row carries the '
      + 'same drill-in affordance instead, so a coach can investigate anyone without the screen '
      + 'nominating anyone.',
    );
  });

  /** ⚠ The drill-in must stay addressable, or `check:layout` can never measure it open — the trap
   *  OWNER_QA_LEDGER §58 records against this exact portal. */
  it('the drill-in is addressable, so the rendered sweep can open it', () => {
    assert.match(
      code(PANEL), /searchParams\.get\('player'\)/,
      'the attendance receipts stopped being addressed by `?player=`. A drill-in that arrives CLOSED '
      + 'is invisible to the layout sweep, which opens URLs and cannot click.',
    );
  });
});
