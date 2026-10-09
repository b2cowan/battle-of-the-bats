import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, stripComments } from './_source-code.ts';
import { EVENT_DELETE_TAKES } from '../../lib/coach-schedule-vocab.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE EVENT SHEET — STAGE 1 OF THE SCHEDULE DEEP DIVE (owner ruling 2026-09-25: E1–E6 "as drawn",
 * S6 "split first", D1 "fix now"). The markup half; the words and the Lineup door's clock are pure
 * and pinned in `coach-schedule-sheet.test.ts`.
 *
 *   E1 ONE SHAPE ON EVERY EVENT: the summary, then the event's jobs as DOOR ROWS (the row recipe,
 *      64px, a second line that says where the job stands), then the foot row. Rows per kind; a
 *      door a person cannot use is not drawn.
 *   E2 ATTENDANCE HAS ITS OWN ROOM — a view inside the same dialog, one Back level, everything moved
 *      from the old tab (chips, All in, Reset, the rows, the Saved pill, the field floor).
 *   E3 LINEUP AND SCOUTING ARE ROWS; THE TABS GO; the look-only peek retires.
 *   E4 THE LINEUP WARNING JOINS THE LINEUP ROW; its box, its 97×15px link and "fix the attendance
 *      below" go (the help content too).
 *   E5 THE ADDRESSES: tab=attendance → the room, tab=scouting → the book, tab=lineup → the sheet.
 *   E6 THE DESK DRAWS THE SAME: one order by the clock at every width; awards follow the clock.
 *
 * Asserted against SOURCE with comments stripped (see `_source-code.ts` for why).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const SHEET = 'components/coaches/ScheduleEventSheet.tsx';
const ROOM = 'components/coaches/ScheduleAttendanceRoom.tsx';
const PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';
const STYLES = 'app/[orgSlug]/coaches/coaches.module.css';
const HELP = 'lib/help-content/coaches.tsx';

const sheet = readCode(SHEET);
const room = readCode(ROOM);
const page = readCode(PAGE);
const css = stripComments(readSource(STYLES));

describe('E1 — one shape: the summary, the door rows, the foot row', () => {
  it('the rows are the portal\'s row recipe in one frame, and a view is opened by a ROW, never a tab', () => {
    assert.match(sheet, /<CoachRowList label="On this event" className=\{styles\.sheetDoorRows\}>\s*\{planRow\}\{attendanceRow\}\{lineupRow\}\{scoutingRow\}\s*<\/CoachRowList>/,
      'the order a job is done in: the plan, Attendance, the Lineup, the book');
    assert.match(sheet, /const doorRows = planRow \|\| attendanceRow \|\| lineupRow \|\| scoutingRow \? \(/, 'no empty frame when no row applies');
  });
  it('every row rides its door — a door a person cannot use is not drawn', () => {
    assert.match(sheet, /const attendanceRow = drawerDoors\.attendanceTab \? \(/);
    assert.match(sheet, /const lineupRow = drawerDoors\.lineupTab && isLineupEvent\(ev\) \? \(/);
    assert.match(sheet, /const scoutingKey = drawerDoors\.scoutingTab && ev\.opponent\s*\? normalizeOpponentName\(ev\.opponent\)\s*: '';/, 'no Scouting row for a TBD opponent');
    assert.match(sheet, /const scoutingRow = scoutingKey \? \(/);
    assert.match(sheet, /const planCaption = practiceHasPlan\(ev\)/, '"has a plan" is the hub\'s one definition');
    assert.match(sheet, /const planRow = ev\.eventType !== 'practice' \? null : planCaption \? \(/, 'the plan row is a practice\'s; a viewer with no plan to read gets a row that opens nothing');
  });
  it('a row is 64px with its icon beside BOTH lines at every width — the drawn anatomy, not the phone card', () => {
    assert.match(css, /\.sheetDoorRows \.rowListRow,\s*\.sheetDoorRows \.rowListRow:has\(\.rowCaption\) \{[^}]*min-height: 64px;/);
    const phone = css.slice(css.indexOf('.sheetDoorRows .rowListMain { display: flex; }') - 400);
    assert.ok(css.includes('.sheetDoorRows .rowListMain { display: flex; }'), 'the name and its line stay stacked beside the icon at ≤640');
    assert.ok(phone.includes('.sheetDoorRows .rowListRow::after { display: none; }'), 'the recipe\'s line break is off inside a door row');
    assert.match(css, /\.sheetDoorRows \.rowListCaption \{[^}]*-webkit-line-clamp: 2;/, 'the second line never runs past two lines');
  });
  it('the old kicker, summary and "Open the plan →" button became the plan row — same destination, same summary', () => {
    assert.match(sheet, /const planFace = \{ mark: <ClipboardList size=\{20\} aria-hidden \/>, title: 'Practice plan' \};/);
    assert.match(sheet, /\? `\$\{summarizePracticePlan\(ev\.practicePlan!\)\}/, 'the same summary the old kicker carried');
    assert.match(sheet, /<CoachRow as="link" href=\{`\$\{base\}\/practice\/\$\{ev\.id\}`\} \{\.\.\.planFace\} caption=\{planCaption\} door="chevron" \/>/, 'the same destination');
    assert.ok(!sheet.includes('Open the plan →') && !sheet.includes('Plan this practice →'), 'no second door to the same page');
    assert.ok(sheet.includes('No plan yet. Writing the plan comes with Schedule: View + edit — ask your head coach.'), 'a viewer is told why');
  });
});

describe('E2 — attendance in its own room', () => {
  it('the Attendance row opens the room as a VIEW inside the sheet\'s dialog — never a second overlay', () => {
    assert.match(sheet, /onClick=\{\(\) => setView\('attendance'\)\}/);
    assert.match(sheet, /const panelContent = openView === 'attendance' \? \(/, 'the dialog\'s body swaps to the room');
    assert.match(sheet, /<ScheduleAttendanceRoom\b/);
    assert.equal((sheet.match(/className=\{styles\.modalOverlay\}/g) ?? []).length, 1, 'one overlay — the room is not a second one');
  });
  it('everything moved from the tab: the chips, All in, Reset, the rows, the Saved pill, the field floor', () => {
    assert.match(room, /<div className=\{styles\.attendanceRoom\} data-field-floor>/);
    assert.match(room, /role="group" aria-label="Filter attendance by status"/);
    assert.ok(room.includes("onClick={() => setAllAttendance('attending')}") && room.includes("onClick={() => setAllAttendance('unknown')}"));
    assert.match(room, /<CoachRowList label="Attendance" inset className=\{styles\.attendanceRows\}>/);
    assert.match(room, /<CoachRow\s+key=\{row\.player\.id\}\s+as="button"\s+aria-haspopup="dialog"/, 'the row is the tap and says it opens a dialog');
    assert.ok(room.includes('onClick={e => setRsvpEditId(row.player.id, e.currentTarget)}'), 'the tap names the row — where the RSVP sheet hands focus back (Sheet Frame step 4)');
    assert.ok(room.includes('<SaveStatusPill'), 'the transient Saved pill');
    assert.match(css, /\.gdPage, \.ppRunPage, \.attendanceRoom \{/, 'the field floor follows the list into the room');
  });
  it('the heading that repeated the tab is gone (F04) — the room\'s head says it once', () => {
    assert.ok(!/attendanceTitle|attendanceHeader|attendanceSection/.test(sheet + room));
    assert.match(sheet, /\{viewHead\('Attendance'\)\}/);
  });
  it('the state stays the SHEET\'s — closing the room never drops an answer in flight', () => {
    assert.ok(!/useState|useEffect|fetch\(/.test(room), 'the room holds no state and reads nothing of its own');
    assert.ok(sheet.includes('const [attendanceRows, setAttendanceRows] = useState'));
  });
  it('the RSVP sheet stays a sibling of the dialog — never inside the room or the panel', () => {
    assert.ok(!room.includes('<CoachRsvpSheet'));
    const a = sheet.indexOf('<div className={styles.modalOverlay}');
    const b = sheet.indexOf('<CoachRsvpSheet');
    assert.ok(a > 0 && b > a && sheet.slice(a, b).includes('{panelContent}'), 'after the overlay that holds the room');
  });
  it('Escape and Back go up one level: the view first, then the event', () => {
    assert.match(sheet, /onClose: \(\) => \{ if \(openView\) closeView\(\); else void requestCloseSlideOver\(\); \}/);
    assert.match(sheet, /focusKey: openView \?\? 'sheet'/, 'focus is re-seated when the view swaps under it');
  });
});

describe('E3 — Lineup and Scouting are rows; the tabs and the peek go', () => {
  it('no tablist is left on the sheet', () => {
    assert.ok(!/role="tablist"|role="tab"/.test(sheet), 'no tab roles');
    assert.ok(!/slideTabs|tabsBlock|tabContent|activeSlideTab|slideTab\b/.test(sheet), 'no tab machinery');
    assert.ok(!/\.slideTabs? \{|\.slideTabActive \{/.test(css), 'no tab rules left in the stylesheet');
  });
  it('the look-only peek retired — no order, no inning flip, no console memory read', () => {
    assert.ok(!/peekInning|initialPeekInning|lineupPeek|data-lineup-peek-flip|gameDayPeriodKey|sessionStorage/.test(sheet));
    assert.ok(!/\.lineupPeek[A-Za-z]* \{/.test(css), 'and no peek rules');
    assert.ok(!/slideOverWide/.test(sheet + css), 'nor the wide dialog the lineup tab needed');
  });
  it('the Lineup row opens the builder (with the way back to this game) or Game day — by the clock, at every width', () => {
    assert.match(sheet, /const liveDoor = lineupDoor\(\{ started, hasLineup, mismatch: !!lineupMismatch, liveWindow: gameDayLive \}\);/);
    assert.match(sheet, /href=\{liveDoor === 'game-day' \? `\$\{base\}\/game\/\$\{ev\.id\}` : editHref\}/);
    assert.match(sheet, /const editHref = lineupBuilderHref\(base, ev\.id, \{ returnTo: `\$\{base\}\/schedule\?event=\$\{ev\.id\}&tab=lineup` \}\);/, '§222: the builder\'s arrow returns to this game');
    const row = sheet.slice(sheet.indexOf('const lineupRow ='), sheet.indexOf('const scoutingRow ='));
    assert.ok(!/isPhone/.test(row), 'the door never asks the width (F07: the desk said "Edit in Lineups →" at every hour)');
    assert.ok(!/Edit in Lineups/.test(sheet));
  });
  it('the Scouting row opens the book\'s panel as a view, like the room', () => {
    assert.match(sheet, /caption=\{scoutingRowWords\(ev\.opponent!, bookEntry, recordChip\)\}/);
    assert.match(sheet, /\) : openView === 'scouting' \? \(\s*<>\s*\{viewHead\('Scouting'\)\}\s*<OpponentScoutingPanel/);
  });
});

describe('E4 — the lineup warning joins the Lineup row', () => {
  it('the box, its tiny link and "fix the attendance below" are gone — from the sheet, the stylesheet and the help', () => {
    assert.ok(!/peekWarnBlock|lineupPeekWarn/.test(sheet + css));
    assert.ok(!/Fix the attendance below|edit the lineup →/i.test(sheet));
    assert.ok(!/Fix the attendance below/i.test(readSource(HELP)));
  });
  it('the disagreement is the Lineup row\'s second line, in the warning tone', () => {
    assert.match(sheet, /const lineupWords = lineupRowWords\(\{ hasLineup, mismatch: lineupMismatch, door: liveDoor \}\);/);
    assert.match(sheet, /data-tone=\{lineupWords\.warn \? 'warn' : undefined\}>\{lineupWords\.line\}/);
    assert.match(css, /\.sheetDoorTone\[data-tone="late"\],\s*\.sheetDoorTone\[data-tone="warn"\] \{[^}]*color: var\(--warning\);/);
  });
});

describe('E5 — the addresses', () => {
  it('the page opens the view the address names — the grammar\'s one reader', () => {
    assert.ok(page.includes("openEvent(ev, sheetViewFromTab(sp.get('tab')));"));
    assert.ok(sheet.includes('const [view, setView] = useState<SheetView | null>(initialView);'));
  });
  it('a view only opens on a grant — the address never opens a room this coach cannot use', () => {
    assert.match(sheet, /view === 'attendance' && drawerDoors\.attendanceTab \? 'attendance'\s*: view === 'scouting' && scoutingKey \? 'scouting'\s*: null;/);
  });
  it('Edit (the head’s pencil) returns to the sheet itself — never to a view inside it', () => {
    assert.match(page, /returnToEventId\.current = event\.id;/);
    assert.match(page, /if \(ev\) openEvent\(ev\);/, 'reopened with no view — the sheet itself');
  });
});

describe('E6 — the desk draws the same', () => {
  it('one order, by the clock, at every width; isPhone decides a block\'s FORM, never the order', () => {
    assert.match(sheet, /const body = scoreLeads \? \(/);
    assert.ok(!/const body = !isPhone/.test(sheet), 'no desktop-only order');
    assert.match(sheet, /data-sheet-order=\{scoreLeads \? 'score-first' : 'rows-first'\}/);
  });
  it('awards follow the clock at every width — no "unlock awards" line on a game days away (F08)', () => {
    assert.match(sheet, /const awardsBlock = drawerDoors\.awards && \(isGameEvent \? scoreLeads : awardUnlock === 'open'\) \? \(/);
  });
  it('the action row sits under the rows at every width', () => {
    const score = sheet.slice(sheet.indexOf('const body = scoreLeads ? ('), sheet.indexOf(') : (', sheet.indexOf('const body = scoreLeads ? (')));
    const rows = sheet.slice(sheet.indexOf(') : (', sheet.indexOf('const body = scoreLeads ? (')), sheet.indexOf('const viewHead ='));
    for (const order of [score, rows]) assert.ok(order.indexOf('{doorRows}') > 0 && order.indexOf('{doorRows}') < order.indexOf('{actionsBlock}'));
    assert.ok(score.indexOf('{scoreBlock}') < score.indexOf('{doorRows}'), 'score first: the score, then the rows');
    assert.ok(rows.indexOf('{doorRows}') < rows.indexOf('{scoreBlock}'), 'rows first: the rows, then the quiet "+ Add final score"');
  });
  it('the view\'s head is the portal\'s one modal head — "← {the event}" at a desk, the arrow alone on a phone', () => {
    // /simplify (2026-09-25): the portal's shared head, not a fifth hand-built one.
    assert.match(sheet, /<CoachModalHeader\s+title=\{title\}\s+titleTag="h2"\s+backLabel=\{ev\.name\}/);
    const head = readCode('components/coaches/CoachModalHeader.tsx');
    assert.match(head, /\{backLabel && <span className=\{styles\.modalBackWord\}>\{backLabel\}<\/span>\}/);
    assert.ok(css.includes('.modalBackWord { display: none; }'), 'the word leaves at ≤640, where the name rides the subtitle');
    assert.ok(css.includes('.modalBackEcho { display: inline; }'), 'and the subtitle names the event there');
  });
});

/**
 * THE HEAD'S PENCIL AND THE FOOT'S TWO DOORS (owner, 2026-10-09: "instead of 'edit details' should we have the edit
 * pencil at the top right like we do in other modals … also evaluate the delete/cancel buttons and make sure they
 * are portal standard in format and location" → build, and Cancel asks once before it tells families).
 */
describe('the event window wears the portal record standard — pencil in the head, the doors in the foot', () => {
  it('Edit is the head\'s pencil at every width, opening the edit form; the foot has no "Edit details"', () => {
    const header = sheet.slice(sheet.indexOf('const header = ('), sheet.indexOf('const titleBlock ='));
    assert.match(header, /className=\{styles\.sheetHeadEnd\}/);
    assert.match(header, /aria-label=\{`Edit this \$\{eventWord\(ev\)\}`\}/);
    assert.match(header, /onClick=\{\(\) => onEdit\(ev\)\}/);
    assert.ok(header.indexOf('styles.sheetHeadEnd') < header.indexOf('styles.modalCloseBtn'), 'the pencil sits before the ✕');
    assert.ok(!/Edit details/.test(sheet), 'no "Edit details" button anywhere on the sheet');
    assert.match(css, /\.sheetHeadEnd \{ flex: 1 1 auto; display: flex; justify-content: flex-end;/);
  });
  it('Delete is the portal\'s delete door at the foot\'s START, asking in place; a series gets the edit form\'s three answers', () => {
    const foot = sheet.slice(sheet.indexOf('const actionsBlock = canAddEvents ? ('), sheet.indexOf('const summary ='));
    assert.match(foot, /<GuardedDelete\s+label=\{`Delete this \$\{word\}`\}/);
    assert.ok(foot.indexOf('<GuardedDelete') < foot.indexOf('styles.slideOverActionsRight'), 'delete first, Cancel at the end');
    assert.ok(sheet.includes("const SERIES_DELETE = [['This only', 'one'], ['This & future', 'remaining'], ['All', 'all']] as const;"),
      'a series answers in the edit form\'s own three words');
    assert.match(foot, /choices: SERIES_DELETE\.map\(/);
    assert.match(foot, /\{EVENT_DELETE_TAKES\[ev\.eventType\]\}/, 'what goes with it, from the schedule vocabulary');
    assert.equal(EVENT_DELETE_TAKES.practice, 'It comes off the schedule with its attendance and practice plan.');
    assert.equal(EVENT_DELETE_TAKES.external_tournament, 'It comes off the schedule with the games under it.');
    assert.ok(!/styles\.deleteConfirm/.test(sheet), 'the old hand-built question is gone');
    assert.ok(!/\.deleteConfirm\b/.test(css), 'and its rules with it');
  });
  it('Cancel / Restore is the secondary button at the foot\'s END, and asks once only where families are told', () => {
    const foot = sheet.slice(sheet.indexOf('const actionsBlock = canAddEvents ? ('), sheet.indexOf('const summary ='));
    assert.match(foot, /<button className=\{styles\.btnSecondary\} disabled=\{saving\}\s+onClick=\{\(\) => \{ setFootError\(''\); if \(familiesSeeSchedule\) setCancelAsk\(true\); else void handleToggleCancel\(\); \}\}>/);
    assert.match(sheet, /families who follow the team are told it&rsquo;s off\./);
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts'), /familiesSeeSchedule: isVisibleToFamilies\(team\.scheduleVisibility\)/,
      'the same gate the notice itself checks (notifyFamiliesOfGameUpdate)');
  });
  it('/review 2026-10-09: the calm question really is calm, an unread flag asks, and a late save never reopens a closed sheet', () => {
    assert.ok(css.includes('.dangerConfirm.sheetAskCalm {'), 'two classes — `.dangerConfirm` sits below and won on source order');
    assert.match(page, /const \[familiesSeeSchedule, setFamiliesSeeSchedule\] = useState\(true\);/, 'familiesSeeSchedule starts TRUE: unknown asks');
    assert.match(page, /setFamiliesSeeSchedule\(data\.familiesSeeSchedule !== false\);/);
    assert.match(page, /onEventChanged=\{ev => setSelectedEvent\(cur => \(cur\?\.id === ev\.id \? ev : cur\)\)\}/);
  });
  it('a question takes the whole foot in place of the controls it suspends; a failed action says so in the foot', () => {
    assert.ok(css.includes('.slideOverActions:has(> [role="alertdialog"]) > :not([role="alertdialog"]):not([role="alert"]) { display: none; }'));
    assert.match(sheet, /\{footError && <p className=\{styles\.errorText\} role="alert">\{footError\}<\/p>\}/);
  });
});
