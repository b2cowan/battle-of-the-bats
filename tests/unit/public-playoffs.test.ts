import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { competitionShellSignature, hasPublicPlayoffBracket, nextPlayoffGame, playoffDoorSub, publicBracketGameLabel, publicBracketRounds, publicBracketSections } from '../../lib/public-playoffs.ts';
import { publishedCompetitionData, standingsRanking } from '../../lib/public-standings.ts';
import { gameSideNames, fanPlaceholder } from '../../lib/public-game-row.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import { generateBracket } from '../../lib/playoff-bracket.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

const division = { id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [] } as unknown as Division;
const teams = ['a', 'b'].map(id => ({ id, name: id.toUpperCase(), divisionId: 'd', status: 'accepted' })) as PublicTeam[];
const now = new Date(zonedWallClockToUtc('2026-10-29', '14:15')!);
const game = (patch: Partial<Game> = {}): Game => ({
  id: 'live', tournamentId: 't', divisionId: 'd', homeTeamId: 'a', awayTeamId: 'b',
  date: '2026-10-29', time: '14:00', location: '', status: 'scheduled', isPlayoff: true, ...patch,
});
const select = (games: Game[], patch = {}) => nextPlayoffGame({
  games, teams, divisions: [division], divisionId: 'd', requireFinalization: true, now, ...patch,
});

describe('the chosen division’s next playoff game', () => {
  it('live beats an upcoming game even before anyone enters a score', () => {
    const live = game();
    assert.deepEqual(select([game({ id: 'later', time: '16:00' }), live]), { kind: 'live', game: live });
    assert.equal(live.homeScore, undefined);
  });
  it('uses chronological order, excludes pool play and cancelled games, and keeps TBD sides', () => {
    const pending = game({ id: 'next', time: '16:00', homeTeamId: '', awayTeamId: '',
      homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' });
    assert.deepEqual(select([
      game({ id: 'cancelled', status: 'cancelled' }), game({ id: 'pool', isPlayoff: false }),
      game({ id: 'tomorrow', date: '2026-10-30', time: '09:00' }), pending,
    ]), { kind: 'upcoming', game: pending });
    assert.deepEqual(gameSideNames(pending, id => id, fanPlaceholder), {
      home: 'Semifinal 1 winner', away: 'Semifinal 2 winner',
    });
  });
  it('does not turn a past unscored game, unofficial result or another division into Up next', () => {
    assert.deepEqual(select([game({ time: '08:00' }), game({ id: 'unofficial', time: '09:00', status: 'submitted' }),
      game({ id: 'elsewhere', divisionId: 'other' })]), { kind: 'none' });
    assert.deepEqual(select([]), { kind: 'none' });
    assert.deepEqual(select([game()], { divisionId: '' }), { kind: 'none' });
  });
  it('shows a champion only after every playoff game is terminal, using the existing final rule', () => {
    const final = game({ id: 'final', bracketCode: 'FIN', status: 'completed', homeScore: 4, awayScore: 2 });
    assert.deepEqual(select([final]), { kind: 'champion', teamId: 'a', game: final });
    assert.deepEqual(select([final, game({ id: 'pending', time: '08:00' })]), { kind: 'none' });
    assert.deepEqual(select([game({ ...final, status: 'submitted', time: '08:00' })]), { kind: 'none' });
    assert.deepEqual(select([game({ ...final, homeScore: 2 })]), { kind: 'none' });
    assert.deepEqual(select([game({ ...final, status: 'forfeit', homeScore: 0, awayScore: 7 })]), {
      kind: 'champion', teamId: 'b', game: game({ ...final, status: 'forfeit', homeScore: 0, awayScore: 7 }),
    });
  });
  it('fails closed for a held-back or unknown division', () => {
    assert.deepEqual(select([game()], { divisions: [{ ...division, scheduleVisibility: 'unpublished' }] }), { kind: 'none' });
    assert.deepEqual(select([game()], { divisionId: 'unknown' }), { kind: 'none' });
  });
});

describe('the new client body’s server hand-off', () => {
  it('removes held-back plans, teams, games and seed rows together without mutating the old page inputs', () => {
    const hidden = { ...division, id: 'hidden', name: 'Secret', scheduleVisibility: 'unpublished', playoffConfig: { teamsQualifying: 8 } } as Division;
    const seed = { teamId: 'a' } as DivisionStandingRow;
    const data = {
      tournament: {} as Tournament, divisions: [division, hidden],
      games: [game(), game({ id: 'secret', divisionId: 'hidden' }), game({ id: 'unknown', divisionId: 'unknown' })],
      teams: [...teams, { ...teams[0], id: 'secret', divisionId: 'hidden' }, { ...teams[0], id: 'pending', status: 'pending' } as PublicTeam],
      venues: [], standingsByDivision: { d: [seed], hidden: [seed] }, requireFinalization: true,
    };
    const shown = publishedCompetitionData(data);
    assert.deepEqual(shown.divisions, [division]);
    assert.deepEqual(shown.teams, teams);
    assert.deepEqual(shown.games, [game()]);
    assert.deepEqual(shown.standingsByDivision, { d: [seed] });
    assert.equal(data.divisions.length, 2);
    assert.equal(data.games.length, 3);
  });
});

describe('the ranking explainer uses the standings settings and current notes', () => {
  it('respects tournament-wide tie-breaker order and shows the cap and pending notes only when needed', () => {
    const rank = standingsRanking({ tieBreakers: ['rd'] } as never,
      { tie_breaker_scope: 'tournament', tie_breakers: ['h2h', 'ra'] }, [{ runDiffCap: 7, hasPendingGame: true }]);
    assert.equal(rank.order, 'Head-to-Head > Runs Against');
    assert.match(rank.capNote!, /capped at ±7 per game/);
    assert.match(rank.pendingNote!, /^Unofficial scores/);
    assert.equal(standingsRanking(undefined, undefined, []).capNote, null);
    assert.equal(standingsRanking(undefined, undefined, []).pendingNote, null);
    assert.deepEqual(rank.legend.map(col => col.abbr), ['REC', 'W', 'L', 'T', 'RF', 'RA', 'RD', 'PTS']);
  });
});

describe('the bracket doors follow the tab, including a bracket-only event', () => {
  const planned = { ...division, playoffConfig: { teamsQualifying: 4 } } as Division;
  const tournament = { settings: {} } as Tournament;
  it('needs a saved plan or a published playoff game, with the bracket’s own format/privacy rule', () => {
    assert.equal(hasPublicPlayoffBracket(tournament, [division], []), false);
    assert.equal(hasPublicPlayoffBracket(tournament, [planned], []), true);
    assert.equal(hasPublicPlayoffBracket({ ...tournament, settings: { format: 'playoff_only' } }, [planned], []), true);
    assert.equal(hasPublicPlayoffBracket({ ...tournament, publicHiddenPages: ['standings'] }, [planned], [game()]), false);
    assert.equal(hasPublicPlayoffBracket({ ...tournament, settings: { format: 'exhibition' } }, [planned], [game()]), false);
    assert.equal(hasPublicPlayoffBracket(tournament, [division], [game()]), true);
    assert.equal(hasPublicPlayoffBracket(tournament, [division], [game({ divisionId: 'unknown' })]), false);
  });
  it('has no sub-line before the bracket exists; live and future lines use the selected division', () => {
    const input = { tournament, divisions: [planned], games: [] as Game[], teams, requireFinalization: true };
    assert.equal(playoffDoorSub(input, 'd', now), null);
    assert.equal(playoffDoorSub({ ...input, games: [game({ bracketCode: 'FIN' })] }, 'd', now), 'Top 4 advance · the championship is live now');
    assert.equal(playoffDoorSub({ ...input, games: [game({ time: '18:00' })] }, 'd', now), 'Top 4 advance · starts Thu');
    assert.equal(playoffDoorSub({ ...input, games: [game({ divisionId: 'other' })] }, 'd', now), null);
  });
});

describe('the new bracket presentation delegates rounds and preserves fan words', () => {
  for (const format of ['single', 'consolation', 'double', 'placement'] as const) it(`retains every saved ${format} game once, including byes and placement branches`, () => {
    for (const count of [3, 4, 8, 16]) {
      const games = generateBracket(count, { format, thirdPlace: true }).map(matchup => game({
        id: matchup.code, bracketCode: matchup.code, roundLabel: matchup.round,
        homePlaceholder: matchup.home, awayPlaceholder: matchup.away,
      }));
      const rendered = publicBracketSections(games, teams, []).flatMap(section => publicBracketRounds(section.games).flatMap(round => round.games));
      assert.deepEqual(rendered.map(g => g.id).sort(), games.map(g => g.id).sort());
      assert.equal(new Set(rendered.map(g => g.id)).size, games.length);
    }
  });
  it('uses the canonical eight-team column grouping with a distinct game label for each feeder', () => {
    const games = ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'FIN'].map(code => game({ id: code, bracketCode: code }));
    const rounds = publicBracketRounds(games);
    assert.deepEqual(rounds.map(round => round.games.length), [4, 2, 1]);
    assert.equal(rounds.at(-1)?.title, 'Championship');
    assert.equal(publicBracketGameLabel(games[0]), 'Quarterfinal 1');
    assert.equal(publicBracketGameLabel(games[4]), 'Semifinal 1');
    assert.equal(publicBracketGameLabel(games[6]), 'Championship');
  });
  it('a custom column title on one game applies to its whole column', () => {
    const rounds = publicBracketRounds([game({ id: 's1', bracketCode: 'SF1' }), game({ id: 's2', bracketCode: 'SF2', roundLabel: 'Last four' })]);
    assert.equal(rounds[0].title, 'Last four');
  });
  it('keeps the if-needed reset in its own column and the title game before third place', () => {
    const double = publicBracketRounds([game({ id: 'gf', bracketCode: 'GF' }), game({ id: 'reset', bracketCode: 'GF2' })]);
    assert.equal(double.length, 2);
    assert.equal(double[1].games[0].id, 'reset');
    const finals = publicBracketRounds([game({ id: 'third', bracketCode: '3RD' }), game({ id: 'final', bracketCode: 'FIN' })]);
    assert.deepEqual(finals[0].games.map(g => g.id), ['final', 'third']);
  });
  it('keeps a cross-pool final with both feeders and separate tiers with repeated game codes', () => {
    const pools = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const games = [game({ id: 'sa', bracketCode: 'SF1', homeTeamId: '', awayTeamId: '', homePlaceholder: '1st Pool A', awayPlaceholder: '2nd Pool A' }),
      game({ id: 'sb', bracketCode: 'SF2', homeTeamId: '', awayTeamId: '', homePlaceholder: '1st Pool B', awayPlaceholder: '2nd Pool B' }),
      game({ id: 'final', bracketCode: 'FIN', homeTeamId: '', awayTeamId: '', homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' })];
    const sections = publicBracketSections(games, [], pools);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].games.length, 3);
    const tiered = publicBracketSections([game({ id: 't1', bracketId: 'one', bracketLabel: 'Tier 1', bracketCode: 'FIN' }),
      game({ id: 't2', bracketId: 'two', bracketLabel: 'Tier 2', bracketCode: 'FIN' })], [], []);
    assert.deepEqual(tiered.map(section => section.games.map(g => g.id)), [['t1'], ['t2']]);
  });
  it('score changes do not refresh the shell; a crown, page gate or tournament status does', () => {
    const initial = { pageEnabled: true, tournament: { status: 'active' } as Tournament };
    assert.equal(competitionShellSignature(initial), competitionShellSignature({ ...initial }));
    assert.notEqual(competitionShellSignature(initial), competitionShellSignature({ ...initial, pageEnabled: false }));
    assert.notEqual(competitionShellSignature(initial), competitionShellSignature({ ...initial, tournament: { ...initial.tournament, championsCrownedAt: '2026-10-29T20:00:00Z' } }));
  });
});
