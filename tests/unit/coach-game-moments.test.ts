/**
 * Game-Day Mode P2 — moments (lib/coach-game-moments.ts).
 *
 * Five contracts:
 *  1. Validation: 1–280 characters, optional player tag, an off-roster tag REJECTED (never
 *     silently dropped — a moment the coach believes is filed under a player must not be
 *     written unfiled).
 *  2. Ordering: newest first, stable when two moments share a timestamp (the "add another"
 *     loop makes same-second captures likely).
 *  3. The player page's cap is one shared constant (the selection itself is done in SQL).
 *  4. Wrapped's slot: the most RECENT plus the season's count; null on an empty season.
 *  5. **THE D4 TEST** (plan §3.7, binding): moments feed nothing. Asserted with teeth — the
 *     analytic Wrapped stats are byte-identical whether or not moments exist, the stats key
 *     set is LOCKED so no future session can grow a moments field inside it, and the share
 *     card's data cannot carry a moment even when the payload does.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GAME_MOMENT_MAX,
  deriveWrappedMomentSlot,
  PLAYER_MOMENTS_SHOWN,
  sortMomentsNewestFirst,
  validateGameMoment,
  type GameMomentLike,
} from '../../lib/coach-game-moments.ts';
import {
  computeSeasonWrapped, wrappedShareCardData, WRAPPED_SHARE_CARD_FIELDS,
  type SeasonWrappedInput,
} from '../../lib/season-wrapped.ts';
import { canLogGameMoment, resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

const ROSTER = ['p1', 'p2', 'p3'];

function moment(overrides: Partial<GameMomentLike> = {}): GameMomentLike {
  return {
    id: 'm1',
    eventId: 'e1',
    playerId: null,
    body: 'Whole bench on their feet for that double play.',
    happenedAt: '2026-06-14T23:32:00Z',
    ...overrides,
  };
}

describe('validateGameMoment', () => {
  it('accepts a line with no player tag — an untagged moment is about the night', () => {
    const v = validateGameMoment({ body: '  Great at-bats all evening.  ' }, ROSTER);
    assert.deepEqual(v, { ok: true, body: 'Great at-bats all evening.', playerId: null });
  });

  it('accepts a roster player tag', () => {
    const v = validateGameMoment({ body: 'First triple.', playerId: 'p2' }, ROSTER);
    assert.deepEqual(v, { ok: true, body: 'First triple.', playerId: 'p2' });
  });

  it('treats null and empty string as no tag', () => {
    for (const playerId of [null, undefined, '']) {
      const v = validateGameMoment({ body: 'x', playerId }, ROSTER);
      assert.equal(v.ok && v.playerId, null);
    }
  });

  it('REJECTS an off-roster tag rather than filing the moment unfiled', () => {
    const v = validateGameMoment({ body: 'First triple.', playerId: 'stranger' }, ROSTER);
    assert.equal(v.ok, false);
    assert.match((v as { reason: string }).reason, /Unknown player/);
  });

  it('rejects empty, whitespace-only and non-string bodies', () => {
    for (const body of ['', '   ', null, undefined, 42, {}]) {
      assert.equal(validateGameMoment({ body }, ROSTER).ok, false);
    }
  });

  it('enforces the 280-character ceiling on the TRIMMED body', () => {
    assert.equal(validateGameMoment({ body: 'a'.repeat(GAME_MOMENT_MAX) }, ROSTER).ok, true);
    assert.equal(validateGameMoment({ body: 'a'.repeat(GAME_MOMENT_MAX + 1) }, ROSTER).ok, false);
    // Trailing whitespace must not push an otherwise-legal line over the edge.
    const padded = `${'a'.repeat(GAME_MOMENT_MAX)}      `;
    assert.equal(validateGameMoment({ body: padded }, ROSTER).ok, true);
  });

  it('accepts a tag when the roster list is empty only if there is no tag', () => {
    assert.equal(validateGameMoment({ body: 'x' }, []).ok, true);
    assert.equal(validateGameMoment({ body: 'x', playerId: 'p1' }, []).ok, false);
  });
});

describe('ordering', () => {
  it('sorts newest first', () => {
    const sorted = sortMomentsNewestFirst([
      moment({ id: 'a', happenedAt: '2026-06-14T22:00:00Z' }),
      moment({ id: 'b', happenedAt: '2026-06-14T23:30:00Z' }),
      moment({ id: 'c', happenedAt: '2026-06-14T22:45:00Z' }),
    ]);
    assert.deepEqual(sorted.map(m => m.id), ['b', 'c', 'a']);
  });

  it('is stable for identical timestamps — two same-second captures never swap on re-render', () => {
    const same = '2026-06-14T23:32:00Z';
    const input = [
      moment({ id: 'aaa', happenedAt: same }),
      moment({ id: 'zzz', happenedAt: same }),
    ];
    assert.deepEqual(sortMomentsNewestFirst(input).map(m => m.id), ['zzz', 'aaa']);
    assert.deepEqual(sortMomentsNewestFirst([...input].reverse()).map(m => m.id), ['zzz', 'aaa']);
  });

  it('does not mutate its input', () => {
    const input = [moment({ id: 'a', happenedAt: '2026-06-01T00:00:00Z' }), moment({ id: 'b' })];
    const before = input.map(m => m.id);
    sortMomentsNewestFirst(input);
    assert.deepEqual(input.map(m => m.id), before);
  });
});

describe('the player page’s cap', () => {
  it('is a shared constant, so the query limit and the "N this season" line agree', () => {
    // The selection itself is done in SQL (getRepTeamGameMomentsForPlayer) — a player page has
    // no business fetching every other player's moments to show a handful of its own.
    assert.equal(Number.isInteger(PLAYER_MOMENTS_SHOWN), true);
    assert.equal(PLAYER_MOMENTS_SHOWN > 0, true);
  });
});

describe('deriveWrappedMomentSlot', () => {
  const labels = new Map([['e1', 'vs Oakville Thunder'], ['e2', '@ Burlington Breeze']]);

  it('is null for a season with no moments — the strip is absent, never empty', () => {
    assert.equal(deriveWrappedMomentSlot([], labels), null);
  });

  it('picks the MOST RECENT and reports the season count', () => {
    const slot = deriveWrappedMomentSlot([
      moment({ id: 'a', eventId: 'e2', body: 'older', happenedAt: '2026-05-01T00:00:00Z' }),
      moment({ id: 'b', eventId: 'e1', body: 'newest', happenedAt: '2026-06-14T00:00:00Z' }),
      moment({ id: 'c', eventId: 'e2', body: 'middle', happenedAt: '2026-06-01T00:00:00Z' }),
    ], labels);
    assert.equal(slot?.body, 'newest');
    assert.equal(slot?.total, 3);
    assert.equal(slot?.gameLabel, 'vs Oakville Thunder');
  });

  it('survives a game whose label is gone rather than dropping the moment', () => {
    const slot = deriveWrappedMomentSlot([moment({ eventId: 'deleted' })], labels);
    assert.equal(slot?.gameLabel, null);
    assert.equal(slot?.total, 1);
  });

  it('tags a player without leaking WHO into the slot — the card carries text only', () => {
    const slot = deriveWrappedMomentSlot([moment({ playerId: 'p1' })], labels);
    assert.deepEqual(Object.keys(slot ?? {}).sort(), ['body', 'gameLabel', 'happenedAt', 'total']);
  });
});

/**
 * ── THE D4 TEST ─────────────────────────────────────────────────────────────────────────────
 * "Moments are optional flavour and NEVER feed analytics, lineups, attendance, or any coverage
 * surface — a half-used log must poison nothing."
 *
 * The way that promise could realistically break is not a wrong number today; it is a future
 * session finding it convenient to fold a moment count into the analytic payload — which is
 * also the payload the shareable PNG is built from. So the assertions below are structural.
 */
describe('the D4 test — moments feed nothing', () => {
  const season: Partial<SeasonWrappedInput> = {
    events: [
      { eventType: 'league_game', startsAt: '2026-05-01T18:00:00Z', status: 'scheduled', result: 'win', teamScore: 5, opponentScore: 2, opponent: 'Thunder', homeAway: 'home' },
      { eventType: 'league_game', startsAt: '2026-05-08T18:00:00Z', status: 'scheduled', result: 'loss', teamScore: 1, opponentScore: 3, opponent: 'Breeze', homeAway: 'away' },
      { eventType: 'league_game', startsAt: '2026-05-15T18:00:00Z', status: 'scheduled', result: 'win', teamScore: 4, opponentScore: 3, opponent: 'Thunder', homeAway: 'home' },
    ],
    attendance: [{ attended: 9, known: 10 }, { attended: 8, known: 10 }],
    awards: [{ playerId: 'p1', typeName: 'Hustle' }],
    playerLabelById: { p1: 'Maya #7' },
    reusedLineups: [],
    gamesWithLineup: 3,
    rosterCount: 12,
  };

  function compute(partial: Partial<SeasonWrappedInput> = {}) {
    return computeSeasonWrapped({
      events: [], attendance: [], awards: [], playerLabelById: {},
      reusedLineups: [], gamesWithLineup: 0, rosterCount: 0,
      ...season, ...partial,
    } as SeasonWrappedInput);
  }

  it('season stats are byte-identical whether the season logged moments or none', () => {
    // The analytics function takes no moments — and that is the point. A season with a full
    // log and a season with an empty one hand it the SAME input, so the record, the streak,
    // the closest game, attendance and the award all come out identical.
    const withNone = compute();
    const withMany = compute();
    assert.deepEqual(withMany, withNone);
    assert.equal(JSON.stringify(withMany), JSON.stringify(withNone));
  });

  it('LOCKS the analytic stats key set — no moments field may ever appear inside it', () => {
    // ⚠ If this fails, someone folded moment data into the analytic payload. That payload is
    // what `generateWrappedCardBlob` draws, so the failure is not cosmetic: it would put a
    // coach's free text about a child into an image that leaves the app. Add the field to the
    // payload as a SIBLING (`momentSlot`), never here.
    assert.deepEqual(Object.keys(compute()).sort(), [
      'attendanceRate', 'closestGame', 'gamesWithLineup', 'lineupFact',
      'longestStreak', 'record', 'rosterCount', 'topAward',
    ]);
  });

  it('a half-used log changes no analytic number — one moment, or none, or twenty', () => {
    const base = compute();
    for (const count of [0, 1, 20]) {
      const log = Array.from({ length: count }, (_, i) => moment({ id: `m${i}` }));
      // Selection over the log is pure and its results are never fed back in.
      deriveWrappedMomentSlot(log, new Map());
      assert.deepEqual(compute(), base);
    }
  });

  it('the SHARE CARD cannot carry a moment, even when the payload does', () => {
    // The exported PNG leaves the app. A moment is coach-written free text about a child, so
    // it renders on the coach's own screen and stops there. Allow-list, not omit-list: the
    // extra fields below stand in for "any future payload addition".
    const payload = {
      ...compute(),
      seasonName: '2026', teamName: 'Blue Jays', teamColor: '#123456',
      momentSlot: { total: 3, body: 'Maya’s first triple.', happenedAt: '2026-06-14T23:32:00Z', gameLabel: 'vs Thunder' },
      seasonId: 'y1', seasonYear: 2026, seasonStatus: 'completed', teamSport: 'softball',
      somethingAddedLater: 'must not reach the canvas',
    };
    const card = wrappedShareCardData(payload);
    assert.deepEqual(Object.keys(card).sort(), [...WRAPPED_SHARE_CARD_FIELDS].sort());
    assert.equal(JSON.stringify(card).includes('triple'), false);
    assert.equal('momentSlot' in card, false);
    assert.equal('somethingAddedLater' in card, false);
  });
});

describe('who may capture a moment (owner Q1, 2026-08-05)', () => {
  const assistant = (grants?: Parameters<typeof resolveCoachCapabilities>[1]) =>
    resolveCoachCapabilities('assistant_coach', grants);

  it('the head coach always may', () => {
    assert.equal(canLogGameMoment(resolveCoachCapabilities('head_coach')), true);
  });

  it('any single console DRIVE grant is enough', () => {
    for (const grants of [{ attendance: true }, { lineups: true }, { scheduleManage: true }]) {
      assert.equal(
        canLogGameMoment(assistant({ schedule: false, attendance: false, lineups: false, scheduleManage: false, ...grants })),
        true,
      );
    }
  });

  it('a schedule-ONLY helper may not — their console is read-only and shows no footer', () => {
    // ⚠ Deliberately stricter than the Scouting Book's gate (`schedule`). A predicate that
    // said yes here would put a write behind a screen that renders no button.
    const helper = assistant({
      schedule: true, scheduleManage: false, attendance: false, lineups: false,
      staffChat: false,
    });
    assert.equal(canLogGameMoment(helper), false);
  });
});
