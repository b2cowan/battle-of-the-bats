import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  tryoutStandingOf,
  isListedTryout,
  tryoutsTabShows,
  openNowTryouts,
  sharedSeasonYear,
  TRYOUT_STATE_WORD,
  TRYOUT_LISTED_DAYS,
  tryoutDayParts,
  tryoutDaysLine,
  dayRangeLabel,
  tryoutsPageTitle,
  tryoutsPageSub,
  tryoutsRowSub,
  bandHeading,
  homeTryoutsRowSub,
  tryoutStateSentence,
  offSeasonSentence,
  tryoutSeasonMeta,
  tryoutPageDescription,
  type TryoutDay,
} from '../../lib/tryout-season.ts';
import { homeCard, teamCard, tryoutCard, clubSitemapPaths, sportsTeamJsonLd } from '../../lib/club-share.ts';
import { liveSeasonOf, publicTryoutSeasonOf } from '../../lib/season-live.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TRYOUT SEASON (Club Tier Stage 4b-2b; drawings ruled 2026-10-19, the asks page ruled 2026-10-20 "all as recommended",
 * words through /marketing 2026-10-20). One rule decides a team's tryout state — Tryouts open · Not open yet · Finished ·
 * Tryouts closed — and every surface reads it: the club Tryouts page and its tab, the tryout page, the home's Open now
 * and the team page's door. The wiring is pinned by club-stage4b2b-guard.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-10-20';

/** A tryout day at a Toronto wall-clock hour (EST after Nov 1, EDT before). */
function day(date: string, startHour: number, endHour: number | null, extra: Partial<TryoutDay> = {}): TryoutDay {
  const offset = date >= '2026-11-01' ? 5 : 4;
  const at = (h: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h + offset)).toISOString();
  return {
    startsAt: at(startHour),
    endsAt: endHour == null ? null : at(endHour),
    status: 'scheduled',
    location: 'Lakeshore Dome',
    locationAddress: '100 Lakeshore Rd, Oakville',
    fieldNumber: '2',
    ...extra,
  };
}

const open = { tryoutOpen: true };
const shut = { tryoutOpen: false };

describe('the three states: one rule, every edge (Ask 3)', () => {
  it('sign-ups open, days ahead → Tryouts open, the days remaining listed', () => {
    const s = tryoutStandingOf({ isArchived: false, season: open, days: [day('2026-11-02', 9, 11), day('2026-11-08', 13, 15)], today: TODAY });
    assert.equal(s.state, 'open');
    assert.equal(s.upcoming.length, 2);
  });
  it('sign-ups open, every day passed → still Tryouts open (the form obeys the switch), no days left to list', () => {
    const s = tryoutStandingOf({ isArchived: false, season: open, days: [day('2026-09-07', 9, 11)], today: TODAY });
    assert.equal(s.state, 'open');
    assert.deepEqual(s.upcoming, []);
  });
  it('sign-ups open, no days entered → Tryouts open', () => {
    assert.equal(tryoutStandingOf({ isArchived: false, season: open, days: [], today: TODAY }).state, 'open');
  });
  it('sign-ups closed, days ahead → Not open yet', () => {
    assert.equal(tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-11-14', 9, 11)], today: TODAY }).state, 'notOpenYet');
  });
  it('sign-ups closed, some days past and one ahead → Not open yet', () => {
    const s = tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-10-10', 9, 11), day('2026-11-14', 9, 11)], today: TODAY });
    assert.equal(s.state, 'notOpenYet');
    assert.equal(s.upcoming.length, 1);
  });
  it('sign-ups closed, last day passed → Finished, dated by its last day', () => {
    const s = tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-09-07', 9, 11), day('2026-09-09', 9, 11)], today: TODAY });
    assert.equal(s.state, 'finished');
    assert.equal(s.lastDay, '2026-09-09');
  });
  it('sign-ups closed, no days → Tryouts closed', () => {
    assert.equal(tryoutStandingOf({ isArchived: false, season: shut, days: [], today: TODAY }).state, 'closed');
  });
  it('sign-ups closed, every day cancelled → Tryouts closed (nothing to say "finished" on)', () => {
    const s = tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-11-14', 9, 11, { status: 'cancelled' })], today: TODAY });
    assert.equal(s.state, 'closed');
  });
  it('a cancelled day is left out of the list, the first day and the last day', () => {
    const s = tryoutStandingOf({
      isArchived: false, season: open,
      days: [day('2026-11-01', 9, 11, { status: 'cancelled' }), day('2026-11-02', 9, 11), day('2026-11-20', 9, 11, { status: 'cancelled' })],
      today: TODAY,
    });
    assert.equal(s.upcoming.length, 1);
    assert.deepEqual(s.heldDays, ['2026-11-02']);
    assert.equal(s.lastDay, '2026-11-02');
  });
  it('a day still counts on the morning of that day, in the club’s zone (passed only from the next day)', () => {
    // 9:00 p.m. in Toronto on Oct 20 is Oct 21 in UTC: the day is still Oct 20, today.
    const late = day('2026-10-20', 21, 22);
    const s = tryoutStandingOf({ isArchived: false, season: shut, days: [late], today: TODAY });
    assert.equal(s.state, 'notOpenYet');
    assert.equal(tryoutStandingOf({ isArchived: false, season: shut, days: [late], today: '2026-10-21' }).state, 'finished');
  });
  it('an archived team, or a team with no live season, is closed whatever its days say', () => {
    assert.equal(tryoutStandingOf({ isArchived: true, season: open, days: [day('2026-11-02', 9, 11)], today: TODAY }).state, 'closed');
    assert.equal(tryoutStandingOf({ isArchived: false, season: null, days: [day('2026-11-02', 9, 11)], today: TODAY }).state, 'closed');
  });
  it('"Tryouts open" is exactly the sign-up form’s rule (publicTryoutSeasonOf), for every archived / switch / season mix', () => {
    const season = (status: string, createdAt: string, tryoutOpen: boolean) => ({ status, createdAt, tryoutOpen });
    const mixes = [
      [], [season('active', '1', true)], [season('active', '1', false)], [season('completed', '1', true)],
      [season('active', '1', false), season('draft', '2', true)], [season('active', '2', true), season('draft', '1', false)],
    ];
    for (const isArchived of [false, true]) {
      for (const seasons of mixes) {
        const live = isArchived ? null : liveSeasonOf(seasons);
        const open = tryoutStandingOf({ isArchived, season: live, days: [], today: TODAY }).state === 'open';
        assert.equal(open, !!publicTryoutSeasonOf({ isArchived }, seasons), JSON.stringify({ isArchived, seasons }));
      }
    }
  });
  it('one phrase per meaning, sentence case', () => {
    assert.deepEqual(TRYOUT_STATE_WORD, { open: 'Tryouts open', notOpenYet: 'Not open yet', finished: 'Finished', closed: 'Tryouts closed' });
  });
});

describe('the Tryouts page and its tab: open, not open yet, or finished in the last four weeks', () => {
  const finishedOn = (lastDay: string) => tryoutStandingOf({ isArchived: false, season: shut, days: [day(lastDay, 9, 11)], today: TODAY });
  it('the window is four weeks', () => assert.equal(TRYOUT_LISTED_DAYS, 28));
  it('finished 28 days ago is still listed; 29 days ago it is not', () => {
    assert.equal(isListedTryout(finishedOn('2026-09-22'), TODAY), true);
    assert.equal(isListedTryout(finishedOn('2026-09-21'), TODAY), false);
  });
  it('open and not open yet are listed; closed never is', () => {
    assert.equal(isListedTryout(tryoutStandingOf({ isArchived: false, season: open, days: [], today: TODAY }), TODAY), true);
    assert.equal(isListedTryout(tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-12-01', 9, 11)], today: TODAY }), TODAY), true);
    assert.equal(isListedTryout(tryoutStandingOf({ isArchived: false, season: shut, days: [], today: TODAY }), TODAY), false);
  });
  it('the tab shows exactly when the page has a team to list', () => {
    assert.equal(tryoutsTabShows([finishedOn('2026-09-21')], TODAY), false);
    assert.equal(tryoutsTabShows([finishedOn('2026-09-21'), finishedOn('2026-10-01')], TODAY), true);
    assert.equal(tryoutsTabShows([], TODAY), false);
  });
});

describe('the home’s Open now: one row when more than one team is involved (Ask 14, round 2)', () => {
  const t = (state: 'open' | 'shut-ahead' | 'finished', name: string) => ({
    name,
    standing: state === 'open'
      ? tryoutStandingOf({ isArchived: false, season: open, days: [day('2026-11-02', 9, 11)], today: TODAY })
      : state === 'shut-ahead'
        ? tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-11-14', 9, 11)], today: TODAY })
        : tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-10-01', 9, 11)], today: TODAY }),
  });
  it('two teams open → one season row carrying both', () => {
    const r = openNowTryouts([t('open', 'A'), t('open', 'B')]);
    assert.equal(r.kind, 'season');
    assert.equal(r.kind === 'season' && r.teams.length, 2);
  });
  it('one open and one not open yet → one season row (round 2 lets it carry not-open-yet teams)', () => {
    assert.equal(openNowTryouts([t('open', 'A'), t('shut-ahead', 'B')]).kind, 'season');
  });
  it('two not open yet → one season row', () => {
    assert.equal(openNowTryouts([t('shut-ahead', 'A'), t('shut-ahead', 'B')]).kind, 'season');
  });
  it('exactly one open → that team’s own row; a finished team does not count', () => {
    const r = openNowTryouts([t('open', 'A'), t('finished', 'B')]);
    assert.equal(r.kind, 'team');
    assert.equal(r.kind === 'team' && r.team.name, 'A');
  });
  it('one not open yet and none open → nothing on the home (a lone not-open-yet team is not "open now")', () => {
    assert.equal(openNowTryouts([t('shut-ahead', 'A')]).kind, 'none');
    assert.equal(openNowTryouts([]).kind, 'none');
  });
});

describe('the words (through /marketing 2026-10-20)', () => {
  it('a day row: "Mon, Nov 2" · "9:00–11:00 a.m." · the venue and the sport’s own surface word', () => {
    const p = tryoutDayParts(day('2026-11-02', 9, 11), 'baseball');
    assert.equal(p.dayLabel, 'Mon, Nov 2');
    assert.equal(p.time, '9:00–11:00 a.m.');
    assert.match(p.place, /^Lakeshore Dome · \S+ 2$/);
    assert.match(p.directions ?? '', /^https:\/\/www\.google\.com\/maps\/search\//);
    assert.equal(p.directionsName, 'Directions to Lakeshore Dome');
  });
  it('a range across noon says both periods; no end time says the start alone; no address means no Directions', () => {
    assert.equal(tryoutDayParts(day('2026-11-02', 11, 13), 'baseball').time, '11:00 a.m.–1:00 p.m.');
    assert.equal(tryoutDayParts(day('2026-11-02', 9, null), 'baseball').time, '9:00 a.m.');
    assert.equal(tryoutDayParts(day('2026-11-02', 9, 11, { locationAddress: null }), 'baseball').directions, null);
    assert.equal(tryoutDayParts(day('2026-11-02', 9, 11, { fieldNumber: null }), 'baseball').place, 'Lakeshore Dome');
  });
  it('the days line: one day, a spelled count to nine, digits from ten; the place only when every day shares it', () => {
    assert.equal(tryoutDaysLine([day('2026-11-02', 9, 11)]), 'Mon, Nov 2 · Lakeshore Dome');
    assert.equal(tryoutDaysLine([day('2026-11-02', 9, 11), day('2026-11-08', 9, 11), day('2026-11-09', 9, 11)]),
      'Three days from Mon, Nov 2 · Lakeshore Dome');
    assert.equal(tryoutDaysLine([day('2026-11-02', 9, 11), day('2026-11-08', 9, 11, { location: 'Sherwood Park' })]),
      'Two days from Mon, Nov 2');
    const twelve = Array.from({ length: 12 }, (_, i) => day(`2026-11-${String(i + 2).padStart(2, '0')}`, 9, 11));
    assert.equal(tryoutDaysLine(twelve), '12 days from Mon, Nov 2 · Lakeshore Dome');
    assert.equal(tryoutDaysLine([]), null);
  });
  it('a date range: one day, within a month, across months', () => {
    assert.equal(dayRangeLabel(['2026-09-07']), 'Sep 7');
    assert.equal(dayRangeLabel(['2026-09-09', '2026-09-07', '2026-09-08']), 'Sep 7–9');
    assert.equal(dayRangeLabel(['2026-08-30', '2026-09-02']), 'Aug 30 – Sep 2'); // the house range (formatEventDateRange)
    assert.equal(dayRangeLabel([]), null);
  });
  it('the page title names a year only when every listed team shares it', () => {
    assert.equal(sharedSeasonYear([{ seasonYear: 2027 }, { seasonYear: 2027 }]), 2027);
    assert.equal(sharedSeasonYear([{ seasonYear: 2027 }, { seasonYear: 2026 }]), null);
    assert.equal(sharedSeasonYear([{ seasonYear: 2027 }, { seasonYear: null }]), null);
    assert.equal(tryoutsPageTitle(2027), '2027 tryouts');
    assert.equal(tryoutsPageTitle(null), 'Tryouts');
  });
  it('the sub names the club’s groups only when every listed team sits in one of at most three', () => {
    assert.equal(tryoutsPageSub(2027, ['Rep', 'Select']), 'Rep and Select teams for the 2027 season');
    assert.equal(tryoutsPageSub(2027, ['Senior', 'Junior', 'Development']), 'Senior, Junior and Development teams for the 2027 season');
    assert.equal(tryoutsPageSub(2027, ['A', 'B', 'C', 'D']), 'Teams for the 2027 season');
    assert.equal(tryoutsPageSub(2027, ['Rep', null]), 'Teams for the 2027 season');
    assert.equal(tryoutsPageSub(2027, []), 'Teams for the 2027 season');
    assert.equal(tryoutsPageSub(2027, ['Rep Teams']), 'Teams for the 2027 season');
    assert.equal(tryoutsPageSub(null, ['Rep', 'Select']), 'Rep and Select teams');
    assert.equal(tryoutsPageSub(null, ['Rep', null]), null);
  });
  it('a band reads "Rep · Sep 7–9", or its name alone with no days', () => {
    assert.equal(bandHeading('Rep', ['2026-09-07', '2026-09-09']), 'Rep · Sep 7–9');
    assert.equal(bandHeading('Rep', []), 'Rep');
  });
  it('a row: the first remaining day and place; open with none left, its season', () => {
    const s = tryoutStandingOf({ isArchived: false, season: open, days: [day('2026-11-02', 9, 11)], today: TODAY });
    assert.equal(tryoutsRowSub(s, { year: 2027, name: '2027 Season' }, TODAY), 'Mon, Nov 2 · Lakeshore Dome');
    const none = tryoutStandingOf({ isArchived: false, season: open, days: [], today: TODAY });
    assert.equal(tryoutsRowSub(none, { year: 2027, name: '2027 Season' }, TODAY), 'For the 2027 season');
  });
  it('a finished row names its last day, with the year once that was last year', () => {
    const done = tryoutStandingOf({ isArchived: false, season: shut, days: [day('2026-10-01', 9, 11)], today: TODAY });
    assert.equal(tryoutsRowSub(done, { year: 2027, name: 'x' }, TODAY), 'Thu, Oct 1 · Lakeshore Dome');
    const acrossNewYear = tryoutStandingOf({ isArchived: false, season: shut, days: [day('2025-12-30', 9, 11)], today: '2026-01-10' });
    assert.equal(tryoutsRowSub(acrossNewYear, { year: 2026, name: 'x' }, '2026-01-10'), 'Tue, Dec 30, 2025 · Lakeshore Dome');
  });
  it('the home’s season row: per-group dates when the groups are honest, one range otherwise', () => {
    assert.equal(homeTryoutsRowSub(7, [{ name: 'Rep', days: ['2026-09-07', '2026-09-09'] }, { name: 'Select', days: ['2026-09-11', '2026-09-13'] }]),
      '7 teams · Rep Sep 7–9 · Select Sep 11–13');
    assert.equal(homeTryoutsRowSub(3, [{ name: null, days: ['2026-09-07', '2026-09-13'] }]), '3 teams · Sep 7–13');
    assert.equal(homeTryoutsRowSub(2, [{ name: 'Rep', days: [] }]), '2 teams');
  });
  it('the state sentences', () => {
    const season = { year: 2027, name: '2027 Season' };
    assert.equal(tryoutStateSentence('closed', '13U AAA', season, null, TODAY), '13U AAA isn’t taking tryout sign-ups right now.');
    assert.equal(tryoutStateSentence('notOpenYet', '15U AA', season, null, TODAY), 'Sign-ups for 15U AA tryouts aren’t open yet.');
    assert.equal(tryoutStateSentence('finished', 'U13 Rep', season, '2026-09-07', TODAY), 'Tryouts for the 2027 season finished on Mon, Sep 7.');
    assert.equal(tryoutStateSentence('finished', 'U13 Rep', season, '2025-09-07', TODAY), 'Tryouts for the 2027 season finished on Sun, Sep 7, 2025.');
    assert.equal(tryoutStateSentence('finished', 'U13 Rep', { year: null, name: 'Spring Season' }, '2026-09-07', TODAY),
      'Tryouts for the Spring Season finished on Mon, Sep 7.');
  });
  it('the off-season sentence always carries the year; a club that never posted one says so plainly', () => {
    assert.equal(offSeasonSentence('2026-09-13'), 'The club’s last tryouts finished on Sun, Sep 13, 2026.');
    assert.equal(offSeasonSentence(null), 'No tryouts are posted right now.');
  });
  it('the season line, and the link-preview description per state', () => {
    assert.equal(tryoutSeasonMeta({ year: 2027, name: '2027 Season' }), 'For the 2027 season');
    assert.equal(tryoutSeasonMeta({ year: null, name: 'Spring Season' }), 'Spring Season');
    const season = { year: 2027, name: '2027 Season' };
    assert.equal(tryoutPageDescription('open', '15U AAA', season, '2026-11-02', null, TODAY), 'Tryouts for the 2027 season, from Mon, Nov 2. Sign-ups are open.');
    assert.equal(tryoutPageDescription('open', '15U AAA', season, null, null, TODAY), 'Tryouts for the 2027 season. Sign-ups are open.');
    assert.equal(tryoutPageDescription('notOpenYet', '15U AA', season, '2026-11-14', null, TODAY), 'Tryouts for the 2027 season, from Sat, Nov 14. Sign-ups aren’t open yet.');
    assert.equal(tryoutPageDescription('finished', 'U13', season, null, '2026-09-07', TODAY), 'Tryouts for the 2027 season finished on Mon, Sep 7.');
    assert.equal(tryoutPageDescription('closed', '13U AAA', season, null, null, TODAY), '13U AAA isn’t taking tryout sign-ups right now.');
  });
});

describe('a shared link’s card: the club, the team or the tryout — never a player (End state 8, S4-02)', () => {
  const roster = ['Ava Martin', 'Noah Singh'];
  it('home: the club and its tagline; no tagline, the name alone', () => {
    assert.deepEqual(homeCard({ clubName: 'Lakeshore Lynx', tagline: 'Rep baseball · ages 9 to 16' }),
      { badge: null, title: 'Lakeshore Lynx', sub: 'Rep baseball · ages 9 to 16', alt: 'Lakeshore Lynx, Rep baseball · ages 9 to 16' });
    assert.deepEqual(homeCard({ clubName: 'Lakeshore Lynx', tagline: '  ' }), { badge: null, title: 'Lakeshore Lynx', sub: null, alt: 'Lakeshore Lynx' });
  });
  it('team: the team over "club · season"', () => {
    assert.deepEqual(teamCard({ clubName: 'Lakeshore Lynx', teamName: '15U AAA', seasonYear: 2026 }),
      { badge: null, title: '15U AAA', sub: 'Lakeshore Lynx · 2026 season', alt: '15U AAA, Lakeshore Lynx' });
    assert.equal(teamCard({ clubName: 'Lakeshore Lynx', teamName: '15U AAA', seasonYear: null }).sub, 'Lakeshore Lynx');
  });
  it('tryout: the state word as its badge, the team’s tryouts, the season and first day', () => {
    const season = { year: 2027, name: '2027 Season' };
    assert.deepEqual(tryoutCard({ clubName: 'Lakeshore Lynx', teamName: '15U AAA', state: 'open', season, firstUpcoming: '2026-11-02', lastDay: null }),
      { badge: 'Tryouts open', badgeTone: 'ok', title: '15U AAA tryouts', sub: 'For the 2027 season · from Mon, Nov 2', alt: '15U AAA tryouts, Lakeshore Lynx: Tryouts open' });
    assert.equal(tryoutCard({ clubName: 'L', teamName: 'T', state: 'finished', season, firstUpcoming: null, lastDay: '2026-09-07' }).sub,
      'For the 2027 season · finished Mon, Sep 7');
    assert.equal(tryoutCard({ clubName: 'L', teamName: 'T', state: 'closed', season, firstUpcoming: null, lastDay: null }).sub, 'For the 2027 season');
  });
  it('no card carries anything but the names it was handed (a roster in reach changes nothing)', () => {
    const cards = [
      homeCard({ clubName: 'Lakeshore Lynx', tagline: null, ...{ roster } } as never),
      teamCard({ clubName: 'Lakeshore Lynx', teamName: '15U AAA', seasonYear: 2026, ...{ roster } } as never),
      tryoutCard({ clubName: 'Lakeshore Lynx', teamName: '15U AAA', state: 'open', season: { year: 2027, name: 'x' }, firstUpcoming: null, lastDay: null, ...{ roster } } as never),
    ];
    const text = JSON.stringify(cards);
    for (const name of roster) assert.ok(!text.includes(name), `a card never names ${name}`);
  });
});

describe('the sitemap and the team described to search engines (Ask 7A, F02)', () => {
  it('the Teams page, each listed team, each open tryout, and the Tryouts page while it has one', () => {
    assert.deepEqual(
      clubSitemapPaths({ orgSlug: 'lynx', teamSlugs: ['15u-aaa', '13u-aaa'], openTryoutSlugs: ['15u-aaa'], tryoutsPage: true }),
      ['/lynx/teams', '/lynx/teams/15u-aaa', '/lynx/teams/13u-aaa', '/lynx/teams/15u-aaa/tryouts', '/lynx/tryouts'],
    );
  });
  it('no listed team → no Teams page, no team; an off-season Tryouts page is left out', () => {
    assert.deepEqual(clubSitemapPaths({ orgSlug: 'lynx', teamSlugs: [], openTryoutSlugs: [], tryoutsPage: false }), []);
  });
  it('a team is a SportsTeam of the club — never its players, coaches or members', () => {
    const ld = sportsTeamJsonLd({ teamName: '15U AAA', sport: 'Baseball', url: 'https://x/lynx/teams/15u-aaa', clubName: 'Lakeshore Lynx', clubUrl: 'https://x/lynx' });
    assert.equal(ld['@type'], 'SportsTeam');
    assert.equal(ld.name, '15U AAA');
    assert.deepEqual(ld.parentOrganization, { '@type': 'SportsOrganization', name: 'Lakeshore Lynx', url: 'https://x/lynx' });
    for (const key of ['athlete', 'coach', 'member', 'employee', 'founder']) assert.ok(!(key in ld), `no ${key}`);
  });
});
