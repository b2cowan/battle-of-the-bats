import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { publicTeamsData, teamMoment, teamPlace, teamRowLine, teamsGroups, withheldTeamProfile } from '../../lib/public-teams.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

const division = { id: 'd', name: 'U11', scheduleVisibility: 'published', pools: [] } as unknown as Division;
const teams = ['a', 'b'].map(id => ({ id, name: id.toUpperCase(), divisionId: 'd', status: 'accepted' })) as PublicTeam[];
const now = new Date(zonedWallClockToUtc('2026-10-30', '14:15')!);
const game = (patch: Partial<Game> = {}): Game => ({ id: 'g', tournamentId: 't', divisionId: 'd',
  homeTeamId: 'a', awayTeamId: 'b', date: '2026-10-30', time: '14:00', status: 'scheduled', location: '', ...patch });
const standing = (teamId: string, patch: Partial<DivisionStandingRow> = {}): DivisionStandingRow => ({
  teamId, teamName: teamId, gp: 1, w: 1, l: 0, t: 0, pts: 2, rf: 4, ra: 2, rd: 2, rdRaw: 2,
  runDiffCap: null, needsCoinToss: false, coinTossGroupKey: null, hasPendingGame: false, ...patch,
});
const select = (games: Game[], patch = {}) => teamMoment({ teamId: 'a', games, teams,
  divisions: [division], tournament: null, requireFinalization: true, now, ...patch });

describe('Stage 5 team moment shared by the row and page', () => {
  it('live without a score beats the next game, regardless of input order', () => {
    const next = select([game({ id: 'later', time: '17:00' }), game()]);
    assert.equal(next.kind, 'live');
    if (next.kind !== 'live') return;
    assert.equal(next.game.id, 'g');
    assert.equal(next.game.homeScore, undefined);
    assert.equal(next.opponent, 'B');
  });
  it('uses both stages and chronological order, dropping cancellations and other teams', () => {
    const next = select([game({ id: 'tomorrow', date: '2026-10-31' }), game({ id: 'pool', time: '17:00' }),
      game({ id: 'playoff', isPlayoff: true, time: '16:00' }), game({ id: 'cancel', status: 'cancelled' }),
      game({ id: 'someone-else', homeTeamId: 'c', awayTeamId: 'e' })]);
    assert.equal(next.kind, 'upcoming');
    if (next.kind === 'upcoming') assert.equal(next.game.id, 'playoff');
  });
  it('normalizes bracket shorthand for a TBD opponent on either side', () => {
    const next = select([game({ time: '16:00', awayTeamId: '', awayPlaceholder: 'Winner SF1' })]);
    assert.equal(next.kind, 'upcoming');
    if (next.kind === 'upcoming') assert.equal(next.opponent, 'Semifinal 1 winner');
    const away = select([game({ time: '16:00', homeTeamId: '', awayTeamId: 'a', homePlaceholder: 'Winner SF2' })]);
    if (away.kind === 'upcoming') assert.equal(away.opponent, 'Semifinal 2 winner');
  });
  it('honours per-game, then division, then tournament duration', () => {
    const old = game({ time: '11:30' });
    assert.equal(select([old]).kind, 'none');
    assert.equal(select([old], { tournament: { settings: { game_duration_minutes: 180 } } as Tournament }).kind, 'live');
    assert.equal(select([old], { divisions: [{ ...division, settings: { game_duration_minutes: 180 } }] }).kind, 'live');
    assert.equal(select([{ ...old, durationMinutes: 30 }], {
      divisions: [{ ...division, settings: { game_duration_minutes: 180 } }],
    }).kind, 'none');
  });
  it('never calls a past unscored or unofficial game Up next', () => {
    assert.equal(select([game({ time: '08:00' })]).kind, 'none');
    assert.equal(select([game({ time: '08:00', status: 'submitted', homeScore: 3, awayScore: 2 })]).kind, 'none');
  });
  it('keeps an undated-time future game eligible without inventing its time', () => {
    const next = select([game({ date: '2026-11-01', time: '' })]);
    assert.equal(next.kind, 'upcoming');
    assert.match(teamRowLine(undefined, null, next, now), /next Sun, Nov 1 Time TBD vs B$/);
  });
  it('a final moves the live row to results-only and crowns only the winning team', () => {
    const final = game({ isPlayoff: true, bracketCode: 'FIN', status: 'completed', homeScore: 4, awayScore: 2 });
    assert.equal(select([final]).kind, 'champion');
    assert.equal(select([final], { teamId: 'b' }).kind, 'none');
    assert.equal(select([final, game({ id: 'pending', isPlayoff: true, time: '08:00' })]).kind, 'none');
    assert.equal(select([{ ...final, status: 'submitted', time: '08:00' }]).kind, 'none');
  });
  it('fails closed for held-back, unknown and unregistered teams/divisions', () => {
    assert.equal(select([game()], { divisions: [{ ...division, scheduleVisibility: 'unpublished' }] }).kind, 'empty');
    assert.equal(select([game()], { divisions: [] }).kind, 'empty');
    assert.equal(select([game()], { teamId: 'unknown' }).kind, 'empty');
    assert.equal(select([game()], { teams: [{ ...teams[0], status: 'pending' }, teams[1]] }).kind, 'empty');
    assert.equal(select([game({ divisionId: 'elsewhere' })]).kind, 'empty');
  });
  it('distinguishes no games from no remaining games and leaves inputs untouched', () => {
    assert.equal(select([]).kind, 'empty');
    assert.equal(select([game({ status: 'cancelled' })]).kind, 'empty');
    const old = game({ status: 'completed', homeScore: 4, awayScore: 2 });
    const before = structuredClone(old);
    assert.equal(select([old]).kind, 'none');
    assert.deepEqual(old, before);
  });
});

describe('one place wording and one Teams summary', () => {
  it('does not invent rank before the group plays or for a missing team', () => {
    assert.equal(teamPlace(teams[0], division, [standing('a', { w: 0, l: 0, t: 0 })]), null);
    assert.equal(teamPlace(teams[0], division, [standing('b')]), null);
  });
  it('keeps pool place/count separate and uses the existing pool-name convention', () => {
    const pooled = { ...division, pools: [{ id: 'pa', name: 'A' }, { id: 'pb', name: 'B' }] } as Division;
    const rows = [standing('b', { poolId: 'pb' }), standing('a', { poolId: 'pa' }), standing('c', { poolId: 'pa' })];
    const place = teamPlace({ ...teams[0], poolId: 'pa' }, pooled, rows);
    assert.deepEqual(place, { rank: 1, total: 2, short: '1st', full: '1st of 2 in A Pool', row: '1st of 2 in A Pool', label: 'Place in A Pool', value: '1st of 2' });
    assert.equal(teamRowLine(standing('a'), place, { kind: 'none' }, now), '1-0-0 · 1st of 2 in A Pool · no more games');
    assert.equal(teamPlace({ ...teams[0], poolId: 'pa' }, pooled, [standing('b', { poolId: 'pb' }), standing('a', { poolId: 'pa', w: 0 })]), null);
  });
  it('keeps unassigned teams out of another pool’s rank/count', () => {
    const pooled = { ...division, pools: [{ id: 'pa', name: 'A' }, { id: 'pb', name: 'B' }] } as Division;
    assert.equal(teamPlace(teams[0], pooled, [standing('b', { poolId: 'pa' }), standing('a', { w: 0 })]), null);
  });
  it('shares proper ordinal words beyond the first three', () => {
    const place = teamPlace({ id: '11' }, division, Array.from({ length: 12 }, (_, i) => standing(String(i + 1))));
    assert.equal(place?.full, '11th of 12');
  });
  it('shows the live opponent, record and meaningful place', () => {
    const rows = [standing('a'), standing('b')];
    assert.equal(teamRowLine(rows[0], teamPlace(teams[0], division, rows), select([game()]), now), '1-0-0 · 1st · Live now vs B');
  });
  it('formats today, tomorrow and later days with the shared clock and date helpers', () => {
    for (const [date, expected] of [['2026-10-30', 'next 5:00 p.m.'], ['2026-10-31', 'next tomorrow 5:00 p.m.'], ['2026-11-01', 'next Sun, Nov 1 5:00 p.m.']]) {
      assert.equal(teamRowLine(undefined, null, select([game({ date, time: '17:00' })]), now), `0-0-0 · ${expected} vs B`);
    }
    assert.equal(teamRowLine(undefined, null, { kind: 'empty' }, now), '0-0-0 · no games scheduled yet');
    assert.equal(teamRowLine(standing('a'), null, { kind: 'none' }, now), '1-0-0 · no more games');
  });
});

describe('server hand-offs for the Stage 5 bodies', () => {
  it('removes a hidden crossover opponent id as well as its name, preserving the source and public side', () => {
    const hidden = { ...division, id:'hidden', scheduleVisibility:'unpublished' } as Division;
    const source = { divisions:[division,hidden], teams:[teams[0],{...teams[1],id:'hidden-opponent',divisionId:'hidden'}],
      games:[game({awayTeamId:'hidden-opponent'})], standingsByDivision:{} };
    const next = publicTeamsData(source);
    assert.equal(next.games[0].awayTeamId, '');
    assert.equal(next.games[0].homeTeamId, teams[0].id);
    assert.doesNotMatch(JSON.stringify(next), /hidden-opponent/);
    assert.equal(source.games[0].awayTeamId, 'hidden-opponent');
  });
  it('removes held-back divisions, teams, games, seeds and private notes without changing legacy inputs', () => {
    const hidden = { ...division, id: 'hidden', name: 'Secret', scheduleVisibility: 'unpublished' } as Division;
    const data = { divisions: [division, hidden], teams: [...teams, { ...teams[0], id: 'secret', divisionId: 'hidden', seed: 1 }],
      games: [game({ notes: 'private', scoreSubmittedByEmail: 'private@example.test', scoreSubmittedByUserId: 'private-user' }), game({ id: 'secret-game', divisionId: 'hidden' })],
      standingsByDivision: { d: [standing('a')], hidden: [standing('secret')] } };
    const before = structuredClone(data);
    const next = publicTeamsData(data);
    assert.deepEqual(next.divisions, [division]);
    assert.deepEqual(next.teams, teams);
    assert.deepEqual(Object.keys(next.standingsByDivision), ['d']);
    assert.equal(next.teamsWithheld, true);
    assert.equal(next.games.length, 1);
    assert.equal('notes' in next.games[0], false);
    assert.doesNotMatch(JSON.stringify(next), /secret|private/i);
    assert.deepEqual(data, before);
    const removed = publicTeamsData({ ...data, divisions: [hidden] });
    assert.deepEqual([removed.divisions.map(d => d.id), removed.teams, removed.games, removed.standingsByDivision], [[], [], [], {}]);
  });
  it('the direct-link exception is an explicit identity whitelist', () => {
    const privateTeam = { ...teams[0], coach: 'Private coach', coachEmail: 'private@example.test', seed: 1, poolId: 'secret', adminNotes: 'private' };
    assert.deepEqual(withheldTeamProfile(privateTeam, 'U11'), {
      scheduleWithheld: true, team: { id: 'a', name: 'A', divisionId: 'd' }, divisionName: 'U11',
    });
  });
});

describe('Teams grouping, sorting and search', () => {
  const team = (id: string, name: string, poolId?: string): PublicTeam => ({ ...teams[0], id, name, poolId, coach: '' });
  const pooled = { ...division, pools: [{ id: 'pa', name: 'A' }, { id: 'pb', name: 'B' }] } as Division;
  const list = [team('a', 'Zulu (Adams)', 'pa'), team('b', 'Alpha', 'pa'), team('c', 'Cedar', 'pb'),
    team('d', 'Birch', 'pb'), team('e', 'Unassigned'), team('f', 'Unknown pool', 'unknown')];
  const rows = [standing('a', { poolId: 'pa' }), standing('b', { poolId: 'pa', w: 0 }),
    standing('c', { poolId: 'pb', w: 0 }), standing('d', { poolId: 'pb', w: 0 }), standing('e', { w: 0 }), standing('f', { w: 0 })];
  const group = (patch = {}) => teamsGroups({ teams: list, divisions: [pooled], standingsByDivision: { d: rows }, ...patch });
  it('keeps each pool inside its division with unassigned teams after the named pools', () => {
    const next = group();
    assert.equal(next[0].count, 6);
    assert.deepEqual(next[0].groups.map(g => g.name), ['A Pool', 'B Pool', 'Awaiting assignment']);
    assert.deepEqual(next[0].groups.map(g => g.teams.map(t => t.id)), [['a', 'b'], ['d', 'c'], ['e', 'f']]);
    assert.deepEqual(list.map(t => t.id), ['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('All divisions includes both published divisions and an explicit pick limits the search', () => {
    const other = { ...division, id: 'other', name: 'U13' };
    const data = { divisions: [pooled, other], teams: [...list, { ...team('g', 'Gamma'), divisionId: 'other' }] };
    assert.deepEqual(group(data).map(g => g.division.id), ['d', 'other']);
    assert.deepEqual(group({ ...data, divisionId: 'd', query: 'Gamma' }), []);
    assert.deepEqual(group({ ...data, query: 'gamma' }).map(g => g.division.id), ['other']);
  });
  it('searches the full name, qualifier and only the coach names retained in the public payload', () => {
    assert.deepEqual(group({ query: '  adams  ' })[0].groups[0].teams.map(t => t.id), ['a']);
    assert.deepEqual(group({ query: 'private coach' }), []);
    assert.deepEqual(group({ teams: [{ ...list[0], coach: 'Public Coach' }], query: 'public coach' })[0].groups[0].teams.map(t => t.id), ['a']);
    assert.deepEqual(group({ query: 'nothing matches' }), []);
  });
  it('judges whether a group has played before search narrows it', () => {
    const alphabet = [team('a', 'Played'), team('b', 'Still Zulu'), team('c', 'Still Alpha')];
    assert.deepEqual(group({ divisions: [division], teams: alphabet, standingsByDivision: {
      d: [standing('a'), standing('b', { w: 0 }), standing('c', { w: 0 })],
    }, query: 'still' })[0].groups[0].teams.map(t => t.id), ['b', 'c']);
  });
  it('sorts by base name before play and the canonical rank once played, with no follow input', () => {
    const alphabet = [team('z', 'Zulu'), team('a', 'Alpha (Zed)'), team('b', 'Beta (Amy)')];
    assert.deepEqual(group({ divisions: [division], teams: alphabet, standingsByDivision: {} })[0].groups[0].teams.map(t => t.id), ['a', 'b', 'z']);
    assert.deepEqual(group({ divisions: [division], teams: alphabet, standingsByDivision: { d: [standing('z'), standing('b'), standing('a')] } })[0].groups[0].teams.map(t => t.id), ['z', 'b', 'a']);
  });
  it('excludes unaccepted teams and held-back/unknown divisions without empty groups or counts', () => {
    assert.deepEqual(group({ divisions: [{ ...pooled, scheduleVisibility: 'unpublished' }] }), []);
    assert.deepEqual(group({ divisions: [] }), []);
    assert.deepEqual(group({ teams: [{ ...list[0], status: 'pending' }] }), []);
  });
});
