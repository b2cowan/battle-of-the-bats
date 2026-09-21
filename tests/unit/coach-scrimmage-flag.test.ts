/**
 * A scrimmage is a flag, not a kind of game (owner ruling 2026-09-20; mig 306).
 *
 * Pins the four things that make "one rule everywhere" true, so no reader can quietly recreate
 * the split this project closed:
 *   1. `countsTowardRecord` — the ONE season-record predicate — reads the kind AND the box.
 *   2. `competitionOf` — the by-competition split is derived from both, never from the kind alone.
 *   3. The auto-name has no kind word and knows the side; a typed name is never mistaken for one.
 *   4. The import / export words round-trip: "Scrimmage" ↔ a Game with the box ticked.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countsTowardRecord, competitionOf, WRAPPED_RECORD_EVENT_TYPES } from '../../lib/season-wrapped.ts';
import { COMPETITIONS, splitByCompetition } from '../../lib/coach-season-record.ts';
import {
  deriveGameName, isAutoShapedName, eventTypeCell, eventWord, parseEventTypeCell,
  scrimmageFlagFor, readStoredEventKind,
  EVENT_LABELS, EVENT_NAME_PREFIX, RECURRABLE_TYPES,
} from '../../lib/coach-schedule-vocab.ts';
import { COACH_GAME_EVENT_TYPES } from '../../lib/coach-tournament-games.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('the season record — one predicate, kind AND box', () => {
  it('a Game counts; the same Game with the box ticked does not', () => {
    assert.equal(countsTowardRecord({ eventType: 'league_game', isScrimmage: false }), true);
    assert.equal(countsTowardRecord({ eventType: 'league_game', isScrimmage: true }), false);
  });
  it('tournament games and the legacy container count; practices and team events never do', () => {
    assert.equal(countsTowardRecord({ eventType: 'tournament_game', isScrimmage: false }), true);
    assert.equal(countsTowardRecord({ eventType: 'external_tournament' }), true);
    assert.equal(countsTowardRecord({ eventType: 'practice' }), false);
    assert.equal(countsTowardRecord({ eventType: 'team_event' }), false);
  });
  it('an older caller that never learned the box reads as not-a-scrimmage', () => {
    assert.equal(countsTowardRecord({ eventType: 'league_game' }), true);
    assert.equal(countsTowardRecord({ eventType: 'league_game', isScrimmage: null }), true);
  });
  it('the kind list is HALF the rule — it no longer names scrimmage, and nothing game-shaped does', () => {
    assert.ok(!WRAPPED_RECORD_EVENT_TYPES.includes('scrimmage'));
    assert.deepEqual(COACH_GAME_EVENT_TYPES, ['league_game', 'tournament_game']);
    assert.ok(!('scrimmage' in EVENT_LABELS));
  });
});

describe('the by-competition split', () => {
  it('derives game · tournament · scrimmage from the kind and the box together', () => {
    assert.equal(competitionOf({ eventType: 'league_game', isScrimmage: false }), 'game');
    assert.equal(competitionOf({ eventType: 'league_game', isScrimmage: true }), 'scrimmage');
    assert.equal(competitionOf({ eventType: 'tournament_game' }), 'tournament');
    assert.equal(competitionOf({ eventType: 'external_tournament' }), 'tournament');
    assert.equal(competitionOf({ eventType: 'practice' }), null);
  });
  it('the scrimmage line is listed and marked not counted, so no iterator can total it in', () => {
    const scrim = COMPETITIONS.find(c => c.key === 'scrimmage')!;
    assert.equal(scrim.counted, false);
    assert.deepEqual(COMPETITIONS.filter(c => c.counted).map(c => c.key), ['game', 'tournament']);
    // Every competition that counts, counts under the record predicate — and vice versa.
    for (const c of COMPETITIONS) {
      const sample = c.key === 'tournament'
        ? { eventType: 'tournament_game', isScrimmage: false }
        : { eventType: 'league_game', isScrimmage: c.key === 'scrimmage' };
      assert.equal(countsTowardRecord(sample), c.counted, `${c.key} agrees with the record rule`);
    }
  });
  it('the words: Games · Tournament · Scrimmages (D1 — "League" left the label), one split for every surface', () => {
    const split = splitByCompetition([
      { eventType: 'league_game', isScrimmage: false, result: 'win' },
      { eventType: 'league_game', isScrimmage: false, result: 'loss' },
      { eventType: 'tournament_game', isScrimmage: false, result: 'win' },
      { eventType: 'league_game', isScrimmage: true, result: 'loss' },
      { eventType: 'league_game', isScrimmage: false, result: null }, // undecided — not a line
    ]);
    assert.deepEqual(split.map(r => [r.label, r.counted, r.tally.w, r.tally.l, r.tally.t]), [
      ['Games', true, 1, 1, 0], ['Tournament', true, 1, 0, 0], ['Scrimmages', false, 0, 1, 0],
    ]);
    // A season that never scrimmaged shows two lines, not three with a 0-0.
    assert.equal(splitByCompetition([{ eventType: 'league_game', isScrimmage: false, result: 'win' }]).length, 1);
    assert.equal(EVENT_LABELS.league_game, 'Game');
  });
});

describe('the auto-name (D2) and the typed-name guard', () => {
  it('a Game reads "vs X" at home or neutral and "@ X" away — no kind word', () => {
    assert.equal(deriveGameName('league_game', 'Oakville Royals', 'home'), 'vs Oakville Royals');
    assert.equal(deriveGameName('league_game', 'Oakville Royals', 'neutral'), 'vs Oakville Royals');
    assert.equal(deriveGameName('league_game', 'Oakville Royals', null), 'vs Oakville Royals');
    assert.equal(deriveGameName('league_game', '  Oakville Royals ', 'away'), '@ Oakville Royals');
  });
  it('a tournament game keeps its prefix (D3 — that kind was left alone); a non-game derives nothing', () => {
    assert.equal(deriveGameName('tournament_game', 'Kanata', 'away'), 'Tournament Game vs Kanata');
    assert.equal(deriveGameName('practice', 'Kanata', 'home'), '');
    assert.equal(deriveGameName('league_game', '   ', 'home'), '');
    assert.equal(EVENT_NAME_PREFIX.league_game, 'Game');
  });
  it('recognizes every shape the PRODUCT ever wrote for THIS side, so an edit may re-derive it', () => {
    for (const n of ['vs Oakville', 'League Game vs Oakville', 'Scrimmage vs Oakville', 'League Game', 'Scrimmage', 'Game', '']) {
      assert.equal(isAutoShapedName(n, 'league_game', 'Oakville', 'home'), true, n || '(blank)');
    }
    assert.equal(isAutoShapedName('@ Oakville', 'league_game', 'Oakville', 'away'), true);
    assert.equal(isAutoShapedName('Tournament Game vs Oakville', 'tournament_game', 'Oakville', 'away'), true);
  });
  it('never mistakes a typed name for an auto one — not even one that mentions the opponent', () => {
    for (const n of ['Oakville friendly', 'Rivalry night vs Oakville', 'vs Oakville (make-up)', 'Scrimmage @ Westbrook Wolves']) {
      assert.equal(isAutoShapedName(n, 'league_game', 'Oakville', 'home'), false, n);
    }
    // An auto-shape for a DIFFERENT opponent is not this event's auto-shape either.
    assert.equal(isAutoShapedName('vs Brampton', 'league_game', 'Oakville', 'home'), false);
    // The side matters: "vs X" on an AWAY game is not what the product writes, so it is the coach's
    // and an untouched edit must not flip it to "@ X" (/review, 2026-09-21).
    assert.equal(isAutoShapedName('vs Oakville', 'league_game', 'Oakville', 'away'), false);
    assert.equal(isAutoShapedName('@ Oakville', 'league_game', 'Oakville', 'home'), false);
  });
  it('a ticked Game can repeat weekly — it is a Game (D5)', () => {
    assert.ok(RECURRABLE_TYPES.includes('league_game'));
  });
});

describe('what a write may store, and what a stored row means', () => {
  it('the box is a Game\'s only — any other kind stores false whatever was asked (D3)', () => {
    assert.equal(scrimmageFlagFor('league_game', true), true);
    assert.equal(scrimmageFlagFor('league_game', false), false);
    assert.equal(scrimmageFlagFor('league_game', 'true'), false, 'a string is not a tick');
    assert.equal(scrimmageFlagFor('tournament_game', true), false);
    assert.equal(scrimmageFlagFor('practice', true), false);
    assert.equal(scrimmageFlagFor(undefined, true), false);
  });
  it('a row still carrying the pre-306 kind reads as a Game with the box ticked', () => {
    assert.deepEqual(readStoredEventKind({ event_type: 'scrimmage', is_scrimmage: false }), { eventType: 'league_game', isScrimmage: true });
    assert.deepEqual(readStoredEventKind({ event_type: 'league_game', is_scrimmage: true }), { eventType: 'league_game', isScrimmage: true });
    assert.deepEqual(readStoredEventKind({ event_type: 'league_game' }), { eventType: 'league_game', isScrimmage: false });
    assert.deepEqual(readStoredEventKind({ event_type: 'practice', is_scrimmage: null }), { eventType: 'practice', isScrimmage: false });
  });
  it('⚠ every SQL reader of the record kind list also asks the box — the two halves travel together', () => {
    // The JS predicate is one function; the SQL side is two clauses a reader has to remember to
    // pair. This guard makes forgetting the second one a failing build rather than a wrong record.
    const root = path.resolve(import.meta.dirname, '../..');
    const files = ['lib/db.ts', 'lib/coach-masthead.ts'];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), 'utf8');
      const re = /\.in\('event_type',\s*WRAPPED_RECORD_EVENT_TYPES\)([\s\S]{0,240})/g;
      let m; let n = 0;
      while ((m = re.exec(src))) {
        n += 1;
        assert.match(m[1], /\.eq\('is_scrimmage',\s*false\)/, `${f}: a record query filters on the kind list without .eq('is_scrimmage', false) beside it`);
      }
      assert.ok(n > 0, `${f}: expected at least one record query`);
    }
  });
});

describe('the words a sentence and a spreadsheet use', () => {
  it('eventWord says "scrimmage" for a ticked Game and the kind\'s word otherwise', () => {
    assert.equal(eventWord({ eventType: 'league_game', isScrimmage: true }), 'scrimmage');
    assert.equal(eventWord({ eventType: 'league_game', isScrimmage: false }), 'game');
    assert.equal(eventWord({ eventType: 'tournament_game', isScrimmage: false }), 'game');
    assert.equal(eventWord({ eventType: 'practice', isScrimmage: false }), 'practice');
  });
  it('the export writes "Scrimmage" for a ticked Game and "Game" otherwise — and the importer reads both back', () => {
    assert.equal(eventTypeCell({ eventType: 'league_game', isScrimmage: true }), 'Scrimmage');
    assert.equal(eventTypeCell({ eventType: 'league_game', isScrimmage: false }), 'Game');
    assert.equal(eventTypeCell({ eventType: 'tournament_game', isScrimmage: false }), 'Game (Tournament)');
    for (const e of [
      { eventType: 'league_game' as const, isScrimmage: true },
      { eventType: 'league_game' as const, isScrimmage: false },
      { eventType: 'practice' as const, isScrimmage: false },
    ]) {
      assert.deepEqual(parseEventTypeCell(eventTypeCell(e)), { type: e.eventType, isScrimmage: e.isScrimmage });
    }
  });
  it('a sheet exported before the change still imports: "League Game" is a Game', () => {
    assert.deepEqual(parseEventTypeCell('League Game'), { type: 'league_game', isScrimmage: false });
    assert.deepEqual(parseEventTypeCell('friendly'), { type: 'league_game', isScrimmage: true });
  });
});
