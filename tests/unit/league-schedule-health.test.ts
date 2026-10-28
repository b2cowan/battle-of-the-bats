import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildLeagueScheduleHealth, leagueHealthGameFromRow, type LeagueHealthGame, type LeagueHealthPractice, type LeagueHealthTeam,
} from '../../lib/league-schedule-health.ts';
import { buildEventScheduleHealth } from '../../lib/schedule-metrics.ts';

/**
 * HOUSE LEAGUE STAGE 9d-2a — SCHEDULE HEALTH WITH A LEAGUE'S RULES (frames d1–d3, ruling 9d2·4). The fixture is Dev House
 * League 2026 as the database holds it (read 2026-10-27, `.probe/9d2a/health-dev.mts`): two divisions, six teams, two games
 * each on the plan; Tigers vs Braves cancelled and never replayed; Cardinals vs Orioles postponed with no new date; two
 * practices at a typed place. The tournament engine, unchanged, scores it 97 Healthy. A league's rules find the four
 * issues the drawing shows and score it 65.
 */

const at = (day: string) => `${day}T10:00:00+00:00`;
let n = 0;
const g = (div: string, home: string, away: string, day: string, status = 'scheduled', venue: string | null = 'v1'): LeagueHealthGame => ({
  id: `g${++n}`, divisionId: div, homeTeamId: home, awayTeamId: away, scheduledAt: at(day), endsAt: null, status,
  venueId: venue, facilityId: venue ? `f${n}` : null, location: venue ? null : 'Eastview School',
});
const teams: LeagueHealthTeam[] = [
  { id: 'cards', name: 'Cardinals', divisionId: 'A' }, { id: 'orioles', name: 'Orioles', divisionId: 'A' }, { id: 'twins', name: 'Twins', divisionId: 'A' },
  { id: 'tigers', name: 'Tigers', divisionId: 'B' }, { id: 'braves', name: 'Braves', divisionId: 'B' }, { id: 'rays', name: 'Rays', divisionId: 'B' },
];
const devGames = (): LeagueHealthGame[] => [
  g('B', 'tigers', 'braves', '2026-06-14', 'cancelled'),
  g('A', 'cards', 'twins', '2026-06-07', 'completed'),
  g('B', 'tigers', 'rays', '2026-06-07', 'completed'),
  g('A', 'cards', 'orioles', '2026-06-14', 'postponed'),
  g('A', 'twins', 'orioles', '2026-06-21'),
  g('B', 'rays', 'braves', '2026-06-21'),
];
const typedPractice = (id: string, team: string): LeagueHealthPractice => ({
  id, divisionId: 'A', teamId: team, scheduledAt: at('2026-06-10'), endsAt: null, status: 'scheduled',
  venueId: null, facilityId: null, location: 'Eastview School', clubSlotId: null,
});

describe('Dev House League 2026', () => {
  const r = buildLeagueScheduleHealth({ games: devGames(), practices: [typedPractice('p1', 'cards'), typedPractice('p2', 'orioles')], teams });

  it('finds the drawing\'s four issues, in the window\'s order', () => {
    assert.deepEqual(r.issues.map(i => i.kind), ['short', 'postponed', 'home_away', 'unchecked']);
    const short = r.issues[0];
    assert.ok(short.kind === 'short');
    assert.deepEqual(short.teamIds, ['tigers', 'braves']);
    assert.equal(short.have, 1);
    assert.equal(short.plan, 2);
    assert.equal(short.cancelled?.day, '2026-06-14');
    const ha = r.issues[2];
    assert.ok(ha.kind === 'home_away');
    assert.deepEqual(ha.teams, [{ teamId: 'cards', home: 2, away: 0 }, { teamId: 'orioles', home: 0, away: 2 }]);
    assert.deepEqual(r.issues[3], { kind: 'unchecked', games: 0, practices: 2 });
  });

  it('a postponed game is not played and a cancelled one is not had: 2 of 6 teams on plan', () => {
    assert.deepEqual(r.tiles.games, { onPlan: 2, teams: 6 });
    const cards = r.teams.find(t => t.teamId === 'cards')!;
    assert.deepEqual({ have: cards.have, plan: cards.plan, postponed: cards.postponed }, { have: 1, plan: 2, postponed: 1 });
  });

  it('scores 65, Needs work, where the tournament engine says 97', () => {
    assert.equal(r.score, 65);
    assert.equal(r.tone, 'danger');
    assert.equal(r.timedGames, 4);
    assert.equal(r.divisions, 2);
    const tournament = buildEventScheduleHealth({
      games: devGames().map(x => ({ id: x.id, divisionId: x.divisionId, homeTeamId: x.homeTeamId, awayTeamId: x.awayTeamId, date: x.scheduledAt!.slice(0, 10), time: '06:00', venueId: x.venueId, venueFacilityId: x.facilityId, location: x.location, status: x.status, isPlayoff: false, durationMinutes: null })),
      teams: teams.map(t => ({ id: t.id, name: t.name, divisionId: t.divisionId })),
      divisions: [{ id: 'A', settings: {}, playoffConfig: null }, { id: 'B', settings: {}, playoffConfig: null }] as never,
      tournament: null,
    });
    assert.ok(tournament.healthScore >= 85, `the tournament engine: ${tournament.healthScore}`);
  });
});

describe('the league rule set', () => {
  const division = (): LeagueHealthGame[] => [
    g('A', 'cards', 'orioles', '2026-06-01'), g('A', 'twins', 'cards', '2026-06-08'), g('A', 'orioles', 'twins', '2026-06-15'),
  ];

  it('a clean round robin is Healthy with no issues', () => {
    const r = buildLeagueScheduleHealth({ games: division(), practices: [], teams: teams.filter(t => t.divisionId === 'A') });
    assert.deepEqual(r.issues, []);
    assert.equal(r.score, 100);
    assert.equal(r.tone, 'good');
  });

  it('nothing timed scores nothing', () => {
    const r = buildLeagueScheduleHealth({ games: [g('A', 'cards', 'orioles', '2026-06-01', 'postponed')], practices: [], teams });
    assert.equal(r.timedGames, 0);
  });

  it('a game and a practice on one facility at once is a clash; two diamonds in one park are not', () => {
    const games = division();
    const clashing: LeagueHealthPractice = { ...typedPractice('p1', 'twins'), scheduledAt: games[0].scheduledAt, venueId: 'v1', facilityId: games[0].facilityId };
    const elsewhere: LeagueHealthPractice = { ...clashing, id: 'p2', facilityId: 'another' };
    const r = buildLeagueScheduleHealth({ games, practices: [clashing, elsewhere], teams: teams.filter(t => t.divisionId === 'A') });
    const c = r.issues.filter(i => i.kind === 'clash');
    assert.equal(c.length, 1);
    assert.deepEqual(c[0].kind === 'clash' && c[0].keys, [`league_game:${games[0].id}`, 'league_practice:p1']);
    assert.equal(r.tiles.clashes.pairs, 1);
    assert.equal(r.score, 90, 'one clash costs a third of the 30');
  });

  it('a team on twice in a day is an issue unless the rules allow it', () => {
    const games = [...division(), g('A', 'cards', 'twins', '2026-06-01')];
    const no = buildLeagueScheduleHealth({ games, practices: [], teams: teams.filter(t => t.divisionId === 'A') });
    assert.deepEqual(no.issues.filter(i => i.kind === 'twice_in_a_day').map(i => i.kind === 'twice_in_a_day' && i.teamId), ['cards']);
    const yes = buildLeagueScheduleHealth({ games, practices: [], teams: teams.filter(t => t.divisionId === 'A'), rules: { twiceInADayAllowed: true, homeAwayTolerance: 1 } });
    assert.equal(yes.issues.some(i => i.kind === 'twice_in_a_day'), false);
  });

  it('a short team that no cancelled game explains is said on its own', () => {
    // Cardinals and Jays have two games, Twins and Orioles one: the plan is 2 and nothing was cancelled.
    const four = [...teams.filter(t => t.divisionId === 'A'), { id: 'jays', name: 'Jays', divisionId: 'A' }];
    const games = [g('A', 'cards', 'twins', '2026-06-01'), g('A', 'jays', 'orioles', '2026-06-01'), g('A', 'cards', 'jays', '2026-06-08')];
    const r = buildLeagueScheduleHealth({ games, practices: [], teams: four });
    const short = r.issues.filter(i => i.kind === 'short');
    assert.deepEqual(short, [
      { kind: 'short', teamIds: ['orioles'], have: 1, plan: 2, cancelled: null },
      { kind: 'short', teamIds: ['twins'], have: 1, plan: 2, cancelled: null },
    ]);
  });
});

describe('leagueHealthGameFromRow', () => {
  it('reads every field a game row carries', () => {
    const row = {
      id: 'g', division_id: 'd', home_team_id: 'h', away_team_id: 'a', scheduled_at: at('2026-06-01'), ends_at: null,
      status: 'scheduled', org_venue_id: 'v', org_venue_facility_id: 'f', location: 'Lions Park — Diamond 1',
    };
    assert.deepEqual(leagueHealthGameFromRow(row), {
      id: 'g', divisionId: 'd', homeTeamId: 'h', awayTeamId: 'a', scheduledAt: at('2026-06-01'), endsAt: null,
      status: 'scheduled', venueId: 'v', facilityId: 'f', location: 'Lions Park — Diamond 1',
    });
  });
});
