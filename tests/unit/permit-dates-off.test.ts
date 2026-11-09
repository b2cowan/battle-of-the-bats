import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { datesOffTaken, tookByDateOff, type PermitTime, type VenueFacilities } from '../../lib/permit-time.ts';
import { bookedThatDayWords, dayWithWeekday, takenCountWords, takenFlag, takenHeading, PERMIT_WORDS as W } from '../../lib/permit-words.ts';
import { leagueBooking, repEventBooking, type ClubBooking } from '../../lib/venue-clash.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import { buildDatesOffNotice } from '../../lib/permit-dates-off-view.ts';
import { kitCalendarLink } from '../../lib/admin-kit-nav.ts';
import { canOpenClubSchedules } from '../../lib/club-schedule-gate.ts';
import { hasCapability } from '../../lib/roles.ts';
import type { CalendarBooking } from '../../lib/club-calendar-view.ts';
import type { OrgRole } from '../../lib/types.ts';

/**
 * WHAT A PERMIT'S DATES OFF TOOK (Club Tier Stage 13c, C2 = A — owner 2026-11-08). The drawing's case: "Saturday diamonds,
 * December 2026" holds Kinsmen Park, every facility, Saturdays 9:00 a.m.–3:00 p.m., Nov 28 – Dec 19; Dec 5 and Dec 12 come
 * off. Eight bookings stand on them — 6 practices from the club's schedule and 2 house-league games — and the third
 * house-league game, postponed, is not one of them. ⚖ Only what THIS permit's own dates off took: never everything at the
 * park (the "Outside it" the owner removed on Oct 11).
 */

const KINSMEN = 'v-kinsmen', LIONS = 'v-lions';
const DA = 'f-da', DB = 'f-db';
const venues: VenueFacilities = new Map([[KINSMEN, [DA, DB]], [LIONS, ['f-d1']]]);

const december: PermitTime = {
  id: 'p-dec', startsOn: '2026-11-28', endsOn: '2026-12-19',
  blocks: [{ id: 'b-sat', venueId: KINSMEN, facilityIds: [], weekdays: [6], startTime: '09:00', endTime: '15:00', fromDate: null, untilDate: null }],
  datesOff: [{ day: '2026-12-05', note: null }, { day: '2026-12-12', note: null }],
};

const iso = (day: string, t: string) => zonedWallClockToUtc(day, t)!;
let n = 0;
const practice = (team: string, day: string, from: string, to: string, facility: string, venue = KINSMEN): ClubBooking =>
  repEventBooking({ id: `e${++n}`, team_id: team, event_type: 'practice', starts_at: iso(day, from), ends_at: iso(day, to), status: 'scheduled', org_venue_id: venue, org_venue_facility_id: facility, club_schedule_slot_id: `slot-${n}` }, { team })!;
const game = (day: string, from: string, to: string, facility: string, status = 'scheduled'): ClubBooking | null =>
  leagueBooking({ id: `g${++n}`, kind: 'game', scheduled_at: iso(day, from), ends_at: iso(day, to), status, org_venue_id: KINSMEN, org_venue_facility_id: facility }, { season: '2026 Fall House League' });

const DEC5 = '2026-12-05', DEC12 = '2026-12-12';
const drawn: ClubBooking[] = [
  game(DEC5, '11:00', '12:00', DA)!, game(DEC5, '12:00', '13:00', DB)!,
  practice('14U AA', DEC5, '13:00', '14:00', DA), practice('15U AA', DEC5, '13:00', '14:00', DB), practice('13U AAA', DEC5, '14:00', '15:00', DA),
  practice('14U AA', DEC12, '13:00', '14:00', DA), practice('15U AA', DEC12, '13:00', '14:00', DB), practice('13U AAA', DEC12, '14:00', '15:00', DA),
];
const postponed = game(DEC5, '10:00', '11:00', DB, 'postponed');

const take = (bookings: readonly ClubBooking[], from = '2026-11-08', others: PermitTime[] = [december]) =>
  datesOffTaken(december, bookings, others, venues, { from });

describe('what the dates off took — the drawing\'s case', () => {
  it('Dec 5 and Dec 12 took 8 bookings: 6 practices and 2 house-league games', () => {
    const days = take(drawn);
    assert.deepEqual(days.map(d => [d.day, d.bookings.length]), [[DEC5, 5], [DEC12, 3]]);
    const all = days.flatMap(d => d.bookings);
    assert.equal(all.filter(b => b.kind === 'practice').length, 6);
    assert.equal(all.filter(b => b.program === 'league' && b.kind === 'game').length, 2);
  });

  it('the postponed third game is not a booking at all: the pool never holds it', () => {
    assert.equal(postponed, null, 'a postponed league game vacates its slot (the clash rule\'s own constructor)');
  });

  it('the day\'s rows are in time order', () => {
    const [dec5] = take([...drawn].reverse());
    assert.deepEqual(dec5.bookings.map(b => b.ownerName), ['2026 Fall House League', '2026 Fall House League', '14U AA', '15U AA', '13U AAA']);
  });

  it('a booking moved off the day drops out', () => {
    const moved = drawn.filter(b => b.ownerName !== '13U AAA');
    const moving = practice('13U AAA', '2026-12-19', '14:00', '15:00', DA);
    assert.equal(take([...moved, moving]).flatMap(d => d.bookings).length, 6);
  });

  it('a date off already past is never asked: from Dec 6 on, only Dec 12 is left', () => {
    assert.deepEqual(take(drawn, '2026-12-06').map(d => d.day), [DEC12]);
  });

  it('a booking another permit still covers is not outside a permit, so this permit never lists it', () => {
    const summer: PermitTime = {
      id: 'p-other', startsOn: '2026-12-01', endsOn: '2026-12-31',
      blocks: [{ id: 'b-o', venueId: KINSMEN, facilityIds: [DA], weekdays: [6], startTime: '13:00', endTime: '15:00', fromDate: null, untilDate: null }],
      datesOff: [],
    };
    const [, dec12] = take(drawn, '2026-11-08', [december, summer]);
    assert.deepEqual(dec12.bookings.map(b => b.ownerName), ['15U AA'], 'Diamond A 1:00–3:00 p.m. is still held by the other permit');
  });

  it('⚖ never everything at the park: a 7:00 p.m. booking and a booking at another venue the same day are not listed', () => {
    const evening = practice('12U AA', DEC5, '19:00', '20:30', DA);
    const lions = practice('11U A', DEC5, '13:00', '14:00', 'f-d1', LIONS);
    assert.equal(tookByDateOff(december, DEC5, evening, [december], venues), false, 'the permit\'s own hours never held it');
    assert.equal(tookByDateOff(december, DEC5, lions, [december], venues), false, 'not at the permit\'s park');
    assert.equal(take([...drawn, evening, lions])[0].bookings.length, 5);
  });

  it('the form asks about a day before it is stored, and a day that took nothing says so', () => {
    const notYetOff: PermitTime = { ...december, datesOff: [] };
    const [d5] = datesOffTaken(notYetOff, drawn, [notYetOff], venues, { from: '2026-11-08', days: [DEC5] });
    assert.equal(d5.bookings.length, 5);
    const [d19] = datesOffTaken(notYetOff, drawn, [notYetOff], venues, { from: '2026-11-08', days: ['2026-12-19'] });
    assert.deepEqual(d19, { day: '2026-12-19', bookings: [] });
  });
});

describe('the words (the drawing\'s)', () => {
  it('the notice\'s heading, the row flag, the form\'s count', () => {
    assert.equal(takenHeading(8, [DEC5, DEC12]), '8 bookings are outside this permit now: Dec 5 and Dec 12 are dates off.');
    assert.equal(takenHeading(1, [DEC5]), '1 booking is outside this permit now: Dec 5 is a date off.');
    assert.equal(takenFlag(2, 8), '2 dates off · 8 bookings on them');
    assert.equal(takenFlag(1, 1), '1 date off · 1 booking on it');
    const dec5 = take(drawn)[0].bookings;
    assert.equal(takenCountWords(dec5), '3 practices and 2 house-league games');
    assert.equal(bookedThatDayWords(dec5), '3 practices and 2 house-league games. They stay booked until moved.');
    assert.equal(dayWithWeekday(DEC5), 'Sat, Dec 5');
    assert.equal(W.doorCalendar(DEC5), 'See Sat, Dec 5 on the Calendar');
    assert.equal(W.doorFix(6, 'Saturdays at Kinsmen, December 2026'), 'Fix the 6 practices in Saturdays at Kinsmen, December 2026');
    assert.equal(W.datesOffWhy, 'e.g. a city event', 'owner decision 1 (2026-11-08)');
  });
});

describe('the notice\'s doors, role by role — a door the reader cannot open is absent, never greyed', () => {
  // What each reader's Calendar shows of the 8 bookings (its own programs), as the Calendar read names them.
  const SCHEDULE = { scheduleId: 'sch-1', scheduleName: 'Saturdays at Kinsmen, December 2026' };
  const SEASON_DOOR = { label: 'Open the season', href: '/demo/admin/house-league/seasons/se-1/schedule' };
  const shownFor = (role: OrgRole) => {
    const out = new Map<string, CalendarBooking>();
    for (const b of drawn) {
      if (b.program === 'rep' && hasCapability(role, null, 'module_rep_teams')) {
        out.set(b.key, { key: b.key, who: b.ownerName, what: 'Practice', door: { label: 'Open', href: `/demo/admin/rep-teams/teams/${b.ownerName}/schedule` },
          clubSchedule: { slotId: b.clubSlotOf!, ...SCHEDULE, canOpen: canOpenClubSchedules({ planId: 'club', role }) } } as unknown as CalendarBooking);
      }
      if (b.program === 'league' && hasCapability(role, null, 'module_house_league')) {
        out.set(b.key, { key: b.key, who: 'Hawks vs Owls', what: 'U11 Pinto', door: SEASON_DOOR } as unknown as CalendarBooking);
      }
    }
    return out;
  };
  const noticeFor = (role: OrgRole) => buildDatesOffNotice(take(drawn), shownFor(role), {
    slug: 'demo',
    seesCalendar: !!kitCalendarLink({ base: '/demo/admin', canUse: c => hasCapability(role, null, c), isCanceled: false, tournamentTier: false }),
    canSchedules: canOpenClubSchedules({ planId: 'club', role }),
  }, new Map([[KINSMEN, 'Kinsmen Park']]))!;
  const doorsOf = (role: OrgRole) => noticeFor(role).doors.map(d => d.label);

  it('owner and admin: fix the practices, open the season\'s schedule, see the day on the Calendar', () => {
    for (const role of ['owner', 'admin'] as OrgRole[]) {
      assert.deepEqual(doorsOf(role), [
        'Fix the 6 practices in Saturdays at Kinsmen, December 2026',
        'Open 2026 Fall House League’s schedule',
        'See Sat, Dec 5 on the Calendar',
      ], role);
    }
  });
  it('league admin and registrar: the season\'s schedule and the Calendar, never the club\'s schedules', () => {
    for (const role of ['league_admin', 'league_registrar'] as OrgRole[]) {
      assert.deepEqual(doorsOf(role), ['Open 2026 Fall House League’s schedule', 'See Sat, Dec 5 on the Calendar'], role);
    }
  });
  it('treasurer: the list alone, each booking by its team or season and facility, with no door', () => {
    const n = noticeFor('treasurer');
    assert.deepEqual(n.doors, []);
    assert.equal(n.count, 8);
    assert.ok(n.groups.flatMap(g => g.rows).every(r => r.door === null));
    assert.deepEqual(n.groups[0].rows.map(r => r.title), [
      '2026 Fall House League', '2026 Fall House League', '14U AA', '15U AA', '13U AAA',
    ], 'the pool\'s own words (no facility names in this fixture)');
  });
  it('staff: a Calendar of tournaments shows none of these, so no Calendar door either', () => {
    assert.deepEqual(doorsOf('staff'), []);
  });
  it('the rows read the Calendar\'s way for a reader who sees them: the matchup, house league\'s division, the schedule', () => {
    const [dec5] = noticeFor('owner').groups;
    assert.equal(dec5.heading, 'Sat, Dec 5 · Kinsmen Park');
    assert.deepEqual(dec5.rows.map(r => [r.title, r.line, r.chip]), [
      ['Hawks vs Owls', 'House league · U11 Pinto', 'Game'],
      ['Hawks vs Owls', 'House league · U11 Pinto', 'Game'],
      ['14U AA', SCHEDULE.scheduleName, 'Practice'],
      ['15U AA', SCHEDULE.scheduleName, 'Practice'],
      ['13U AAA', SCHEDULE.scheduleName, 'Practice'],
    ]);
  });
});

describe('Permits is a place — moved, not copied (C1 = A)', () => {
  const page = readFileSync('app/[orgSlug]/admin/permits/page.tsx', 'utf8');
  const venues = readFileSync('app/[orgSlug]/admin/org/venues/page.tsx', 'utf8');
  it('the old address keeps working: ?view=permits lands on Permits', () => {
    assert.match(venues, /search\.get\('view'\) === 'permits'/);
    assert.match(venues, /router\.replace\(`\/\$\{slug\}\/admin\/permits`\)/);
  });
  it('the Venue library keeps its venues and loses the list: no switch, no permits read, no Add permit', () => {
    assert.doesNotMatch(venues, /ViewSwitch|AddPermitWindow|readPermitsYear|\/api\/admin\/org\/permits\?/);
  });
  it('the page sits in its place\'s frame (the bar names it) and keeps only its actions; ?permit=<id> opens one', () => {
    assert.match(readFileSync('app/[orgSlug]/admin/permits/layout.tsx', 'utf8'), /<PermitsFrame>\{children\}<\/PermitsFrame>/);
    assert.match(readFileSync('components/admin/kit/club/PermitsFrame.tsx', 'utf8'), /place\?\.key !== 'permits'/);
    assert.match(page, /<TabPageHeader title=\{PW\.placeTitle\}/);
    assert.match(page, /search\.get\('permit'\)/);
    assert.match(page, /takenFlag\(t\.dates, t\.bookings\)/, 'the row\'s flag, from the list read\'s `taken`');
  });
  it('the notice is in the permit window\'s read, its own read; the form counts each date off as it is picked', () => {
    const win = readFileSync('components/admin/kit/club/PermitWindows.tsx', 'utf8');
    assert.match(win, /<DatesOffNoticeBlock key=\{view\.updatedAt\}/);
    assert.match(win, /&taken=\$\{encodeURIComponent\(permitId\)\}/);
    assert.match(win, /<DayBookedNote q=\{q\} permitId=\{permitId\} day=\{o\.day\}/);
    assert.match(win, /action: 'booked-that-day'/);
    assert.match(win, /ctl\.abort\(\); window\.clearTimeout\(wait\)/, 'a superseded count is cancelled');
    assert.doesNotMatch(win, /placeholder="The dome is closed"/, 'owner decision 1');
  });
});

describe('one answer, no query of its own', () => {
  const src = readFileSync('lib/permit-dates-off.ts', 'utf8');
  it('the shared reader holds no .from(…) — it reads through the permit read, the booking pool and the Calendar', () => {
    assert.doesNotMatch(src, /\.from\(/);
    assert.doesNotMatch(src, /supabaseAdmin/);
    assert.match(src, /readClubBookings\(/);
    assert.match(src, /readPermitTimes\(/);
    assert.match(src, /datesOffTaken\(/, 'the one rule (lib/permit-time.ts §4)');
  });
  it('the rule asks the permit\'s answer twice — no second definition of "on a date off"', () => {
    const rule = readFileSync('lib/permit-time.ts', 'utf8');
    const body = rule.slice(rule.indexOf('export function tookByDateOff'), rule.indexOf('export function datesOffTaken'));
    assert.equal((body.match(/permitAnswer\(/g) ?? []).length, 2);
  });
  it('the route\'s list flag, the notice and the form count all call the shared reader', () => {
    const route = readFileSync('app/api/admin/org/permits/route.ts', 'utf8');
    assert.match(route, /readDatesOffTaken\(orgId, \{ today \}\)/, 'the list\'s flags');
    assert.match(route, /readDatesOffTaken\(orgId, \{ today, permitIds: \[takenId\] \}\)/, 'the notice');
    assert.match(route, /readDayTaken\(orgId,/, 'the form');
  });
});
