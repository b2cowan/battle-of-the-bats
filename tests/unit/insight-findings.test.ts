import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeInsightFindings,
  formatInsightDigest,
  MAX_FINDINGS,
  DIGEST_MAX_SEGMENTS,
  type FindingsInputs,
  type FindingsGameSummary,
  type FindingsAttendanceRow,
  type InsightFinding,
} from '../../lib/insight-findings.ts';
import type { SeasonLineupAnalytics } from '../../lib/lineup-season-analytics.ts';

const VOCAB = { periodsWord: 'innings', scoreUnitWord: 'run' };

function analytics(partial: Partial<SeasonLineupAnalytics> = {}): SeasonLineupAnalytics {
  return {
    gamesWithLineup: 4,
    fairPlay: [],
    benchBalance: [],
    positionVariety: [],
    armCare: [],
    reusedLineups: [],
    ...partial,
  };
}

function games(partial: Partial<FindingsGameSummary> = {}): FindingsGameSummary {
  return {
    wins: 5, losses: 2, ties: 0,
    streakType: null, streakCount: 0,
    home: null, awayLosses: 0,
    ...partial,
  };
}

function attRow(name: string, g: [number, number], p: [number, number] = [0, 0]): FindingsAttendanceRow {
  return { name, games: { attended: g[0], known: g[1] }, practices: { attended: p[0], known: p[1] } };
}

function run(partial: Partial<FindingsInputs> = {}) {
  return computeInsightFindings({ vocab: VOCAB, ...partial });
}

describe('honesty — nothing fires without qualifying data', () => {
  it('returns [] for empty inputs', () => {
    assert.deepEqual(run(), []);
    assert.deepEqual(run({ analytics: null, games: null, attendance: null, dues: null }), []);
  });

  it('returns [] for present-but-quiet data', () => {
    const out = run({
      analytics: analytics(),
      games: games(),
      attendance: [attRow('A', [9, 10])],
      dues: { neverPaidCount: 0, outstandingTotal: 0, overdueCount: 0 },
    });
    assert.deepEqual(out, []);
  });
});

describe('safety — arm-care over cap', () => {
  it('fires per over-cap pitcher with the cap in the sentence', () => {
    const out = run({
      analytics: analytics({
        armCare: [{ playerId: 'p1', name: 'Riley P.', inningsPitched: 14, gamesPitched: 4, perGameCap: 3, overCapGames: 1 }],
      }),
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].tier, 'safety');
    assert.match(out[0].text, /Riley P\. went over the pitching cap in 1 game/);
    assert.match(out[0].text, /14 innings pitched vs a cap of 3\/game/);
  });

  it('caps named pitchers at 2 and skips under-cap pitchers', () => {
    const armCare = ['A', 'B', 'C'].map((n, i) => ({
      playerId: `p${i}`, name: n, inningsPitched: 9, gamesPitched: 3, perGameCap: 2, overCapGames: 2,
    }));
    assert.equal(run({ analytics: analytics({ armCare }) }).filter(f => f.tier === 'safety').length, 2);
    assert.deepEqual(run({
      analytics: analytics({ armCare: [{ playerId: 'p1', name: 'R', inningsPitched: 6, gamesPitched: 3, perGameCap: 3, overCapGames: 0 }] }),
    }), []);
  });
});

describe('money — deadline first, then never-paid, then overdue', () => {
  const dues = { neverPaidCount: 0, outstandingTotal: 0, overdueCount: 0 };

  it('deadline fires inside the 7-day window with weekday wording', () => {
    const out = run({
      todayISO: '2026-07-12', // a Sunday
      dues: { ...dues, nextDue: { dueDateISO: '2026-07-17', unpaidCount: 5, unpaidTotal: 700 } },
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].tier, 'money');
    assert.match(out[0].text, /due on Friday — 5 players unpaid \(\$700\)/);
  });

  it('deadline handles today / tomorrow / in a week and omits a null total', () => {
    const nd = (d: string, total: number | null) => run({
      todayISO: '2026-07-12',
      dues: { ...dues, nextDue: { dueDateISO: d, unpaidCount: 1, unpaidTotal: total } },
    });
    assert.match(nd('2026-07-12', null)[0].text, /due today — 1 player unpaid\.$/);
    assert.match(nd('2026-07-13', null)[0].text, /due tomorrow/);
    assert.match(nd('2026-07-19', 100)[0].text, /due in a week/);
  });

  it('deadline never fires outside the window, without todayISO, or with nobody unpaid', () => {
    assert.deepEqual(run({
      todayISO: '2026-07-12',
      dues: { ...dues, nextDue: { dueDateISO: '2026-07-20', unpaidCount: 3, unpaidTotal: 100 } },
    }), []);
    assert.deepEqual(run({
      dues: { ...dues, nextDue: { dueDateISO: '2026-07-14', unpaidCount: 3, unpaidTotal: 100 } },
    }), []);
    assert.deepEqual(run({
      todayISO: '2026-07-12',
      dues: { ...dues, nextDue: { dueDateISO: '2026-07-14', unpaidCount: 0, unpaidTotal: null } },
    }), []);
  });

  it('never-paid fires with the outstanding total; overdue only when never-paid is zero', () => {
    const a = run({ dues: { neverPaidCount: 3, outstandingTotal: 420, overdueCount: 5 } });
    assert.equal(a.length, 1);
    assert.match(a[0].text, /3 players haven't paid anything yet — \$420 outstanding/);
    const b = run({ dues: { neverPaidCount: 0, outstandingTotal: 100, overdueCount: 2 } });
    assert.match(b[0].text, /2 dues installments are overdue/);
  });
});

describe('attendance — reliability + game-vs-practice split', () => {
  it('ignores thin samples and flags the least-reliable tracked player under 60%', () => {
    assert.deepEqual(run({ attendance: [attRow('K. Wu', [0, 3])] }), []);
    const out = run({ attendance: [attRow('A. Reyes', [9, 10]), attRow('K. Wu', [4, 8])] });
    assert.equal(out.length, 1);
    assert.match(out[0].text, /K\. Wu has made 4 of 8 tracked sessions/);
    assert.deepEqual(run({ attendance: [attRow('K. Wu', [6, 10])] }), []);
  });

  it('split fires when the gap is ≥20 points and the lagging side is under 70%', () => {
    const out = run({
      attendance: [
        attRow('A', [5, 5], [3, 5]),
        attRow('B', [4, 5], [3, 5]),
      ],
    });
    // games 9/10 = 90%, practices 6/10 = 60% → gap 30, lagging 60% < 70%
    assert.equal(out.length, 1);
    assert.match(out[0].text, /Game attendance is 90%, but practices are at 60%/);
  });

  it('split needs both categories sampled and a real gap', () => {
    // practices unsampled (combined kept ≥60% so the worst-player rule stays quiet)
    assert.deepEqual(run({ attendance: [attRow('A', [4, 5], [1, 2])] }), []);
    // gap too small (80% vs 70%)
    assert.deepEqual(run({
      attendance: [attRow('A', [4, 5], [3, 5]), attRow('B', [4, 5], [4, 5])],
    }), []);
  });
});

describe('fairness — most-benched + coverage risk', () => {
  const bench = (benchInnings: number, backToBackGames: number) => analytics({
    benchBalance: [{ playerId: 'p1', name: 'Avery M.', benchInnings, backToBackGames }],
  });

  it('most-benched fires warn with back-to-back, info without, and needs a sample', () => {
    const a = run({ analytics: bench(8, 2) });
    assert.equal(a[0].tone, 'warn');
    assert.match(a[0].text, /Avery M\. has sat the bench most — 8 innings, including 2 back-to-back games/);
    assert.equal(run({ analytics: bench(7, 0) })[0].tone, 'info');
    assert.deepEqual(run({ analytics: { ...bench(8, 2), gamesWithLineup: 2 } }), []);
    assert.deepEqual(run({ analytics: bench(4, 1) }), []);
  });

  const variety = (entries: [string, string[]][]) => analytics({
    positionVariety: entries.map(([name, positions], i) => ({ playerId: `p${i}`, name, positions, count: positions.length })),
  });

  it('coverage risk fires on a single-coverage position (bench excluded, roster sample required)', () => {
    const six: [string, string[]][] = [
      ['Avery M.', ['C', '1B', 'Bench']], ['B', ['1B', '2B']], ['D', ['2B', 'SS']],
      ['E', ['SS', '1B']], ['F', ['LF', '2B']], ['G', ['RF', 'SS', 'LF']],
    ];
    // Singleton positions: C (Avery) and RF (G); Bench never counts. Alphabetical → C leads.
    const out = run({ analytics: variety(six) });
    assert.equal(out.length, 1);
    assert.equal(out[0].tier, 'fairness');
    assert.match(out[0].text, /Only Avery M\. has played C this season — one absence from a gap \(1 more position has single coverage\)/);
  });

  it('coverage risk needs ≥6 players in the data', () => {
    assert.deepEqual(run({
      analytics: variety([['A', ['C']], ['B', ['1B']], ['D', ['2B']]]),
    }), []);
  });
});

describe('good news — hot lineup, road split, streak, momentum, milestone', () => {
  it('undefeated reused lineup needs ≥2 scored wins and no losses', () => {
    const hot = analytics({ reusedLineups: [{ label: 'Gold-medal order', games: 3, scoredGames: 3, wins: 3, losses: 0, ties: 0 }] });
    assert.match(run({ analytics: hot })[0].text, /“Gold-medal order” lineup is 3-0/);
    const cold = analytics({ reusedLineups: [{ label: 'X', games: 4, scoredGames: 3, wins: 2, losses: 1, ties: 0 }] });
    assert.deepEqual(run({ analytics: cold }), []);
  });

  it('road-losses split needs all losses away and a clean home sample', () => {
    const out = run({ games: games({ losses: 3, awayLosses: 3, home: { wins: 6, losses: 0, ties: 1, games: 7 } }) });
    assert.match(out[0].text, /All 3 losses have come on the road — you're 6-0-1 at home/);
    assert.deepEqual(run({ games: games({ losses: 3, awayLosses: 2, home: { wins: 6, losses: 1, ties: 0, games: 7 } }) }), []);
  });

  it('win streak fires from 3; momentum fires on 5-of-6 only when the streak rule did not', () => {
    assert.match(run({ games: games({ streakType: 'win', streakCount: 4 }) })[0].text, /won 4 straight/);
    const momentum = run({
      games: games({ streakType: 'win', streakCount: 2, recentResults: ['win', 'win', 'loss', 'win', 'win', 'win'] }),
    });
    assert.equal(momentum.length, 1);
    assert.match(momentum[0].text, /won 5 of your last 6/);
    // streak fired → momentum suppressed (one good-news line, the streak's)
    const both = run({
      games: games({ streakType: 'win', streakCount: 5, recentResults: ['win', 'win', 'win', 'win', 'win', 'loss'] }),
    });
    assert.equal(both.filter(f => f.tier === 'good-news').length, 1);
    assert.match(both[0].text, /won 5 straight/);
  });

  it('milestone fires on win #10/#15… only when the latest result reached it, combining with momentum', () => {
    assert.deepEqual(run({ games: games({ wins: 10, recentResults: ['loss', 'win'] }) }), []);
    const solo = run({ games: games({ wins: 10, recentResults: ['win', 'loss', 'loss', 'win', 'win', 'win'] }) });
    assert.match(solo[0].text, /win #10 of the season/);
    const combined = run({ games: games({ wins: 15, recentResults: ['win', 'win', 'loss', 'win', 'win', 'win'] }) });
    assert.equal(combined.length, 1);
    assert.match(combined[0].text, /Won 5 of your last 6 — and that was win #15 of the season/);
    assert.deepEqual(run({ games: games({ wins: 11, recentResults: ['win'] }) }), []);
  });
});

describe('ladder order + cap', () => {
  it('orders safety → money → attendance → fairness → good news and caps the list', () => {
    const out = run({
      analytics: analytics({
        armCare: [
          { playerId: 'p1', name: 'R1', inningsPitched: 9, gamesPitched: 3, perGameCap: 2, overCapGames: 1 },
          { playerId: 'p2', name: 'R2', inningsPitched: 9, gamesPitched: 3, perGameCap: 2, overCapGames: 1 },
        ],
        benchBalance: [{ playerId: 'p3', name: 'Avery', benchInnings: 9, backToBackGames: 1 }],
        reusedLineups: [{ label: 'Gold', games: 3, scoredGames: 3, wins: 3, losses: 0, ties: 0 }],
      }),
      games: games({
        losses: 2, awayLosses: 2, home: { wins: 5, losses: 0, ties: 0, games: 5 },
        streakType: 'win', streakCount: 3,
      }),
      attendance: [attRow('K. Wu', [2, 8])],
      dues: { neverPaidCount: 1, outstandingTotal: 140, overdueCount: 0 },
    });
    assert.equal(out.length, MAX_FINDINGS);
    assert.deepEqual(out.map(f => f.tier), ['safety', 'safety', 'money', 'attendance', 'fairness', 'good-news']);
  });
});

describe('digest formatting', () => {
  const F = (tier: InsightFinding['tier'], tone: InsightFinding['tone'], text: string): InsightFinding =>
    ({ tier, tone, text, report: 'results' });

  it('returns null on a quiet week', () => {
    assert.equal(formatInsightDigest([]), null);
  });

  it('leads with one good-news segment, then ladder order, capped with ⚠ on warns', () => {
    const digest = formatInsightDigest([
      F('safety', 'warn', 'Riley P. went over the pitching cap in 1 game.'),
      F('money', 'warn', "3 players haven't paid anything yet — $420 outstanding."),
      F('attendance', 'warn', 'Jordan K. has made 2 of 8 tracked sessions this season.'),
      F('good-news', 'good', "You've won 3 straight."),
    ]);
    assert.ok(digest);
    assert.equal(digest.title, 'Your week in review');
    assert.equal(
      digest.body,
      "You've won 3 straight · ⚠ Riley P. went over the pitching cap in 1 game · ⚠ 3 players haven't paid anything yet — $420 outstanding.",
    );
    assert.equal(digest.body.split(' · ').length, DIGEST_MAX_SEGMENTS);
  });

  it('works without a good-news finding', () => {
    const digest = formatInsightDigest([F('safety', 'warn', 'A went over the pitching cap in 1 game.')]);
    assert.equal(digest?.body, '⚠ A went over the pitching cap in 1 game.');
  });
});
