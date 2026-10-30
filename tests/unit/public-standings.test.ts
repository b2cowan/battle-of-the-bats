import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publishedCompetitionData, standingsAdvancing, standingsCounts, standingsDivision, standingsRankChanges } from '../../lib/public-standings.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

const tournament = { id: 't', settings: {} } as Tournament;
const division = { id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [], playoffConfig: { teamsQualifying: 4 } } as unknown as Division;
const now = new Date(zonedWallClockToUtc('2026-10-29', '14:15')!);
const game = (patch: Partial<Game> = {}): Game => ({
  id: 'g', tournamentId: 't', divisionId: 'd', date: '2026-10-29', time: '08:00', location: '',
  status: 'scheduled', homeTeamId: 'a', awayTeamId: 'b', ...patch,
});
const row = (teamId: string, poolId?: string) => ({ teamId, poolId, gp: 1 } as DivisionStandingRow);
const pool = (id: string, name: string) => ({ id, name, divisionId: 'd', order: 0 });

describe('the standings counts describe the selected division’s table', () => {
  it('counts pool finals, submitted scores and unplayed games; playoff/other-division/cancelled games are absent', () => {
    assert.equal(standingsCounts(tournament, division, [
      game({ status: 'completed' }), game({ status: 'forfeit' }),
      game({ status: 'submitted' }), game({ time: '14:00' }), game({ time: '16:00' }),
      game({ status: 'cancelled' }), game({ divisionId: 'hidden' }), game({ isPlayoff: true, status: 'completed' }),
    ], true, now), 'Top 4 advance · 2 games final · 1 Submitted · 2 left to play');
  });
  it('omits every zero and respects the event’s finalization rule', () => {
    assert.equal(standingsCounts(tournament, division, [], true, now), 'Top 4 advance');
    assert.equal(standingsCounts(tournament, division, [game({ status: 'submitted' })], false, now), 'Top 4 advance · 1 game final');
    assert.equal(standingsCounts(tournament, { ...division, playoffConfig: undefined }, [], true, now), '');
  });
  it('does not promise playoffs for an exhibition, or expose a held-back division', () => {
    assert.equal(standingsCounts({ ...tournament, settings: { format: 'exhibition' } }, division,
      [game({ status: 'completed' })], true, now), '1 game final');
    assert.equal(standingsCounts(tournament, { ...division, scheduleVisibility: 'unpublished' }, [game()], true, now), '');
  });
  it('keeps the per-pool qualification rule honest', () => {
    const pooled = { ...division, pools: [pool('p1', 'A'), pool('p2', 'B')] };
    assert.equal(standingsCounts(tournament, pooled, [], true, now), 'Top 4 per pool advance');
  });
});

describe('selection and playoff-spot marks preserve the existing engine’s order', () => {
  const hidden = { ...division, id: 'hidden', name: 'Hidden', scheduleVisibility: 'unpublished' } as Division;
  it('a missing, held-back or removed remembered division falls back to the first public one', () => {
    assert.equal(standingsDivision([hidden, division], hidden.id), division);
    assert.equal(standingsDivision([division], 'deleted'), division);
    assert.equal(standingsDivision([hidden], ''), undefined);
  });
  it('does not sort points again when deciding the cut, and keeps pool cuts separate', () => {
    const rows = [row('tied-winner'), row('tied-loser'), row('third')];
    const config = { ...division, playoffConfig: { ...division.playoffConfig!, teamsQualifying: 1 } };
    assert.deepEqual([...standingsAdvancing(tournament, config, rows)], ['tied-winner']);
    const pooled = { ...config, pools: [pool('a', 'A'), pool('b', 'B')] };
    assert.deepEqual([...standingsAdvancing(tournament, pooled, [row('a1', 'a'), row('b1', 'b'), row('a2', 'a')])], ['a1', 'b1']);
    assert.equal(standingsAdvancing({ ...tournament, settings: { format: 'exhibition' } }, config, rows).size, 0);
    assert.equal(standingsAdvancing(tournament, config, rows.map(r => ({ ...r, gp: 0 }))).size, 0);
  });
  it('a rank arrow compares a team’s pool rank, not its position in the combined list', () => {
    const pools = [pool('a', 'A'), pool('b', 'B')];
    assert.deepEqual([...standingsRankChanges([row('a1', 'a'), row('b1', 'b'), row('a2', 'a')],
      [row('b1', 'b'), row('a2', 'a'), row('a1', 'a'), row('new', 'b')], pools)], [['a2', 'up'], ['a1', 'down']]);
  });
  it('the server removes a hidden division’s teams, plans, games and standings without changing the old payload', () => {
    const input = { divisions: [division, hidden], games: [game(), game({ divisionId: 'hidden' }), game({ divisionId: 'unknown' })],
      teams: [{ id: 'a', divisionId: 'd', status: 'accepted' }, { id: 'secret', divisionId: 'hidden', status: 'accepted' }] as PublicTeam[],
      standingsByDivision: { d: [row('a')], hidden: [row('secret')] } };
    const shown = publishedCompetitionData(input);
    assert.deepEqual(shown.divisions, [division]);
    assert.deepEqual(shown.games, [game()]);
    assert.deepEqual(shown.teams.map(t => t.id), ['a']);
    assert.deepEqual(Object.keys(shown.standingsByDivision), ['d']);
    assert.equal(input.divisions.length, 2);
    assert.equal(input.games.length, 3);
  });
});
