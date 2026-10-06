/**
 * HOW IT FINISHED, AND THE EVENT IN NUMBERS (Tournament admin redesign Stage 4, Part 0) — one test per
 * definition in TOURNAMENT_ADMIN_REDESIGN_PLAN.md §6d, on fixtures shaped like the demo's Riverdale
 * Season Opener (U11 decided by a final, U13 round robin only) plus the cases no test data holds: a
 * tiered division (P1), a final never scored (P2), a forfeited final, an Exhibition (A24).
 *
 * And the rule that made Part 0 necessary: the finished board and Summary return the SAME object,
 * from ONE read — the route guard at the foot reads both routes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeEventRecap, type RecapInput } from '../../lib/event-recap';
import { FINISH_WORDS, hasMoney } from '../../lib/after-event-words';
import type { Division, Game, Team } from '../../lib/types';

let gameSeq = 0;
function game(over: Partial<Game> & Pick<Game, 'divisionId' | 'homeTeamId' | 'awayTeamId'>): Game {
  gameSeq++;
  return {
    id: `g${gameSeq}`,
    tournamentId: 't1',
    date: '2026-10-03',
    time: '09:00',
    location: 'Field 1',
    status: 'completed',
    isPlayoff: false,
    ...over,
  } as Game;
}
const score = (home: number, away: number) => ({ homeScore: home, awayScore: away });

function team(id: string, divisionId: string, status: Team['status'] = 'accepted'): Team {
  return { id, tournamentId: 't1', divisionId, name: `Team ${id}`, coach: '', email: '', status, paymentStatus: 'pending', registeredAt: '2026-09-01' };
}
function division(id: string, name: string, order: number, over: Partial<Division> = {}): Division {
  return { id, tournamentId: 't1', name, minAge: null, maxAge: null, order, ...over };
}

/** A four-team round robin (6 games) where team a1 goes 3-0, a2 2-1, a3 1-2, a4 0-3. */
function roundRobin(div: string, ids: [string, string, string, string]): Game[] {
  const [a, b, c, d] = ids;
  return [
    game({ divisionId: div, homeTeamId: a, awayTeamId: b, ...score(5, 2) }),
    game({ divisionId: div, homeTeamId: a, awayTeamId: c, ...score(6, 1) }),
    game({ divisionId: div, homeTeamId: a, awayTeamId: d, ...score(7, 0) }),
    game({ divisionId: div, homeTeamId: b, awayTeamId: c, ...score(4, 3) }),
    game({ divisionId: div, homeTeamId: b, awayTeamId: d, ...score(3, 1) }),
    game({ divisionId: div, homeTeamId: c, awayTeamId: d, ...score(2, 1) }),
  ];
}

/** The Season Opener's shape: U11 (round robin + semis + a decided final), U13 (round robin only). */
function seasonOpener(over: Partial<RecapInput> = {}): RecapInput {
  const divisions = [division('u13', 'U13', 2), division('u11', 'U11', 1)];
  const teams = [
    ...['a1', 'a2', 'a3', 'a4'].map(id => team(id, 'u11')),
    ...['b1', 'b2', 'b3', 'b4'].map(id => team(id, 'u13')),
    team('x9', 'u11', 'rejected'), // the ninth registration, never accepted: it never played
  ];
  const games = [
    ...roundRobin('u11', ['a1', 'a2', 'a3', 'a4']),
    ...roundRobin('u13', ['b1', 'b2', 'b3', 'b4']),
    game({ divisionId: 'u11', homeTeamId: 'a1', awayTeamId: 'a4', ...score(6, 2), isPlayoff: true, bracketCode: 'SF1', bracketId: 'br1' }),
    game({ divisionId: 'u11', homeTeamId: 'a2', awayTeamId: 'a3', ...score(3, 1), isPlayoff: true, bracketCode: 'SF2', bracketId: 'br1' }),
    game({ divisionId: 'u11', homeTeamId: 'a2', awayTeamId: 'a1', ...score(4, 5), isPlayoff: true, bracketCode: 'FIN', bracketId: 'br1', date: '2026-10-04' }),
  ];
  const payments = teams.map(t => ({ divisionId: t.divisionId, status: t.status, totalPaid: t.status === 'accepted' ? 600 : 0 }));
  return {
    tournament: {
      status: 'completed',
      settings: {},
      publicHiddenPages: [],
      feeScheduleMode: 'tournament',
      fee: { depositAmount: null, depositDueDate: null, totalFeeAmount: 600, totalFeeDueDate: null },
    },
    divisions,
    teams,
    games,
    payments,
    publicBase: '/riverdale-minor-ball/season-opener',
    ...over,
  };
}

describe('a division\'s finish', () => {
  it('a decided final names the champion, the runner-up, both scores (winner first) and the final\'s date', () => {
    const [u11] = computeEventRecap(seasonOpener()).finishes;
    assert.deepEqual(u11, {
      kind: 'champion', divisionId: 'u11', divisionName: 'U11', teamName: 'Team a1', tierLabel: null,
      runnerUpName: 'Team a2', winnerScore: 5, loserScore: 4, byForfeit: false, finalDate: '2026-10-04',
    });
  });

  it('a division with no final names the team first in the published standings, with its W-L-T and "no final" (F50)', () => {
    const [, u13] = computeEventRecap(seasonOpener()).finishes;
    assert.deepEqual(u13, { kind: 'standings', divisionId: 'u13', divisionName: 'U13', teamName: 'Team b1', w: 3, l: 0, t: 0, final: 'none' });
  });

  it('rows follow the event\'s division order, not the read order', () => {
    assert.deepEqual(computeEventRecap(seasonOpener()).finishes.map(f => f.divisionName), ['U11', 'U13']);
  });

  it('P1 · a tiered division names its TOP tier\'s champion and the tier, never a lower tier\'s', () => {
    const input = seasonOpener();
    // A Tier 2 consolation final in U13, decided, beside a decided Tier 1 final: the division row is Tier 1's.
    input.games.push(
      game({ divisionId: 'u13', homeTeamId: 'b3', awayTeamId: 'b4', ...score(9, 0), isPlayoff: true, bracketCode: 'FIN', bracketId: 't2', bracketLabel: 'Tier 2' }),
      game({ divisionId: 'u13', homeTeamId: 'b1', awayTeamId: 'b2', ...score(2, 3), isPlayoff: true, bracketCode: 'FIN', bracketId: 't1', bracketLabel: 'Tier 1' }),
    );
    const u13 = computeEventRecap(input).finishes[1];
    assert.equal(u13.kind, 'champion');
    assert.equal(u13.teamName, 'Team b2');
    assert.equal(u13.kind === 'champion' && u13.tierLabel, 'Tier 1');
  });

  it('P2 · playoffs with no decided final: where its top team finished, marked "final not scored", no champion', () => {
    const input = seasonOpener();
    const final = input.games.find(g => g.bracketCode === 'FIN')!;
    final.status = 'scheduled';
    final.homeScore = null;
    final.awayScore = null;
    const [u11] = computeEventRecap(input).finishes;
    assert.deepEqual(u11, { kind: 'standings', divisionId: 'u11', divisionName: 'U11', teamName: 'Team a1', w: 3, l: 0, t: 0, final: 'unscored' });
  });

  it('a final won by forfeit is still a champion, and says so (its score is nominal)', () => {
    const input = seasonOpener();
    const final = input.games.find(g => g.bracketCode === 'FIN')!;
    Object.assign(final, { status: 'forfeit', homeScore: 0, awayScore: 1 });
    const [u11] = computeEventRecap(input).finishes;
    assert.equal(u11.kind === 'champion' && u11.byForfeit, true);
    assert.equal(u11.teamName, 'Team a1');
  });

  it('a division where no game counts has no row', () => {
    const input = seasonOpener();
    input.divisions.push(division('u15', 'U15', 3));
    input.teams.push(team('c1', 'u15'), team('c2', 'u15'));
    input.games.push(game({ divisionId: 'u15', homeTeamId: 'c1', awayTeamId: 'c2', status: 'scheduled', homeScore: null, awayScore: null }));
    assert.deepEqual(computeEventRecap(input).finishes.map(f => f.divisionName), ['U11', 'U13']);
  });

  it('a division whose only scores are entered but not final (submitted) has no row and no printed standings (/review 2026-10-06)', () => {
    // The standings engine counts a submitted score; games played does not — so the row followed the figure.
    const input = seasonOpener();
    input.divisions.push(division('u15', 'U15', 3));
    input.teams.push(team('c1', 'u15'), team('c2', 'u15'));
    input.games.push(game({ divisionId: 'u15', homeTeamId: 'c1', awayTeamId: 'c2', status: 'submitted', ...score(3, 1) }));
    const recap = computeEventRecap(input);
    assert.deepEqual(recap.finishes.map(f => f.divisionName), ['U11', 'U13']);
    assert.deepEqual(recap.standings.map(s => s.divisionName), ['U11', 'U13']);
    assert.equal(recap.gamesPlayed, 15);
  });

  it('A24 · an Exhibition names no winner, but keeps its figures and its standings', () => {
    const recap = computeEventRecap(seasonOpener({
      tournament: { ...seasonOpener().tournament, settings: { format: 'exhibition' } },
    }));
    assert.deepEqual(recap.finishes, []);
    assert.equal(recap.isExhibition, true);
    assert.equal(recap.gamesPlayed, 15);
    assert.deepEqual(recap.standings.map(s => s.divisionName), ['U11', 'U13']);
  });
});

describe('the event in numbers', () => {
  it('teams = the teams that PLAYED (8), not the registrations (9)', () => {
    assert.equal(computeEventRecap(seasonOpener()).teamsPlayed, 8);
  });

  it('games played = games with a final result, forfeits in, cancelled and unscored out; and the playoff share', () => {
    const input = seasonOpener();
    input.games.push(
      game({ divisionId: 'u13', homeTeamId: 'b1', awayTeamId: 'b2', status: 'cancelled' }),
      game({ divisionId: 'u13', homeTeamId: 'b1', awayTeamId: 'b3', status: 'forfeit', ...score(1, 0) }),
      game({ divisionId: 'u13', homeTeamId: 'b2', awayTeamId: 'b3', status: 'submitted', ...score(2, 2) }),
    );
    const recap = computeEventRecap(input);
    assert.equal(recap.gamesPlayed, 16);
    assert.equal(recap.playoffGamesPlayed, 3);
  });

  it('collected = what every ACCEPTED team paid; a rejected registration\'s money is not counted', () => {
    const input = seasonOpener();
    input.payments.find(p => p.status === 'rejected')!.totalPaid = 600;
    assert.deepEqual(computeEventRecap(input).money, { charged: true, collected: 4800, owed: 0, teamsOwing: 0 });
  });

  it('still owed = accepted teams\' unpaid balances against their OWN fee, and by how many teams (P4)', () => {
    const input = seasonOpener({
      tournament: { ...seasonOpener().tournament, feeScheduleMode: 'division' },
    });
    // U13 carries its own fee in division mode; U11 falls back to the event's $600.
    input.divisions = input.divisions.map(d => d.id === 'u13' ? { ...d, totalFeeAmount: 750 } : d);
    const recap = computeEventRecap(input);
    assert.equal(recap.money.collected, 4800);
    assert.equal(recap.money.owed, 600); // 4 U13 teams × $150
    assert.equal(recap.money.teamsOwing, 4);
  });

  it('P4 · an accepted team that never played still counts in the money, not in the teams', () => {
    const input = seasonOpener();
    input.teams.push(team('a5', 'u11'));
    input.payments.push({ divisionId: 'u11', status: 'accepted', totalPaid: 150 });
    const recap = computeEventRecap(input);
    assert.equal(recap.teamsPlayed, 8);
    assert.equal(recap.money.collected, 4950);
    assert.equal(recap.money.owed, 450);
    assert.equal(recap.money.teamsOwing, 1);
  });

  it('an event that charged no fees says so: nothing charged, nothing owed', () => {
    const input = seasonOpener({ tournament: { ...seasonOpener().tournament, fee: { depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null } } });
    input.payments.forEach(p => { p.totalPaid = 0; });
    const recap = computeEventRecap(input);
    assert.deepEqual(recap.money, { charged: false, collected: 0, owed: 0, teamsOwing: 0 });
    assert.equal(hasMoney(recap), false, 'a free event never shows a pair of zeroes');
    assert.equal(FINISH_WORDS.footLine(recap).lead, '8 teams · 15 games played');
  });

  it('money collected WITHOUT a fee schedule is still said: collected counts with or without one (/review 2026-10-06)', () => {
    const input = seasonOpener({ tournament: { ...seasonOpener().tournament, fee: { depositAmount: null, depositDueDate: null, totalFeeAmount: null, totalFeeDueDate: null } } });
    input.payments.forEach(p => { p.totalPaid = 0; });
    input.payments[0].totalPaid = 300;
    const recap = computeEventRecap(input);
    assert.deepEqual(recap.money, { charged: false, collected: 300, owed: 0, teamsOwing: 0 });
    assert.equal(hasMoney(recap), true);
    assert.match(FINISH_WORDS.footLine(recap).lead, /collected/);
  });
});

describe('the link to share (P3)', () => {
  it('the champions page when it will name a champion', () => {
    const recap = computeEventRecap(seasonOpener());
    assert.equal(recap.shareLink, 'champions');
    assert.equal(recap.sharePath, '/riverdale-minor-ball/season-opener/champions');
  });

  it('the Standings page when a final was never scored (the public page would say "no champions crowned yet")', () => {
    const input = seasonOpener();
    Object.assign(input.games.find(g => g.bracketCode === 'FIN')!, { status: 'scheduled', homeScore: null, awayScore: null });
    assert.equal(computeEventRecap(input).sharePath, '/riverdale-minor-ball/season-opener/standings');
  });

  it('the Standings page when the event had no playoffs at all, and always for an Exhibition', () => {
    const input = seasonOpener();
    input.games = input.games.filter(g => !g.isPlayoff);
    assert.equal(computeEventRecap(input).shareLink, 'standings');
    const exhibition = computeEventRecap(seasonOpener({ tournament: { ...seasonOpener().tournament, settings: { format: 'exhibition' } } }));
    assert.equal(exhibition.shareLink, 'standings');
  });

  it('nothing when Standings is hidden (both pages say the results are hidden) or the site is offline', () => {
    const hidden = computeEventRecap(seasonOpener({ tournament: { ...seasonOpener().tournament, publicHiddenPages: ['standings'] } }));
    assert.equal(hidden.shareLink, null);
    assert.equal(hidden.sharePath, null);
    assert.equal(hidden.shareHidden, true, 'the organizer hid it: the card says so');
    const archived = computeEventRecap(seasonOpener({ tournament: { ...seasonOpener().tournament, status: 'archived' } }));
    assert.equal(archived.shareLink, null);
    assert.equal(archived.shareHidden, false, 'an offline site has nothing to say about Standings');
  });

  it('a bracket-only event shares nothing and says nothing: its champions page reads Standings, which the format turns off (F56, reported)', () => {
    const recap = computeEventRecap(seasonOpener({ tournament: { ...seasonOpener().tournament, settings: { format: 'playoff_only' } } }));
    assert.equal(recap.shareLink, null);
    assert.equal(recap.shareHidden, false);
  });
});

describe('one read, both screens', () => {
  // The board's route and Summary's each built their own "How it finished" before Part 0; now both return
  // `recap` from lib/event-recap-read.ts unchanged, so their payloads cannot differ.
  const routes = [
    'app/api/admin/tournament-dashboard/route.ts',
    'app/api/admin/tournaments/[tournamentId]/summary/route.ts',
  ];
  for (const path of routes) {
    it(`${path} returns the shared recap read`, () => {
      const src = readFileSync(path, 'utf8');
      assert.match(src, /from '@\/lib\/event-recap-read'/);
      assert.match(src, /loadEventRecap\(tournamentId, ctx\.org\.slug\)/);
      assert.match(src, /\n\s+recap,\n/, 'the route returns the read as `recap`, unchanged');
      assert.doesNotMatch(src, /computeEventRecap/, 'a route never computes its own recap');
    });
  }
});
