/**
 * CLUB TIER STAGE 6b — THE CLUB CALENDAR AND THE VENUE LIBRARY, held in place (hub K4MPu4ni53Ct7yrDcmWJd9 v64,
 * Mockups → Stage 6, specimens 5 and 6; design log 2026-10-09; plan §6 Stage 6 "6b BUILT"). What the screens and their
 * routes were built to do, and must not drift back from:
 *
 *   1. THE CALENDAR'S DOOR: "Calendar" directly under Overview in the rail, the first row of the phone's More sheet, the
 *      calendar-with-clock glyph, gated on the programs it reads — one gate (`kitCalendarLink`) for both navs.
 *   2. THE COACH SCHEDULE'S TOOLBAR: List · Week · Month in the portal's order, opening on Week; the quiet Venue ·
 *      Program · Team pills; Export pinned right (one button, Excel first); no Today, no Search.
 *   3. NOTHING ON THE CALENDAR WRITES (D3): its route answers GET only, the page and its read window send no write, and
 *      the window has no pencil.
 *   4. ONE RULE: the calendar's clashes come from 6a's rule (`findClashPairs`), never a second comparison.
 *   5. THE LIBRARY'S SAVE RULE on every write; Archive when booked, Delete only when nothing books it (refused on the
 *      server too); an archived venue leaves the pickers' read; a failed load says so.
 *   6. THE ORGANIZATION TILE is "Venue library" and carries the plan's gate (S6-11).
 *   7. THE DATABASE: members read, only the server writes (mig 321, S6-10).
 *   8. THE OLD LOOK is gone from the library page.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { kitCalendarLink } from '../../lib/admin-kit-nav.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const NAV = 'lib/admin-kit-nav.ts';
const RAIL = 'components/admin/kit/AdminKitRail.tsx';
const BAR = 'components/admin/kit/AdminKitBottomNav.tsx';
const CAL_PAGE = 'app/[orgSlug]/admin/calendar/page.tsx';
const CAL_VIEWS = 'components/admin/kit/club/ClubCalendarViews.tsx';
const CAL_CSS = 'components/admin/kit/club/ClubCalendar.module.css';
const CAL_ROUTE = 'app/api/admin/club-calendar/route.ts';
const CAL_READ = 'lib/club-calendar.ts';
const LIB_PAGE = 'app/[orgSlug]/admin/org/venues/page.tsx';
const LIB_WINDOWS = 'components/admin/kit/club/VenueLibraryWindows.tsx';
const LIB_ROUTE = 'app/api/admin/org/venues/route.ts';
const ORG_PAGE = 'app/[orgSlug]/admin/org/page.tsx';
const MIG = 'supabase/migrations/321_the_venue_library_is_written_by_the_server.sql';

describe('1. the Calendar door — under Overview, first in More, one gate', () => {
  const base = '/riverdale/admin';
  const only = (...caps: string[]) => (c: string) => caps.includes(c);

  it('shows to whoever can open a program it reads; never on a Tournament plan or a cancelled one', () => {
    for (const cap of ['module_rep_teams', 'module_house_league', 'module_tournaments']) {
      assert.equal(kitCalendarLink({ base, canUse: only(cap), isCanceled: false, tournamentTier: false })?.href, `${base}/calendar`, cap);
    }
    assert.equal(kitCalendarLink({ base, canUse: only('module_accounting', 'module_members'), isCanceled: false, tournamentTier: false }), null, 'a treasurer reads no program');
    assert.equal(kitCalendarLink({ base, canUse: only('module_rep_teams'), isCanceled: true, tournamentTier: false }), null);
    assert.equal(kitCalendarLink({ base, canUse: only('module_tournaments'), isCanceled: false, tournamentTier: true }), null);
  });

  it('wears the calendar-with-clock glyph (House league keeps the plain calendar)', () => {
    const code = readCode(NAV);
    assert.match(code, /key: 'calendar', label: 'Calendar'.*icon: CalendarClock/);
    assert.match(code, /label: 'House league', icon: CalendarDays/);
  });

  it('the rail draws it directly under Overview', () => {
    const code = readCode(RAIL);
    const overview = code.indexOf('label="Overview"');
    const calendar = code.indexOf('calendarLink.href');
    const programs = code.indexOf('<div className={styles.label}>Programs</div>');
    assert.ok(overview > 0 && calendar > overview && calendar < programs, 'Overview, then Calendar, then the programs');
  });

  it("the phone's More sheet opens on it — its first row, above Notifications", () => {
    const code = readCode(BAR);
    const calendar = code.indexOf('row(calendarLink, calendarLink.icon)');
    const notifications = code.indexOf('id="admin-mob-notifications"');
    assert.ok(calendar > 0 && calendar < notifications);
  });
});

describe('2. the coach schedule’s toolbar', () => {
  const code = readCode(CAL_PAGE);
  it('List · Week · Month in the portal’s order, opening on Week', () => {
    assert.match(code, /const VIEWS: CalendarView\[\] = \['list', 'week', 'month'\]/);
    assert.match(code, /useState<CalendarView>\('week'\)/);
  });
  it('a phone offers Week and Month only — List would repeat Week there (owner 2026-10-09, §288 W4)', () => {
    // On this page List and Week both read ONE week, and a phone draws both as the same stack of day cards. (The coach
    // schedule's List is the whole season, which is why its phone keeps three.) A computer keeps all three.
    assert.match(code, /const PHONE_VIEWS: CalendarView\[\] = \['week', 'month'\]/);
    assert.match(code, /\{PHONE_VIEWS\.map\(v =>/);
    assert.match(code, /const shownView: CalendarView = phone && view === 'list' \? 'week' : view;/);
    assert.match(code, /setView\(phone \? 'week' : 'list'\)/);
    assert.match(code, /\) : shownView === 'week' \? \(\s*<WeekView/, 'the body draws shownView, never the raw choice');
    assert.match(code, /\) : shownView === 'month' \? \(\s*<MonthView/);
    const views = readCode(CAL_VIEWS);
    const list = views.slice(views.indexOf('export function ListView'), views.indexOf('export function MonthView'));
    assert.doesNotMatch(list, /PhoneCard|cal\.stack/, 'List has no phone form');
    assert.match(views, /<section key=\{g\.key\} id=\{`cal-day-\$\{g\.key\}`\}/, "Week's phone days are Month's scroll targets");
  });
  it('the view switch leads, then the quiet Venue · Program · Team pills, Export pinned right', () => {
    const views = code.indexOf('aria-label="Show the calendar as"');
    const venue = code.indexOf('label="Venue"');
    const program = code.indexOf('label="Program"');
    const team = code.indexOf('label="Team"');
    assert.ok(views > 0 && venue > views && program > venue && team > program);
    assert.match(code, /<MultiSelectDropdown restQuiet label="Venue"/);
    assert.match(code, /<CoachListToolbar actions=\{exportMenu\}>/);
    assert.match(code, /formats=\{\['xlsx', 'csv', 'ics'\]\}/);
  });
  it('a phone keeps Export pinned right in the Filter row — never a second copy under the list (owner 2026-10-09, §288 W4)', () => {
    // The coach schedule sends Export under the list only because its phone drops the toolbar row; this page keeps the
    // row for Filter, so Export stays in it. ONE render of the menu, at every width.
    assert.equal(code.match(/\{exportMenu\}/g)?.length, 1);
    assert.doesNotMatch(readCode(CAL_CSS), /\.export(Desk|Phone)\b/);
  });
  it('no Today and no Search; the clock said once; the clash count is the amber pill that toggles Clashes only', () => {
    assert.doesNotMatch(code, />Today</);
    assert.doesNotMatch(code, /type="search"|placeholder="Search/);
    assert.match(code, /\{W\.timesNote\}/);
    assert.match(code, /className=\{cal\.amberPill\} aria-pressed=\{clashesOnly\} onClick=\{\(\) => setClashesOnly\(on => !on\)\}/);
  });
});

describe('3. nothing on the calendar writes (D3)', () => {
  it('its route answers GET and nothing else', () => {
    const code = readCode(CAL_ROUTE);
    assert.match(code, /export const GET = /);
    assert.doesNotMatch(code, /export const (POST|PATCH|PUT|DELETE)\b/);
  });
  it('the page and the views send no write, and the read window has no pencil', () => {
    for (const f of [CAL_PAGE, CAL_VIEWS]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /method: '(POST|PATCH|PUT|DELETE)'|jsonInit\(/, f);
    }
    const views = readCode(CAL_VIEWS);
    const win = views.slice(views.indexOf('export function BookingWindow'));
    assert.doesNotMatch(win, /\bedit=\{/);
    assert.doesNotMatch(win, /btn-lime/);
  });
});

describe('4. one clash rule', () => {
  it('the calendar reads 6a’s rule — findClashPairs over the club’s pool — and compares nothing itself', () => {
    const code = readCode(CAL_READ);
    assert.match(code, /findClashPairs\(pool\)/);
    assert.doesNotMatch(code, /windowsOverlap|facilityId === /);
  });
  it('a club team’s game inside a tournament the reader sees is never listed twice (S6-06)', () => {
    assert.match(readCode(CAL_READ), /if \(r\.source_tournament_game_id && clubGameIds\.has\(r\.source_tournament_game_id\)\) continue;/);
  });
  it('a game the reader can’t see carries its clash on the team’s copy they can see, under one key (/review 6b)', () => {
    const code = readCode(CAL_READ);
    assert.match(code, /if \(gid && !clubGameIds\.has\(gid\) && !mirrorKeyOfGame\.has\(gid\)\) mirrorKeyOfGame\.set\(gid, `rep_event:\$\{r\.id\}`\);/);
    assert.match(code, /mirrorKeyOfGame\.get\(g\.id\) \?\? `tday:\$\{t\.id\}:\$\{g\.game_date\}`/);
  });
});

describe('5. the Venue library — who saves, Archive vs Delete, archived out of the pickers, a failed load', () => {
  const route = readCode(LIB_ROUTE);
  const post = route.slice(route.indexOf('export const POST'));
  it('the save rule is checked once, before any action, on every write', () => {
    const rule = post.indexOf('canSaveVenueLibrary(ctx.role, ctx.capabilities)');
    const firstAction = post.indexOf("action === 'save-venue'");
    assert.ok(rule > 0 && rule < firstAction);
  });
  it('a delete is refused while anything books the venue, past included', () => {
    const del = post.slice(post.indexOf("action === 'delete-venue'"));
    assert.ok(del.indexOf('venueIsBooked(orgId, id)') < del.indexOf(".from('org_venues').delete()"));
    assert.match(del, /venueRefusal\(409, 'venue_in_use'/);
  });
  it('a facility a booking holds is renamed, never removed (refused before any write)', () => {
    const upd = post.slice(post.indexOf("action === 'update-venue'"), post.indexOf("action === 'archive-venue'"));
    assert.ok(upd.indexOf('facilitiesBooked(orgId, remove)') < upd.indexOf(".from('org_venues')\n        .update("));
    assert.match(upd, /'facility_in_use'/);
  });
  it('a rename reaches the upcoming bookings BEFORE the library writes its own rows, so a failed save is carried on retry', () => {
    const upd = post.slice(post.indexOf("action === 'update-venue'"), post.indexOf("action === 'archive-venue'"));
    const carry = upd.indexOf('carryWordsForward(');
    assert.ok(carry > 0);
    for (const write of [".from('org_venue_facilities').delete()", ".from('org_venue_facilities')\n          .update(", ".from('org_venues')\n        .update({ name"]) {
      assert.ok(upd.indexOf(write) > carry, write);
    }
  });
  it("the pickers' read (no `library=1`) returns the ACTIVE venues only", () => {
    const get = route.slice(route.indexOf('async function readVenues'), route.indexOf('export const GET'));
    assert.match(get, /else if \(!which\.withArchived\) q = q\.eq\('is_active', true\);/);
    assert.match(route, /return NextResponse\.json\(await readVenues\(ctx\.org\.id, \{ withArchived: false \}\)\);/);
  });
  it('the window offers Archive when booked, and Delete only when nothing books it — both ending the body', () => {
    const win = readCode(LIB_WINDOWS);
    // Archive / Bring back end the body with Delete, never a foot row (owner 2026-10-09, walking §288 W6).
    assert.match(win, /: archived \? <RecordAction icon=\{<ArchiveRestore size=\{13\} aria-hidden \/>\} onClick=\{\(\) => void leave\(onRestore\)\}>Bring back this venue<\/RecordAction>/);
    assert.match(win, /: u\.anyBooking \? <RecordAction icon=\{<Archive size=\{13\} aria-hidden \/>\} onClick=\{\(\) => void leave\(onArchive\)\}>Archive this venue<\/RecordAction>/);
    assert.match(win, /const canDelete = canSave && !u\.anyBooking;/);
    assert.match(win, /\{\(lifeDoor \|\| canDelete\) && \(\s*<div className=\{own\.recordEnd\}>\s*\{lifeDoor\}\s*\{canDelete && <RecordDelete/);
    assert.doesNotMatch(win, /footerStart/, 'no venue door sits in a foot row of its own');
    assert.match(win, /inUse=\{f => !!usageOf\(f\.id\)\?\.anyBooking\}/);
  });
  it('a reader who cannot save sees no Add venue and no pencil', () => {
    const page = readCode(LIB_PAGE);
    assert.match(page, /actions=\{planAllowed && canSave \? \(/);
    assert.match(readCode(LIB_WINDOWS), /const canEdit = canSave && !archived;/);
  });
  it('a failed load says so, with Try again — never an empty library (S6-09)', () => {
    const page = readCode(LIB_PAGE);
    assert.match(page, /failed \? \(\s*<LoadFailed title=\{W\.loadFailed\} onRetry=/);
  });
});

describe('6. the Organization tile', () => {
  it('is called "Venue library" and shows only on a plan that carries it (S6-11)', () => {
    const code = readCode(ORG_PAGE);
    assert.match(code, /hasOrgVenueLibrary\(currentOrg\?\.planId\) \? \[\{\s*label: 'Venue library'/);
    assert.doesNotMatch(code, /label: 'Venues'/);
  });
});

describe('7. the database: members read, only the server writes (mig 321)', () => {
  it('drops the six member write policies and revokes the writes', () => {
    const sql = readSource(MIG).toLowerCase();
    for (const t of ['org_venues', 'org_venue_facilities']) {
      for (const verb of ['write', 'update', 'delete']) {
        assert.match(sql, new RegExp(`drop policy if exists "org_members_${verb}_${t}" on public\\.${t};`), `${verb} on ${t}`);
      }
    }
    assert.match(sql, /revoke insert, update, delete on public\.org_venues, public\.org_venue_facilities from authenticated;/);
    assert.doesNotMatch(sql, /drop policy if exists "org_members_read_/);
  });
});

describe('8. the old look is gone from the library page', () => {
  it('no admin-kit switch, no legacy header', () => {
    const code = readCode(LIB_PAGE);
    assert.doesNotMatch(code, /useAdminKit\(|legacy=\{/);
    assert.doesNotMatch(code, /venues-admin\.module\.css/);
  });
  it('the calendar page exists where the door points', () => {
    assert.ok(existsSync(path.join(REPO, CAL_PAGE)));
  });
});
