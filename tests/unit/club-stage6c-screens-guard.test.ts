/**
 * CLUB TIER STAGE 6c — ONE CALENDAR, held in place (ruled 2026-10-10; hub K4MPu4ni53Ct7yrDcmWJd9 v78, Mockups → Stage 6c,
 * specimens 1 and 2; table standard §11; plan §6 Stage 6c). What the coach's desk schedule, the club calendar and a
 * team's schedule (admin) were built to do, and must not drift back from:
 *
 *   1. MONDAY FIRST in every calendar grid (C2), the cells from calendar parts.
 *   2. NO DEVICE CLOCK in the calendar family's files — every heading from calendar parts or the zone helpers (C8, C10).
 *   3. THE COACH'S ONE TOOLBAR LINE (C4): the switch leads, the dates follow it above 900 px, Export then Add Event;
 *      Import lives inside Add Event's menu.
 *   4. THE CLUB LIST IS THE KIT'S ROW (C5, A41 answered): band · row · chevron, never a table.
 *   5. NOTHING HIDDEN (C9): the club calendar reads cancelled bookings and postponed league games, marked, and the clash
 *      rule never pairs them.
 *   6. A TEAM'S SCHEDULE (ADMIN) DRAWS THE COACH'S VIEWS (Ask 14): no week or month grid of its own, no Done, no Export.
 *   7. TODAY SAID IN WORDS on every day heading (C7); a season list marks it with a now line, never a band.
 *   8. ONE SPELLING: the day, the week, the zone sentence read from the zone (C8, C10); the olive switch (Ask 13).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  WEEKDAY_HEADS, dayHeading, dayWords, monthCells, nowLineAt, weekDays, weekRangeWords, widestRangeWords, type SeasonListItem,
} from '../../lib/calendar-recipe.ts';
import { addCalendarDays, formatMonthYear, formatWeekRange, timesInZoneSentence } from '../../lib/timezone.ts';
import { groupWeekDays } from '../../lib/coach-schedule-phone.ts';
import { leagueBooking, repEventBooking, tryoutSessionBooking } from '../../lib/venue-clash.ts';
import { orgWeekdayDay } from '../../lib/club-board-view.ts';

const COACH_PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';
const COACH_VIEWS = 'components/coaches/ScheduleCalendarViews.tsx';
const COACH_CSS = 'app/[orgSlug]/coaches/coaches.module.css';
const CLUB_CSS = 'components/admin/kit/club/ClubCalendar.module.css';
const ADMIN_FRAME_CSS = 'components/admin/kit/AdminKitFrame.module.css';
const OPENS = 'components/coaches/useScheduleOpensOnToday.ts';
const CLUB_PAGE = 'app/[orgSlug]/admin/calendar/page.tsx';
const CLUB_VIEWS = 'components/admin/kit/club/ClubCalendarViews.tsx';
const CLUB_VIEW_LIB = 'lib/club-calendar-view.ts';
const CLUB_READ = 'lib/club-calendar.ts';
const TEAM_PAGE = 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx';
const RECIPE = 'lib/calendar-recipe.ts';

describe('1. Monday first, in every grid (C2)', () => {
  it('the recipe’s grid starts on Monday: October 2026 opens on its Thursday the 1st, three pads in', () => {
    assert.deepEqual([...WEEKDAY_HEADS], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const cells = monthCells('2026-10-14');
    assert.deepEqual(cells.slice(0, 4), [null, null, null, '2026-10-01']);
    assert.equal(cells.length % 7, 0);
    assert.deepEqual(weekDays('2026-10-10'), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });
  it('every calendar grid draws the recipe’s heads and cells — no Sunday-first grid of its own', () => {
    for (const f of [COACH_VIEWS, CLUB_VIEWS]) {
      const code = readCode(f);
      assert.match(code, /WEEKDAY_HEADS\.map\(/, f);
      assert.match(code, /monthCells\((curMonth|cursor)\)/, f);
      assert.doesNotMatch(code, /DAYS_OF_WEEK|getDay\(\)|getUTCDay\(\)/, f);
    }
  });
});

describe('2. no device clock in the calendar family (C8, C10)', () => {
  for (const f of [COACH_VIEWS, COACH_PAGE, CLUB_PAGE, CLUB_VIEWS, TEAM_PAGE, RECIPE, OPENS]) {
    it(`${f} formats no date on the device’s clock`, () => {
      const code = readCode(f);
      assert.doesNotMatch(code, /toLocale(Date|Time)?String\(/, 'a toLocale* call reads the device zone');
      assert.doesNotMatch(code, /new Date\(`\$\{[^}]+\}T00:00:00`\)/, 'a device midnight');
      assert.doesNotMatch(code, /\.(getDate|getMonth|getFullYear|setMonth|setDate)\(/, 'device-clock calendar arithmetic');
    });
  }
});

describe('3. the coach’s one toolbar line (C4); Import inside Add Event', () => {
  const page = readCode(COACH_PAGE);
  it('the switch leads, the dates follow it on the line, Export then Add Event at its end', () => {
    const line = page.slice(page.indexOf('<CoachListToolbar'), page.indexOf('</CoachListToolbar>'));
    assert.match(line, /actions=\{<><span className=\{styles\.scheduleExportIcon\}>\{scheduleExport\}<\/span>\{!isPhone && addEventMenu\}<\/>\}/);
    assert.ok(line.indexOf('<CalendarViewSwitch') >= 0 && line.indexOf('<CalendarViewSwitch') < line.indexOf('styles.calNavOnLine'), 'the switch, then the dates');
    assert.match(page, /\{view !== 'list' && <div className=\{styles\.calNavOwnRow\}>\{dateNav\}<\/div>\}/, 'their own row at 900 and narrower');
  });
  it('Import is the last item of Add Event’s menu — never a button on the line or the title row', () => {
    const menu = page.slice(page.indexOf('const addEventMenu = canAddEvents ? ('), page.indexOf('const scheduleHeaderActions'));
    assert.ok(menu.indexOf('<CoachToolbarMenuSeparator />') > 0);
    assert.match(menu, /label=\{IMPORT_WORDS\}[\s\S]*setImportOpen\(true\)/);
    assert.match(page, /const IMPORT_WORDS = 'Import a schedule';/);
    assert.doesNotMatch(page, /headerActionWideOnly|>\s*Import\s*</);
  });
  it('ONE Add Event menu, placed by width — never two instances on one open state', () => {
    assert.equal(page.match(/\{isPhone && addEventMenu\}/g)?.length, 1);
    assert.equal(page.match(/\{!isPhone && addEventMenu\}/g)?.length, 1);
  });
  it('the date arrows are the shared row, named, and step the calendar', () => {
    // Stage 11a part B: a club schedule's grid passes its own `range` (its dates seven at a time) and names its arrows;
    // the calendars pass none and keep these names.
    assert.match(readCode(COACH_VIEWS), /aria-label=\{range\?\.prevLabel \?\? \(view === 'month' \? 'Previous month' : 'Previous week'\)\}/);
    assert.match(page, /<ScheduleDateNav view=\{view\} cursor=\{cursorDate\} onStep=\{navigate\} \/>/);
    assert.match(readCode(TEAM_PAGE), /<ScheduleDateNav view=\{view\} cursor=\{cursor\} onStep=\{step\} \/>/);
    assert.match(page, /stepScheduleCursor\(view, cursorDate, dir\)/);
  });
});

describe('4. the club List is the kit’s row list (C5)', () => {
  const views = readCode(CLUB_VIEWS);
  const list = views.slice(views.indexOf('export function ListView'), views.indexOf('export function MonthView'));
  it('ClubRowList · ClubRowBand · ClubRow with a chevron; no table anywhere in the views', () => {
    assert.match(list, /<ClubRowList label="Bookings">/);
    assert.match(list, /<ClubRowBand key=\{`band-\$\{day\}`\} id=\{`cal-band-\$\{day\}`\}/, 'Month’s day still lands on its band');
    assert.match(list, /<ClubRow\s+key=\{b\.key\}\s+as="button"/);
    assert.match(list, /chevron\s/);
    assert.doesNotMatch(views, /<table|repKit\.table\b/);
  });
  it('the swatch is the row’s one lead mark, the range its lead, no count on a band', () => {
    assert.match(list, /mark=\{<span className=\{cal\.swatch\} style=\{edge\(b\)\} \/>\}/);
    assert.match(list, /lead=\{<span className=\{cal\.timeCell\}>\{timeWords\(b\)\}<\/span>\}/);
    assert.doesNotMatch(list, /count=\{/);
  });
});

describe('5. nothing hidden; never a clash (C9)', () => {
  const read = readCode(CLUB_READ);
  it('the four reads keep their called-off rows; each booking says its state', () => {
    const reads = read.slice(read.indexOf("supabaseAdmin.from('rep_team_events')"), read.indexOf("supabaseAdmin\n      .from('tournaments')"));
    assert.doesNotMatch(reads, /\.neq\('status', '(cancelled|postponed)'\)/);
    assert.equal(read.match(/state: stateOf\(r\.status\),/g)?.length, 3, 'rep events, tryouts, house league');
  });
  it('the clash rule’s own constructors drop a cancelled booking and a postponed game — they never reach the pool', () => {
    const base = { id: 'e', team_id: 't', starts_at: '2026-10-20T22:00:00Z', ends_at: '2026-10-21T00:00:00Z', org_venue_id: 'v', org_venue_facility_id: 'f' };
    assert.equal(repEventBooking({ ...base, event_type: 'practice', status: 'cancelled' }, { team: 'X', venue: 'V', facility: 'F' }), null);
    assert.equal(tryoutSessionBooking({ ...base, status: 'cancelled' }, { team: 'X', venue: 'V', facility: 'F' }), null);
    const league = { id: 'g', season_id: 's', scheduled_at: '2026-10-20T22:00:00Z', ends_at: null, org_venue_id: 'v', org_venue_facility_id: 'f', kind: 'game' as const };
    assert.equal(leagueBooking({ ...league, status: 'postponed' }, { season: 'S', venue: 'V', facility: 'F' }), null);
    assert.equal(leagueBooking({ ...league, status: 'cancelled' }, { season: 'S', venue: 'V', facility: 'F' }), null);
  });
  it('a called-off booking is struck, worded, never flagged, and out of the Month’s count', () => {
    const views = readCode(CLUB_VIEWS);
    assert.match(views, /b\.clash === 'booked_by' && !b\.state && <AlertTriangle/);
    assert.match(views, /const list = \(map\.get\(d\) \?\? \[\]\)\.filter\(b => !b\.state\);/);
    assert.match(views, /muted=\{!!b\.state\}/);
  });
});

describe('6. a team’s schedule (admin) draws the coach’s views, read-only (Ask 14)', () => {
  const page = readCode(TEAM_PAGE);
  it('the coach’s List, Week and Month — and no grid or strip of its own', () => {
    for (const v of ['<ScheduleListView', '<ScheduleWeekView', '<ScheduleMonthView']) assert.ok(page.includes(v), v);
    assert.doesNotMatch(page, /calWeekGrid|calMonthGrid|eventChip\b|'Won'|'Lost'|'Tied'/);
  });
  it('every write absent: no create, no Export, no Done; the read-only sentence ends the line', () => {
    assert.match(page, /canAddEvents=\{false\}/);
    assert.doesNotMatch(page, /ExportMenu|CoachExportButton|footer=|>Done</);
    assert.match(page, /<CoachListToolbar actions=\{<p className=\{styles\.scheduleReadOnly\}>\{readOnlyWords\(team\.name\)\}<\/p>\}>/);
  });
  it('it opens on today through the coach’s own hook, and "+N more" opens the day', () => {
    assert.match(page, /useScheduleOpensOnToday\(\{/);
    assert.match(page, /onOpenDay=\{\(day, dayEvents\) => setDaySheet\(\{ day, events: dayEvents \}\)\}/);
  });
});

describe('7. today said in words; a season list’s now line (C7)', () => {
  it('a day heading says today in words, any other day its own', () => {
    assert.equal(dayHeading('2026-10-10', '2026-10-10'), 'Today · Sat, Oct 10');
    assert.equal(dayHeading('2026-10-13', '2026-10-10'), 'Tue, Oct 13');
  });
  it('every day heading reads dayHeading — the coach’s Week, the club’s Week and List bands, the phone day', () => {
    const coach = readCode(COACH_VIEWS);
    assert.match(coach, /<div className=\{styles\.calWeekDayLabel\}>\{dayHeading\(key, today\)\}<\/div>/);
    assert.match(coach, /<CoachRowBand>\{dayHeading\(selectedDay, today\)\}<\/CoachRowBand>/);
    const club = readCode(CLUB_VIEWS);
    assert.match(club, /<span className=\{cal\.dayName\}>\{dayHeading\(d, today\)\}<\/span>/);
    assert.match(club, /<h3 className=\{cal\.pdayHead\}>\{dayHeading\(g\.key, today\)\}<\/h3>/);
  });
  it('the now line: before the next row; closing the earlier month; after the last; none in an empty list', () => {
    const items: SeasonListItem[] = [
      { kind: 'band', month: '2026-10' }, { kind: 'row', day: '2026-10-07' }, { kind: 'row', day: '2026-10-09' },
      { kind: 'row', day: '2026-10-13' },
      { kind: 'band', month: '2026-11' }, { kind: 'row', day: '2026-11-04' },
    ];
    assert.equal(nowLineAt(items, '2026-10-10'), 3, 'between Fri Oct 9 and Tue Oct 13');
    assert.equal(nowLineAt(items, '2026-10-13'), 3, 'above today’s first row');
    assert.equal(nowLineAt(items, '2026-10-20'), 4, 'October’s end — never under November’s band');
    assert.equal(nowLineAt(items, '2026-12-01'), items.length, 'the season behind today');
    assert.equal(nowLineAt([{ kind: 'band', month: '2026-10' }], '2026-10-10'), -1);
  });
  it('an empty today is never folded into a run of empty days (the phone week)', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
      .map(key => ({ key, label: dayHeading(key, '2026-10-10'), hasEvents: key === '2026-10-07', today: key === '2026-10-10' }));
    assert.deepEqual(groupWeekDays(days).map(g => (g.kind === 'day' ? g.key : `${g.label}${g.today ? ' (today)' : ''}`)), [
      'Mon, Oct 5 – Tue, Oct 6', '2026-10-07', 'Thu, Oct 8 – Fri, Oct 9', 'Today · Sat, Oct 10 (today)', 'Sun, Oct 11',
    ]);
  });
  it('the list renders the now line from the helper, never a band', () => {
    const coach = readCode(COACH_VIEWS);
    assert.match(coach, /const nowAt = nowLineAt\(items, today\);/);
    assert.match(coach, /<li className=\{styles\.rowListNow\} data-now-line role="presentation">/);
  });
});

describe('8. one spelling; the zone read from the zone; the olive switch', () => {
  it('a day, a week, a month', () => {
    assert.equal(dayWords('2026-10-10'), 'Sat, Oct 10');
    assert.equal(orgWeekdayDay('2026-10-03T14:00:00Z'), 'Sat, Oct 3', 'the club board’s next event takes its comma');
    assert.equal(formatWeekRange('2026-10-05', '2026-10-11'), 'Oct 5 – 11, 2026');
    assert.equal(formatWeekRange('2026-10-26', '2026-11-01'), 'Oct 26 – Nov 1, 2026');
    assert.equal(formatWeekRange('2026-12-28', '2027-01-03'), 'Dec 28, 2026 – Jan 3, 2027');
    assert.equal(formatWeekRange('2026-12-28', '2027-01-03', false), 'Dec 28 – Jan 3');
    assert.equal(weekRangeWords('2026-10-10', false), 'Oct 5 – 11');
    assert.equal(formatMonthYear('2026-10'), 'October 2026');
  });
  it('the date control keeps one width: whatever it shows, an unseen line is the same shape or wider (owner 2026-10-10)', () => {
    // Digits read as one glyph — the label sets tabular figures — so a line of the same shape is the same width.
    const shape = (s: string) => s.replace(/\d/g, '0');
    for (const withYear of [true, false]) {
      for (let day = '2026-01-01'; day < '2028-01-01'; day = addCalendarDays(day, 1)) {
        const lines = widestRangeWords(day, withYear).split('\n').map(shape);
        const week = shape(weekRangeWords(day, withYear));
        const straddles = /^[A-Z][a-z]{2} .* – [A-Z][a-z]{2} /.test(week);
        // A week inside one month is its straddling line with a month name fewer: "Oct 0 – 00" under "Oct 00 – Nov 0".
        assert.ok(straddles ? lines.includes(week) : lines.some(l => l.startsWith(week.slice(0, 4)) && l.length > week.length), `${day} ${week}`);
        assert.ok(lines.includes(shape(formatMonthYear(day))), day);
      }
    }
    // One date row draws the sizer, and every calendar draws that row (§289).
    assert.match(readCode(COACH_VIEWS), /<span className=\{styles\.calNavSizer\} aria-hidden>/);
    assert.match(readCode(CLUB_PAGE), /<ScheduleDateNav view=\{view === 'month' \? 'month' : 'week'\} cursor=\{cursor\} onStep=\{step\} \/>/);
  });
  it('the zone sentence is read from the zone, never written into the page', () => {
    assert.equal(timesInZoneSentence(), 'Times in Eastern time.');
    assert.equal(timesInZoneSentence('America/Vancouver'), 'Times in Pacific time.');
    assert.equal(timesInZoneSentence('America/Regina'), 'Times in Central time.');
    assert.match(readCode(CLUB_VIEW_LIB), /timesNote: \(timeZone\?: string\) => timesInZoneSentence\(timeZone\),/);
    assert.doesNotMatch(readCode(CLUB_VIEW_LIB), /'Times in Eastern time\.'/);
  });
  it('ONE switch and ONE date row on every calendar, both white — none hand-rolls its own (Ask 13; owner 2026-10-10, §289)', () => {
    // The build first matched only the chosen view's colour: the coach kept a see-through switch and arrows beside the
    // club's white ones, and a team's schedule mixed the two. The owner saw them side by side.
    for (const f of [COACH_PAGE, CLUB_PAGE, TEAM_PAGE]) {
      const code = readCode(f);
      assert.match(code, /<CalendarViewSwitch views=\{VIEW[_A-Z]*\} value=\{view\} onChange=\{(setView|pickView)\} label="Show the (schedule|calendar) as" \/>/, f);
      assert.match(code, /<ScheduleDateNav /, f);
      assert.doesNotMatch(code, /aria-pressed=\{view === v\}|styles\.viewToggle|repKit\.views|ChevronLeft/, `${f} draws its own switch or arrows`);
    }
    // The switch's look lives in the coach kit's sheet since Toolbar Rules Stage 2 (its `ViewSwitch`); the arrows here.
    const kitCss = readCode('components/coaches/kit/CoachKit.module.css');
    const rule = (css: string, sel: string) => css.slice(css.indexOf(`\n${sel} {`), css.indexOf('}', css.indexOf(`\n${sel} {`)));
    for (const [css, sel] of [[kitCss, '.calViews'], [readCode(COACH_CSS), '.calNavBtn']] as const) {
      assert.match(rule(css, sel), /background: var\(--card-bg\);/, `${sel} is white`);
      assert.match(rule(css, sel), /border: 1px solid var\(--home-line-strong\);/, `${sel} wears the strong line`);
    }
    assert.match(kitCss, /\.calViewOn, \.calViewOn:hover \{ background: var\(--home-olive-soft\); color: var\(--home-olive\); \}/, 'the chosen view is olive');
  });
  it('in dark both Months draw lines that LAND lighter than their cells, and the admin rail’s thin scrollbar carries its colours (owner 2026-10-11, §289 W11)', () => {
    assert.match(readCode(COACH_CSS), /:global\(html\[data-user-theme="dark"\]\) \.calMonthGrid \{ background: var\(--white-20\); border-color: var\(--white-20\); \}/);
    assert.match(readCode(CLUB_CSS), /:global\(html\[data-user-theme="dark"\]\) \.month \{ background: var\(--white-20\); border-color: var\(--white-20\); \}/);
    // The gap paints a TRANSLUCENT line over the page, so the guard checks where it lands. The first fix picked the
    // "strong line" by name: the platform blue at 25% over #0A0A0A lands on the card's own navy, and the owner saw no change.
    const globals = readCode('app/globals.css');
    const hex = (name: string) => (globals.match(new RegExp(`--${name}:\\s*#([0-9A-Fa-f]{6});`))?.[1] ?? '').match(/../g)!.map(h => parseInt(h, 16));
    const white20 = Number(globals.match(/--white-20:\s*rgba\(255, 255, 255, ([0-9.]+)\);/)?.[1]);
    const lum = (rgb: number[]) => rgb.map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const page = hex('bg'), card = hex('hud-surface');
    const line = page.map(c => c + (255 - c) * white20);
    assert.ok((lum(line) + 0.05) / (lum(card) + 0.05) >= 1.4, 'the dark Month line stands off the card');
    // A browser that reads scrollbar-width stops reading ::-webkit-scrollbar for the element — a width alone draws its default, light bar.
    assert.match(readCode(ADMIN_FRAME_CSS), /scrollbar-width: thin;\s*scrollbar-color: var\(--home-line-strong, rgba\(255, 255, 255, 0\.18\)\) transparent;/);
  });
  it('the state words: one source, styled as chips', () => {
    assert.match(readCode(RECIPE), /export const STATE_WORDS = \{ cancelled: 'Cancelled', postponed: 'Postponed' \} as const;/);
    for (const f of [COACH_VIEWS, CLUB_VIEWS, CLUB_VIEW_LIB, TEAM_PAGE]) assert.doesNotMatch(readCode(f), /'Cancelled'|'CANCELLED'|\.toUpperCase\(\)/, f);
  });
});
