import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  rankStandings, gameCounts, coachStandingLine, recordWords, diffWords, standingsTitle, STANDINGS_WORDS as W, type StandingsGame,
} from '../../lib/league-standings.ts';

/** House League 9e-1 (rulings 9e·2–9e·4): one table, ranked one way, explained by its own rules. */

const team = (name: string) => ({ id: name.toLowerCase(), name });
const g = (home: string, away: string, hs: number | null, as: number | null, status = 'completed'): StandingsGame => ({
  homeTeamId: home.toLowerCase(), awayTeamId: away.toLowerCase(), homeScore: hs, awayScore: as, status,
});
const order = (s: ReturnType<typeof rankStandings>) => s.rows.map(r => `${W.place(r.place!, r.tied)} ${r.team.name}`);

describe('a game counts once both scores are in', () => {
  it('completed with both scores counts; anything else does not', () => {
    assert.equal(gameCounts(g('A', 'B', 3, 2)), true);
    assert.equal(gameCounts(g('A', 'B', 0, 0)), true);
    assert.equal(gameCounts(g('A', 'B', null, null)), false);
    assert.equal(gameCounts(g('A', 'B', 3, null)), false);
    assert.equal(gameCounts(g('A', 'B', 3, 2, 'scheduled')), false);
    assert.equal(gameCounts(g('A', 'B', 3, 2, 'cancelled')), false);
  });

  it('a completed game with no scores is not a 0–0 tie', () => {
    const s = rankStandings([team('Cubs'), team('Hawks')], [g('Cubs', 'Hawks', null, null)], 'softball');
    assert.equal(s.scored, false);
    assert.ok(s.rows.every(r => r.gamesPlayed === 0 && r.ties === 0 && r.points === 0 && r.place === null));
  });
});

describe('points: 2 for a win, 1 for a tie, 0 for a loss (the ball packs)', () => {
  it('counts the record and the points', () => {
    const s = rankStandings([team('Twins'), team('Royals')], [g('Twins', 'Royals', 5, 3), g('Royals', 'Twins', 4, 4)], 'softball');
    const twins = s.rows.find(r => r.team.name === 'Twins')!;
    assert.deepEqual([twins.wins, twins.losses, twins.ties, twins.points, twins.runsFor, twins.runsAgainst, twins.runDifferential], [1, 0, 1, 3, 9, 7, 2]);
    const royals = s.rows.find(r => r.team.name === 'Royals')!;
    assert.equal(royals.points, 1);
    assert.equal(recordWords(twins), '1-0-1');
  });

  it('a clear order by points', () => {
    const s = rankStandings([team('Cubs'), team('Hawks'), team('Twins')], [
      g('Twins', 'Hawks', 6, 1), g('Twins', 'Cubs', 6, 1), g('Hawks', 'Cubs', 3, 2),
    ], 'baseball');
    assert.deepEqual(order(s), ['1 Twins', '2 Hawks', '3 Cubs']);
    assert.ok(s.rows.every(r => !r.tied && r.levelWith.length === 0));
  });
});

describe('two teams level on points: the game between them', () => {
  it('decides it, even against a better run differential', () => {
    // Hawks and Rays both 2 points; Rays have the better RD (+10 to +1), but Hawks beat Rays.
    const s = rankStandings([team('Hawks'), team('Rays'), team('Cubs'), team('Owls')], [
      g('Hawks', 'Rays', 6, 4), g('Rays', 'Cubs', 12, 0), g('Owls', 'Cubs', 1, 0), g('Owls', 'Hawks', 1, 0),
    ], 'softball');
    assert.deepEqual(order(s), ['1 Owls', '2 Hawks', '3 Rays', '4 Cubs']);
  });

  it('a tied game between them, or none played, falls through to run differential', () => {
    const tied = rankStandings([team('Hawks'), team('Rays'), team('Cubs')], [
      g('Hawks', 'Rays', 3, 3), g('Rays', 'Cubs', 9, 1), g('Hawks', 'Cubs', 4, 3),
    ], 'softball');
    assert.deepEqual(order(tied), ['1 Rays', '2 Hawks', '3 Cubs']);
    const none = rankStandings([team('Hawks'), team('Rays'), team('Cubs'), team('Owls')], [
      g('Hawks', 'Cubs', 4, 3), g('Rays', 'Owls', 9, 1),
    ], 'softball');
    assert.deepEqual(order(none), ['1 Rays', '2 Hawks', '3 Cubs', '4 Owls']);
  });
});

describe('three teams level on points: no game-between step', () => {
  it('goes straight to run differential, even when one beat another', () => {
    // A circle: Rays beat Orioles, Orioles beat Hawks, Hawks beat Rays — all 2 points. Orioles beat Hawks yet sit below them.
    const s = rankStandings([team('Hawks'), team('Orioles'), team('Rays')], [
      g('Rays', 'Orioles', 10, 2), g('Orioles', 'Hawks', 5, 4), g('Hawks', 'Rays', 3, 2),
    ], 'softball');
    assert.deepEqual(order(s), ['1 Rays', '2 Hawks', '3 Orioles']);
  });
});

describe('then runs for, then a shared place', () => {
  it('runs for splits equal run differentials', () => {
    const s = rankStandings([team('Cubs'), team('Hawks'), team('Owls'), team('Rays')], [
      g('Cubs', 'Owls', 8, 6), g('Hawks', 'Rays', 3, 1),
    ], 'softball');
    assert.deepEqual(order(s).slice(0, 2), ['1 Cubs', '2 Hawks']);
  });

  it('still level after every step: a shared place, and the next team takes the place after ("T-3, T-3, 5")', () => {
    const s = rankStandings(['Twins', 'Royals', 'Orioles', 'Rays', 'Hawks'].map(team), [
      g('Twins', 'Hawks', 9, 0), g('Twins', 'Royals', 9, 0), g('Royals', 'Hawks', 9, 0), g('Royals', 'Hawks', 9, 0), g('Royals', 'Hawks', 9, 0),
      g('Orioles', 'Hawks', 5, 4), g('Rays', 'Hawks', 5, 4), g('Orioles', 'Rays', 2, 2),
      g('Twins', 'Orioles', 3, 3), g('Twins', 'Rays', 3, 3),
    ], 'softball');
    // Twins and Royals 6 (Twins won the game between them); Orioles and Rays 4 each, tied the game between them, same RD and RF.
    assert.deepEqual(order(s), ['1 Twins', '2 Royals', 'T-3 Orioles', 'T-3 Rays', '5 Hawks']);
    const orioles = s.rows.find(r => r.team.name === 'Orioles')!;
    assert.deepEqual(orioles.levelWith.map(t => t.name), ['Rays']);
    assert.equal(W.placeTip(3), 'Tied for 3rd');
  });

  it('three still level share one place and each names the other two', () => {
    const s = rankStandings(['Cubs', 'Hawks', 'Owls', 'Rays'].map(team), [
      g('Cubs', 'Rays', 4, 1), g('Hawks', 'Rays', 4, 1), g('Owls', 'Rays', 4, 1),
    ], 'softball');
    assert.deepEqual(order(s), ['T-1 Cubs', 'T-1 Hawks', 'T-1 Owls', '4 Rays']);
    assert.deepEqual(s.rows[0].levelWith.map(t => t.name), ['Hawks', 'Owls']);
    assert.equal(W.admin.levelCell(['Hawks', 'Owls']), 'Hawks and Owls');
  });
});

describe('before the first counted game (9e·4)', () => {
  it('lists the teams A–Z with no place', () => {
    const s = rankStandings(['Rays', 'Cubs', 'Orioles', 'Hawks'].map(team), [g('Rays', 'Cubs', null, null, 'scheduled')], 'softball');
    assert.equal(s.scored, false);
    assert.deepEqual(s.rows.map(r => r.team.name), ['Cubs', 'Hawks', 'Orioles', 'Rays']);
    assert.ok(s.rows.every(r => r.place === null && !r.counted && !r.tied));
  });

  it('a team with no counted game in a scored division keeps a place but reads uncounted', () => {
    const s = rankStandings(['Cubs', 'Hawks', 'Owls'].map(team), [g('Cubs', 'Hawks', 3, 2)], 'softball');
    const owls = s.rows.find(r => r.team.name === 'Owls')!;
    assert.equal(owls.counted, false);
    assert.equal(owls.place, 2);
  });
});

describe('the sport decides the words and the points (9e·2)', () => {
  for (const sport of ['softball', 'baseball']) {
    it(`${sport}: RF, RA, RD; 2 and 1`, () => {
      const s = rankStandings([team('A')], [], sport);
      assert.deepEqual([s.labels.forAbbr, s.labels.againstAbbr, s.labels.diffAbbr], ['RF', 'RA', 'RD']);
      assert.deepEqual([s.labels.forName, s.labels.againstName, s.labels.diffName], ['Runs for', 'Runs against', 'Run differential']);
      assert.deepEqual([s.rules.pointsPerWin, s.rules.pointsPerDraw], [2, 1]);
      assert.deepEqual(s.rules.steps, ['h2h', 'rd', 'rf']);
    });
  }

  it('an unknown stored value reads the neutral pack, never a crash', () => {
    const s = rankStandings([team('A')], [], 'cricket');
    assert.equal(s.labels.forAbbr, 'SF');
  });

  it('the ranking box reads the same rules', () => {
    const s = rankStandings([team('A')], [], 'softball');
    assert.equal(W.rank.points(s.rules.pointsPerWin, s.rules.pointsPerDraw), 'A win is 2 points, a tie 1, a loss 0. Teams level on points are ordered by:');
    assert.deepEqual(s.rules.steps.map(step => W.rank.step(step, s.labels)), [
      'The game between them, when exactly two teams are level', 'Run differential (RD)', 'Runs for (RF)',
    ]);
    assert.equal(W.tip.diff(s.labels), 'Run differential (runs for minus runs against)');
    assert.equal(W.swipe(s.labels), 'Swipe the table for GP, RF and RA.');
    assert.equal(W.rank.points(1, 1).startsWith('A win is 1 point,'), true);
  });
});

describe('the coach line (copy §4)', () => {
  const teams = ['Twins', 'Royals', 'Orioles', 'Rays', 'Hawks', 'Cubs'].map(team);
  it('ranked: "1st of 6 · 1-0-0 · 2 points"', () => {
    const s = rankStandings(teams, [g('Twins', 'Cubs', 5, 1)], 'softball');
    assert.deepEqual(coachStandingLine(s, 'twins'), { kind: 'ranked', text: '1st of 6 · 1-0-0 · 2 points' });
  });
  it('tied, and one point', () => {
    const s = rankStandings(teams, [g('Twins', 'Cubs', 2, 2), g('Royals', 'Hawks', 2, 2)], 'softball');
    assert.deepEqual(coachStandingLine(s, 'twins'), { kind: 'ranked', text: 'Tied for 1st of 6 · 0-0-1 · 1 point' });
  });
  it('no counted game yet', () => {
    const s = rankStandings(teams, [], 'softball');
    assert.deepEqual(coachStandingLine(s, 'twins'), { kind: 'none', text: 'Standings start with the first score.' });
  });
  it('a team not in the division: no line', () => {
    assert.equal(coachStandingLine(rankStandings(teams, [], 'softball'), 'nobody'), null);
  });
  it('a finished season: "Final place: …", the same line from the same live table (9f·6, 9f·2)', () => {
    const s = rankStandings(teams, [g('Twins', 'Cubs', 5, 1)], 'softball');
    assert.deepEqual(coachStandingLine(s, 'twins', { final: true }), { kind: 'ranked', text: 'Final place: 1st of 6 · 1-0-0 · 2 points' });
    const tied = rankStandings(teams, [g('Twins', 'Cubs', 2, 2), g('Royals', 'Hawks', 2, 2)], 'softball');
    assert.deepEqual(coachStandingLine(tied, 'twins', { final: true }), { kind: 'ranked', text: 'Final place: Tied for 1st of 6 · 0-0-1 · 1 point' });
  });
});

describe('"Final" means completed (9f·3, 9f·6)', () => {
  it('the standings page title: Final standings for a completed (or archived) season, Standings otherwise', () => {
    assert.equal(standingsTitle('completed'), 'Final standings');
    assert.equal(standingsTitle('archived'), 'Final standings');
    for (const s of ['active', 'registration_closed', 'registration_open']) assert.equal(standingsTitle(s), 'Standings');
    assert.match(readCode('app/[orgSlug]/league/[seasonSlug]/standings/page.tsx'), /<h1 className=\{kit\.title\}>\{standingsTitle\(season\.status\)\}<\/h1>/);
  });
  it('the coach: the link names the page it opens; a finished page has no Schedule section and no "nothing scored" line', () => {
    assert.equal(W.coach.finalLink, 'See the final standings');
    assert.equal(W.coach.link, 'See the standings');
    const page = readCode('app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx');
    assert.match(page, /view === 'finished' \? STANDINGS_WORDS\.coach\.finalLink : STANDINGS_WORDS\.coach\.link/);
    assert.match(page, /\{view !== 'finished' && \(\s*<section className=\{styles\.section\} aria-labelledby="coach-schedule">/);
    const read = readCode('lib/house-league-coach.ts');
    assert.match(read, /const ranks = \(view === 'open' \|\| view === 'finished'\) && !!team\.division_id && !!division\?\.schedule_published_at && division\.show_standings !== false;/);
    assert.match(read, /if \(final && line\?\.kind === 'none'\) return null;/);
  });
});

describe('cell words', () => {
  it('a differential carries its sign, with a true minus', () => {
    assert.deepEqual([diffWords(19), diffWords(0), diffWords(-7)], ['+19', '0', '−7']);
  });
});
