import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  buildLeagueScheduleHealth, DEFAULT_LEAGUE_HEALTH_RULES, leagueHealthGameOf, leagueHealthPracticeOf, leagueHealthRulesOf, leagueIssueWords,
  primeTimeCell, sameLeagueHealthRules,
  type LeagueHealthGame, type LeagueHealthIssue, type LeagueHealthPractice, type LeagueHealthTeam,
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
    assert.deepEqual(r.issues[3], { kind: 'unchecked', games: 0, practices: 2, keys: ['league_practice:p1', 'league_practice:p2'] });
  });

  it('says the four issues in the copy file\'s words, each with its door (step 6, d2)', () => {
    const name = new Map(teams.map(t => [t.id, t.name]));
    const said = r.issues.map(i => leagueIssueWords(i, { team: id => name.get(id)!, label: k => k, place: () => 'Kinsmen Park · Diamond 2', division: d => `Division ${d}` }));
    assert.deepEqual(said.map(x => [x.text, x.door]), [
      ['Tigers and Braves have 1 of 2 games. Their Jun 14 game was cancelled and not replayed.', 'show'],
      ['Cardinals vs Orioles was postponed from Jun 14 and still needs a new date.', 'date'],
      ['Cardinals has both games at home; Orioles has both away.', 'teams'],
      ['2 practices are at a typed place, so they can’t be checked for clashes.', 'show'],
    ]);
  });

  it('every team\'s games all fall on one time, so prime time is even; the plan is said per division', () => {
    assert.ok(r.teams.every(t => t.primeTime === 'even'));
    assert.equal(primeTimeCell(r.teams[0].primeTime), 'even');
    assert.deepEqual(r.plans, [{ divisionId: 'B', games: 2, schedule: 2, set: false }, { divisionId: 'A', games: 2, schedule: 2, set: false }]);
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
    const yes = buildLeagueScheduleHealth({ games, practices: [], teams: teams.filter(t => t.divisionId === 'A'), rules: { ...DEFAULT_LEAGUE_HEALTH_RULES, twiceInADayAllowed: true } });
    assert.equal(yes.issues.some(i => i.kind === 'twice_in_a_day'), false);
  });

  it('short teams that no cancelled game explains are said once per division and count (9d-2b Part 6)', () => {
    // Cardinals and Jays have two games, Twins and Orioles one: the plan is 2 and nothing was cancelled.
    const four = [...teams.filter(t => t.divisionId === 'A'), { id: 'jays', name: 'Jays', divisionId: 'A' }];
    const games = [g('A', 'cards', 'twins', '2026-06-01'), g('A', 'jays', 'orioles', '2026-06-01'), g('A', 'cards', 'jays', '2026-06-08')];
    const r = buildLeagueScheduleHealth({ games, practices: [], teams: four });
    const short = r.issues.filter(i => i.kind === 'short');
    assert.deepEqual(short, [
      { kind: 'short', teamIds: ['orioles', 'twins'], have: 1, plan: 2, cancelled: null },
    ]);
  });
});

describe('the season\'s rules, kept (9d-2b Part 6, d3)', () => {
  const division = (): LeagueHealthGame[] => [
    g('A', 'cards', 'orioles', '2026-06-01'), g('A', 'twins', 'cards', '2026-06-08'), g('A', 'orioles', 'twins', '2026-06-15'),
  ];
  const three = teams.filter(t => t.divisionId === 'A');

  it('read off the season and its divisions; a division with no games per team plays to the schedule', () => {
    const rules = leagueHealthRulesOf({ twiceInADayAllowed: true, homeAwayTolerance: 2 }, [{ id: 'A', gamesPerTeam: 4 }, { id: 'B', gamesPerTeam: null }]);
    assert.deepEqual(rules, { twiceInADayAllowed: true, homeAwayTolerance: 2, gamesPerTeam: { A: 4 } });
    assert.deepEqual(leagueHealthRulesOf(null, []), DEFAULT_LEAGUE_HEALTH_RULES);
  });

  it('two rule sets are the same when they say the same thing', () => {
    assert.ok(sameLeagueHealthRules(DEFAULT_LEAGUE_HEALTH_RULES, { twiceInADayAllowed: false, homeAwayTolerance: 1, gamesPerTeam: {} }));
    assert.ok(!sameLeagueHealthRules(DEFAULT_LEAGUE_HEALTH_RULES, { ...DEFAULT_LEAGUE_HEALTH_RULES, gamesPerTeam: { A: 2 } }));
    assert.ok(!sameLeagueHealthRules({ ...DEFAULT_LEAGUE_HEALTH_RULES, gamesPerTeam: { A: 2 } }, { ...DEFAULT_LEAGUE_HEALTH_RULES, gamesPerTeam: { A: 3 } }));
  });

  it('a games-per-team target the whole division falls short of is one line, and the plan says it was set', () => {
    const r = buildLeagueScheduleHealth({ games: division(), practices: [], teams: three, rules: { ...DEFAULT_LEAGUE_HEALTH_RULES, gamesPerTeam: { A: 4 } } });
    assert.deepEqual(r.issues.filter(i => i.kind === 'short'), [{ kind: 'short', teamIds: ['cards', 'orioles', 'twins'], have: 2, plan: 4, cancelled: null }]);
    assert.deepEqual(r.plans, [{ divisionId: 'A', games: 4, schedule: 2, set: true }]);
    assert.deepEqual(r.tiles.games, { onPlan: 0, teams: 3 });
    assert.equal(r.breakdown.games, 0);
    const name = new Map(teams.map(t => [t.id, t.name]));
    assert.equal(leagueIssueWords(r.issues[0], { team: id => name.get(id)!, label: k => k, place: () => '', division: d => d }).text,
      'Cardinals, Orioles and Twins have 2 of 4 games.');
  });

  it('a target at or under what every team has is on plan', () => {
    const r = buildLeagueScheduleHealth({ games: division(), practices: [], teams: three, rules: { ...DEFAULT_LEAGUE_HEALTH_RULES, gamesPerTeam: { A: 2 } } });
    assert.equal(r.score, 100);
    assert.deepEqual(r.issues, []);
  });

  it('a wider home-and-away tolerance takes Dev House League 2026\'s home/away issue away', () => {
    const tight = buildLeagueScheduleHealth({ games: devGames(), practices: [], teams });
    const loose = buildLeagueScheduleHealth({ games: devGames(), practices: [], teams, rules: { ...DEFAULT_LEAGUE_HEALTH_RULES, homeAwayTolerance: 2 } });
    assert.equal(tight.tiles.homeAway.off, 2);
    assert.equal(loose.tiles.homeAway.off, 0);
    assert.equal(loose.issues.some(i => i.kind === 'home_away'), false);
    assert.equal(loose.score - tight.score, 5);
  });
});

describe('the window\'s other sentences', () => {
  const ctx = { team: (id: string) => id[0].toUpperCase() + id.slice(1), label: (k: string) => (k.endsWith('p1') ? 'Twins practice' : 'Cards vs Orioles'), place: () => 'Kinsmen Park · Diamond 2', division: (d: string) => (d === 'U12' ? 'U12' : `Division ${d}`) };

  it('a clash names the place, the day, the clock and both bookings', () => {
    const issue: LeagueHealthIssue = { kind: 'clash', keys: ['league_game:g1', 'league_practice:p1'], venueId: 'v1', facilityId: 'f1', day: '2027-06-17', startMs: Date.parse('2027-06-17T22:00:00Z') };
    assert.equal(leagueIssueWords(issue, ctx).text, 'Kinsmen Park · Diamond 2 is booked twice on Thu, Jun 17 at 6:00 p.m.: Cards vs Orioles and Twins practice.');
    assert.equal(leagueIssueWords(issue, ctx).tone, 'error');
  });

  it('twice in a day and byes are the generator\'s sentences', () => {
    assert.equal(leagueIssueWords({ kind: 'twice_in_a_day', teamId: 'tigers', day: '2027-06-17' }, ctx).text, 'Tigers plays twice on Thu, Jun 17.');
    assert.equal(leagueIssueWords({ kind: 'byes_back_to_back', teamId: 'rays', weeks: ['2027-06-07', '2027-06-14'] }, ctx).text, 'Rays has a bye two weeks running, Jun 7 and Jun 14.');
  });

  it('home and away past two games, a lone short team, an undated game, a typed game and practice', () => {
    assert.equal(leagueIssueWords({ kind: 'home_away', divisionId: 'A', teams: [{ teamId: 'cards', home: 3, away: 0 }, { teamId: 'jays', home: 1, away: 4 }] }, ctx).text,
      'Cards has all 3 games at home; Jays has 1 game at home and 4 away.');
    assert.equal(leagueIssueWords({ kind: 'short', teamIds: ['twins'], have: 1, plan: 2, cancelled: null }, ctx).text, 'Twins has 1 of 2 games.');
    assert.equal(leagueIssueWords({ kind: 'postponed', gameId: 'g', homeTeamId: 'cards', awayTeamId: 'twins', day: null }, ctx).text, 'Cards vs Twins still needs a date.');
    assert.equal(leagueIssueWords({ kind: 'unchecked', games: 1, practices: 1, keys: [] }, ctx).text, '1 game and 1 practice are at a typed place, so they can’t be checked for clashes.');
    assert.equal(leagueIssueWords({ kind: 'unchecked', games: 0, practices: 1, keys: [] }, ctx).text, '1 practice is at a typed place, so it can’t be checked for clashes.');
  });
});

describe('a division with teams and no games (9d-2a /review call 2)', () => {
  const u10 = [{ id: 'a1', name: 'Aces', divisionId: 'U10' }, { id: 'a2', name: 'Bats', divisionId: 'U10' }];
  const u12 = [{ id: 'c1', name: 'Cubs', divisionId: 'U12' }, { id: 'c2', name: 'Dukes', divisionId: 'U12' }];
  const clean = [g('U10', 'a1', 'a2', '2027-06-07'), g('U10', 'a2', 'a1', '2027-06-14')];

  it('is an issue, and its teams are not on plan (it used to fall out of the score: 100)', () => {
    const r = buildLeagueScheduleHealth({ games: clean, practices: [], teams: [...u10, ...u12] });
    assert.deepEqual(r.issues.filter(i => i.kind === 'no_games'), [{ kind: 'no_games', divisionId: 'U12', teams: 2 }]);
    assert.deepEqual(r.tiles.games, { onPlan: 2, teams: 4 });
    assert.equal(r.breakdown.games, 15);
    assert.ok(r.score < 100);
    const alone = buildLeagueScheduleHealth({ games: clean, practices: [], teams: u10 });
    assert.equal(alone.score, 100);
    assert.equal(alone.issues.some(i => i.kind === 'no_games'), false);
  });

  it('says the calendar\'s settled pair, and has no door', () => {
    const r = buildLeagueScheduleHealth({ games: clean, practices: [], teams: [...u10, ...u12] });
    const said = leagueIssueWords(r.issues.find(i => i.kind === 'no_games')!, { team: id => id, label: k => k, place: () => '', division: d => d });
    assert.equal(said.text, 'U12 has no games yet. Generate the whole season, or add games one at a time.');
    assert.equal(said.door, 'none');
    assert.equal(said.tone, 'warning');
  });

  it('a season with no games at all has nothing to score, so no division is flagged', () => {
    const r = buildLeagueScheduleHealth({ games: [], practices: [], teams: [...u10, ...u12] });
    assert.deepEqual(r.issues, []);
    assert.equal(r.timedGames, 0);
  });
});

describe('prime time', () => {
  // Three teams, Tuesday evenings and one Saturday morning: the Saturday is the rarest time.
  const sat = (home: string, away: string, day: string) => ({ ...g('A', home, away, day), scheduledAt: `${day}T14:00:00+00:00` });
  const tue = (home: string, away: string, day: string) => ({ ...g('A', home, away, day), scheduledAt: `${day}T22:00:00+00:00` });
  const three = teams.filter(t => t.divisionId === 'A');

  it('one team with the only Saturday morning games, the others none: the cell says each share', () => {
    const games = [sat('cards', 'orioles', '2026-06-06'), tue('twins', 'cards', '2026-06-09'), tue('orioles', 'twins', '2026-06-16'), tue('cards', 'twins', '2026-06-23'), tue('orioles', 'cards', '2026-06-30'), sat('cards', 'orioles', '2026-07-04')];
    const r = buildLeagueScheduleHealth({ games, practices: [], teams: three });
    const of = (id: string) => primeTimeCell(r.teams.find(t => t.teamId === id)!.primeTime);
    assert.equal(of('cards'), '2 Saturday mornings');
    assert.equal(of('twins'), '0 Saturday mornings');
  });

  it('shares within one of each other are even', () => {
    const games = [sat('cards', 'orioles', '2026-06-06'), tue('twins', 'cards', '2026-06-09'), tue('orioles', 'twins', '2026-06-16'), tue('cards', 'twins', '2026-06-23')];
    const r = buildLeagueScheduleHealth({ games, practices: [], teams: three });
    assert.ok(r.teams.every(t => t.primeTime === 'even'));
  });
});

describe('the page\'s rows', () => {
  it('a game and a practice as the page holds them read the same as their rows', () => {
    const game = { id: 'g', seasonId: 's', divisionId: 'd', homeTeamId: 'h', awayTeamId: 'a', scheduledAt: at('2026-06-01'), endsAt: null, orgVenueId: 'v', orgVenueFacilityId: 'f', location: null, homeScore: null, awayScore: null, status: 'scheduled' as const, notes: null, slotUseId: null, movedFrom: null, createdAt: '', updatedAt: '' };
    assert.deepEqual(leagueHealthGameOf(game), { id: 'g', divisionId: 'd', homeTeamId: 'h', awayTeamId: 'a', scheduledAt: at('2026-06-01'), endsAt: null, status: 'scheduled', venueId: 'v', facilityId: 'f', location: null });
    const practice = { id: 'p', seasonId: 's', divisionId: null, teamId: 't', scheduledAt: null, endsAt: null, orgVenueId: null, orgVenueFacilityId: null, location: 'Eastview', notes: null, status: 'scheduled' as const, recurrenceGroupId: null, clubScheduleSlotId: 'slot', createdAt: '', updatedAt: '' };
    assert.deepEqual(leagueHealthPracticeOf(practice), { id: 'p', divisionId: null, teamId: 't', scheduledAt: null, endsAt: null, status: 'scheduled', venueId: null, facilityId: null, location: 'Eastview', clubSlotId: 'slot' });
  });
});

describe('the season\'s schedule wears it (step 6, d1)', () => {
  const PAGE = readFileSync('app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx', 'utf8');
  const WINDOW = readFileSync('components/admin/kit/club/league/schedule/LeagueHealthWindow.tsx', 'utf8');

  it('the tournament\'s header button opens the league\'s window, which never arrives open', () => {
    assert.match(PAGE, /<HealthButton\b/);
    assert.match(PAGE, /<LeagueHealthWindow\b/);
    assert.match(PAGE, /const \[healthOpen, setHealthOpen\] = useState\(false\);/);
  });

  it('health is worked out from the season the page holds: no read of its own, no strip above the views', () => {
    assert.match(PAGE, /buildLeagueScheduleHealth\(\{/);
    assert.doesNotMatch(PAGE, /schedule\/health/, 'the old health route is retired');
    assert.doesNotMatch(PAGE, /with another at the same time|not being checked for double-bookings/, 'the old warning strip is gone');
  });

  it('the window is the tournament\'s frame, tiles, rows and rules editor', () => {
    assert.match(WINDOW, /<HealthWindowFrame\b/);
    assert.match(WINDOW, /<Metric\b/);
    assert.match(WINDOW, /<IssueRow\b/);
    assert.match(WINDOW, /<HealthRulesDoor\b/);
    assert.match(WINDOW, /<HealthRulesEditor\b/);
  });

  it('Adjust the rules is offered only to whoever runs the season, and the page scores by the season\'s rules (9d-2b Part 6, d3)', () => {
    assert.match(WINDOW, /\{onSaveRules && <HealthRulesDoor\b/, 'no save, no door');
    assert.match(PAGE, /onSaveRules=\{canManage \? saveHealthRules : undefined\}/);
    assert.match(PAGE, /leagueHealthRulesOf\(season, divisions\)/);
    assert.match(PAGE, /schedule\/rules\$\{orgQuery\}/);
  });

  it('a door that leaves the window waits while the rules are unsaved; Team detail stays', () => {
    assert.match(WINDOW, /if \(dirty && x\.door !== 'teams'\) return null;/);
  });
});
