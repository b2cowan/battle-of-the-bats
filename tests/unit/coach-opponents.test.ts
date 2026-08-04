/**
 * Opponent Scouting Book — pure-logic tests (lib/coach-opponents.ts).
 * The load-bearing claims: the normalizer groups what it should and nothing more, aliases
 * fold groups together, the record chip can never disagree with the wrapped rule
 * (scrimmages listed, never counted), and future games are not "meetings".
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeOpponentName,
  buildOpponentBook,
  recordChip,
  scoutingTagsForSport,
  type OpponentGameInput,
} from '../../lib/coach-opponents.ts';
import { getSportPack } from '../../lib/sports.ts';
import type { RepTeamOpponent } from '../../lib/types.ts';

const NOW = '2026-06-20T00:00:00Z';

function game(over: Partial<OpponentGameInput>): OpponentGameInput {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    name: 'League Game',
    eventType: 'league_game',
    startsAt: '2026-06-01T22:00:00Z',
    programYearId: 'py-2026',
    opponent: 'Oakville Thunder',
    homeAway: 'home',
    teamScore: null,
    opponentScore: null,
    result: null,
    status: 'scheduled',
    ...over,
  };
}

function minted(over: Partial<RepTeamOpponent>): RepTeamOpponent {
  return {
    id: over.id ?? 'opp-1',
    teamId: 't1',
    orgId: 'o1',
    displayName: 'Oakville Thunder',
    normalizedName: 'oakville thunder',
    summary: null,
    lastNoteUpdatedAt: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe('normalizeOpponentName', () => {
  const cases: [string | null | undefined, string][] = [
    ['Oakville Thunder', 'oakville thunder'],
    ['  OAKVILLE   THUNDER  ', 'oakville thunder'],
    ['The Oakville Thunder', 'oakville thunder'],
    ['Oakville-Thunder (12U)', 'oakville thunder 12u'],
    ['St. Kitts — Élite', 'st kitts élite'],
    ['THE THE', 'the'], // only the LEADING "the" is stripped
    ['   ', ''],
    [null, ''],
    [undefined, ''],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      assert.equal(normalizeOpponentName(input), expected);
    });
  }
});

describe('buildOpponentBook', () => {
  it('groups by normalized name and tallies via the wrapped rule (scrimmage listed, never counted)', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [],
      aliases: [],
      events: [
        game({ id: 'g1', opponent: 'Oakville Thunder', startsAt: '2026-06-14T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win', status: 'scheduled' }),
        game({ id: 'g2', opponent: 'OAKVILLE THUNDER', startsAt: '2026-05-17T22:00:00Z', teamScore: 4, opponentScore: 2, result: 'win' }),
        game({ id: 'g3', opponent: 'Oakville Thunder', eventType: 'scrimmage', startsAt: '2026-04-26T22:00:00Z', teamScore: 3, opponentScore: 6, result: 'loss' }),
      ],
    });
    assert.equal(entries.length, 1);
    const e = entries[0];
    assert.equal(e.key, 'oakville thunder');
    assert.deepEqual(e.record, { wins: 2, losses: 0, ties: 0 });
    assert.equal(e.scrimmageCount, 1);
    assert.equal(e.meetings.length, 3); // scrimmage present as a meeting
    assert.equal(e.meetings.find(m => m.eventType === 'scrimmage')?.counted, false);
    assert.equal(e.unitFor, 9); // counted games only: 5 + 4
    assert.equal(e.unitAgainst, 5);
    assert.equal(e.streak, 'W2');
    assert.equal(e.lastMeeting?.eventId, 'g1');
  });

  it('derives a result from scores when the stored result is null (API-set scores)', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [],
      aliases: [],
      events: [game({ startsAt: '2026-06-01T22:00:00Z', teamScore: 2, opponentScore: 7, result: null })],
    });
    assert.deepEqual(entries[0].record, { wins: 0, losses: 1, ties: 0 });
  });

  it('excludes future scheduled games and cancelled games from meetings', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [],
      aliases: [],
      events: [
        game({ id: 'past', startsAt: '2026-06-01T22:00:00Z' }),               // played, no score yet
        game({ id: 'future', startsAt: '2026-06-28T22:00:00Z' }),             // upcoming — not a meeting
        game({ id: 'gone', startsAt: '2026-05-01T22:00:00Z', status: 'cancelled', teamScore: 1, opponentScore: 0 }),
      ],
    });
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].meetings.map(m => m.eventId), ['past']);
    assert.deepEqual(entries[0].record, { wins: 0, losses: 0, ties: 0 });
  });

  it('folds aliased spellings into the owning opponent and keeps its display name + summary', () => {
    const opp = minted({ id: 'opp-1', summary: 'Beatable when we run early.' });
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [opp],
      aliases: [{ opponentId: 'opp-1', normalizedAlias: 'thunder 12u' }],
      events: [
        game({ id: 'g1', opponent: 'Oakville Thunder', startsAt: '2026-06-14T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win' }),
        game({ id: 'g2', opponent: 'Thunder 12U', startsAt: '2025-07-05T22:00:00Z', eventType: 'tournament_game', teamScore: 2, opponentScore: 4, result: 'loss' }),
      ],
      observationCounts: { 'opp-1': 6 },
    });
    assert.equal(entries.length, 1);
    const e = entries[0];
    assert.equal(e.opponentId, 'opp-1');
    assert.equal(e.displayName, 'Oakville Thunder');
    assert.equal(e.summary, 'Beatable when we run early.');
    assert.deepEqual(e.record, { wins: 1, losses: 1, ties: 0 });
    assert.equal(e.meetings.length, 2);
    assert.equal(e.observationCount, 6);
  });

  it('lastMeeting is the literal newest meeting, even when its score is not entered yet', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [],
      aliases: [],
      events: [
        game({ id: 'newest-unscored', startsAt: '2026-06-18T22:00:00Z' }),
        game({ id: 'older-decided', startsAt: '2026-06-01T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win' }),
      ],
    });
    // Preferring the older DECIDED game here showed a stale "last met" date — regression guard.
    assert.equal(entries[0].lastMeeting?.eventId, 'newest-unscored');
    assert.equal(entries[0].lastMeeting?.result, null);
  });

  it('an un-minted opponent wears its NEWEST spelling, not its oldest', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [],
      aliases: [],
      // events arrive newest-first, as the db read returns them
      events: [
        game({ id: 'g-new', opponent: 'Oakville Thunder Blue', startsAt: '2026-06-14T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win' }),
        game({ id: 'g-old', opponent: 'OAKVILLE  THUNDER-BLUE', startsAt: '2025-07-05T22:00:00Z', teamScore: 2, opponentScore: 4, result: 'loss' }),
      ],
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].displayName, 'Oakville Thunder Blue');
  });

  it('legacy external_tournament games count toward the record (the wrapped rule)', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [],
      aliases: [],
      events: [
        game({ id: 'ext', eventType: 'external_tournament', name: 'Summer Classic', startsAt: '2025-08-02T22:00:00Z', teamScore: 7, opponentScore: 2, result: 'win' }),
        game({ id: 'lg', startsAt: '2026-06-14T22:00:00Z', teamScore: 3, opponentScore: 4, result: 'loss' }),
      ],
    });
    assert.deepEqual(entries[0].record, { wins: 1, losses: 1, ties: 0 });
    assert.equal(entries[0].meetings.find(m => m.eventId === 'ext')?.counted, true);
  });

  it('handles timestamptz-style offsets: a just-started game is not a future game', () => {
    const entries = buildOpponentBook({
      nowIso: '2026-06-20T00:00:00.000Z',
      opponents: [],
      aliases: [],
      // same instant as now, spelled the way Supabase serializes it (+00:00, no ms) —
      // lexicographic comparison against toISOString() gets this boundary wrong.
      events: [game({ id: 'boundary', startsAt: '2026-06-19T23:59:59+00:00' })],
    });
    assert.deepEqual(entries[0].meetings.map(m => m.eventId), ['boundary']);
  });

  it('a minted opponent with no games still gets an entry; events without an opponent are ignored', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [minted({ id: 'opp-2', displayName: 'Georgetown Gators', normalizedName: 'georgetown gators' })],
      aliases: [],
      events: [game({ opponent: null, startsAt: '2026-06-01T22:00:00Z' })],
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].displayName, 'Georgetown Gators');
    assert.equal(entries[0].meetings.length, 0);
    assert.equal(entries[0].lastMeeting, null);
  });

  it('sorts by most recent meeting, entries without meetings last', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [minted({ id: 'opp-2', displayName: 'No Games Yet', normalizedName: 'no games yet' })],
      aliases: [],
      events: [
        game({ opponent: 'Breeze', startsAt: '2026-05-31T22:00:00Z', teamScore: 2, opponentScore: 6, result: 'loss' }),
        game({ opponent: 'Thunder', startsAt: '2026-06-14T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win' }),
      ],
    });
    assert.deepEqual(entries.map(e => e.displayName), ['Thunder', 'Breeze', 'No Games Yet']);
  });
});

describe('recordChip', () => {
  it('hides ties until one exists', () => {
    assert.equal(recordChip({ wins: 2, losses: 1, ties: 0 }), '2–1');
    assert.equal(recordChip({ wins: 1, losses: 1, ties: 1 }), '1–1–1');
  });
});

describe('scoutingTagsForSport', () => {
  it('diamond sports get the diamond vocabulary; generic packs a neutral one', () => {
    assert.deepEqual(scoutingTagsForSport(getSportPack('softball')),
      ['Pitching', 'Hitting', 'Defense', 'Baserunning', 'Coaching']);
    assert.ok(scoutingTagsForSport(getSportPack('soccer')).includes('Offense'));
  });
});
