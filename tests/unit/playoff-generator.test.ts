import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bracketsOf, crossesPools, defaultSettings, distinctDrafts, draftMeasures, firstRoundOf, fitOf, getsOf, isFinalCode, levelInto,
  normalizeSettings, planOf, settingsFromPlan, shapesFor, templateOf, topChoices,
  type PlayoffDivisionFacts, type PlayoffDraftMeasures, type PlayoffSettings,
} from '../../lib/playoff-generator.ts';
import { generateBracket } from '../../lib/playoff-bracket.ts';
import { mergePlayoffPlan } from '../../lib/playoff-plan.ts';

/**
 * The Playoff generator's rules (Tournament admin redesign, Stage 3 addendum — A61–A70, the sheet's PG1–PG7). The
 * drawing's own scenarios: U11 Girls (6 teams, pools Red and Blue), U13 Boys (8, North and South), U15 Open (4, no pools).
 */

const U11: PlayoffDivisionFacts = { teamCount: 6, pools: [{ id: 'r', name: 'Red', teamCount: 3 }, { id: 'b', name: 'Blue', teamCount: 3 }], playoffsOnly: false };
const U13: PlayoffDivisionFacts = { teamCount: 8, pools: [{ id: 'n', name: 'North', teamCount: 4 }, { id: 's', name: 'South', teamCount: 4 }], playoffsOnly: false };
const U15: PlayoffDivisionFacts = { teamCount: 4, pools: [], playoffsOnly: false };
const set = (d: PlayoffDivisionFacts, over: Partial<PlayoffSettings>) => normalizeSettings({ ...defaultSettings(d), ...over }, d);

describe('who plays: the shapes and the counts a division can take (A62)', () => {
  test('one per pool needs two pools; tiers need four teams', () => {
    assert.deepEqual(shapesFor(U11), ['one', 'pools', 'tiers']);
    assert.deepEqual(shapesFor(U15), ['one', 'tiers']);
    assert.deepEqual(shapesFor({ teamCount: 3, pools: [], playoffsOnly: false }), ['one']);
    assert.deepEqual(shapesFor({ ...U11, playoffsOnly: true }), ['one', 'tiers'], 'a playoffs-only event has no pools to play');
  });
  test('teams that advance step by two while the pools cross, and never past the smaller pool', () => {
    assert.deepEqual(topChoices(set(U11, { seeding: 'cross' }), U11), [2, 4, 6]);
    assert.deepEqual(topChoices(set(U11, { seeding: 'standings' }), U11), [2, 3, 4, 5, 6]);
    const lopsided: PlayoffDivisionFacts = { teamCount: 7, pools: [{ id: 'a', name: 'A', teamCount: 3 }, { id: 'b', name: 'B', teamCount: 4 }], playoffsOnly: false };
    assert.deepEqual(topChoices(set(lopsided, { seeding: 'cross' }), lopsided), [2, 4, 6]);
  });
  test('seeding is a choice only with exactly two pools; crossing an odd count steps down', () => {
    assert.equal(defaultSettings(U11).seeding, 'cross');
    assert.equal(defaultSettings(U15).seeding, 'standings');
    assert.equal(crossesPools(set(U15, { seeding: 'cross' }), U15), false);
    assert.equal(set(U11, { seeding: 'cross', top: 5 }).top, 4);
  });
  test('a division with no plan starts at one bracket, the top 4, crossing when it has two pools', () => {
    assert.deepEqual({ ...defaultSettings(U11), tiers: [] }, { shape: 'one', top: 4, seeding: 'cross', perPool: { r: 2, b: 2 }, tiers: [], format: 'single', third: false, reset: true });
    assert.equal(defaultSettings({ teamCount: 3, pools: [], playoffsOnly: false }).top, 3);
  });
  test('tiers stay contiguous from seed 1, two seeds at least, never past the teams', () => {
    const s = set(U13, { shape: 'tiers', tiers: [{ name: 'Gold', toSeed: 5, format: 'single', third: true, reset: true }, { name: 'Silver', toSeed: 5, format: 'single', third: false, reset: true }] });
    assert.deepEqual(s.tiers.map(t => t.toSeed), [5, 7]);
    assert.deepEqual(bracketsOf(s, U13).map(b => [b.label, b.fromSeed, b.n]), [['Gold', 1, 5], ['Silver', 6, 2]]);
  });
});

describe('the seeding sentence reads the engine\'s own first round', () => {
  const pairsFromEngine = (n: number) => generateBracket(n, { format: 'single' })
    .filter(m => /^Seed #/.test(m.home) && /^Seed #/.test(m.away))
    .map(m => [m.home, m.away].map(x => Number(x.slice(6))).sort((a, b) => a - b));
  test('by the standings at 2, 3, 4, 6 and 8 teams: seed i meets P+1−i, the rest skip round one', () => {
    const cases: Record<number, { plays: string[][]; skips: string[] }> = {
      2: { plays: [['1st', '2nd']], skips: [] },
      3: { plays: [['2nd', '3rd']], skips: ['1st'] },
      4: { plays: [['1st', '4th'], ['2nd', '3rd']], skips: [] },
      6: { plays: [['3rd', '6th'], ['4th', '5th']], skips: ['1st', '2nd'] },
      8: { plays: [['1st', '8th'], ['2nd', '7th'], ['3rd', '6th'], ['4th', '5th']], skips: [] },
    };
    for (const [n, want] of Object.entries(cases)) {
      const d = { teamCount: Number(n), pools: [], playoffsOnly: false };
      assert.deepEqual(firstRoundOf(set(d, { top: Number(n) }), d), want, `${n} teams`);
      assert.equal(pairsFromEngine(Number(n)).length, want.plays.length, `the engine plays ${want.plays.length} first-round games at ${n}`);
    }
  });
  test('crossing two pools interleaves their places: 1st Red plays 2nd Blue, 1st Blue plays 2nd Red', () => {
    assert.deepEqual(firstRoundOf(set(U11, { top: 4 }), U11), { plays: [['1st Pool Red', '2nd Pool Blue'], ['1st Pool Blue', '2nd Pool Red']], skips: [] });
    assert.deepEqual(firstRoundOf(set(U11, { top: 6 }), U11), {
      plays: [['2nd Pool Red', '3rd Pool Blue'], ['2nd Pool Blue', '3rd Pool Red']], skips: ['1st Pool Red', '1st Pool Blue'],
    });
    assert.deepEqual(firstRoundOf(set(U13, { top: 8 }), U13).plays[0], ['1st Pool North', '4th Pool South']);
  });
});

describe('the template: today\'s labels, the engine\'s games', () => {
  test('crossing pools labels the seeds by place; one per pool by the pool\'s own places; tiers by the division\'s seeds', () => {
    const cross = templateOf(set(U11, { top: 4 }), U11);
    assert.deepEqual(cross.map(g => [g.code, g.home, g.away, g.level]), [
      ['SF1', '1st Pool Red', '2nd Pool Blue', 1], ['SF2', '1st Pool Blue', '2nd Pool Red', 1], ['FIN', 'Winner SF1', 'Winner SF2', 2],
    ]);
    const pools = templateOf(set(U13, { shape: 'pools', perPool: { n: 2, s: 2 } }), U13);
    assert.deepEqual(pools.map(g => [g.group, g.code, g.home, g.away]), [['North', 'FIN', '1st Pool North', '2nd Pool North'], ['South', 'FIN', '1st Pool South', '2nd Pool South']]);
    const tiers = templateOf(set(U13, { shape: 'tiers', tiers: [{ name: 'Gold', toSeed: 4, format: 'single', third: false, reset: true }, { name: 'Silver', toSeed: 8, format: 'single', third: false, reset: true }] }), U13);
    assert.deepEqual(tiers.filter(g => g.group === 'Silver' && g.level === 1).map(g => [g.home, g.away]), [['Seed #5', 'Seed #8'], ['Seed #6', 'Seed #7']]);
  });
  test('a 3rd-place game only where every bracket has semifinals', () => {
    assert.ok(templateOf(set(U15, { top: 4, third: true }), U15).some(g => g.code === '3RD' || g.code === 'P3'));
    assert.equal(templateOf(set(U13, { shape: 'pools', perPool: { n: 2, s: 2 }, third: true }), U13).length, 2, 'top 2 of a pool: one final each, no 3rd');
  });
});

describe('what you get matches the engine, for every format at 2–8 teams', () => {
  for (const format of ['single', 'consolation', 'double', 'placement'] as const) {
    test(format, () => {
      for (let n = 2; n <= 8; n++) {
        const d = { teamCount: n, pools: [], playoffsOnly: false };
        const s = set(d, { top: n, format, third: false, reset: true });
        const gets = getsOf(s, d);
        const engine = generateBracket(n, { format, grandFinalReset: true });
        assert.equal(gets.games, engine.length, `${format} ${n}`);
        assert.ok(gets.depth >= 1 && gets.depth <= engine.length);
      }
    });
  }
  test('the sheet\'s cases: U11 top 4 = 3 games over 2 rounds; U13 all 8 double = 15 over 7', () => {
    const u11 = getsOf(set(U11, { top: 4 }), U11);
    assert.deepEqual([u11.games, u11.depth, u11.brackets[0].rounds], [3, 2, [['Semifinal', 2], ['Final', 1]]]);
    const u13 = getsOf(set(U13, { top: 8, seeding: 'standings', format: 'double', reset: true }), U13);
    assert.deepEqual([u13.games, u13.depth], [15, 7]);
  });
});

describe('the fit check (A65): rounds laid into the days, waves over the fields, a night is rest', () => {
  const sunday = [{ date: '2026-10-18', startMinute: 9 * 60, endMinute: 20 * 60 + 30 }];
  const levels = (s: PlayoffSettings, d: PlayoffDivisionFacts) => templateOf(s, d).map(g => g.level);
  test('U11 top 4, single: fits Sunday (about 4 h)', () => {
    const r = fitOf({ levels: levels(set(U11, { top: 4 }), U11), lanes: 4, gameLength: 90, turnover: 15, rest: 60, windows: sunday });
    assert.deepEqual(r, { fits: true, depth: 2, spanMinutes: 240, holdsMinutes: 690 });
  });
  test('U13 all 8, double: 16 h 30 min against Sunday\'s 11 h 30 min — and single elimination fits (6 h 30 min)', () => {
    const double = fitOf({ levels: levels(set(U13, { top: 8, seeding: 'standings', format: 'double', reset: true }), U13), lanes: 4, gameLength: 90, turnover: 15, rest: 60, windows: sunday });
    assert.deepEqual(double, { fits: false, depth: 7, spanMinutes: 990, holdsMinutes: 690 });
    const single = fitOf({ levels: levels(set(U13, { top: 8, seeding: 'standings', third: true }), U13), lanes: 4, gameLength: 90, turnover: 15, rest: 60, windows: sunday });
    assert.equal(single.fits, true);
    assert.equal(single.spanMinutes, 390);
  });
  test('two days hold it: the night between them is the rest', () => {
    const twoDays = [{ date: '2026-10-17', startMinute: 9 * 60, endMinute: 20 * 60 + 30 }, ...sunday];
    const r = fitOf({ levels: levels(set(U13, { top: 8, seeding: 'standings', format: 'double', reset: true }), U13), lanes: 4, gameLength: 90, turnover: 15, rest: 60, windows: twoDays });
    assert.equal(r.fits, true);
  });
  test('fewer fields means more waves: 8 teams on 2 fields, the first round runs twice', () => {
    const r = fitOf({ levels: levels(set(U13, { top: 8, seeding: 'standings' }), U13), lanes: 2, gameLength: 90, turnover: 15, rest: 60, windows: sunday });
    // 4 quarterfinals in 2 waves (90 + 15 + 90), 2 semifinals in 1, the final in 1, a rest between the three rounds.
    assert.equal(r.spanMinutes, 195 + 90 + 90 + 2 * 60);
  });
  test('no day chosen (leave it for later), or no games: nothing to check', () => {
    assert.equal(fitOf({ levels: [1, 1, 2], lanes: 2, gameLength: 90, turnover: 15, rest: 60, windows: [] }).fits, true);
  });
});

describe('the drafts: what they measure, and only the ones that differ (A66)', () => {
  const row = (code: string, home: string, away: string, time: string, field = 'Lions Diamond') =>
    ({ group: null, code, home, away, date: '2026-10-18', time, field });
  // The sheet's U11: the engine's draft (final at 2:15 p.m.) and the earliest final the same slots allow (12:30 p.m.).
  const late = [row('SF1', '1st Pool Red', '2nd Pool Blue', '09:00'), row('SF2', '1st Pool Blue', '2nd Pool Red', '09:00', 'Maple Field 1'), row('FIN', 'Winner SF1', 'Winner SF2', '14:15', 'Maple Field 2')];
  const early = [late[0], late[1], row('FIN', 'Winner SF1', 'Winner SF2', '12:30')];
  test('the measures: shortest rest, rest before the final, when the last game ends, the final, games in a day', () => {
    const m = draftMeasures(late, 90);
    assert.equal(m.shortestRest, 225);
    assert.equal(m.restBeforeFinal, 225);
    assert.deepEqual(m.lastEnd && { date: m.lastEnd.date, time: m.lastEnd.time }, { date: '2026-10-18', time: '15:45' });
    assert.deepEqual(m.final, { date: '2026-10-18', time: '14:15', field: 'Maple Field 2' });
    assert.equal(m.maxGamesInDay, 2);
  });
  test('two drafts that differ: Most rest first (the engine\'s), Finishes earliest second; a copy of either is not a card', () => {
    const measures = [draftMeasures(late, 90), draftMeasures(early, 90), draftMeasures(late, 90), draftMeasures(early, 90)];
    assert.deepEqual(distinctDrafts(measures).cards.map(c => [c.index, c.win]), [[0, 'rest'], [1, 'earliest']]);
  });
  test('every draft the same: one draft, no card names', () => {
    const one = distinctDrafts([draftMeasures(late, 90), draftMeasures(late, 90)]);
    assert.deepEqual(one.cards, [{ index: 0, win: null }]);
    assert.equal(one.matchedAll, true, '"every draft it tried came out the same" is true');
  });
  test('a draft that wins nothing among those shown is left out', () => {
    const worse: PlayoffDraftMeasures = { ...draftMeasures(late, 90), shortestRest: 100, restBeforeFinal: 100, lastEnd: { date: '2026-10-18', time: '20:00', at: Number.MAX_SAFE_INTEGER } };
    const shown = distinctDrafts([draftMeasures(late, 90), worse, draftMeasures(early, 90)]);
    assert.deepEqual(shown.cards.map(c => c.index), [0, 2]);
    assert.equal(shown.matchedAll, false, 'a worse draft was left out: the note may not say every other draft matched');
    const copies = distinctDrafts([draftMeasures(late, 90), draftMeasures(early, 90), draftMeasures(late, 90)]);
    assert.equal(copies.matchedAll, true, 'only copies were left out');
  });
  test('the final is FIN, a double elimination\'s GF (and GF2), a placement bracket\'s 1st-place game', () => {
    assert.deepEqual(['FIN', 'GF', 'GF2', 'PL1', 'SF1', '3RD', 'PL3'].map(isFinalCode), [true, true, true, true, false, false, false]);
  });
});

describe('/review: a held division\'s brackets keep their own depths, and a clocks-change day keeps 24 hours', () => {
  test('Gold\'s SF1 waits on quarterfinals; Silver\'s SF1 is its first round — the same code, two depths', () => {
    const rows = [
      { group: 'gold', code: 'QF1', home: 'Seed #1', away: 'Seed #8', level: 0 },
      { group: 'gold', code: 'QF2', home: 'Seed #4', away: 'Seed #5', level: 0 },
      { group: 'gold', code: 'SF1', home: 'Winner QF1', away: 'Winner QF2', level: 0 },
      { group: 'silver', code: 'SF1', home: 'Seed #9', away: 'Seed #12', level: 0 },
      { group: 'silver', code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', level: 0 },
    ];
    assert.deepEqual(levelInto(rows).map(r => `${r.group} ${r.code} ${r.level}`), ['gold QF1 1', 'gold QF2 1', 'gold SF1 2', 'silver SF1 1', 'silver FIN 2']);
  });
  test('a final the morning after the clocks go back rests the calendar\'s hours, whatever the viewer\'s zone', () => {
    const rows = [
      { group: null, code: 'SF1', home: 'Seed #1', away: 'Seed #4', date: '2026-10-31', time: '18:00', field: 'Lions Diamond' },
      { group: null, code: 'SF2', home: 'Seed #2', away: 'Seed #3', date: '2026-10-31', time: '18:00', field: 'Maple Field 1' },
      { group: null, code: 'FIN', home: 'Winner SF1', away: 'Winner SF2', date: '2026-11-01', time: '10:00', field: 'Lions Diamond' },
    ];
    const m = draftMeasures(rows, 90);
    assert.equal(m.restBeforeFinal, 16 * 60 - 90);
    assert.deepEqual(m.lastEnd && { date: m.lastEnd.date, time: m.lastEnd.time }, { date: '2026-11-01', time: '11:30' });
  });
});

describe('the plan (A63): what the settings save, and read back', () => {
  test('one bracket, pools crossing: standard; by the standings: reseed', () => {
    assert.deepEqual(planOf(set(U11, { top: 4 }), U11), { type: 'single', crossover: 'standard', format: 'single', hasThirdPlace: false, teamsQualifying: 4 });
    assert.deepEqual(planOf(set(U13, { top: 8, seeding: 'standings', format: 'double', reset: false }), U13),
      { type: 'single', crossover: 'reseed', format: 'double', grandFinalReset: false, hasThirdPlace: false, teamsQualifying: 8 });
  });
  test('a 3rd-place game is saved only where it is played', () => {
    assert.equal(planOf(set(U15, { top: 4, third: true }), U15).hasThirdPlace, true);
    assert.equal(planOf(set(U15, { top: 3, third: true }), U15).hasThirdPlace, false);
  });
  test('one per pool and tiers keep each bracket\'s count and range', () => {
    const pools = planOf(set(U13, { shape: 'pools', perPool: { n: 2, s: 3 } }), U13);
    assert.deepEqual([pools.crossover, pools.splitConfigs], ['none', { n: { teamsQualifying: 2, hasThirdPlace: false }, s: { teamsQualifying: 3, hasThirdPlace: false } }]);
    const tiers = planOf(set(U13, { shape: 'tiers', tiers: [{ name: 'Gold', toSeed: 4, format: 'single', third: true, reset: true }, { name: 'Silver', toSeed: 8, format: 'double', third: false, reset: true }] }), U13);
    assert.deepEqual(tiers.tierConfigs, [
      { name: 'Gold', fromSeed: 1, toSeed: 4, format: 'single', hasThirdPlace: true },
      { name: 'Silver', fromSeed: 5, toSeed: 8, format: 'double', hasThirdPlace: false, grandFinalReset: true },
    ]);
    assert.equal(tiers.teamsQualifying, 8);
  });
  test('a saved plan opens as it was saved; the silent default "top 4" is never read as a choice the window made', () => {
    const settings = set(U13, { top: 8, seeding: 'standings', format: 'double', reset: false });
    const saved = mergePlayoffPlan({ tieBreakers: ['h2h'] }, planOf(settings, U13));
    const back = settingsFromPlan(saved, U13);
    assert.deepEqual([back.shape, back.top, back.seeding, back.format, back.reset], ['one', 8, 'standings', 'double', false]);
    assert.deepEqual(settingsFromPlan({ tieBreakers: ['h2h'] } as never, U13), defaultSettings(U13));
  });
});
