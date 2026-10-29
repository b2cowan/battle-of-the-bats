import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { changedScheduleGameIds, scheduleGames, scheduleInitialSelection, scheduleLandingDay, splitEarlierToday, visibleScheduleGames } from '../../lib/public-schedule.ts';
import { gameRowView } from '../../lib/public-game-row.ts';
import type { Division, Game, PublicTeam, Tournament } from '../../lib/types.ts';

const today = '2026-10-29';
const now = new Date('2026-10-29T16:00:00Z'); // noon Toronto
const divisions = [{ id: 'u11', name: 'U11', scheduleVisibility: 'published' },
  { id: 'u13', name: 'U13', scheduleVisibility: 'published' },
  { id: 'secret', name: 'Held back', scheduleVisibility: 'unpublished' }] as Division[];
const teams = [{ id: 'a', divisionId: 'u11', name: 'Falcons', coach: 'Dana Chen', status: 'accepted' },
  { id: 'b', divisionId: 'u13', name: 'Bears', coach: '', status: 'accepted' }] as PublicTeam[];
const tournament = { settings: { format: 'round_robin_playoffs' } } as Tournament;
const game = (id: string, extra: Partial<Game> = {}): Game => ({ id, tournamentId: 't', divisionId: 'u11',
  homeTeamId: 'a', awayTeamId: 'b', date: today, time: '15:00', status: 'scheduled', location: '', ...extra });
const pick = (extra: Partial<Parameters<typeof scheduleInitialSelection>[0]> = {}) => scheduleInitialSelection({
  games: [], divisions, teams, tournament, preference: null, followedTeamId: null, highlightId: null, today, now, ...extra,
});
const select = (games: Game[], extra: Partial<Parameters<typeof scheduleGames>[0]> = {}) => scheduleGames({ games, teams, divisions, division: '', stage: 'pool', ...extra });

describe('the preview Schedule: landing and access', () => {
  it('a first visit opens All divisions; a remembered name still wins', () => {
    assert.equal(pick().division, '');
    assert.equal(pick({ preference: 'U13' }).division, 'u13');
    assert.equal(pick({ preference: 'An old division' }).division, '');
  });
  it('following jumps to its division without filtering its opponents out', () => {
    assert.equal(pick({ followedTeamId: 'b', preference: 'U11' }).division, 'u13');
    assert.equal(select([game('one'), game('two', { homeTeamId: 'c', awayTeamId: 'd' })]).games.length, 2);
  });
  it('a deep link beats the followed division, playoff-day default and remembered day', () => {
    const result = pick({ games: [game('target', { date: '2026-10-28' }), game('live-playoff', { isPlayoff: true })],
      followedTeamId: 'b', preference: 'U13', highlightId: 'target' });
    assert.deepEqual(result, { division: 'u11', stage: 'pool', day: '2026-10-28', highlight: 'target' });
  });
  it('withheld and orphan games reach no chips, searches, fold, calendar source or deep link', () => {
    const hidden = game('hidden', { divisionId: 'secret', date: '2027-01-01', status: 'completed' });
    const all = [game('public'), hidden, game('orphan', { divisionId: 'missing' })];
    assert.deepEqual(visibleScheduleGames(all, divisions).map(g => g.id), ['public']);
    assert.deepEqual(select(all, { query: 'Dana' }).games.map(g => g.id), ['public']);
    assert.deepEqual(select(all).dates, [today]);
    assert.equal(pick({ games: all, highlightId: 'hidden' }).highlight, null);
    assert.deepEqual(splitEarlierToday(select(all).games, today, true, now).earlier, []);
  });
  it('playoff day opens Playoffs once; the format pins one-stage events', () => {
    assert.equal(pick({ games: [game('p', { isPlayoff: true })] }).stage, 'playoff');
    assert.equal(pick({ games: [game('p', { isPlayoff: true })], tournament: { settings: { format: 'exhibition' } } as Tournament }).stage, 'pool');
    assert.equal(pick({ tournament: { settings: { format: 'playoff_only' } } as Tournament }).stage, 'playoff');
  });
  it('day landing handles before, today, gap days, after, explicit picks and search', () => {
    const dates = ['2026-10-28', today, '2026-11-01'];
    assert.equal(scheduleLandingDay(dates, '2026-10-01', null), '2026-10-28');
    assert.equal(scheduleLandingDay(dates, today, null), today);
    assert.equal(scheduleLandingDay(dates, '2026-10-30', null), '2026-11-01');
    assert.equal(scheduleLandingDay(dates, '2026-11-02', null), '2026-11-01');
    assert.equal(scheduleLandingDay(dates, today, '2026-10-28'), '2026-10-28');
    assert.equal(scheduleLandingDay(dates, today, 'invalid'), today);
    assert.equal(scheduleLandingDay(dates, today, today, true), 'all');
  });
});

describe('the preview Schedule: game lists and live updates', () => {
  it('search matches public team and coach names, not wholly unresolved slots', () => {
    const list = [game('named'), game('tbd', { homeTeamId: '', awayTeamId: '' })];
    assert.deepEqual(select(list, { query: 'chen' }).games.map(g => g.id), ['named']);
    assert.deepEqual(select(list, { query: 'FALCONS' }).games.map(g => g.id), ['named']);
    assert.deepEqual(select(list, { query: 'TBD' }).games, []);
    assert.deepEqual(select(list, { query: 'absent' }).games, []);
  });
  it('My games uses participant ids across dates, not similar team names or unresolved slots', () => {
    const list = [game('real'), game('slot', { homeTeamId: '', awayTeamId: '', homePlaceholder: 'Falcons' })];
    assert.deepEqual(select(list, { myTeamId: 'a' }).games.map(g => g.id), ['real']);
  });
  it('a many-day event has distinct game dates; dateless games sort last', () => {
    const list = Array.from({ length: 7 }, (_, i) => game(`d${i}`, { date: `2026-11-0${i + 1}` }));
    list.push(game('duplicate', { date: '2026-11-01' }), game('tbd', { date: '' }));
    assert.equal(select(list).dates.length, 7);
    assert.equal(select(list).games.at(-1)?.id, 'tbd');
  });
  it('pool tags use resolved participants and suppress cross-pool games', () => {
    const poolDivisions = [{ ...divisions[0], pools: [{ id: 'pa', name: 'Pool A' }, { id: 'pb', name: 'Pool B' }] }] as Division[];
    const poolTeams = [{ ...teams[0], poolId: 'pa' }, { ...teams[1], divisionId: 'u11', poolId: 'pa' },
      { ...teams[1], id: 'c', divisionId: 'u11', poolId: 'pb' }] as PublicTeam[];
    const result = select([game('same'), game('cross', { awayTeamId: 'c' })], { divisions: poolDivisions, teams: poolTeams });
    assert.equal(result.poolTags.get('same'), 'Pool A');
    assert.equal(result.poolTags.get('cross'), null);
  });
  it('only today’s confirmed finals fold, in chronological order', () => {
    const list = [game('yesterday', { date: '2026-10-28', status: 'completed' }),
      game('final', { status: 'completed', time: '09:00' }), game('unofficial', { status: 'submitted', time: '08:00' }),
      game('live', { time: '11:30' }), game('cancelled', { status: 'cancelled' })];
    const result = splitEarlierToday(select(list).games, today, true, now);
    assert.deepEqual(result.earlier.map(g => g.id), ['final']);
    assert.deepEqual(result.remaining.map(g => g.id), ['yesterday', 'unofficial', 'live', 'cancelled']);
    assert.deepEqual(splitEarlierToday(select(list).games, today, false, now).earlier.map(g => g.id), ['unofficial', 'final']);
  });
  it('a live-to-final refresh moves once to the fold; changed ids animate, new ids do not', () => {
    const live = game('live', { time: '11:30', homeScore: 2, awayScore: 1 });
    const next = [{ ...live, status: 'completed' as const, homeScore: 3 }, game('new')];
    assert.deepEqual(changedScheduleGameIds([live, game('removed')], next), ['live']);
    assert.deepEqual(changedScheduleGameIds(next, next), []);
    const result = splitEarlierToday(select(next).games, today, true, now);
    assert.deepEqual(result.earlier.map(g => g.id), ['live']);
    assert.deepEqual(result.remaining.map(g => g.id), ['new']);
  });
  it('finished Schedule rows keep time, round, field and the unofficial state', () => {
    const view = gameRowView(game('score', { time: '09:00', status: 'submitted', homeScore: 3, awayScore: 2 }),
      { home: 'Falcons', away: 'Bears' }, 'U11 · Diamond 2', today, { state: 'unofficial', round: 'Semifinal', schedule: true });
    assert.equal(view.head, '9:00 a.m.');
    assert.equal(view.when, 'Semifinal');
    assert.equal(view.sub, 'U11 · Diamond 2');
    assert.equal(view.status, 'unofficial');
    assert.equal(view.sides[0].name, 'Falcons');
  });
});
