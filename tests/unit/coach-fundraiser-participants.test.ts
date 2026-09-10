/**
 * A DRIVE'S BOARD ROW IS A PARTICIPANT — the grouping behind mig 287 (owner ruling 2026-09-10 on
 * mockup `94c27428`; `COACH_FUNDRAISER_MORE_THAN_ONCE_PLAN.md`).
 *
 * ⚠⚠ THE FIRST CASE IS THE LOAD-BEARING ONE and it is the one to run before touching the board. A
 * participant with ONE entry must come back with exactly one entry and its own date, because that
 * is what the room's no-fold branch keys on — `entries.length === 1` is the whole test the board
 * draws on, and a drive where nobody handed in twice must stay byte-for-byte what shipped before
 * the fold existed.
 *
 * ⚠ THE SECOND-MOST IMPORTANT: the credit is SUMMED from stamped shares and never re-multiplied by
 * the drive's current rate (`shares changed mid-drive`, below). That trap is the reason the whole
 * team's rows carry a 0% stamp (owner ruling 2026-09-08) — re-multiplying would mint a family
 * credit for a row that names no family.
 *
 * ⚠ AND THE FRACTION. Before mig 287, "how many players logged something" and "how many entry rows
 * have a player" were the same number, and four surfaces relied on it. They are not the same number
 * any more; `driveLoggedPlayerCount` is where that is settled once.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  driveParticipants,
  driveLoggedPlayerCount,
  WHOLE_TEAM_PARTICIPANT,
  WHOLE_TEAM_ENTRY_LABEL,
} from '../../lib/coach-fundraising';

let seq = 0;
/** One hand-in. `createdAt` runs forward with the call order unless a test pins it, so a same-day
 *  tie orders as it was recorded — which is the tie-break the board relies on. */
const handIn = (
  playerId: string | null,
  playerName: string,
  amountRaised: number,
  effectiveDate: string,
  opts: { rebateAmount?: number; playerActive?: boolean; createdAt?: string; id?: string } = {},
) => ({
  id: opts.id ?? `e${++seq}`,
  playerId,
  playerName,
  playerActive: opts.playerActive ?? true,
  amountRaised,
  rebateAmount: opts.rebateAmount ?? 0,
  effectiveDate,
  createdAt: opts.createdAt ?? `2026-01-01T00:00:${String(seq).padStart(2, '0')}Z`,
});

const team = (amount: number, date: string, opts = {}) =>
  handIn(null, WHOLE_TEAM_ENTRY_LABEL, amount, date, opts);

describe('driveParticipants — the one-entry participant is untouched', () => {
  it('⚠ gives a single hand-in back as ONE entry, its own date, its own figures', () => {
    const [p] = driveParticipants([handIn('casey', 'Casey Test', 250, '2026-08-20', { rebateAmount: 37.5 })]);
    assert.equal(p!.entries.length, 1, 'the board keys its no-fold branch on exactly this');
    assert.equal(p!.total, 250);
    assert.equal(p!.credit, 37.5);
    assert.equal(p!.latestDate, '2026-08-20');
    assert.equal(p!.playerId, 'casey');
    assert.equal(p!.key, 'casey');
  });

  it('a board where nobody handed in twice has no participant with a fold', () => {
    const board = driveParticipants([
      handIn('casey', 'Casey Test', 250, '2026-08-20'),
      handIn('devon', 'Devon Test', 180, '2026-08-24'),
      team(450, '2026-09-10'),
    ]);
    assert.equal(board.length, 3);
    assert.ok(board.every(p => p.entries.length === 1), 'no fold anywhere → the board draws as it always did');
  });

  it('carries the caller’s own entry fields through the grouping', () => {
    // The board needs `notes` and `id` back out of this, not the structural minimum.
    const rows = [{ ...handIn('casey', 'Casey Test', 10, '2026-08-20'), notes: 'two boxes' }];
    const [p] = driveParticipants(rows);
    assert.equal(p!.entries[0]!.notes, 'two boxes');
  });
});

describe('driveParticipants — a player who hands in more than once', () => {
  const avery = [
    handIn('avery', 'Avery Test', 90, '2026-09-12', { rebateAmount: 13.5 }),
    handIn('avery', 'Avery Test', 486, '2026-08-31', { rebateAmount: 72.9 }),
  ];

  it('is ONE row carrying the SUM', () => {
    const board = driveParticipants(avery);
    assert.equal(board.length, 1, 'one player is one row, however many times they handed in');
    assert.equal(board[0]!.total, 576);
    assert.equal(board[0]!.credit, 86.4);
  });

  it('⚠ Received is the MOST RECENT hand-in, not the first', () => {
    assert.equal(driveParticipants(avery)[0]!.latestDate, '2026-09-12');
  });

  it('folds open OLDEST FIRST — the order the money actually arrived in', () => {
    const dates = driveParticipants(avery)[0]!.entries.map(e => e.effectiveDate);
    assert.deepEqual(dates, ['2026-08-31', '2026-09-12']);
  });

  it('orders two hand-ins on ONE day by when they were recorded', () => {
    const board = driveParticipants([
      handIn('avery', 'Avery Test', 20, '2026-09-12', { id: 'second', createdAt: '2026-09-12T15:00:00Z' }),
      handIn('avery', 'Avery Test', 10, '2026-09-12', { id: 'first', createdAt: '2026-09-12T09:00:00Z' }),
    ]);
    assert.deepEqual(board[0]!.entries.map(e => e.id), ['first', 'second']);
  });

  it('⚠⚠ SUMS the stamped credits — it never re-multiplies by a current rate', () => {
    // The drive paid 15% in August and the coach dropped it to 5% in September. Each hand-in keeps
    // what it was stamped with; 576 × either rate is neither 72.90 + 4.50 nor anything near it.
    const board = driveParticipants([
      handIn('avery', 'Avery Test', 486, '2026-08-31', { rebateAmount: 72.9 }),
      handIn('avery', 'Avery Test', 90, '2026-09-12', { rebateAmount: 4.5 }),
    ]);
    assert.equal(board[0]!.credit, 77.4);
    assert.notEqual(board[0]!.credit, Math.round(576 * 0.05 * 100) / 100);
    assert.notEqual(board[0]!.credit, Math.round(576 * 0.15 * 100) / 100);
  });

  it('rounds the sum to cents rather than carrying float drift onto the board', () => {
    const board = driveParticipants([
      handIn('avery', 'Avery Test', 0.1, '2026-08-01', { rebateAmount: 0.1 }),
      handIn('avery', 'Avery Test', 0.2, '2026-08-02', { rebateAmount: 0.2 }),
    ]);
    assert.equal(board[0]!.total, 0.3);
    assert.equal(board[0]!.credit, 0.3);
  });
});

describe('driveParticipants — the whole team folds the same way', () => {
  it('⚠ groups every team entry under ONE row (ruling 3, accepted against §157 F3b)', () => {
    const board = driveParticipants([team(450, '2026-09-10'), team(60, '2026-09-14')]);
    assert.equal(board.length, 1, 'one grammar for the board — the team stacks like everybody else');
    assert.equal(board[0]!.key, WHOLE_TEAM_PARTICIPANT);
    assert.equal(board[0]!.playerId, null);
    assert.equal(board[0]!.playerName, WHOLE_TEAM_ENTRY_LABEL);
    assert.equal(board[0]!.total, 510);
    assert.equal(board[0]!.latestDate, '2026-09-14');
  });

  it('never merges the team into a player, nor two players into each other', () => {
    const board = driveParticipants([
      team(450, '2026-09-10'),
      handIn('avery', 'Avery Test', 486, '2026-08-31'),
      handIn('casey', 'Casey Test', 250, '2026-08-20'),
    ]);
    assert.deepEqual(board.map(p => p.key), ['avery', WHOLE_TEAM_PARTICIPANT, 'casey']);
  });
});

describe('driveParticipants — the order of the board', () => {
  it('is largest total first, so a player who hands in twice can climb it', () => {
    const board = driveParticipants([
      handIn('casey', 'Casey Test', 250, '2026-08-20'),
      handIn('avery', 'Avery Test', 90, '2026-09-12'),
      handIn('avery', 'Avery Test', 486, '2026-08-31'),
      team(450, '2026-09-14'),
      handIn('devon', 'Devon Test', 180, '2026-08-24'),
    ]);
    assert.deepEqual(board.map(p => p.total), [576, 450, 250, 180]);
    assert.deepEqual(board.map(p => p.playerName),
      ['Avery Test', WHOLE_TEAM_ENTRY_LABEL, 'Casey Test', 'Devon Test']);
  });

  it('breaks an equal-total tie by name, so a re-read cannot shuffle the board', () => {
    const board = driveParticipants([
      handIn('z', 'Zoe Test', 100, '2026-08-01'),
      handIn('a', 'Avery Test', 100, '2026-08-02'),
    ]);
    assert.deepEqual(board.map(p => p.playerName), ['Avery Test', 'Zoe Test']);
  });
});

describe('driveParticipants — a participant leaving the board', () => {
  it('removing one of two hand-ins leaves a one-entry participant, drawn with no fold', () => {
    const rest = [handIn('avery', 'Avery Test', 486, '2026-08-31', { rebateAmount: 72.9 })];
    const [p] = driveParticipants(rest);
    assert.equal(p!.entries.length, 1);
    assert.equal(p!.total, 486);
    assert.equal(p!.latestDate, '2026-08-31', 'Received falls back to the hand-in that is left');
  });

  it('removing the LAST hand-in takes the participant off the board entirely', () => {
    assert.deepEqual(driveParticipants([]), []);
  });
});

/* ⚠ IT TAKES THE ENTRIES, NOT THE GROUPED BOARD (`/simplify`, 2026-09-10) — a headcount does not
   need the participants built, and asking for them made the facts line grope through the whole
   display-grouping engine on every render. These cases pass the raw rows, which is also the shape
   every caller actually holds. */
describe('driveLoggedPlayerCount — the fraction’s numerator', () => {
  it('⚠⚠ counts DISTINCT PLAYERS, so a second hand-in does not tick it up', () => {
    const entries = [
      handIn('avery', 'Avery Test', 486, '2026-08-31'),
      handIn('avery', 'Avery Test', 90, '2026-09-12'),
      handIn('casey', 'Casey Test', 250, '2026-08-20'),
      handIn('devon', 'Devon Test', 180, '2026-08-24'),
    ];
    // Four rows, three people. Counting rows — which every reader did before mig 287 — says 4.
    assert.equal(driveLoggedPlayerCount(entries), 3);
    assert.notEqual(driveLoggedPlayerCount(entries), entries.length);
  });

  it('⚠ never counts the whole team as a player (owner ruling 2026-09-08, carried forward)', () => {
    assert.equal(driveLoggedPlayerCount([team(450, '2026-09-10'), team(60, '2026-09-14')]), 0);
  });

  it('leaves an inactive player’s entry ON the board and OUTSIDE the fraction', () => {
    const entries = [
      handIn('gone', 'Gone Test', 300, '2026-08-01', { playerActive: false }),
      handIn('casey', 'Casey Test', 250, '2026-08-20'),
    ];
    assert.equal(driveParticipants(entries).length, 2, 'the money is on the books, so the row stays visible');
    assert.equal(driveLoggedPlayerCount(entries), 1, 'the denominator is the ACTIVE roster');
  });

  it('counts a player recorded with $0 raised — an entry is an entry', () => {
    assert.equal(driveLoggedPlayerCount([handIn('casey', 'Casey Test', 0, '2026-08-20')]), 1);
  });

  it('agrees with the grouped board, which is the invariant the two must not break', () => {
    const entries = [
      handIn('avery', 'Avery Test', 486, '2026-08-31'),
      handIn('avery', 'Avery Test', 90, '2026-09-12'),
      team(450, '2026-09-10'),
      handIn('gone', 'Gone Test', 300, '2026-08-01', { playerActive: false }),
      handIn('casey', 'Casey Test', 250, '2026-08-20'),
    ];
    const viaBoard = driveParticipants(entries).filter(p => p.playerId && p.playerActive).length;
    assert.equal(driveLoggedPlayerCount(entries), viaBoard);
  });
});
