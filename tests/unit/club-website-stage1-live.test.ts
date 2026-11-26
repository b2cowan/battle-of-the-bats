import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { clubGameWindow, repEntryState, repGamePhase, type RepGameFacts } from '../../lib/club-game-live.ts';
import { scheduleScoreText } from '../../lib/family-schedule-format.ts';
import { splitPublicSchedule } from '../../lib/club-team-page.ts';
import { DEFAULT_GAME_DURATION_MINUTES, LIVE_GRACE_MINUTES } from '../../lib/game-status.ts';
import type { FamilyScheduleEntry } from '../../lib/family-view';

/**
 * Club Website Stage 1, Part 0 — the rep running-score defect ("T 4–2") and the one live rule (G7, owner 2026-11-25).
 * While a coach keeps the running score in Game-Day Mode (quiet saves write the scores, never the result), the public team
 * page and the family schedule read the game as LIVE with its running score; End game makes it final with its result; a
 * score whose game was never ended reads, past its window, as a finished game with its score and no result letter.
 */

const START = Date.parse('2026-11-28T14:00:00Z');
const END = Date.parse('2026-11-28T15:30:00Z');
const MIN = 60_000;

const game = (over: Partial<RepGameFacts> = {}): RepGameFacts & { ownGame: boolean } => ({
  ownGame: true, startsAt: new Date(START).toISOString(), endsAt: new Date(END).toISOString(),
  status: 'scheduled', result: null, teamScore: null, opponentScore: null, ...over,
});

/** A schedule row as the server builds it (lib/family-view.ts toEntry), from the same facts. */
function entry(over: Partial<RepGameFacts>, now: number): FamilyScheduleEntry {
  const g = game(over);
  const { completed, live } = repEntryState(g, now);
  const scored = g.teamScore !== null && g.opponentScore !== null && (completed || live);
  return {
    id: 'e1', eventType: 'league_game', name: '', startsAt: g.startsAt, endsAt: g.endsAt, location: null,
    locationAddress: null, fieldNumber: null, arrivalTime: null, opponent: 'Falcons', homeAway: 'home',
    teamScore: scored ? g.teamScore : null, opponentScore: scored ? g.opponentScore : null,
    result: completed ? g.result : null, status: 'scheduled', completed, live, hasScore: scored, isNextUp: false, mark: null,
  };
}

describe('the live window is the tournament one (G7)', () => {
  it('runs from the start to the scheduled end plus the tournament grace', () => {
    assert.deepEqual(clubGameWindow(game()), { startMs: START, endMs: END + LIVE_GRACE_MINUTES * MIN });
  });
  it('a game with no end time runs the platform booking length', () => {
    assert.equal(clubGameWindow(game({ endsAt: null }))!.endMs, START + (DEFAULT_GAME_DURATION_MINUTES + LIVE_GRACE_MINUTES) * MIN);
  });
});

describe('a running score is live, never a finished tie (the "T 4–2" defect)', () => {
  const mid = START + 40 * MIN;

  it('a score with no result inside the window → live, the score alone, not over', () => {
    const e = entry({ teamScore: 4, opponentScore: 2 }, mid);
    assert.equal(e.live, true);
    assert.equal(e.completed, false);
    assert.equal(scheduleScoreText(e), '4–2');
  });

  it('still live in the grace after the scheduled end', () => {
    assert.equal(repGamePhase(game({ teamScore: 4, opponentScore: 2 }), END + 29 * MIN), 'live');
  });

  it('inside the window with nothing saved → live with no score (never an invented 0–0)', () => {
    const e = entry({}, mid);
    assert.equal(e.live, true);
    assert.equal(scheduleScoreText(e), null);
  });

  it('End game → final with its result, whatever the clock says', () => {
    for (const [result, text] of [['win', 'W 4–2'], ['loss', 'L 4–2'], ['tie', 'T 4–2']] as const) {
      const e = entry({ teamScore: 4, opponentScore: 2, result }, mid);
      assert.equal(e.live, false);
      assert.equal(e.completed, true);
      assert.equal(scheduleScoreText(e), text);
    }
  });

  it('a score with no result past the window → a finished game: over, its score, no result letter', () => {
    // What the shipped page shows for a finished game (folded into "Earlier this season", its score on the row), minus
    // the letter: the coach never pressed End game, so no result exists, and the season record (which counts results
    // only) does not count it either. A guessed "W" would disagree with the record.
    const e = entry({ teamScore: 4, opponentScore: 2 }, END + LIVE_GRACE_MINUTES * MIN);
    assert.equal(e.live, false);
    assert.equal(e.completed, true);
    assert.equal(scheduleScoreText(e), '4–2');
  });

  it('past the window with nothing saved → not over, not live (we never call it played)', () => {
    assert.deepEqual(repEntryState(game(), END + 2 * 60 * MIN), { completed: false, live: false });
  });

  it('before the start → coming', () => {
    assert.equal(repGamePhase(game(), START - MIN), 'coming');
  });

  it('a cancelled game is never live', () => {
    assert.deepEqual(repEntryState(game({ status: 'cancelled' }), mid), { completed: false, live: false });
  });

  it('only the team’s own game is ever live — a practice, a tournament entry or a copied tournament game is not', () => {
    assert.deepEqual(repEntryState({ ...game(), ownGame: false }, mid), { completed: false, live: false });
  });

  it('a copied tournament game with an unconfirmed score reads as over, its score alone (the tournament decides live)', () => {
    const g = { ...game({ teamScore: 4, opponentScore: 2 }), ownGame: false };
    assert.deepEqual(repEntryState(g, mid), { completed: true, live: false });
  });

  it('a score saved before the start (Game-Day Mode opens early) is neither live nor over, and is not drawn', () => {
    const e = entry({ teamScore: 1, opponentScore: 0 }, START - 30 * MIN);
    assert.equal(repGamePhase(game({ teamScore: 1, opponentScore: 0 }), START - 30 * MIN), 'coming');
    assert.deepEqual([e.live, e.completed, e.hasScore, scheduleScoreText(e)], [false, false, false, null]);
  });
});

describe('a live game stays in view on the public team page', () => {
  it('a live game with no end time is not folded into "Earlier this season"', () => {
    const now = START + 40 * MIN;
    const rows = [{ startsAt: new Date(START).toISOString(), endsAt: null, live: true }];
    assert.equal(splitPublicSchedule(rows, now).upcoming.length, 1);
    assert.equal(splitPublicSchedule([{ ...rows[0], live: false }], now).earlier.length, 1);
  });
  it('a live game in the grace after its end time stays in view', () => {
    const rows = [{ startsAt: new Date(START).toISOString(), endsAt: new Date(END).toISOString(), live: true }];
    assert.equal(splitPublicSchedule(rows, END + 10 * MIN).upcoming.length, 1);
  });
});

describe('the server read asks the one rule (lib/family-view.ts)', () => {
  const src = readFileSync('lib/family-view.ts', 'utf8');
  it('the row state comes from repEntryState, with own games = game kinds not copied from a tournament', () => {
    assert.ok(src.includes('repEntryState({'));
    assert.ok(src.includes('ownGame: COACH_GAME_EVENT_TYPES.includes(row.event_type) && row.source_tournament_game_id === null'));
    assert.ok(src.includes("source_tournament_game_id';"), 'the copy marker is read');
  });
  it('a score is drawn only on a game that is over or live', () => {
    assert.ok(src.includes('const scored = hasScore(row) && (completed || live);'));
  });
  it('the copy marker never leaves the server (it is not a field of the schedule row)', () => {
    const entryType = src.slice(src.indexOf('export interface FamilyScheduleEntry'), src.indexOf('export interface FamilyTeamView'));
    assert.doesNotMatch(entryType, /source_tournament_game_id|sourceTournamentGameId/);
  });
  it('a house-league family row is never live', () => {
    assert.ok(readFileSync('lib/family-league-entries.ts', 'utf8').includes('    live: false,\n'));
  });
});
