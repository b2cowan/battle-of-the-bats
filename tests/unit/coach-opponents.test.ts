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
  mergeSummaries,
  planOpponentMerge,
  formatGamePlanSnapshot,
  pickPracticeWeekOpponentGame,
  OPPONENT_SUMMARY_MAX,
  type OpponentGameInput,
  type OpponentBookEntry,
  type PracticeWeekGameCandidate,
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
    ['THE THE', 'the'], // a bare trailing "the" survives — only "the " prefixes strip
    ['The The Sharks', 'sharks'], // leading "the " strips to a FIXED POINT (idempotence)
    ['   ', ''],
    [null, ''],
    [undefined, ''],
  ];
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      assert.equal(normalizeOpponentName(input), expected);
    });
  }

  it('is idempotent — already-normalized keys round-trip unchanged (URL params, merge payloads)', () => {
    for (const raw of ['The The Sharks', 'The Thunder', 'Oakville-Thunder (12U)', 'THE THE']) {
      const once = normalizeOpponentName(raw);
      assert.equal(normalizeOpponentName(once), once);
    }
  });
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

describe('aliasKeys (P2) — the client chip lookup must see merged-away spellings', () => {
  const twoSpellings = [
    game({ id: 'g1', opponent: 'Oakville Thunder', startsAt: '2026-06-14T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win' }),
    game({ id: 'g2', opponent: 'Thunder 12U', startsAt: '2025-07-05T22:00:00Z', teamScore: 2, opponentScore: 4, result: 'loss' }),
  ];

  it('an entry lists the alias keys that resolve to it', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [minted({ id: 'opp-1' })],
      aliases: [{ opponentId: 'opp-1', normalizedAlias: 'thunder 12u' }],
      events: twoSpellings,
    });
    assert.deepEqual(entries[0].aliasKeys, ['thunder 12u']);
  });

  it('the schedule map built from key + aliasKeys resolves an aliased row spelling', () => {
    const entries = buildOpponentBook({
      nowIso: NOW,
      opponents: [minted({ id: 'opp-1' })],
      aliases: [{ opponentId: 'opp-1', normalizedAlias: 'thunder 12u' }],
      events: twoSpellings,
    });
    // Exactly the map the schedule page builds (page.tsx loadBook).
    const map = new Map<string, OpponentBookEntry>();
    for (const e of entries) {
      map.set(e.key, e);
      for (const alias of e.aliasKeys) map.set(alias, e);
    }
    // A schedule row whose event still says "Thunder 12U" must find the unified entry.
    const hit = map.get(normalizeOpponentName('Thunder 12U'));
    assert.equal(hit?.key, 'oakville thunder');
    assert.deepEqual(hit?.record, { wins: 1, losses: 1, ties: 0 });
  });
});

describe('mergeSummaries', () => {
  it('labels the loser’s line and appends it', () => {
    assert.equal(
      mergeSummaries('Fast infield.', 'Ace throws heat.', 'Thunder 12U'),
      'Fast infield.\n[Thunder 12U] Ace throws heat.',
    );
  });
  it('a loser with no summary changes nothing (undefined = no write)', () => {
    assert.equal(mergeSummaries('Fast infield.', null, 'Thunder 12U'), undefined);
  });
  it('a winner with no summary adopts the labelled line alone', () => {
    assert.equal(mergeSummaries(null, 'Ace throws heat.', 'Thunder 12U'), '[Thunder 12U] Ace throws heat.');
  });
  it('caps the merged line at the summary limit', () => {
    const merged = mergeSummaries('a'.repeat(490), 'b'.repeat(100), 'T');
    assert.equal(merged?.length, OPPONENT_SUMMARY_MAX);
  });
  it('retry-idempotent: a winner already carrying the appendix is not appended again', () => {
    // The partial-merge recovery path: summary written, loser delete failed, coach retries.
    const afterFirstTry = mergeSummaries('Fast infield.', 'Ace throws heat.', 'Thunder 12U')!;
    assert.equal(mergeSummaries(afterFirstTry, 'Ace throws heat.', 'Thunder 12U'), undefined);
  });
});

describe('planOpponentMerge + round-trip through buildOpponentBook', () => {
  const winner = { id: 'opp-w', normalizedName: 'oakville thunder', summary: 'Fast infield.' };
  const loser = { id: 'opp-l', normalizedName: 'thunder 12u', summary: 'Ace throws heat.', displayName: 'Thunder 12U' };

  it('refuses to merge an entry into itself', () => {
    assert.equal(planOpponentMerge({ winner, loser: { ...loser, id: 'opp-w' }, loserKey: 'thunder 12u' }), null);
    assert.equal(planOpponentMerge({ winner, loser: null, loserKey: 'oakville thunder' }), null);
  });

  it('a minted loser is absorbed: observations re-point, its name becomes an alias, its line survives labelled', () => {
    const plan = planOpponentMerge({ winner, loser, loserKey: 'thunder 12u' });
    assert.deepEqual(plan, {
      absorbOpponentId: 'opp-l',
      aliasToInsert: 'thunder 12u',
      mergedSummary: 'Fast infield.\n[Thunder 12U] Ace throws heat.',
    });
  });

  it('an unminted loser needs only the alias', () => {
    const plan = planOpponentMerge({ winner, loser: null, loserKey: 'thunder 12u' });
    assert.deepEqual(plan, { absorbOpponentId: null, aliasToInsert: 'thunder 12u', mergedSummary: undefined });
  });

  it('round-trip: merge unifies the book, un-merge regroups it', () => {
    const events = [
      game({ id: 'g1', opponent: 'Oakville Thunder', startsAt: '2026-06-14T22:00:00Z', teamScore: 5, opponentScore: 3, result: 'win' }),
      game({ id: 'g2', opponent: 'Thunder 12U', startsAt: '2025-07-05T22:00:00Z', teamScore: 2, opponentScore: 4, result: 'loss' }),
    ];
    const mintedWinner = minted({ id: 'opp-w', summary: 'Fast infield.' });
    const mintedLoser = minted({
      id: 'opp-l', displayName: 'Thunder 12U', normalizedName: 'thunder 12u', summary: 'Ace throws heat.',
    });

    // BEFORE: two entries, one observation on each row.
    const before = buildOpponentBook({
      nowIso: NOW, opponents: [mintedWinner, mintedLoser], aliases: [],
      events, observationCounts: { 'opp-w': 1, 'opp-l': 2 },
    });
    assert.equal(before.length, 2);

    // MERGE: apply the plan's effects exactly as executeRepTeamOpponentMerge does —
    // observations re-point to the winner, the loser row goes, its name becomes an alias,
    // the winner's summary carries the labelled appendix.
    const plan = planOpponentMerge({ winner: mintedWinner, loser: mintedLoser, loserKey: 'thunder 12u' })!;
    const mergedWinner = { ...mintedWinner, summary: plan.mergedSummary ?? mintedWinner.summary };
    const after = buildOpponentBook({
      nowIso: NOW,
      opponents: [mergedWinner],
      aliases: [{ opponentId: 'opp-w', normalizedAlias: plan.aliasToInsert }],
      events,
      observationCounts: { 'opp-w': 3 }, // 1 + the 2 re-pointed
    });
    assert.equal(after.length, 1);
    assert.equal(after[0].key, 'oakville thunder');
    assert.deepEqual(after[0].record, { wins: 1, losses: 1, ties: 0 });
    assert.equal(after[0].observationCount, 3);
    assert.equal(after[0].summary, 'Fast infield.\n[Thunder 12U] Ace throws heat.');
    assert.deepEqual(after[0].aliasKeys, ['thunder 12u']);

    // UN-MERGE: delete the alias and the names regroup naturally on the next read; the
    // re-pointed observations stay with the row they were attached to (plan §3).
    const unmerged = buildOpponentBook({
      nowIso: NOW, opponents: [mergedWinner], aliases: [], events, observationCounts: { 'opp-w': 3 },
    });
    assert.equal(unmerged.length, 2);
    const regrouped = unmerged.find(e => e.key === 'thunder 12u');
    assert.ok(regrouped);
    assert.equal(regrouped!.opponentId, null); // its row is gone — aggregation-only again
    assert.deepEqual(regrouped!.record, { wins: 0, losses: 1, ties: 0 });
  });
});

describe('formatGamePlanSnapshot', () => {
  const baseOpts = {
    displayName: 'Oakville Thunder',
    record: { wins: 4, losses: 2, ties: 0 },
    lastMeeting: { result: 'win' as const, teamScore: 5, opponentScore: 3 },
    summary: 'Beatable when we run early.',
    observations: [
      { body: 'Their SS cheats up with runners on', tag: 'Defense' },
      { body: 'Ace works up in the zone', tag: null },
    ],
    insights: [{ text: '3–1 at home · 1–1 away', fromGames: 6 }],
    maxLength: 4000,
  };

  it('carries matchup, record, book line, tagged observations, and the numbers', () => {
    const msg = formatGamePlanSnapshot(baseOpts);
    assert.match(msg, /^Game plan — vs Oakville Thunder\n/);
    assert.match(msg, /All-time 4–2 · Last meeting W 5–3/);
    assert.match(msg, /The book line\nBeatable when we run early\./);
    assert.match(msg, /The numbers\n• 3–1 at home · 1–1 away \(from 6 games\)/);
    assert.match(msg, /• \[Defense\] Their SS cheats up with runners on/);
    assert.match(msg, /• Ace works up in the zone/);
  });

  it('empty sections are ABSENT, never hedged', () => {
    const msg = formatGamePlanSnapshot({ ...baseOpts, summary: null, observations: [], insights: [] });
    assert.ok(!msg.includes('The book line'));
    assert.ok(!msg.includes('The numbers'));
    assert.ok(!msg.includes('Observations'));
    assert.match(msg, /^Game plan — vs Oakville Thunder/);
  });

  it('bounds the observation list and counts the rest honestly', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ body: `Note ${i + 1}`, tag: null }));
    const msg = formatGamePlanSnapshot({ ...baseOpts, observations: many });
    assert.match(msg, /• Note 8/);
    assert.ok(!msg.includes('• Note 9'));
    assert.match(msg, /\(\+4 more in the book\)/);
  });

  it('never exceeds the chat cap — sheds observations before truncating words', () => {
    const long = Array.from({ length: 8 }, (_, i) => ({ body: `${i}${'x'.repeat(499)}`, tag: null }));
    const msg = formatGamePlanSnapshot({ ...baseOpts, observations: long, maxLength: 1000 });
    assert.ok(msg.length <= 1000);
    assert.match(msg, /more in the book\)/);
  });
});

describe('scoutingTagsForSport', () => {
  it('diamond sports get the diamond vocabulary; generic packs a neutral one', () => {
    assert.deepEqual(scoutingTagsForSport(getSportPack('softball')),
      ['Pitching', 'Hitting', 'Defense', 'Baserunning', 'Coaching']);
    assert.ok(scoutingTagsForSport(getSportPack('soccer')).includes('Offense'));
  });
});

// ── Practice-week bridge (P3, plan §4.9) ────────────────────────────────────────────────

/** UTC day arithmetic stands in for lib/timezone's calendarDaysBetween — the picker's
 *  window logic is what's under test, not the org-zone day boundary. */
const utcDays = (from: Date, to: Date) =>
  Math.floor(to.getTime() / 86_400_000) - Math.floor(from.getTime() / 86_400_000);

function candidate(over: Partial<PracticeWeekGameCandidate> & { id: string }): PracticeWeekGameCandidate {
  return {
    eventType: 'league_game',
    startsAt: '2026-06-20T22:00:00Z', // Saturday, four days after the Tuesday practice
    opponent: 'Oakville Thunder',
    status: 'scheduled',
    ...over,
  };
}

describe('pickPracticeWeekOpponentGame', () => {
  const PRACTICE = '2026-06-16T22:00:00Z'; // Tuesday evening

  it('picks the SOONEST upcoming game with a real opponent inside the 6-day window', () => {
    const picked = pickPracticeWeekOpponentGame(PRACTICE, [
      candidate({ id: 'later', startsAt: '2026-06-21T15:00:00Z', opponent: 'Burlington Breeze' }),
      candidate({ id: 'saturday' }),
    ], utcDays);
    assert.equal(picked?.id, 'saturday');
  });

  it('ignores everything that cannot anchor the bridge', () => {
    assert.equal(pickPracticeWeekOpponentGame(PRACTICE, [
      candidate({ id: 'cancelled', status: 'cancelled' }),
      candidate({ id: 'practice', eventType: 'practice' }),
      candidate({ id: 'tbd', opponent: '   ' }),          // a TBD slot never anchors anything
      candidate({ id: 'no-name', opponent: null }),
      candidate({ id: 'played', startsAt: '2026-06-15T22:00:00Z' }), // already behind the practice
      candidate({ id: 'next-week', startsAt: '2026-06-24T22:00:00Z' }), // 8 days out — next week's problem
    ], utcDays), null);
  });

  it('a scrimmage is a game — the bridge preps for those too', () => {
    const picked = pickPracticeWeekOpponentGame(PRACTICE, [
      candidate({ id: 'scrim', eventType: 'scrimmage' }),
    ], utcDays);
    assert.equal(picked?.id, 'scrim');
  });

  it('day 6 is in the window; day 7 is not (the masthead nudge’s own week)', () => {
    const day6 = candidate({ id: 'day6', startsAt: '2026-06-22T22:00:00Z' });
    const day7 = candidate({ id: 'day7', startsAt: '2026-06-23T22:00:00Z' });
    assert.equal(pickPracticeWeekOpponentGame(PRACTICE, [day6, day7], utcDays)?.id, 'day6');
    assert.equal(pickPracticeWeekOpponentGame(PRACTICE, [day7], utcDays), null);
  });
});
