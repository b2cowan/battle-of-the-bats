import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeInsightFindings,
  MAX_FINDINGS,
  type FindingsInputs,
  type FindingsGameSummary,
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
      attendance: [{ name: 'A', attended: 9, known: 10 }],
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
    assert.equal(out[0].tone, 'warn');
    assert.equal(out[0].report, 'playing-time');
    assert.match(out[0].text, /Riley P\. went over the pitching cap in 1 game/);
    assert.match(out[0].text, /14 innings pitched vs a cap of 3\/game/);
  });

  it('caps named pitchers at 2', () => {
    const armCare = ['A', 'B', 'C'].map((n, i) => ({
      playerId: `p${i}`, name: n, inningsPitched: 9, gamesPitched: 3, perGameCap: 2, overCapGames: 2,
    }));
    const out = run({ analytics: analytics({ armCare }) });
    assert.equal(out.filter(f => f.tier === 'safety').length, 2);
  });

  it('does not fire when nobody is over cap', () => {
    const out = run({
      analytics: analytics({
        armCare: [{ playerId: 'p1', name: 'Riley P.', inningsPitched: 6, gamesPitched: 3, perGameCap: 3, overCapGames: 0 }],
      }),
    });
    assert.deepEqual(out, []);
  });
});

describe('money — never-paid beats overdue', () => {
  it('never-paid fires with the outstanding total', () => {
    const out = run({ dues: { neverPaidCount: 3, outstandingTotal: 420, overdueCount: 5 } });
    assert.equal(out.length, 1);
    assert.equal(out[0].tier, 'money');
    assert.match(out[0].text, /3 players haven't paid anything yet — \$420 outstanding/);
  });

  it('overdue fires only when never-paid is zero', () => {
    const out = run({ dues: { neverPaidCount: 0, outstandingTotal: 100, overdueCount: 2 } });
    assert.equal(out.length, 1);
    assert.match(out[0].text, /2 dues installments are overdue/);
  });
});

describe('attendance — never judges thin or missing data', () => {
  it('ignores players under the minimum tracked sessions', () => {
    const out = run({ attendance: [{ name: 'K. Wu', attended: 0, known: 3 }] });
    assert.deepEqual(out, []);
  });

  it('flags the least-reliable tracked player under 60%', () => {
    const out = run({
      attendance: [
        { name: 'A. Reyes', attended: 9, known: 10 },
        { name: 'K. Wu', attended: 4, known: 8 },
      ],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].tier, 'attendance');
    assert.match(out[0].text, /K\. Wu has made 4 of 8 tracked sessions/);
  });

  it('does not flag at or above 60%', () => {
    const out = run({ attendance: [{ name: 'K. Wu', attended: 6, known: 10 }] });
    assert.deepEqual(out, []);
  });
});

describe('fairness — most-benched needs a real sample', () => {
  const bench = (benchInnings: number, backToBackGames: number) => analytics({
    benchBalance: [{ playerId: 'p1', name: 'Avery M.', benchInnings, backToBackGames }],
  });

  it('fires warn with back-to-back sits', () => {
    const out = run({ analytics: bench(8, 2) });
    assert.equal(out.length, 1);
    assert.equal(out[0].tier, 'fairness');
    assert.equal(out[0].tone, 'warn');
    assert.match(out[0].text, /Avery M\. has sat the bench most — 8 innings, including 2 back-to-back games/);
  });

  it('fires info without back-to-back', () => {
    const out = run({ analytics: bench(7, 0) });
    assert.equal(out[0].tone, 'info');
  });

  it('needs enough saved lineups and enough bench time', () => {
    assert.deepEqual(run({ analytics: { ...bench(8, 2), gamesWithLineup: 2 } }), []);
    assert.deepEqual(run({ analytics: bench(4, 1) }), []);
  });
});

describe('good news', () => {
  it('undefeated reused lineup needs ≥2 scored wins and no losses', () => {
    const hot = analytics({
      reusedLineups: [
        { label: 'Gold-medal order', games: 3, scoredGames: 3, wins: 3, losses: 0, ties: 0 },
      ],
    });
    const out = run({ analytics: hot });
    assert.equal(out.length, 1);
    assert.match(out[0].text, /“Gold-medal order” lineup is 3-0/);

    const cold = analytics({
      reusedLineups: [{ label: 'X', games: 4, scoredGames: 3, wins: 2, losses: 1, ties: 0 }],
    });
    assert.deepEqual(run({ analytics: cold }), []);
  });

  it('road-losses split needs all losses away and a clean home sample', () => {
    const out = run({
      games: games({ losses: 3, awayLosses: 3, home: { wins: 6, losses: 0, ties: 1, games: 7 } }),
    });
    assert.equal(out.length, 1);
    assert.match(out[0].text, /All 3 losses have come on the road — you're 6-0-1 at home/);

    assert.deepEqual(run({
      games: games({ losses: 3, awayLosses: 2, home: { wins: 6, losses: 1, ties: 0, games: 7 } }),
    }), []);
  });

  it('win streak fires only from 3 straight', () => {
    assert.deepEqual(run({ games: games({ streakType: 'win', streakCount: 2 }) }), []);
    const out = run({ games: games({ streakType: 'win', streakCount: 4 }) });
    assert.match(out[0].text, /won 4 straight/);
    assert.deepEqual(run({ games: games({ streakType: 'loss', streakCount: 5 }) }), []);
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
      attendance: [{ name: 'K. Wu', attended: 2, known: 8 }],
      dues: { neverPaidCount: 1, outstandingTotal: 140, overdueCount: 0 },
    });
    assert.equal(out.length, MAX_FINDINGS);
    const tiers = out.map(f => f.tier);
    assert.deepEqual(tiers, ['safety', 'safety', 'money', 'attendance', 'fairness', 'good-news']);
  });
});
