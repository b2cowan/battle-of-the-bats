import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { calendarOutside, permitDoor, type TakenDay } from '../../lib/permit-dates-off-view.ts';
import { leagueBooking, repEventBooking, type ClubBooking } from '../../lib/venue-clash.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import { buildLeagueScheduleHealth, leagueIssueWords, type LeagueHealthGame } from '../../lib/league-schedule-health.ts';
import { filtersQuery, readFiltersQuery, type CalendarBooking, type CalendarProgram } from '../../lib/club-calendar-view.ts';

/**
 * CLUB TIER STAGE 13c SESSION B — telling people away from the permit (C3 = A, F-XR-6; owner 2026-11-08). The Overview's
 * "Outside the permit · N" and the Permits row's pill, the Calendar's day mark, an empty week's "Next:", and house
 * league's Schedule health lines. ⚖ Every surface calls the permit's ONE answer (`readDatesOffTaken`, the shared rule's
 * tests in permit-dates-off.test.ts); none of them moves, blocks or tells anyone (warns, never blocks).
 */

const read = (p: string) => readFileSync(p, 'utf8');
const iso = (day: string, t: string) => zonedWallClockToUtc(day, t)!;
const DEC5 = '2026-12-05', DEC12 = '2026-12-12';

describe('B1 · "Outside the permit · N": owner and admin only, its own read after the brief', () => {
  const provider = read('components/admin/kit/club/ClubBriefProvider.tsx');
  const route = read('app/api/admin/org/permits/route.ts');
  const hub = read('components/admin/kit/club/ClubHubKit.tsx');

  it('the measured gate: never inside the brief — the brief route reads no permit', () => {
    assert.doesNotMatch(read('app/api/admin/club-brief/route.ts'), /permit/i);
  });
  it('the provider asks only after the brief has answered, and only for the owner and an admin on a plan with permits', () => {
    assert.match(provider, /\(userRole === 'owner' \|\| userRole === 'admin'\)\s*&& hasOrgVenueLibrary\(currentOrg\.planId\)/);
    assert.match(provider, /if \(!asksOutside \|\| !orgSlug \|\| !briefAnswer\) return;/);
    assert.match(provider, /\/api\/admin\/org\/permits\?orgSlug=\$\{encodeURIComponent\(orgSlug\)\}&outside=1/);
    assert.match(provider, /\}, \[asksOutside, orgSlug, briefAnswer, permitsLeft\]\);/, 'and again on leaving Permits, where a date off changes (/review)');
    assert.match(read('lib/permit-lookup.ts'), /\.not\('permit_id', 'is', null\)/, 'a schedule\'s own dates off are not a permit\'s (/review)');
  });
  it('with filters on, a day is marked only while one of its marked bookings is drawn (/review)', () => {
    const views = read('components/admin/kit/club/ClubCalendarViews.tsx');
    assert.match(views, /day in outside\.days && !!drawn\?\.some\(b => outside\.keys\.has\(b\.key\)\)/);
    assert.match(views, /const taken = dayMarked\(outside, d, list\);/, 'Month too');
  });
  it('the route refuses everyone else, and a scoped admin (review item a: a scoped reader never gets a count)', () => {
    assert.match(route, /\(ctx\.role !== 'owner' && ctx\.role !== 'admin'\) \|\| ctx\.assignedTournamentIds !== null\) return forbidden\(\)/);
    assert.match(route, /outside: clubTaken\(taken, times\.venueName\)/, 'each booking once (review item e)');
  });
  it('the card shows only while true, after the cards that exist, and its door is a door only into Permits for someone who can open it', () => {
    assert.match(hub, /if \(outside && outside\.count > 0 && permitsLink\) \{\s*extraCards\.push\(/);
    assert.match(hub, /href: permitDoor\(permitsLink\.href, outside\.permitIds\)/, 'the one door rule, the Calendar\'s too');
    assert.equal(permitDoor('/demo/admin/permits', ['p1']), '/demo/admin/permits?permit=p1');
    assert.equal(permitDoor('/demo/admin/permits', ['p1', 'p2']), '/demo/admin/permits');
  });
  it('the Permits row and the More sheet\'s row carry the same N, from the one provider value', () => {
    assert.match(read('components/admin/kit/useAdminKitNav.ts'), /permitsCount: club\.outside\?\.count \?\? 0/);
    assert.match(read('components/admin/kit/AdminKitRail.tsx'), /count=\{permitsCount\} countLabel=\{PW\.outsideCountLabel\(permitsCount\)\}/);
    assert.match(read('components/admin/kit/AdminKitBottomNav.tsx'), /\{permitsLink && row\(permitsLink, permitsCount\)\}/);
  });
});

describe('B2 · the Calendar\'s day mark: what the dates off took, as THIS reader\'s Calendar shows it', () => {
  let n = 0;
  const practice = (team: string, day: string, slot: string | null = null): ClubBooking =>
    repEventBooking({ id: `e${++n}`, team_id: team, event_type: 'practice', starts_at: iso(day, '13:00'), ends_at: iso(day, '14:00'), status: 'scheduled', org_venue_id: 'v', org_venue_facility_id: 'f', club_schedule_slot_id: slot }, { team })!;
  const game = (day: string): ClubBooking =>
    leagueBooking({ id: `g${++n}`, kind: 'game', scheduled_at: iso(day, '11:00'), ends_at: iso(day, '12:00'), status: 'scheduled', org_venue_id: 'v', org_venue_facility_id: 'f' }, { season: 'Fall' })!;
  const shownOf = (b: ClubBooking, day: string, extra: Partial<CalendarBooking> = {}) =>
    ({ key: b.key, day, state: null, clubSchedule: null, ...extra }) as Pick<CalendarBooking, 'key' | 'day' | 'state' | 'clubSchedule'>;

  const g5 = game(DEC5), a = practice('14U AA', DEC5, 'slot-1'), b = practice('15U AA', DEC5, 'slot-1'), p12 = practice('13U AAA', DEC12);
  const taken = new Map<string, TakenDay[]>([['p-dec', [{ day: DEC5, bookings: [g5, a, b] }, { day: DEC12, bookings: [p12] }]]]);
  /** A Calendar read's own pool → Calendar key map: empty where each booking is drawn under its own key. */
  const NO_MAP = new Map<string, string>();

  it('marks the bookings the reader sees, with the day\'s door to that permit', () => {
    const out = calendarOutside(taken, [shownOf(g5, DEC5), shownOf(p12, DEC12)], NO_MAP, '/demo/admin/permits')!;
    assert.deepEqual(out.keys, [g5.key, p12.key]);
    assert.deepEqual(out.days, { [DEC5]: '/demo/admin/permits?permit=p-dec', [DEC12]: '/demo/admin/permits?permit=p-dec' });
  });
  it('a shared slot ("teams at once") is one Calendar booking under its first team\'s key: the slot finds it', () => {
    const merged = shownOf(practice('14U AA', DEC5), DEC5, { key: 'rep_event:other', clubSchedule: { slotId: 'slot-1', scheduleId: 's', scheduleName: 'S' } });
    assert.deepEqual(calendarOutside(taken, [merged], NO_MAP, null)!.keys, ['rep_event:other']);
  });
  it('a tournament game is found the Calendar\'s way, on its day\'s booking (the read\'s own key map, as the permit line is)', () => {
    const tg = { ...g5, key: 'tournament_game:t1', program: 'tournament' as const };
    const tday = new Map<string, TakenDay[]>([['p-dec', [{ day: DEC5, bookings: [tg] }]]]);
    const out = calendarOutside(tday, [{ key: `tday:t:${DEC5}`, day: DEC5, state: null, clubSchedule: null }],
      new Map([['tournament_game:t1', `tday:t:${DEC5}`]]), null)!;
    assert.deepEqual(out.keys, [`tday:t:${DEC5}`]);
  });
  it('a called-off booking is never marked; a booking the reader\'s Calendar does not show is never named', () => {
    assert.equal(calendarOutside(taken, [shownOf(g5, DEC5, { state: 'postponed' })], NO_MAP, null), null);
    assert.equal(calendarOutside(taken, [], NO_MAP, '/demo/admin/permits'), null, 'a staff Calendar showing none of them: no mark, no door');
  });
  it('a reader who cannot open Permits gets the chip with no door; two permits on a day → Permits', () => {
    assert.equal(calendarOutside(taken, [shownOf(g5, DEC5)], NO_MAP, null)!.days[DEC5], null);
    const two = new Map([...taken, ['p-twin', [{ day: DEC5, bookings: [g5] }]]]);
    assert.equal(calendarOutside(two, [shownOf(g5, DEC5)], NO_MAP, '/demo/admin/permits')!.days[DEC5], '/demo/admin/permits');
  });
  it('the route reads the shared answer bounded to the range on screen, from today on, and never fails the Calendar over it', () => {
    const route = read('app/api/admin/club-calendar/route.ts');
    assert.match(route, /readDatesOffTaken\(ctx\.org\.id, \{ from: window\.from > today \? window\.from : today, nowMs: Date\.now\(\), through: window\.to \}\)/);
    assert.match(route, /\.catch\(e => \{ console\.error\('\[club-calendar\] the dates-off read failed \(no marks\):'/);
    assert.match(route, /calendarOutside\(taken, read\.bookings, calendarKeyOf, permitsHref\(\)\)/);
    assert.match(route, /const \[\{ calendarKeyOf, \.\.\.read \}, taken\]/, 'the key map is never sent');
  });
});

describe('B4 · an empty week names the next event: the band\'s own reader, no new calendar query', () => {
  it('the band and the Calendar\'s "Next:" call one reader', () => {
    assert.match(read('lib/club-band-read.ts'), /await readComingBookings\(/);
    assert.doesNotMatch(read('lib/club-band-read.ts'), /readClubCalendar\(/);
    const route = read('app/api/admin/club-calendar/route.ts');
    assert.match(route, /readComingBookings\(reader, nextFrom > today \? nextFrom : today\)/);
    assert.match(route, /coming\.find\(b => matchesFilters\(b, filters\)\)/, 'with filters on, the next MATCHING event');
  });
  it('the filters travel to the server and back unchanged', () => {
    const f = { venues: new Set(['v1', 'elsewhere']), programs: new Set<CalendarProgram>(['rep']), teams: new Set(['t1']), clashesOnly: true };
    const back = readFiltersQuery(new URLSearchParams(filtersQuery(f).slice(1)));
    assert.deepEqual([...back.venues], ['v1', 'elsewhere']);
    assert.deepEqual([...back.programs], ['rep']);
    assert.deepEqual([...back.teams], ['t1']);
    assert.equal(back.clashesOnly, true);
    assert.equal(filtersQuery({ venues: new Set(), programs: new Set(), teams: new Set(), clashesOnly: false }), '');
  });
  it('⚖ disagreement 7: the line lives on the Calendar page; the season page\'s WeekView is drawn as before (no marks, no Next)', () => {
    const page = read('app/[orgSlug]/admin/calendar/page.tsx');
    assert.match(page, /\{emptyWeek && emptyLine\}/);
    assert.match(page, /CLUB_BAND_WORDS\.week\.nothingSoon/, 'the band\'s own words');
    const season = read('app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx');
    assert.match(season, /<WeekView cursor=\{cursor\} bookings=\{week\} onOpen=\{b => openBooking\(b as SeasonBooking\)\} multiProgram=\{false\} \/>/);
    assert.doesNotMatch(read('components/admin/kit/club/ClubCalendarViews.tsx'), /nextLine|nextRow|readComingBookings/);
  });
});

describe('B3 · house league\'s Schedule health: a line per game on a pulled date', () => {
  const g = (id: string, day: string, at: string, extra: Partial<LeagueHealthGame> = {}): LeagueHealthGame => ({
    id, divisionId: 'd1', homeTeamId: 'hawks', awayTeamId: 'owls', scheduledAt: iso(day, at), endsAt: null,
    status: 'scheduled', venueId: 'v', facilityId: 'fa', location: null, ...extra,
  });
  const teams = [{ id: 'hawks', name: 'Hawks', divisionId: 'd1' }, { id: 'owls', name: 'Owls', divisionId: 'd1' }];
  const outside = { g1: { day: DEC5, venue: 'Kinsmen Park', facility: 'Diamond A' } };
  const ctx = { team: (id: string) => teams.find(t => t.id === id)!.name, label: (k: string) => k, place: () => '', division: () => 'U11 Pinto' };

  it('the drawing\'s line, its door "Give it a new date" (the existing new-date path)', () => {
    const h = buildLeagueScheduleHealth({ games: [g('g1', DEC5, '11:00')], practices: [], teams, outsidePermit: outside });
    const issue = h.issues.find(i => i.kind === 'outside_permit')!;
    const said = leagueIssueWords(issue, ctx);
    assert.equal(said.text, 'Hawks vs Owls, Sat, Dec 5, 11:00 a.m. · Diamond A: the club’s permit no longer holds Kinsmen Park that day.');
    assert.equal(said.door, 'date');
    assert.match(read('components/admin/kit/club/league/schedule/LeagueHealthWindow.tsx'), /x\.issue\.kind === 'postponed' \|\| x\.issue\.kind === 'outside_permit' \? x\.issue\.gameId/);
  });
  it('a game moved off the day drops out at once; the line never touches the score', () => {
    const moved = buildLeagueScheduleHealth({ games: [g('g1', DEC12, '11:00')], practices: [], teams, outsidePermit: outside });
    assert.equal(moved.issues.some(i => i.kind === 'outside_permit'), false);
    const without = buildLeagueScheduleHealth({ games: [g('g1', DEC5, '11:00')], practices: [], teams });
    const withIt = buildLeagueScheduleHealth({ games: [g('g1', DEC5, '11:00')], practices: [], teams, outsidePermit: outside });
    assert.equal(withIt.score, without.score);
  });
  it('a postponed game holds no time: never a "no longer holds" line', () => {
    const h = buildLeagueScheduleHealth({ games: [g('g1', DEC5, '11:00', { status: 'postponed' })], practices: [], teams, outsidePermit: outside });
    assert.equal(h.issues.some(i => i.kind === 'outside_permit'), false);
  });
  it('the season read asks the shared answer over what is BOOKED at the park, never what a schedule handed out', () => {
    const route = read('app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts');
    assert.match(route, /const takenRead = runs && hasOrgVenueLibrary\(ctx!\.org\.planId\)\s*\? readDatesOffTaken\(ctx!\.org\.id, \{ from: tournamentToday\(\), nowMs: Date\.now\(\) \}\)/, 'for whoever runs the season, as the permit line is');
    assert.match(route, /takenOnce\(taken\)\.values\(\)/, 'each game once');
    assert.match(route, /outsidePermit \}\);/);
  });
});
