import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, stripComments } from './_source-code.ts';
import { positionGroups, ordinal } from '../../lib/lineup-position-groups.ts';
import type { LineupPlayerRow } from '../../lib/lineup-grid.ts';
import type { RepRosterPlayer } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE LINEUP BUILDER ON A PHONE (phone re-evaluation stage 3 · Game week, owner rulings
 * 2026-09-21: D1 = B the panel · D2 = B after the Setup row · D5 · D3 · D4 as drawn)
 *
 *   D1 **SETUP IS ONE ROW; THE ROW OPENS THE BUILDER'S PANEL.** Its tone is decided ONCE at open
 *      from `hasAssignments` — never `rows.length` (a new lineup seeds every roster player as a
 *      row), never live (the first Generate would fold the controls under the coach's thumb). The
 *      title is the lineup's shape (`lineupMode` + `inningCount`), the caption the auto-fill
 *      setting; the panel holds Format · Innings · Generate · Reshuffle at ≤640.
 *
 *   D2 **UNDO · REDO · PRINT · TEMPLATES · CLEAR ARE ONE ROW OF `footerIconBtn` SQUARES** with
 *      `aria-label`s; Templates is a glyph BUTTON with `aria-expanded` opening today's panel (a
 *      form), not a `role="menu"`. Tools, not header actions: the page-actions guard's builder
 *      entry stays `actions: null`. The builder page hands its four over BARE and the EDITOR
 *      composes the row (owner, 2026-09-22), because the fifth square is the editor's own Clear
 *      and it has to sit INSIDE the row — the stranded text link under the grid is gone at every
 *      width, and `.lineupClearBtn` with it.
 *
 *   D5 **ONE INNING AT A TIME.** The phone's list renders INSIDE the same `SortableContext` with
 *      the D8 sensors; the position pill is a `<button aria-haspopup="dialog">` with no chevron
 *      glyph; the position sheet's groups come from `playerPositionPrefs` (the depth chart's
 *      three states), its pick is the same `setPosition` mutation, and a Never pick is never
 *      confirmed; the stepper is sticky; the dots read the analysis.
 *
 *   D3 **THE ROAD IN AND BACK OUT.** The peek's heading row carries the clock-turned door at ≤640
 *      with the foot door phone-hidden; the peek reads `inningPositions[<the shown inning>]` with
 *      44px ‹ › that never call a setter; the four doors send their own address as `return`, and
 *      the builder's arrow reads it through `safeReturnPath` / `returnLabel` (three labels).
 *
 *   D4 **THE SMALL MOVES.** The year is a phone-hidden span; the hint renders after the list.
 *
 * Asserted against SOURCE with comments stripped (see `_source-code.ts` for why); the sheet's
 * grouping against its exported pure function.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const EDITOR = 'app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx';
const BUILDER = 'app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx';
const SCHEDULE = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';
const CONSOLE = 'app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx';
const OVERVIEW = 'app/[orgSlug]/coaches/teams/[teamId]/page.tsx';
const LIST = 'components/coaches/LineupInningList.tsx';
const LIST_STYLES = 'components/coaches/LineupInningList.module.css';
const SHEET = 'components/coaches/LineupPositionSheet.tsx';
const STYLES = 'app/[orgSlug]/coaches/coaches.module.css';
const ADDRESS = 'lib/lineups-address.ts';
const PAGE_ACTIONS_GUARD = 'tests/unit/coach-page-actions-guard.test.ts';

const editor = readCode(EDITOR);
const builder = readCode(BUILDER);
const schedule = readCode(SCHEDULE);
const list = readCode(LIST);
const sheet = readCode(SHEET);
const css = stripComments(readSource(STYLES));
const listCss = stripComments(readSource(LIST_STYLES));

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

/** The text between two unique anchors. */
function between(source: string, from: string, to: string, label: string): string {
  const a = source.indexOf(from);
  assert.notEqual(a, -1, `${label}: start anchor missing`);
  const b = source.indexOf(to, a + from.length);
  assert.notEqual(b, -1, `${label}: end anchor missing`);
  return source.slice(a, b);
}

describe('D1 — the Setup row and its panel', () => {
  it('the row is a <button aria-expanded aria-controls> whose tone is decided ONCE from hasAssignments', () => {
    assert.match(editor, /const \[setupFolded\] = useState\(\(\) => analysis\.hasAssignments\)/, 'a lazy useState from hasAssignments');
    assert.doesNotMatch(editor, /setupFolded[^\n]*rows\.length/, 'never rows.length');
    assert.doesNotMatch(editor, /setSetupFolded/, 'never re-derived live');
    const row = between(editor, 'className={styles.lineupSetupRow}', '</button>', 'the setup row');
    assert.match(row, /aria-expanded=\{autoFillOpen\}/);
    assert.match(row, /aria-controls=\{SETUP_PANEL_ID\}/);
    assert.match(row, /data-state=\{setupFolded \? undefined : 'primary'\}/, 'the primary tone gated on the folded state');
    assert.match(editor, /<button ref=\{setupRowRef\} type="button" className=\{styles\.lineupSetupRow\}/);
  });
  it('the title reads lineupMode + inningCount; the caption the auto-fill setting', () => {
    const row = between(editor, 'className={styles.lineupSetupRow}', '</button>', 'the setup row');
    assert.match(row, /<strong>\{lineupMode === 'nine_player' \? '9 player ball' : 'Everyone bats'\} · \{inningCount\} \{sportPack\.periodLabelPlural\.toLowerCase\(\)\}<\/strong>/);
    assert.match(row, /<small>Auto-fill · \{autoFillLabel\}<\/small>/);
  });
  it('the panel is the one auto-fill panel, holding Format · Innings before the mode and Reshuffle after Generate on a phone', () => {
    const panel = between(editor, 'const autoFillPanel = (', '\n  );', 'the panel');
    assert.match(panel, /id=\{SETUP_PANEL_ID\} className=\{styles\.lineupAutoMenu\}/);
    const setupAt = panel.indexOf('{setupFields}');
    const modeAt = panel.indexOf('id="lineup-auto-mode"');
    const generateAt = panel.indexOf('Generate lineup');
    const reshuffleAt = panel.indexOf('{isPhone && reshuffleButton}');
    assert.ok(setupAt > 0 && setupAt < modeAt, 'Format and Innings come first');
    assert.ok(generateAt > modeAt && reshuffleAt > generateAt, 'Reshuffle after Generate');
    assert.match(panel, /\{isPhone && \(\s*<>\s*<span className=\{styles\.lineupSetupLabel\}>Setup<\/span>\s*\{setupFields\}/);
    assert.match(editor, /aria-label="Lineup format"/);
    assert.match(editor, /aria-label="Lineup innings"/);
    assert.equal(editor.split('aria-label="Lineup format"').length - 1, 1, 'Format is written once (setupFields) and rendered by width');
  });
  it('Generate closes the panel and returns focus to the row; Escape does the same', () => {
    assert.match(editor, /runGenerate\(autoFillMode\);\s*closePanelToRow\(\);/);
    assert.match(editor, /useDismissable\(autoFillOpen, autoFillRef, \(\) => setAutoFillOpen\(false\), \(\) => closePanelToRow\(\)\)/);
    assert.match(editor, /function closePanelToRow\(\) \{\s*setAutoFillOpen\(false\);\s*if \(isPhone\) setupRowRef\.current\?\.focus/);
  });
  it('the DOM decision is useIsPhone; the desktop branch keeps the Setup group, the Auto-fill button and Reshuffle', () => {
    assert.match(editor, /const isPhone = useIsPhone\(\);/);
    const controls = between(editor, '<div className={styles.lineupControls}>', '{controlsExtra}', 'the controls');
    assert.match(controls, /\{isPhone \? \(/);
    assert.match(controls, /className=\{styles\.lineupSetupGroup\} aria-label="Setup"/);
    assert.match(controls, /Auto-fill · \{autoFillLabel\} ▾/);
    assert.match(controls, /\{reshuffleButton\}/);
  });
});

describe('D2 — the tool row', () => {
  it('Undo · Redo · Print · Templates are exactly four footerIconBtn with aria-labels, handed over BARE', () => {
    const tools = between(builder, 'const lineupTools = (', '\n  );', 'the tools');
    const templates = between(builder, 'const templatesControl = (', '\n  );', 'templates');
    const labels = [...(tools + templates).matchAll(/className=\{styles\.footerIconBtn\} aria-label="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(labels, ['Undo', 'Redo', 'Print', 'Templates']);
    assert.match(tools, /\{templatesControl\}\s*<\/>/, 'Templates is the fourth, last');
    assert.match(builder, /controlsExtra=\{lineupTools\}/, 'handed over bare — the EDITOR builds the row');
    assert.doesNotMatch(builder, /toolbarExtras/, 'the page no longer wraps them');
    assert.match(builder, /const isPhone = useIsPhone\(\);/);
  });
  it('CLEAR is the editor\'s fifth square, INSIDE the row at ≤640 and beside them above it — the text link is gone', () => {
    const button = between(editor, 'const clearButton = (', '\n  );', 'the clear tool');
    assert.match(button, /className=\{styles\.footerIconBtn\} aria-label="Clear positions" title="Clear positions"/);
    assert.match(button, /disabled=\{!analysis\.hasAssignments\}/, 'greys out when there is nothing to erase');
    assert.match(button, /onClick=\{handleClear\}/);
    assert.match(button, /<Eraser size=\{18\} \/>/);
    assert.match(editor, /\{isPhone \? <div className=\{styles\.lineupToolRow\}>\{controlsExtra\}\{clearButton\}<\/div> : <>\{controlsExtra\}\{clearButton\}<\/>\}/);
    assert.match(editor, /confirm\(\{ title: 'Clear all positions\?'/, 'the confirm behind it is unchanged');
    assert.doesNotMatch(editor, /lineupClearBtn/, 'the stranded text link is gone');
    assert.doesNotMatch(css, /lineupClearBtn/, 'and so is its rule');
  });
  it('Templates is a glyph BUTTON with aria-expanded opening today\'s panel — not a role="menu"', () => {
    const control = between(builder, 'const templatesControl = (', '\n  );', 'templates');
    assert.match(control, /className=\{styles\.footerIconBtn\} aria-label="Templates"[\s\S]*?aria-expanded=\{templatesOpen\}>\s*<LayoutTemplate/);
    assert.match(control, /<LayoutTemplate size=\{18\} \/>/);
    assert.match(control, /<input className=\{styles\.input\} value=\{newTemplateName\}/, 'the panel is a form');
    assert.doesNotMatch(control, /role="menu"/);
    assert.doesNotMatch(control, /CoachToolbarMenu/);
  });
  it('Print keeps its preflight', () => {
    assert.match(builder, /if \(!\(await confirmPrintIfOpen\(\)\)\) return;/);
  });
  it('the controls are one column at ≤640 and the full-width rule does not catch the squares', () => {
    assert.match(phoneCss, /\.lineupControls \{\s*display: flex;\s*flex-direction: column;/);
    assert.match(phoneCss, /\.lineupToolRow > \.lineupAutoWrap \{ width: auto;/);
    assert.match(phoneCss, /\.lineupToolRow \.lineupAutoWrap > button \{ width: var\(--tap-min, 44px\); \}/);
  });
  it('the page-actions guard\'s builder entry stays actions: null', () => {
    const guard = readSource(PAGE_ACTIONS_GUARD);
    assert.match(guard, /lineups\/\[eventId\]\/page\.tsx', occurrence: 0,\s*screen: 'Lineups → one game', variant: 'standard', helpHost: 'masthead', actions: null,/);
  });
});

describe('D5 — one inning at a time', () => {
  it('the phone list renders inside the editor\'s DndContext in the grid\'s place, with the same SortableContext + strategy', () => {
    const dnd = between(editor, '<DndContext sensors={sensors}', '</DndContext>', 'the DndContext');
    assert.match(dnd, /\{isPhone \? \(<>\s*(\{ \}\s*)?<LineupInningList/);
    assert.match(dnd, /<div className=\{styles\.lineupTableWrap\}>/, 'the grid stays for the desktop');
    assert.match(list, /<SortableContext items=\{rows\.map\(r => r\.player\.id\)\} strategy=\{verticalListSortingStrategy\}>/);
    assert.match(list, /useSortable\(\{ id: row\.player\.id \}\)/);
    assert.match(editor, /useSensor\(TouchSensor, \{ activationConstraint: \{ delay: 250, tolerance: 5 \} \}\)/, 'the D8 sensors, unchanged');
  });
  it('the number is the D8 handle, unchanged: lineupBatHandle, the sortable listeners, a tap opens the row sheet', () => {
    assert.match(list, /className=\{coach\.lineupBatHandle\}[^>]*\{\.\.\.attributes\} \{\.\.\.listeners\} onClick=\{\(\) => onRowActions\(row\.player\.id\)\}/);
    assert.match(editor, /onRowActions=\{setRowActionsFor\}/);
  });
  it('the pill is a <button aria-haspopup="dialog"> with no chevron glyph, reading this inning\'s cell with the grid\'s outlines', () => {
    const pill = between(list, 'className={s.pill}', '</button>', 'the pill');
    assert.match(pill, /aria-haspopup="dialog"/);
    assert.doesNotMatch(pill, /Chevron|▾|⌄/);
    assert.match(list, /const value = row\.inningPositions\[String\(inning\)\] \?\? '';/);
    assert.match(pill, /\{value \|\| '—'\}/);
    assert.match(pill, /data-open=\{issue\.isOpen \|\| undefined\} data-clash=\{issue\.hasConflict \|\| undefined\}/);
    assert.match(list, /const issue = cellIssueFor\(row\.player\.id, inning, value\);/);
    assert.doesNotMatch(list, /<select/, 'no select on the phone row');
  });
  it('the neighbours read the previous and next inning; none on the first and last', () => {
    assert.match(list, /const prev = inning > 1 \? \(row\.inningPositions\[String\(inning - 1\)\] \?\? ''\) : null;/);
    assert.match(list, /const next = inning < inningCount \? \(row\.inningPositions\[String\(inning \+ 1\)\] \?\? ''\) : null;/);
  });
  it('the stepper is sticky under the masthead; its pill is the inspector\'s door; the dots read the analysis', () => {
    assert.match(listCss, /\.pin \{\s*position: sticky;\s*top: calc\(var\(--coach-topstrip-top, 0px\) \+ var\(--coach-header-h, 0px\)\);/);
    assert.doesNotMatch(listCss, /\.list \{[^}]*overflow/, 'the list never clips (a sticky stepper needs no overflow ancestor)');
    assert.match(editor, /onOpenInning=\{\(\) => setLens\(\{ view: 'inning', inning: inningOnScreen, fromCheck: false \}\)\}/);
    assert.match(editor, /const phoneDots: InningDotState\[\] = Array\.from\(\{ length: inningCount \}, \(_, i\) => \{\s*const n = i \+ 1;\s*return analysis\.conflictInnings\.has\(n\) \? 'clash' : openRolesByInning\.has\(n\) \? 'open' : assignedInnings\.has\(n\) \? 'done' : 'untouched';/);
    assert.match(list, /<div className=\{s\.dots\} aria-hidden data-lineup-dots>/);
  });
  it('the phone inning is the VIEW: opens on 1, stepped by ‹ ›, focusInning and the inspector\'s onNavigate keep it in step; the data is untouched', () => {
    assert.match(editor, /const \[phoneInning, setPhoneInning\] = useState\(1\);/);
    assert.match(editor, /onStep=\{setPhoneInning\}/);
    assert.match(editor, /function focusInning\(inning: number\) \{\s*setView\('lineup'\);\s*setPhoneInning\(inning\);/);
    assert.match(editor, /onNavigate=\{inning => \{ setPhoneInning\(inning\); setLens\(/);
    assert.doesNotMatch(list, /inningPositions\[[^\]]*\] =/, 'the list never writes a cell');
  });
  it('the position sheet\'s pick is the same setPosition mutation for the inning on screen, then closes; a Never pick is never confirmed', () => {
    assert.match(editor, /onPick=\{code => \{ setPosition\(positionRow\.player\.id, inningOnScreen, code\); setPositionFor\(null\); \}\}/);
    assert.match(editor, /onPickPosition=\{setPositionFor\}/);
    assert.doesNotMatch(sheet, /confirm\(/);
    assert.match(sheet, /useDialogFloor\(true, panelRef, \{ onClose \}\)/);
    assert.match(sheet, /role="dialog"\s*aria-modal="true"/);
    assert.match(sheet, /sheet\.sheetAnchor/, 'the one sheet system\'s container');
  });
  it('the hint renders after the list on a phone and names the stepper; the desktop keeps the swipe hint', () => {
    const dnd = between(editor, '<DndContext sensors={sensors}', '</DndContext>', 'the DndContext');
    const listAt = dnd.indexOf('<LineupInningList');
    const hintAt = dnd.indexOf('lineupScrollHintUnder');
    assert.ok(listAt > 0 && hintAt > listAt, 'the hint after the list');
    assert.match(dnd, /Hold a number to move a player · ‹ › for the \{periodLc\}s/);
    assert.match(dnd, /Hold a number to move a player · swipe across innings →/);
  });
});

describe('D5 — the sheet\'s groups are the depth chart\'s three states', () => {
  const player = (over: Partial<RepRosterPlayer>): RepRosterPlayer => ({
    id: 'p1', firstName: 'Avery', lastName: 'Test', primaryPosition: null, secondaryPosition: null, lineupProfile: null, ...over,
  } as RepRosterPlayer);
  const row = (p: RepRosterPlayer, positions: Record<string, string>): LineupPlayerRow => ({ player: p, battingOrder: '1', starter: true, inningPositions: positions, notes: '' });
  const pack = { positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH'], fieldPositions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'], pitcherPosition: 'P' };

  it('Best in rank order with the rank as the note; Fine is everything in neither list; Never is the chart\'s', () => {
    const p = player({ primaryPosition: '3B', secondaryPosition: 'SS', lineupProfile: { morePreferred: ['1B'], never: ['C'], pitcher: null, aSquad: false } });
    const g = positionGroups(row(p, { '2': 'CF' }), pack, null, 'CF');
    assert.deepEqual(g.best, [{ code: '3B', note: '1st' }, { code: 'SS', note: '2nd' }, { code: '1B', note: '3rd' }]);
    assert.deepEqual(g.fine.map(c => c.code), ['2B', 'LF', 'CF', 'RF', 'OF', 'DH', 'P']);
    assert.deepEqual(g.fine.find(c => c.code === 'P'), { code: 'P', note: 'doesn’t pitch' });
    assert.deepEqual(g.never, [{ code: 'C' }]);
  });
  it('a charted pitcher\'s mound sits with their Best, carrying the cap\'s use — "at cap" is named, never hidden', () => {
    const p = player({ primaryPosition: '1B', lineupProfile: { morePreferred: [], never: [], pitcher: { rank: 1, maxInnings: 4 }, aSquad: false } });
    const two = positionGroups(row(p, { '1': 'P', '2': 'P', '3': '1B' }), pack, 4, '1B');
    assert.deepEqual(two.best, [{ code: '1B', note: '1st' }, { code: 'P', note: '2 of 4 used', tone: undefined }]);
    const capped = positionGroups(row(p, { '1': 'P', '2': 'P', '3': 'P', '4': 'P' }), pack, 4, '');
    assert.deepEqual(capped.best[1], { code: 'P', note: 'at cap', tone: 'cap' });
    const uncapped = positionGroups(row(p, { '1': 'P' }), pack, null, '');
    assert.equal(uncapped.best[1].note, '1 pitched · no cap');
    assert.ok(!two.fine.some(c => c.code === 'P'), 'the mound is never in Fine for a pitcher');
  });
  it('a current value outside the vocabulary still gets a chip; Bench and open never do', () => {
    const p = player({});
    const g = positionGroups(row(p, { '1': 'EH' }), pack, null, 'EH');
    assert.ok(g.fine.some(c => c.code === 'EH'));
    assert.ok(!positionGroups(row(p, { '1': 'Bench' }), pack, null, 'Bench').fine.some(c => c.code === 'Bench'));
    assert.ok(!positionGroups(row(p, {}), pack, null, '').fine.some(c => c.code === ''));
  });
  it('the ranks read as ordinals', () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});

describe('D3 — the road in and back out', () => {
  const tab = between(schedule, 'const lineupTab = activeSlideTab', 'const tabContent =', 'the lineup tab');
  it('the peek\'s heading row carries the clock-turned door; the foot door is phone-hidden', () => {
    assert.match(tab, /const started = gameHasStarted\(ev, nowMs\);/);
    assert.match(tab, /const peekDoor = started\s*\? \{ href: `\$\{base\}\/game\/\$\{ev\.id\}`, word: 'Game day' \}\s*: \{ href: editHref, word: 'Edit' \};/);
    assert.match(tab, /<Link href=\{peekDoor\.href\} className=\{styles\.lineupPeekDoor\}/);
    const titleRow = between(tab, 'className={styles.lineupPeekTitleRow}', '</div>', 'the title row');
    assert.match(titleRow, /lineupFrontChip/);
    assert.match(titleRow, /lineupPeekDoor/);
    assert.match(css, /\.lineupPeekDoor \{ display: none; \}/, 'hidden above 640');
    assert.match(phoneCss, /\.lineupPeekDoor \{\s*display: inline-flex;[^}]*min-height: var\(--tap-min, 44px\);/);
    assert.match(phoneCss, /\.lineupPeekFooter \{ display: none; \}/);
    assert.match(tab, /className=\{styles\.lineupPeekFooter\}/, 'the desktop keeps its foot door');
  });
  it('the look-only flip: the order reads inningPositions[<shown inning>] with 44px ‹ › that never call a setter on the rows', () => {
    assert.match(tab, /const inningShown = Math\.min\(Math\.max\(1, peekInning\), Math\.max\(1, lineupInningCount\)\);/);
    assert.match(tab, /\{r\.inningPositions\[String\(inningShown\)\] \|\| '—'\}/);
    assert.doesNotMatch(tab, /inningPositions\['1'\]/, 'no longer hard-wired to the first inning');
    const flip = between(tab, 'data-lineup-peek-flip', '</div>', 'the flip');
    assert.match(flip, /className=\{styles\.gdStepper\}[\s\S]*?onClick=\{\(\) => setPeekInning\(inningShown - 1\)\}>‹<\/button>/);
    assert.match(flip, /className=\{styles\.gdStepper\}[\s\S]*?onClick=\{\(\) => setPeekInning\(inningShown \+ 1\)\}>›<\/button>/);
    assert.equal((flip.match(/className=\{styles\.gdStepper\}/g) ?? []).length, 2, 'two 44px steppers');
    assert.doesNotMatch(flip, /setLineupRows|onPositionChange|setPosition/);
    assert.doesNotMatch(tab, /setLineupRows/, 'the peek never edits');
  });
  it('the peek opens on 1, or on a game in play the inning the console last showed — read, never written', () => {
    assert.match(schedule, /function initialPeekInning\(event: RepTeamEvent\): number \{\s*if \(!gameHasStarted\(event, nowMs\)\) return 1;/);
    assert.match(schedule, /sessionStorage\.getItem\(gameDayPeriodKey\(event\.id\)\)/);
    assert.doesNotMatch(schedule, /sessionStorage\.setItem\(gameDayPeriodKey/);
    const open = between(schedule, 'function openEvent(event: RepTeamEvent) {', '\n  }', 'openEvent');
    assert.match(open, /setPeekInning\(initialPeekInning\(event\)\);/);
  });
  it('the four doors send their own address; the room\'s rows send none', () => {
    assert.match(tab, /const editHref = lineupBuilderHref\(base, ev\.id, \{ returnTo: `\$\{base\}\/schedule\?event=\$\{ev\.id\}&tab=lineup` \}\);/);
    const consolePage = readCode(CONSOLE);
    assert.equal(consolePage.split('lineupBuilderHref(base, eventId, { returnTo: `${base}/game/${eventId}` })').length - 1, 2, 'both console doors');
    assert.doesNotMatch(consolePage, /href=\{`\$\{base\}\/lineups\/\$\{eventId\}`\}/);
    const overview = readCode(OVERVIEW);
    assert.match(overview, /case 'build_lineup': return nextEvent \? lineupBuilderHref\(base, nextEvent\.id, \{ returnTo: base \}\) : `\$\{base\}\/lineups`;/);
    const room = readCode('app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx');
    assert.doesNotMatch(room, /return=|lineupBuilderHref/, 'the room sends no return');
    assert.match(readSource(ADDRESS), /export function lineupBuilderHref\(base: string, eventId: string, opts: \{ returnTo\?: string \| null \} = \{\}\): string \{\s*const back = safeReturnPath\(opts\.returnTo \?\? null, base\);/);
  });
  it('the builder\'s arrow reads the address through safeReturnPath / returnLabel and falls back to All lineups', () => {
    assert.match(builder, /const returnTo = safeReturnPath\(searchParams\.get\('return'\), base\);/);
    assert.match(builder, /const returnName = returnTo \? returnLabel\(returnTo, base\) : null;/);
    assert.match(builder, /const backTo = returnTo && returnName \? \{ href: returnTo, label: returnName \} : \{ href: `\$\{base\}\/lineups`, label: 'All lineups' \};/);
    assert.match(builder, /backTo=\{backTo\}/);
    const address = readSource('lib/development-address.ts');
    assert.match(address, /if \(returnTo === base\) return 'Overview';/);
    assert.match(address, /if \(under\('schedule'\) && \/\[\?&\]event=\/\.test\(returnTo\)\) return 'The game';/);
    assert.match(address, /if \(under\('game'\)\) return 'Game day';/);
  });
  it('Save, Mark ready and the autosave never navigate', () => {
    const save = between(builder, 'async function saveLineupNow()', 'async function handleMarkReady()', 'the save');
    const mark = between(builder, 'async function handleMarkReady()', 'function buildPosterOptions()', 'mark ready');
    for (const fn of [save, mark]) assert.doesNotMatch(fn, /router\.|location\.|redirect\(/);
  });
});

describe('D4 — the small moves', () => {
  it('the year is a span the phone hides; the poster\'s dateLabel keeps the full date', () => {
    assert.match(builder, /<span className=\{styles\.lineupMetaYear\}>, \{fmtYear\(event\.startsAt\)\}<\/span>/);
    assert.match(phoneCss, /\.lineupMetaYear \{ display: none; \}/);
    assert.match(builder, /dateLabel: event\.startsAt \? `\$\{fmtDate\(event\.startsAt\)\} · \$\{fmtTime\(event\.startsAt\)\}` : '',/);
  });
});
