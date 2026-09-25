import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROW_NAME_CAP, attendanceRowWords, lineupDoor, lineupRowWords, nameList, rowPlayerLabel,
  scoutingRowWords, sheetAddressFor, sheetViewFromTab,
  type AttendanceStatusValue, type RowPlayer,
} from '../../lib/coach-schedule-sheet.ts';
import { recordChip } from '../../lib/coach-opponents.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE EVENT SHEET'S DOOR ROWS (the Schedule deep dive, stage 1 · E1–E5, owner ruling 2026-09-25:
 * every ask "as drawn"). The pure half: what each row says, where the Lineup row goes, and the
 * address grammar. The sheet's markup is pinned in `coach-schedule-sheet-guard.test.ts`.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const P = (firstName: string, number: string | null = null): RowPlayer => ({ firstName, number });
const roster = (spec: [string, string | null, AttendanceStatusValue][]) =>
  spec.map(([first, num, status]) => ({ player: P(first, num), status }));

/** The UAT fixture's twelve, by jersey. */
const TWELVE: [string, string][] = [
  ['Avery', '1'], ['Blake', '2'], ['Casey', '3'], ['Devon', '4'], ['Emery', '5'], ['Finley', '6'],
  ['Gray', '7'], ['Harper', '8'], ['Jules', '10'], ['Kai', '11'], ['Logan', '12'], ['Morgan', '13'],
];

describe('E5 — the address grammar', () => {
  it('tab=attendance opens the room; tab=scouting the book\'s panel; tab=lineup and no tab, the sheet itself', () => {
    assert.equal(sheetViewFromTab('attendance'), 'attendance');
    assert.equal(sheetViewFromTab('scouting'), 'scouting');
    assert.equal(sheetViewFromTab('lineup'), null, 'the builder\'s way home (§222) lands on the sheet, the Lineup row on screen one');
    assert.equal(sheetViewFromTab(null), null);
    assert.equal(sheetViewFromTab('anything'), null);
  });
  it('the sheet stands on ?event=…; a view inside it adds its own tab — the level Back pops', () => {
    const base = '/org/coaches/teams/t1';
    assert.equal(sheetAddressFor(base, 'e1', null), '/org/coaches/teams/t1/schedule?event=e1');
    assert.equal(sheetAddressFor(base, 'e1', 'attendance'), '/org/coaches/teams/t1/schedule?event=e1&tab=attendance');
    assert.equal(sheetAddressFor(base, 'e1', 'scouting'), '/org/coaches/teams/t1/schedule?event=e1&tab=scouting');
    // The round trip: every address a view writes opens that view again on a cold load.
    for (const v of ['attendance', 'scouting'] as const) {
      assert.equal(sheetViewFromTab(new URL(`https://x${sheetAddressFor(base, 'e1', v)}`).searchParams.get('tab')), v);
    }
  });
});

describe('the names on a row — the length rule', () => {
  it('three names at most, then "and N more"', () => {
    assert.equal(ROW_NAME_CAP, 3);
    assert.equal(nameList(['Avery']), 'Avery');
    assert.equal(nameList(['Avery', 'Blake']), 'Avery and Blake');
    assert.equal(nameList(['Avery', 'Blake', 'Casey']), 'Avery, Blake and Casey');
    assert.equal(nameList(['Avery', 'Blake', 'Casey', 'Devon']), 'Avery, Blake, Casey and 1 more');
  });
  it('a player is their number and first name', () => {
    assert.equal(rowPlayerLabel(P('Logan', '12')), '#12 Logan');
    assert.equal(rowPlayerLabel(P('bob', null)), 'bob');
  });
});

describe('E1 · E2 — the Attendance row names names', () => {
  const text = (w: ReturnType<typeof attendanceRowWords>) => w.parts.map(p => p.text).join(' · ');

  it('the started probe game: the counts on the head, Out then Late on the line, in their tones', () => {
    const w = attendanceRowWords(roster(TWELVE.map(([f, n]) => [f, n, f === 'Logan' ? 'absent' : f === 'Kai' ? 'late' : 'attending'])));
    assert.equal(w.head, 'Attendance · 10 in · 1 late · 1 out');
    assert.equal(text(w), 'Out: #12 Logan · Late: #11 Kai');
    assert.deepEqual(w.parts.map(p => p.tone), ['out', 'late']);
  });
  it('before anyone answers: how many, and the first three by name', () => {
    const w = attendanceRowWords(roster(TWELVE.map(([f, n]) => [f, n, 'unknown'])));
    assert.equal(w.head, 'Attendance');
    assert.equal(text(w), '12 haven’t replied — Avery, Blake, Casey and 9 more');
  });
  it('once everyone is in: "All 12 in"', () => {
    const w = attendanceRowWords(roster(TWELVE.map(([f, n]) => [f, n, 'attending'])));
    assert.equal(w.head, 'Attendance');
    assert.equal(text(w), 'All 12 in');
  });
  it('vs Ridgeview: everyone in but one who never answered', () => {
    const w = attendanceRowWords([...roster(TWELVE.map(([f, n]) => [f, n, 'attending'])), ...roster([['bob', '56', 'unknown']])]);
    assert.equal(w.head, 'Attendance · 12 in · 1 no reply');
    assert.equal(text(w), 'No reply: #56 bob');
  });
  it('the order is Out, then Late, then No reply — and the names share one budget of three', () => {
    const w = attendanceRowWords(roster([
      ['Avery', '1', 'unknown'], ['Blake', '2', 'late'], ['Casey', '3', 'absent'], ['Devon', '4', 'absent'],
      ['Emery', '5', 'late'], ['Finley', '6', 'attending'], ['Gray', '7', 'unknown'],
    ]));
    assert.equal(w.head, 'Attendance · 1 in · 2 late · 2 out · 2 no reply');
    assert.equal(text(w), 'Out: #3 Casey, #4 Devon · Late: #2 Blake and 1 more · 2 no reply');
  });
  it('"and N more" is only ever more of THAT answer — never another group\'s players (/review)', () => {
    // 3 Out + 2 Late: the budget is spent on the Out names, and the two Late are counted as Late —
    // folded into the Out line they read as five out beside a head that says three.
    const w = attendanceRowWords(roster([
      ['P1', '1', 'absent'], ['P2', '2', 'absent'], ['P3', '3', 'absent'], ['P4', '4', 'late'], ['P5', '5', 'late'],
    ]));
    assert.equal(w.head, 'Attendance · 2 late · 3 out');
    assert.equal(text(w), 'Out: #1 P1, #2 P2, #3 P3 · 2 late');
    assert.deepEqual(w.parts.map(p => p.tone), ['out', 'late']);
    // A group cut short says how many more OF IT.
    const w2 = attendanceRowWords(roster([
      ['A', '1', 'absent'], ['B', '2', 'absent'], ['C', '3', 'absent'], ['D', '4', 'absent'], ['E', '5', 'unknown'], ['F', '6', 'attending'],
    ]));
    assert.equal(text(w2), 'Out: #1 A, #2 B, #3 C and 1 more · 1 no reply');
  });
  it('never more than three names on the line, whatever the roster', () => {
    const big = roster(Array.from({ length: 20 }, (_, i) => [`P${i}`, String(i), i % 2 ? 'absent' : 'late'] as [string, string, AttendanceStatusValue]));
    const names = text(attendanceRowWords(big)).match(/#\d+/g) ?? [];
    assert.equal(names.length, ROW_NAME_CAP);
  });
  it('a rosterless team says so rather than "0 haven\'t replied"', () => {
    assert.equal(text(attendanceRowWords([])), 'No players on the roster yet');
  });
});

describe('E3 — the Lineup row\'s door turns by the clock, at every width', () => {
  it('before first pitch the builder; from first pitch Game day', () => {
    assert.equal(lineupDoor({ started: false, hasLineup: true, mismatch: false, liveWindow: false }), 'builder');
    assert.equal(lineupDoor({ started: true, hasLineup: true, mismatch: false, liveWindow: true }), 'game-day');
    assert.equal(lineupDoor({ started: true, hasLineup: true, mismatch: false, liveWindow: false }), 'game-day', 'a finished game\'s recap');
  });
  it('no lineup: the builder at any hour — nothing for a bench to run', () => {
    assert.equal(lineupDoor({ started: true, hasLineup: false, mismatch: false, liveWindow: true }), 'builder');
  });
  it('E4: a disagreement on a finished game opens the builder, where the fix is; in the window, the console', () => {
    assert.equal(lineupDoor({ started: true, hasLineup: true, mismatch: true, liveWindow: false }), 'builder');
    assert.equal(lineupDoor({ started: true, hasLineup: true, mismatch: true, liveWindow: true }), 'game-day');
    assert.equal(lineupDoor({ started: false, hasLineup: true, mismatch: true, liveWindow: false }), 'builder');
  });
});

describe('E4 — the lineup warning joins the Lineup row', () => {
  it('the fixture\'s vs Ridgeview: "Kai and Logan are in, but not in the lineup", in the warning tone', () => {
    const w = lineupRowWords({ hasLineup: true, mismatch: { coming: [P('Kai', '11'), P('Logan', '12')], out: [] }, door: 'builder' });
    assert.deepEqual(w, { head: 'Lineup · Needs a look', line: 'Kai and Logan are in, but not in the lineup', warn: true });
  });
  it('the other direction reads the same way on the same row', () => {
    const w = lineupRowWords({ hasLineup: true, mismatch: { coming: [], out: [P('Logan', '12')] }, door: 'game-day' });
    assert.equal(w.line, 'Logan is Out but in the lineup');
    assert.equal(w.warn, true);
  });
  it('no lineup / has a lineup — and the line says where the door goes', () => {
    assert.deepEqual(lineupRowWords({ hasLineup: false, mismatch: null, door: 'builder' }), { head: 'Lineup', line: 'No lineup yet', warn: false });
    assert.equal(lineupRowWords({ hasLineup: true, mismatch: null, door: 'game-day' }).line, 'Game day — the bench console');
    assert.equal(lineupRowWords({ hasLineup: true, mismatch: null, door: 'builder' }).head, 'Lineup · Has a lineup');
  });
});

describe('E3 — the Scouting row reads the book', () => {
  it('a record and the notes, or none yet', () => {
    assert.equal(scoutingRowWords('Ridgeview', { record: { wins: 2, losses: 1, ties: 0 }, observationCount: 3 }, recordChip), `Ridgeview · ${recordChip({ wins: 2, losses: 1, ties: 0 })} vs them · 3 notes`);
    assert.equal(scoutingRowWords('Probe Rovers', undefined, recordChip), 'Probe Rovers · no games against them yet');
    assert.equal(scoutingRowWords('Probe Rovers', { record: { wins: 0, losses: 0, ties: 0 }, observationCount: 1 }, recordChip), 'Probe Rovers · no games against them yet · 1 note');
  });
});
