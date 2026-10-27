import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { projectClubSlots, type RawClubSlot } from '../../lib/league-club-schedule.ts';

/**
 * CLUB TIER STAGE 11b PART 3 — THE LEAGUE ADMIN IN THE CLUB'S SCHEDULE (drawings tab 5, ruled card 11). The read is an
 * ALLOW-LIST: a slot's day, clock, place and holder, and nothing of the club's money, asks, sends or bill. Rep team names
 * reach only a viewer who can open Rep teams. These tests pin the keys, so a new field is a decision, not a drift.
 */

const U12 = '11111111-1111-4111-8111-111111111111';
const SEASON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const slot = (id: string, day: string, extra: Partial<RawClubSlot> = {}): RawClubSlot => ({
  id, venueId: 'v1', facilityId: 'f1', startsAt: `${day}T22:00:00.000Z`, day, weekday: 2, startClock: '18:00', endClock: '19:30',
  teamIds: [], houseLeague: false, removed: false, ...extra,
});

const raw: RawClubSlot[] = [
  slot('hl1', '2027-06-15', { houseLeague: true }),
  slot('hl2', '2027-06-22', { houseLeague: true }),
  slot('hl3', '2027-06-29', { houseLeague: true }),
  slot('old', '2027-06-08', { houseLeague: true }),
  slot('rep1', '2027-06-18', { teamIds: ['t1'], weekday: 5 }),
  slot('open1', '2027-06-20', { weekday: 7 }),
  slot('gone', '2027-06-16', { houseLeague: true, removed: true, weekday: 3 }),
];

const base = {
  slots: raw, week: { from: '2027-06-14', to: '2027-06-20' }, seasonId: SEASON,
  uses: new Map([['hl1', { seasonId: SEASON, use: { divisionId: U12, kind: 'games' as const } }]]),
  final: true, now: '2027-01-01T00:00:00.000Z', inSeason: () => true,
};

describe('The club schedule a league admin reads — an allow-list', () => {
  it('a slot carries exactly these keys, and its holder only its own', () => {
    const out = projectClubSlots({ ...base, teamName: new Map([['t1', '15U AAA']]) });
    for (const s of out) {
      assert.deepEqual(Object.keys(s).sort(),
        ['canUse', 'day', 'endClock', 'facilityId', 'holder', 'id', 'repeats', 'startClock', 'startsAt', 'venueId']);
    }
    const keys = new Set(out.map(s => Object.keys(s.holder).sort().join(',')));
    assert.deepEqual([...keys].sort(), ['kind', 'kind,otherSeason,use', 'kind,teams']);
  });

  it('answers the week only, and never a removed slot', () => {
    const out = projectClubSlots({ ...base, teamName: null });
    assert.deepEqual(out.map(s => s.id), ['hl1', 'rep1', 'open1']);
  });

  it('a rep team’s name never reaches a viewer without Rep teams', () => {
    const out = projectClubSlots({ ...base, teamName: null });
    assert.deepEqual(out.find(s => s.id === 'rep1')!.holder, { kind: 'rep', teams: null });
    assert.ok(!JSON.stringify(out).includes('15U'));
    const named = projectClubSlots({ ...base, teamName: new Map([['t1', '15U AAA']]) });
    assert.deepEqual(named.find(s => s.id === 'rep1')!.holder, { kind: 'rep', teams: ['15U AAA'] });
  });

  it('a house-league slot carries its use; another season’s use is not this season’s to read or change', () => {
    const out = projectClubSlots({ ...base, teamName: null });
    assert.deepEqual(out[0].holder, { kind: 'house_league', use: { divisionId: U12, kind: 'games' }, otherSeason: false });
    assert.equal(out[0].canUse, true);
    const other = projectClubSlots({ ...base, teamName: null, uses: new Map([['hl1', { seasonId: OTHER, use: { divisionId: U12, kind: 'games' as const } }]]) });
    assert.deepEqual(other[0].holder, { kind: 'house_league', use: null, otherSeason: true });
    assert.equal(other[0].canUse, false);
  });

  it('a date can change only when it is still to come, in the season, on a final schedule', () => {
    assert.equal(projectClubSlots({ ...base, teamName: null, now: '2028-01-01T00:00:00.000Z' })[0].canUse, false);
    assert.equal(projectClubSlots({ ...base, teamName: null, inSeason: () => false })[0].canUse, false);
    assert.equal(projectClubSlots({ ...base, teamName: null, final: false })[0].canUse, false);
    assert.equal(projectClubSlots({ ...base, teamName: null }).find(s => s.id === 'rep1')!.canUse, false);
  });

  it('Repeats reads the same weekday, clock, place and holder across the schedule', () => {
    const out = projectClubSlots({ ...base, teamName: null });
    assert.equal(out[0].repeats, 'Every Tuesday at 6:00 p.m., Jun 8 – 29');
    assert.equal(out.find(s => s.id === 'rep1')!.repeats, null);
  });
});

describe('The route reads the projection, never the club’s schedule view', () => {
  it('no house-league file passes scheduleView, and the route makes no module check of its own', () => {
    const route = readFileSync('app/api/admin/house-league/seasons/[seasonId]/club-schedule/[scheduleId]/route.ts', 'utf8');
    const server = readFileSync('lib/league-club-schedule-server.ts', 'utf8');
    assert.ok(!/scheduleView\s*\(/.test(route) && !/scheduleView\s*\(/.test(server));
    assert.ok(!/canOpenModule\(/.test(route));
    assert.ok(/readClubTeams\(p\.orgId, \{ repTeams: true \}\)/.test(server) && /repTeams \?/.test(server),
      'a rep team’s name is read only when the viewer can open Rep teams');
  });
});
