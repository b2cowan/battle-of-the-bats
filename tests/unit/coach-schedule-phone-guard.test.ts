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
/** The ≤768 blocks — the touch band (K-12), where the touch Month lives since Club Tier 6c (Ask 6). */
function touchBlocks(source: string): string {
  const out: string[] = [];
  const re = /@media \(max-width: 768px\) \{/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let depth = 1, i = m.index + m[0].length;
    for (; i < source.length && depth > 0; i++) { if (source[i] === '{') depth++; else if (source[i] === '}') depth--; }
    out.push(source.slice(m.index, i));
  }
  return out.join('\n');
}
const touchCss = touchBlocks(css);

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
  // ⚖ Club Tier 6c (Ask 3, 2026-10-10): the list scrolls in its own frame at EVERY width, so the pin is every width's.
  it('the band pins inside the scroller at every width, and the frame clips with `clip`, not `hidden`', () => {
    assert.match(css, /\.scheduleScroller \.rowListBand \{[^}]*position: sticky;[^}]*top: 0;/, 'the month band is sticky at the scroller\'s top');
    assert.match(css, /\.scheduleScroller ul\.rowList \{ overflow: clip; \}/, 'inside the scroller the frame clips at every width');
    assert.match(css, /\.scheduleListFrame \{[^}]*height: max\(420px, calc\(100dvh - var\(--schedule-frame-top, 0px\) - var\(--coach-foot-clear, 0px\)[^}]*overflow-y: auto;/, 'the List is its own frame (C3), clear of the shell\'s bar');
    assert.match(page, /view === 'list' \? ` \$\{styles\.scheduleListFrame\}` : ''/, 'the coach\'s List wears it');
    assert.match(phoneCss, /ul\.rowList \{[^}]*overflow: clip;/, '`overflow: hidden` on the frame would make it the sticky container and kill the pin');
    assert.doesNotMatch(phoneCss, /ul\.rowList \{[^}]*overflow: hidden;/);
    assert.match(phoneCss, /\.schedulePage > \.scheduleScroller \{[^}]*overflow-y: auto;/, 'the scroller scrolls; the page fits the viewport');
  });
  // ⚖ Club Tier 6c (2026-10-10): the effect is ONE shared hook — the coach's page and a team's schedule (admin) both open
  // their season list through it.
  it('the open-on-today effect decides by the club-local DAY, never by an instant', () => {
    assert.match(page, /useScheduleOpensOnToday\(\{/, 'the page opens its list through the shared hook');
    const hook = readCode('components/coaches/useScheduleOpensOnToday.ts');
    const a = hook.indexOf('useLayoutEffect(() => {\n    if (!active) return;');
    assert.ok(a > 0, 'a layout effect (before first paint)');
    const effect = hook.slice(a, hook.indexOf('}, [active, trigger, scrollerRef, tailRef]);', a));
    assert.ok(effect.includes('pickTodayRow(rows.map(r => r.dataset.day'), 'the rows\' data-day is what it reads');
    assert.ok(effect.includes('tournamentToday()'), 'today is the club\'s day');
    assert.ok(!/nowMs|Date\.now\(\)|getTime\(\)/.test(effect), 'no instant — a game that started an hour ago is still today\'s row');
    assert.ok(effect.includes('scroller.scrollTop ='), 'it sets the scroller\'s position directly — no smooth scroll');
    assert.ok(!effect.includes('scrollIntoView') && !effect.includes("behavior: 'smooth'"), 'no scroll to watch');
    // The three row kinds carry their club-local day.
    assert.match(views, /data-day=\{event\.startsAt \? dayStr\(event\.startsAt\) : undefined\}/, 'an event row: orgDayKey through dayStr');
    assert.match(views, /'data-day': game\.gameDate \?\? undefined,/, 'a tournament game row: its game day');
    assert.match(views, /const day = tryoutSessionDay\(session\.startsAt\);[\s\S]*'data-day': day,/, 'a tryout row: its session day');
  });
  it('there is no "Earlier this season" fold — the past is above, in the same list', () => {
    assert.ok(!/Earlier this season/i.test(page + views), 'the first draft\'s fold row was ruled out on 2026-09-21');
    assert.ok(!/Earlier this season/i.test(css));
  });
  it('the view control renders BOTH forms — the kit toolbar\'s toggle and the glyph menu — and CSS decides', () => {
    // ⚖ Club Tier 6c (Ask 4): ONE toolbar line — the toggle leads, Export and Add Event at its end. The toggle is every
    // calendar's one switch (§289, owner 2026-10-10).
    assert.match(page, /<CoachListToolbar actions=\{<><span className=\{styles\.scheduleExportIcon\}>\{scheduleExport\}<\/span>\{!isPhone && addEventMenu\}<\/>\} className=\{styles\.scheduleToolbarWide\}>\s*<CalendarViewSwitch views=\{VIEW_MODES\}/, 'the ≥641 form: the toggle leading the kit toolbar, Export and Add Event at its end');
    // Its panel rises from the bar as a drawer titled VIEW since Sheet Frame step 2 (D5, 2026-10-05).
    assert.match(page, /<span className=\{styles\.viewMenuPhone\}>\s*<CoachToolbarMenu label=\{`Change view · \$\{VIEW_WORD\[view\]\}`\} icon=\{<ViewGlyph size=\{20\} aria-hidden \/>\} variant="glyph"\s+drawerOnPhone drawerTitle="View">/, 'the ≤640 form: a glyph-only menu named for assistive tech, wearing the CURRENT view\'s glyph');
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
  // ⚖ Club Tier 6c (Ask 12 / C13, 2026-10-10): the List-only "Export the season" row retired — Export is the title
  // row's 44px calendar mark in EVERY view on a phone, the toolbar line's button above 640.
  it('the export is the title row\'s mark on a phone, in every view; the toolbar line\'s button above', () => {
    assert.ok(!/variant="row"/.test(page), 'no quiet export row under the List');
    assert.match(page, /<span className=\{styles\.schedulePhoneOnly\}>\{scheduleExport\}<\/span>/, 'the title row\'s Export, every view');
    // Club Tier 6d (B2, 2026-10-11): the same one control also carries the Subscribe door — still one set of choices.
    assert.match(page, /choices=\{scheduleExportChoices\}\s*(subscribe=\{scheduleSubscribe\}\s*)?\/>\s*\);/, 'one control, one set of choices');
    assert.match(css, /\.schedulePhoneOnly \{ display: none; \}/);
    assert.match(phoneCss, /\.schedulePhoneOnly \{ display: contents; \}/);
    assert.ok(!/\.scheduleExportRow/.test(css), 'the row\'s rules went with it');
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
    // ⚖ Club Tier 6c (Ask 6 / C6–C8): the touch Month from 768 down; the band in the one spelling, today in words; an
    // empty day said once.
    assert.match(views, /<CoachRowBand>\{dayHeading\(selectedDay, today\)\}<\/CoachRowBand>/, 'the day names the band');
    assert.match(views, /\{NOTHING_SCHEDULED\}/, 'an empty day says so, once');
    assert.match(touchCss, /\.calMonthDayEvents \{ display: none; \}/, 'the chips and "+N more" leave the touch band');
    assert.match(touchCss, /\.calMonthDayRows \{ display: block;/, 'the chosen day\'s rows show from 768 down');
    assert.match(css, /\.calMonthDayRows \{ display: none; \}/, 'and never at a desk');
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
    assert.ok(room.includes('onClick={e => setRsvpEditId(row.player.id, e.currentTarget)}'), 'the tap names the row — where the sheet hands focus back');
    assert.ok(!/Edit RSVP/.test(page + sheet + room), 'no "Edit RSVP" anywhere on the page, its sheet or its room');
    assert.ok(!/Edit RSVP|rsvpEditor|rsvpOption/.test(css), 'nor its editor\'s rules in the stylesheet');
    assert.match(room, /<span className=\{styles\.attendanceStatusBadge\} data-status=\{row\.status\} data-field-key aria-hidden>/, 'the badge is the trail and the looked-for value (A4)');
    assert.ok(room.includes('<div className={styles.attendanceRoom} data-field-floor>'), 'the field floor survives');
  });
  it('the RSVP sheet is a real dialog on its own floor, rendered as a SIBLING of the event sheet', () => {
    const rsvp = readCode(RSVP);
    // Wherever the bar shows it is the shared sheet frame's FORM layer over the event window (Sheet Frame step 4 —
    // modal, its floor the frame's, pinned in sheet-frame-guard); on a computer, a dialog on its own floor.
    assert.match(rsvp, /<SheetFrame form overWindow grabCloses onClose=\{onClose\} opener=\{opener\} role="dialog" aria-labelledby=\{nameId\}/);
    assert.match(rsvp, /role="dialog" aria-modal="true" aria-labelledby=\{nameId\}/);
    assert.ok(rsvp.includes('useDialogFloor(!isPhoneNav, panelRef, { onClose, opener });'), 'its own floor — Escape closes it first, focus returns to the row');
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
    assert.match(phoneCss, /\.slideOverFoot \.slideOverActionsRight \{ display: contents; \}/, 'two equal cells — the right-hand group dissolves (Edit became the head’s pencil, 2026-10-09)');
  });
});
