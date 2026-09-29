import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE SCHEDULE ON A PHONE (phone re-evaluation stage 2, owner rulings C1–C4, 2026-09-21)
 *
 * Four rulings, each of which a later tidy-up could quietly undo without a test failing:
 *
 *   C1 **THE LIST IS THE SCROLLER AND OPENS ON TODAY.** At ≤640 the calendar body is the thing that
 *      scrolls; the month band pins at its top; the list's rows keep ONE white frame (the recipe's
 *      declared phone form); the position is set before first paint from the first row whose
 *      club-local DAY is on or after today — never from an instant, because a game that started
 *      an hour ago is still today's. There is no "Earlier this season" fold: the past is above.
 *      The view switch is a glyph-only menu beside "+" (both forms render; CSS decides); the "+"
 *      loses its chevron on a phone; Roster's List / Depth chart toggle stays a toggle.
 *
 *   C2 **A WEEK WITHOUT BLANKS; A MONTH OF DOTS WITH THE DAY'S ROWS BENEATH.** Both forms render.
 *
 *   C3 **THE SHEET ORDERS ITSELF BY THE CLOCK, IN JSX ORDER.** Two block orders switched by
 *      `gameHasStarted` (through the pure `sheetOrder`), never CSS `order`; the awards block does
 *      not render before first pitch; the deep-link tab calls are untouched; the attendance row
 *      is the tap (`<button aria-haspopup="dialog">`) and raises the RSVP sheet — a real dialog on
 *      its own floor, rendered as a SIBLING of the event sheet (nested, one Escape would close
 *      both). The "Edit RSVP" button and its inline editor are gone at every width.
 *
 *   C4 is the baseline file's business (`check:layout`), not this guard's.
 *
 * Asserted against SOURCE with comments stripped (see `_source-code.ts` for why).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';
// The Schedule deep dive's split (stage 1 · S6, 2026-09-25) moved the list / week / month and the
// event sheet out of the page into files of their own; each assertion reads the file its code lives in.
const VIEWS = 'components/coaches/ScheduleCalendarViews.tsx';
const SHEET = 'components/coaches/ScheduleEventSheet.tsx';
// Stage 1 · E2 (2026-09-25): the attendance list lives in its own room, a view inside the sheet.
const ROOM = 'components/coaches/ScheduleAttendanceRoom.tsx';
const STYLES = 'app/[orgSlug]/coaches/coaches.module.css';
const RSVP = 'components/coaches/CoachRsvpSheet.tsx';
const MENU = 'components/coaches/CoachToolbarMenu.tsx';
const MENU_STYLES = 'components/coaches/CoachToolbarMenu.module.css';
const ROSTER = 'app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx';
const PURE = 'lib/coach-schedule-phone.ts';

const page = readCode(PAGE);
const views = readCode(VIEWS);
const sheet = readCode(SHEET);
const room = readCode(ROOM);
const css = stripComments(readSource(STYLES));

/** The ≤640 blocks of a stylesheet, joined — what a phone-only rule must live inside. */
function phoneBlocks(source: string): string {
  const out: string[] = [];
  const re = /@media \(max-width: 640px\) \{/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let depth = 1, i = m.index + m[0].length;
    for (; i < source.length && depth > 0; i++) { if (source[i] === '{') depth++; else if (source[i] === '}') depth--; }
    out.push(source.slice(m.index, i));
  }
  return out.join('\n');
}
const phoneCss = phoneBlocks(css);

/** The sheet's blocks and its orders — from the clock it reads to the return that draws the panel. */
function sheetFn(): string {
  const a = sheet.indexOf('const hasScore = ev.teamScore != null');
  const b = sheet.indexOf('\n  return (\n    <>\n      <div className={styles.modalOverlay}', a);
  assert.ok(a > 0 && b > a, 'the sheet builds its blocks, then returns the overlay');
  return sheet.slice(a, b);
}
/** The event sheet's PANEL — the overlay's own markup, up to the siblings that follow it. */
function sheetPanel(): string {
  const a = sheet.indexOf('<div className={styles.modalOverlay}');
  const b = sheet.indexOf('{rsvpEditId && (() => {', a);
  assert.ok(a > 0 && b > a, 'the overlay, then the RSVP sheet after it');
  return sheet.slice(a, b);
}

describe('C1 — the list is the scroller and opens on today', () => {
  it('the schedule list is the row recipe, framed on a phone', () => {
    assert.match(views, /<CoachRowList label="Schedule">/, 'one white frame with hairlines at ≤640 — every row list\'s one phone form (P1)');
  });
  it('the band pins inside the scroller, and the frame clips with `clip`, not `hidden` — both at ≤640', () => {
    assert.match(phoneCss, /\.scheduleScroller \.rowListBand \{[^}]*position: sticky;[^}]*top: 0;/, 'the month band is sticky at the scroller\'s top');
    assert.match(phoneCss, /ul\.rowList \{[^}]*overflow: clip;/, '`overflow: hidden` on the frame would make it the sticky container and kill the pin');
    assert.doesNotMatch(phoneCss, /ul\.rowList \{[^}]*overflow: hidden;/);
    assert.match(phoneCss, /\.schedulePage > \.scheduleScroller \{[^}]*overflow-y: auto;/, 'the scroller scrolls; the page fits the viewport');
  });
  it('the open-on-today effect decides by the club-local DAY, never by an instant', () => {
    const a = page.indexOf('useLayoutEffect(() => {');
    assert.ok(a > 0, 'a layout effect (before first paint)');
    const effect = page.slice(a, page.indexOf('}, [loading, view, teamId]);', a));
    assert.ok(effect.includes('pickTodayRow(rows.map(r => r.dataset.day'), 'the rows\' data-day is what it reads');
    assert.ok(effect.includes('tournamentToday()'), 'today is the club\'s day');
    assert.ok(!/nowMs|Date\.now\(\)|getTime\(\)/.test(effect), 'no instant — a game that started an hour ago is still today\'s row');
    assert.ok(effect.includes('scroller.scrollTop ='), 'it sets the scroller\'s position directly — no smooth scroll');
    assert.ok(!effect.includes('scrollIntoView') && !effect.includes("behavior: 'smooth'"), 'no scroll to watch');
    // The three row kinds carry their club-local day.
    assert.match(views, /data-day=\{event\.startsAt \? dayStr\(event\.startsAt\) : undefined\}/, 'an event row: orgDayKey through dayStr');
    assert.match(views, /'data-day': game\.gameDate \?\? undefined,/, 'a tournament game row: its game day');
    assert.match(views, /data-day=\{tryoutSessionDay\(session\.startsAt\)\}/, 'a tryout row: its session day');
  });
  it('there is no "Earlier this season" fold — the past is above, in the same list', () => {
    assert.ok(!/Earlier this season/i.test(page + views), 'the first draft\'s fold row was ruled out on 2026-09-21');
    assert.ok(!/Earlier this season/i.test(css));
  });
  it('the view control renders BOTH forms — the kit toolbar\'s toggle and the glyph menu — and CSS decides', () => {
    assert.match(page, /<CoachListToolbar actions=\{scheduleExport\} className=\{styles\.scheduleToolbarWide\}>\s*<div className=\{styles\.viewToggle\}>/, 'the ≥641 form: the toggle inside the kit toolbar');
    assert.match(page, /<span className=\{styles\.viewMenuPhone\}>\s*<CoachToolbarMenu label=\{`Change view · \$\{VIEW_WORD\[view\]\}`\} icon=\{<ViewGlyph size=\{20\} aria-hidden \/>\} variant="glyph">/, 'the ≤640 form: a glyph-only menu named for assistive tech, wearing the CURRENT view\'s glyph');
    assert.match(page, /checked=\{view === v\}/, 'the rows are radio items with the current one ticked');
    assert.match(phoneCss, /\.viewMenuPhone \{ display: inline-flex; \}/);
    assert.match(phoneCss, /\.schedulePage \.scheduleToolbarWide \{ display: none; \}/);
    assert.match(css, /\.viewMenuPhone \{ display: none; \}/, 'hidden above 640');
    const menu = readCode(MENU);
    assert.match(menu, /variant\?: 'secondary' \| 'primary' \| 'chip' \| 'glyph';/);
    assert.match(menu, /variant !== 'chip' && variant !== 'glyph' && <ChevronDown/, 'the glyph trigger draws no chevron');
  });
  it('the "+" loses its chevron at ≤640 and nowhere else', () => {
    assert.match(page, /collapseOnPhone\s+bareOnPhone/, 'the Add Event trigger is bare on a phone');
    const menuCss = stripComments(readSource(MENU_STYLES));
    assert.match(phoneBlocks(menuCss), /\.triggerBare > svg:last-child \{ display: none; \}/, 'the chevron hides by a ≤640 rule; the desktop\'s worded trigger keeps it');
  });
  it('the header\'s actions never drop on a phone — the view menu is for every coach', () => {
    assert.ok(!/actionsPhoneHidden=\{!canAddEvents\}/.test(page), 'a read-only assistant still switches views; the create gates itself');
  });
  it('Roster\'s List / Depth chart toggle stays a toggle — two options do not earn a menu', () => {
    const roster = readCode(ROSTER);
    assert.ok(roster.includes('kit.toolbarView'), 'the roster still draws its segmented switch');
    assert.ok(!roster.includes('variant="glyph"'), 'and no glyph menu');
  });
  it('the export is a quiet row under the list at ≤640, the toolbar\'s button above', () => {
    assert.match(page, /<CoachExportButton variant="row" label="Schedule" choices=\{scheduleExportChoices\} \/>/);
    assert.match(page, /choices=\{scheduleExportChoices\}\s*\/>\s*\);/, 'the toolbar\'s button reads the same choices');
    assert.match(css, /\.scheduleExportRow \{ display: none; \}/);
    assert.match(phoneCss, /\.scheduleExportRow \{ display: block; \}/);
  });
});

describe('C2 — a week without blanks; a month of dots with the day\'s rows beneath', () => {
  it('Week renders both forms from one set of cells, grouped by the pure helper', () => {
    assert.ok(views.includes('const groups = groupWeekDays(cells);'));
    assert.match(views, /className=\{`\$\{styles\.calWeekGrid\} \$\{styles\.calWeekWide\}`\}/, 'the seven cards');
    assert.match(views, /className=\{styles\.calWeekPhone\}/, 'the grouped stack');
    assert.match(views, /<p key=\{g\.from\} className=\{styles\.calWeekQuiet\}>\{weekEmptyLine\(g\.label\)\}<\/p>/, 'a run of empty days is one quiet line, spelled once');
    assert.match(css, /\.calWeekPhone \{ display: none; \}/);
    assert.match(phoneCss, /\.calWeekWide \{ display: none; \}/);
  });
  it('Month: the cell is the tap, the dots are decoration, the selected day\'s rows sit under the grid', () => {
    assert.match(page, /const \[selectedDay, setSelectedDay\] = useState\(\(\) => tournamentToday\(\)\);/, 'today pre-selected');
    assert.match(views, /className=\{styles\.calMonthDayBtn\}\s+aria-pressed=\{isSelected\}/, 'a real button over the cell');
    assert.match(views, /<span className=\{styles\.calMonthDots\} aria-hidden>/);
    assert.match(views, /<CoachRowBand>\{selectedLong\}<\/CoachRowBand>/, 'the day names the band');
    assert.match(views, /Nothing on \{selectedLong\}/, 'an empty day says so');
    assert.match(phoneCss, /\.calMonthDayEvents \{ display: none; \}/, 'the chips and "+N more" leave the phone');
    assert.match(css, /\.calMonthDayRows \{ display: none; \}/, 'the rows are phone-only');
  });
  it('the pure helpers are React-free and exported', () => {
    const pure = readCode(PURE);
    assert.ok(!pure.includes("from 'react'"));
    for (const fn of ['pickTodayRow', 'groupWeekDays', 'sheetOrder', 'weekEmptyLine']) assert.ok(pure.includes(`export function ${fn}`) || pure.includes(`export const ${fn}`), fn);
  });
});

/*
 * ⚠ C3's CLOCK STANDS; ITS TABS DO NOT (the Schedule deep dive, stage 1 · E1–E6, owner ruling
 * 2026-09-25). "Tabs before first pitch / score from first pitch" became "ROWS before / score from",
 * the same clock — and at EVERY width (E6), so the desktop's third order is gone. The rows, the room
 * and the rest of stage 1 are pinned in coach-schedule-sheet-guard.test.ts; what stays here is the
 * clock, the RSVP sheet's floor and the phone forms of the where-row and the foot row.
 */
describe('C3 — the sheet by the clock; the row is the tap; the RSVP sheet is a dialog on its own floor', () => {
  const fn = sheetFn();
  it('two block orders, in JSX, switched by gameHasStarted through the pure sheetOrder — at every width (E6)', () => {
    assert.ok(fn.includes('const started = gameHasStarted(ev, nowMs);'));
    assert.ok(fn.includes("const scoreLeads = isGameEvent && sheetOrder({ started, hasScore }) === 'score-first';"));
    assert.match(fn, /const body = scoreLeads \? \(/, 'the clock picks the order');
    assert.ok(!/const body = !isPhone/.test(fn), 'the width never does — the desktop draws the same order (E6)');
    // The two orders differ in WHERE the score block sits: before the door rows, or after them.
    const first = fn.slice(fn.indexOf('const body = scoreLeads ? ('), fn.indexOf(') : (', fn.indexOf('const body = scoreLeads ? (')));
    const second = fn.slice(fn.indexOf(') : (', fn.indexOf('const body = scoreLeads ? (')));
    assert.ok(first.indexOf('{scoreBlock}') < first.indexOf('{doorRows}'), 'score-first: the score before the rows');
    assert.ok(second.indexOf('{doorRows}') < second.indexOf('{scoreBlock}'), 'rows-first: the rows before the score door');
    assert.ok(!/[\s;{]order:\s*\d/.test(phoneBlocks(css).slice(phoneBlocks(css).indexOf('.slideOverFoot'))), 'no CSS `order` on the sheet (a `border:` is not an `order:`) — the tab sequence is the reading order');
  });
  it('the awards block does not render before first pitch — on a phone, and since stage 1 · E6 at a desk too', () => {
    // A GAME's awards wait for the score to lead, at every width (E6: the desk's "Enter a final score
    // to unlock awards" on a game days away was F08). Since awards at any event (owner, 2026-09-25)
    // the non-game branch opens on the event's own state instead — pinned in
    // coach-awards-any-event.test.ts.
    assert.ok(fn.includes('const awardsBlock = drawerDoors.awards && (isGameEvent ? scoreLeads : awardUnlock === \'open\') ? ('));
  });
  it('the deep link still reads the address — and since stage 1 · E5 a tab names a VIEW, not a tab', () => {
    // tab=attendance → the room; tab=scouting → the book's panel; tab=lineup and none → the sheet
    // (`sheetViewFromTab`, pinned in coach-schedule-sheet.test.ts).
    assert.ok(page.includes("openEvent(ev, sheetViewFromTab(sp.get('tab')));"));
    assert.ok(sheet.includes('const [view, setView] = useState<SheetView | null>(initialView);'), 'the sheet opens on the view it is handed');
  });
  it('the attendance row is the tap — a button that says it opens a dialog — and the old button is gone (in the room, since stage 1 · E2)', () => {
    assert.match(room, /<CoachRowList label="Attendance" inset className=\{styles\.attendanceRows\}>/, 'the portal\'s one row recipe, hairlined inside the sheet on a phone');
    assert.match(room, /<CoachRow\s+key=\{row\.player\.id\}\s+as="button"\s+aria-haspopup="dialog"/, 'the whole row raises the sheet');
    assert.ok(room.includes('onClick={() => setRsvpEditId(row.player.id)}'));
    assert.ok(!/Edit RSVP/.test(page + sheet + room), 'no "Edit RSVP" anywhere on the page, its sheet or its room');
    assert.ok(!/Edit RSVP|rsvpEditor|rsvpOption/.test(css), 'nor its editor\'s rules in the stylesheet');
    assert.match(room, /<span className=\{styles\.attendanceStatusBadge\} data-status=\{row\.status\} data-field-key aria-hidden>/, 'the badge is the trail and the looked-for value (A4)');
    assert.ok(room.includes('<div className={styles.attendanceRoom} data-field-floor>'), 'the field floor survives');
  });
  it('the RSVP sheet is a real dialog on its own floor, rendered as a SIBLING of the event sheet', () => {
    const rsvp = readCode(RSVP);
    assert.match(rsvp, /role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{nameId\}/);
    assert.ok(rsvp.includes('useDialogFloor(true, panelRef, { onClose });'), 'its own floor — Escape closes it first, focus returns to the row');
    assert.match(rsvp, /aria-pressed=\{on\}/, 'the four choices say which one holds');
    assert.ok(!rsvp.includes('useOverlayOpen('), 'the event sheet beneath already holds the lock');
    assert.ok(!fn.includes('<CoachRsvpSheet'), 'never inside the event sheet\'s panel');
    assert.ok(!sheetPanel().includes('<CoachRsvpSheet'), 'never inside the event sheet\'s panel');
    assert.ok(!room.includes('<CoachRsvpSheet'), 'nor inside the room the panel holds');
    const siteA = sheet.indexOf('<div className={styles.modalOverlay}');
    const siteB = sheet.indexOf('<CoachRsvpSheet');
    assert.ok(siteA > 0 && siteB > siteA, 'rendered after the event sheet\'s overlay, as a sibling');
    assert.ok(sheet.includes('onPick={status => { setPlayerAttendance(row.player.id, { status }); setRsvpEditId(null); }}'), 'a choice writes through the list\'s own path and closes');
    assert.ok(sheet.includes('onNote={note => setPlayerAttendance(row.player.id, { note })}'), 'a note rides the same autosave');
  });
  it('the where-row and the foot row are phone forms; the desktop keeps its inline link and its action row', () => {
    assert.ok(fn.includes('isPhone && mappable ? ('), 'the where-row only where the map opens');
    assert.match(fn, /className=\{styles\.slideOverWhereRow\}/);
    // The foot row is PINNED (owner, 2026-09-21): it rides the form sheets' `.modalFooter` sticky
    // recipe, on the phone branch only — a second sticky rule on `.slideOverFoot` is the trap the
    // stylesheet's `:has(.modalFooter)` note records eight panels falling into.
    assert.match(fn, /className=\{`\$\{styles\.slideOverActions\}\$\{isPhone \? ` \$\{styles\.slideOverFoot\} \$\{styles\.modalFooter\}` : ''\}`\}/);
    assert.ok(!/\.slideOverFoot\s*\{[^}]*position:\s*sticky/.test(phoneCss), 'the pin is the shared recipe, not a second sticky rule');
    assert.match(phoneCss, /\.slideOverFoot \.slideOverActionsRight \{ display: contents; \}/, 'three equal cells — the right-hand group dissolves');
  });
});
