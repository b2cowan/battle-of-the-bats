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
const STYLES = 'app/[orgSlug]/coaches/coaches.module.css';
const RSVP = 'components/coaches/CoachRsvpSheet.tsx';
const MENU = 'components/coaches/CoachToolbarMenu.tsx';
const MENU_STYLES = 'components/coaches/CoachToolbarMenu.module.css';
const ROSTER = 'app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx';
const PURE = 'lib/coach-schedule-phone.ts';

const page = readCode(PAGE);
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

/** The sheet's render function, sliced out of the page. */
function sheetFn(): string {
  const a = page.indexOf('function renderEventSheet(');
  const b = page.indexOf('\n  return (\n    <div className={`${styles.page}', a);
  assert.ok(a > 0 && b > a, 'the sheet is rendered by renderEventSheet(), declared before the page\'s return');
  return page.slice(a, b);
}

describe('C1 — the list is the scroller and opens on today', () => {
  it('the schedule list declares the recipe\'s framed phone form', () => {
    assert.match(page, /<CoachRowList label="Schedule" phoneFrame>/, 'one white frame with hairlines at ≤640 (S.7; B5\'s second phone form)');
  });
  it('the band pins inside the scroller, and the frame clips with `clip`, not `hidden` — both at ≤640', () => {
    assert.match(phoneCss, /\.scheduleScroller \.rowListBand \{[^}]*position: sticky;[^}]*top: 0;/, 'the month band is sticky at the scroller\'s top');
    assert.match(phoneCss, /ul\.rowListPhoneFrame \{[^}]*overflow: clip;/, '`overflow: hidden` on the frame would make it the sticky container and kill the pin');
    assert.doesNotMatch(phoneCss, /ul\.rowListPhoneFrame \{[^}]*overflow: hidden;/);
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
    assert.match(page, /data-day=\{event\.startsAt \? dayStr\(event\.startsAt\) : undefined\}/, 'an event row: orgDayKey through dayStr');
    assert.match(page, /'data-day': game\.gameDate \?\? undefined,/, 'a tournament game row: its game day');
    assert.match(page, /data-day=\{tryoutSessionDay\(session\.startsAt\)\}/, 'a tryout row: its session day');
  });
  it('there is no "Earlier this season" fold — the past is above, in the same list', () => {
    assert.ok(!/Earlier this season/i.test(page), 'the first draft\'s fold row was ruled out on 2026-09-21');
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
    assert.ok(page.includes('const groups = groupWeekDays(cells);'));
    assert.match(page, /className=\{`\$\{styles\.calWeekGrid\} \$\{styles\.calWeekWide\}`\}/, 'the seven cards');
    assert.match(page, /className=\{styles\.calWeekPhone\}/, 'the grouped stack');
    assert.match(page, /<p key=\{g\.from\} className=\{styles\.calWeekQuiet\}>\{weekEmptyLine\(g\.label\)\}<\/p>/, 'a run of empty days is one quiet line, spelled once');
    assert.match(css, /\.calWeekPhone \{ display: none; \}/);
    assert.match(phoneCss, /\.calWeekWide \{ display: none; \}/);
  });
  it('Month: the cell is the tap, the dots are decoration, the selected day\'s rows sit under the grid', () => {
    assert.match(page, /const \[selectedDay, setSelectedDay\] = useState\(\(\) => tournamentToday\(\)\);/, 'today pre-selected');
    assert.match(page, /className=\{styles\.calMonthDayBtn\}\s+aria-pressed=\{isSelected\}/, 'a real button over the cell');
    assert.match(page, /<span className=\{styles\.calMonthDots\} aria-hidden>/);
    assert.match(page, /<CoachRowBand>\{selectedLong\}<\/CoachRowBand>/, 'the day names the band');
    assert.match(page, /Nothing on \{selectedLong\}/, 'an empty day says so');
    assert.match(phoneCss, /\.calMonthDayEvents \{ display: none; \}/, 'the chips and "+N more" leave the phone');
    assert.match(css, /\.calMonthDayRows \{ display: none; \}/, 'the rows are phone-only');
  });
  it('the pure helpers are React-free and exported', () => {
    const pure = readCode(PURE);
    assert.ok(!pure.includes("from 'react'"));
    for (const fn of ['pickTodayRow', 'groupWeekDays', 'sheetOrder', 'weekEmptyLine']) assert.ok(pure.includes(`export function ${fn}`) || pure.includes(`export const ${fn}`), fn);
  });
});

describe('C3 — the sheet by the clock; the row is the tap; the RSVP sheet is a dialog on its own floor', () => {
  const fn = sheetFn();
  it('two block orders, in JSX, switched by gameHasStarted through the pure sheetOrder', () => {
    assert.ok(fn.includes('const started = gameHasStarted(ev, nowMs);'));
    assert.ok(fn.includes("const scoreLeads = isGameEvent && sheetOrder({ started, hasScore }) === 'score-first';"));
    assert.match(fn, /const body = !isPhone \? \(/, 'the desktop order first');
    assert.match(fn, /\) : scoreLeads \? \(/, 'then the phone\'s two');
    // The two phone orders differ in WHERE the score block sits: before the tabs, or after them.
    const phone = fn.slice(fn.indexOf(') : scoreLeads ? ('));
    const first = phone.slice(0, phone.indexOf(') : ('));
    const second = phone.slice(phone.indexOf(') : ('));
    assert.ok(first.indexOf('{scoreBlock}') < first.indexOf('{tabsBlock}'), 'score-first: the score before the tabs');
    assert.ok(second.indexOf('{tabsBlock}') < second.indexOf('{scoreBlock}'), 'tabs-first: the tabs before the score door');
    assert.ok(!/[\s;{]order:\s*\d/.test(phoneBlocks(css).slice(phoneBlocks(css).indexOf('.slideOverFoot'))), 'no CSS `order` on the sheet (a `border:` is not an `order:`) — the tab sequence is the reading order');
  });
  it('the awards block does not render before first pitch on a phone', () => {
    assert.ok(fn.includes('const awardsBlock = isGameEvent && drawerDoors.awards && (!isPhone || scoreLeads) ? ('));
  });
  it('the deep-link tab calls are untouched', () => {
    assert.ok(page.includes("if (sp.get('tab') === 'lineup') setSlideTab('lineup');"));
    assert.ok(page.includes("if (sp.get('tab') === 'scouting') setSlideTab('scouting');"));
  });
  it('the attendance row is the tap — a button that says it opens a dialog — and the old button is gone', () => {
    assert.match(fn, /<CoachRowList label="Attendance" inset phoneFrame className=\{styles\.attendanceRows\}>/, 'the portal\'s one row recipe, framed on a phone');
    assert.match(fn, /<CoachRow\s+key=\{row\.player\.id\}\s+as="button"\s+aria-haspopup="dialog"/, 'the whole row raises the sheet');
    assert.ok(fn.includes('onClick={() => setRsvpEditId(row.player.id)}'));
    assert.ok(!/Edit RSVP/.test(page), 'no "Edit RSVP" anywhere on the page');
    assert.ok(!/Edit RSVP|rsvpEditor|rsvpOption/.test(css), 'nor its editor\'s rules in the stylesheet');
    assert.match(fn, /<span className=\{styles\.attendanceStatusBadge\} data-status=\{row\.status\} data-field-key aria-hidden>/, 'the badge is the trail and the looked-for value (A4)');
    assert.ok(fn.includes('<div className={styles.attendanceSection} data-field-floor>'), 'the field floor survives');
  });
  it('the RSVP sheet is a real dialog on its own floor, rendered as a SIBLING of the event sheet', () => {
    const rsvp = readCode(RSVP);
    assert.match(rsvp, /role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{nameId\}/);
    assert.ok(rsvp.includes('useDialogFloor(true, panelRef, { onClose });'), 'its own floor — Escape closes it first, focus returns to the row');
    assert.match(rsvp, /aria-pressed=\{on\}/, 'the four choices say which one holds');
    assert.ok(!rsvp.includes('useOverlayOpen('), 'the event sheet beneath already holds the lock');
    assert.ok(!fn.includes('<CoachRsvpSheet'), 'never inside the event sheet\'s panel');
    const siteA = page.indexOf('{selectedEvent && renderEventSheet(selectedEvent)}');
    const siteB = page.indexOf('<CoachRsvpSheet');
    assert.ok(siteA > 0 && siteB > siteA, 'rendered after the event sheet, as a sibling');
    assert.ok(page.includes('onPick={status => { setPlayerAttendance(row.player.id, { status }); setRsvpEditId(null); }}'), 'a choice writes through the list\'s own path and closes');
    assert.ok(page.includes('onNote={note => setPlayerAttendance(row.player.id, { note })}'), 'a note rides the same autosave');
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
