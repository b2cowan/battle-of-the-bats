import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode, readSource, stripComments } from './_source-code.ts';
import { positionGroups, ordinal } from '../../lib/lineup-position-groups.ts';
import type { LineupPlayerRow } from '../../lib/lineup-grid.ts';
import type { RepRosterPlayer } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE LINEUP BUILDER ON A PHONE (phone re-evaluation stage 3 · Game week, owner rulings
 * 2026-09-21: D1 = B the panel · D2 = B after the Setup row · D5 · D3 · D4 as drawn)
 *
 *   D1 **SETUP IS ONE ROW; THE ROW OPENS THE BUILDER'S PANEL.** The title is the lineup's shape
 *      (`lineupMode` + `inningCount`), the caption the auto-fill setting; the panel holds
 *      Format · Innings · Generate · Reshuffle at ≤640.
 *      ⚰ **AMENDED 2026-09-22 — the lime row is gone.** D1 originally gave a new lineup the whole
 *      row filled lime, frozen at open from `hasAssignments` so it could not shift under a
 *      coach's thumb. The owner struck it: *"why are we highlighting this dropdown in green? that
 *      seems inconsistent from elsewhere in the app"* — correctly, because lime in this portal is
 *      a BUTTON or a CHIP and this was its only full-width surface. Freezing the tone also meant
 *      it never went quiet: generate a lineup and the row stayed lime all session. `setupFolded`
 *      and `data-state="primary"` are DELETED; what a new lineup gets is D14's pill.
 *
 *   D14 **ONE RULE FOR THE TWO ROWS ABOVE THE ORDER** (owner, 2026-09-22, from a screenshot of the
 *      Draft card: *"lots of empty space"*). At ≤640 the status strip is ONE row — mark, state as
 *      the title, the sentence as the caption, the Mark ready pill, a chevron — and the Setup row
 *      is the portal's ordinary quiet row carrying an Auto-fill pill while the game has no lineup.
 *      **A lime pill is the one thing you can do right now; no pill means there is nothing to do
 *      here.** Both pills are `btnPrimary` siblings of their row's door, never nested inside it,
 *      and in both cases the WRAP carries the border and the 52px floor. Desktop is untouched: the
 *      strip's wrapper is `display: contents` above 640, and the Mark ready count — D11's, whose
 *      reason is adjacency to the sentence — stays on the desktop button and comes off the phone
 *      pill, where the sentence is already touching it. The Ready row's "an edit before game time
 *      returns this to Draft" moves into the Lineup check's subtitle on a phone, but ONLY when
 *      that check is reachable, so it is never deleted — one flag drives both ends.
 *
 *   D2 **CALL UP · UNDO · REDO · CLEAR · ⋯ TOOLS ARE ONE ROW** — `footerIconBtn` squares with
 *      `aria-label`s, then the portal's toolbar menu. Tools, not header actions: the page-actions
 *      guard's builder entry stays `actions: null`. The builder page hands Undo · Redo over BARE
 *      and Tools as the trailing slot; the EDITOR composes the row (owner, 2026-09-22), because its
 *      own Clear has to sit INSIDE the row — the stranded text link under the grid is gone at every
 *      width, and `.lineupClearBtn` with it.
 *      ⚖ **2026-10-02 (Copy from, owner ruling D11): Print and Templates left the row.** What
 *      changes the grid while you build stays a square; what takes a lineup IN or OUT — Copy from,
 *      Print, Save as template — sits behind ⋯ Tools, the club Ledger's menu. Six squares (304px)
 *      had no room for a seventh on a 360px phone (328px); five is 252px.
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
// The schedule's event sheet — its own file since the Schedule deep dive's split (stage 1 · S6, 2026-09-25).
const SCHEDULE = 'components/coaches/ScheduleEventSheet.tsx';
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
const head = readCode('components/coaches/LineupDrawerHead.tsx');
const copyFrom = readCode('components/coaches/LineupCopyFrom.tsx');
const saveTemplate = readCode('components/coaches/LineupSaveTemplate.tsx');
const drawer = readCode('components/coaches/LineupDrawer.tsx');
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
  it('the row is a <button aria-expanded aria-controls>, and it is NEVER a lime surface (D1 amended)', () => {
    const row = between(editor, 'className={styles.lineupSetupRow}', '</button>', 'the setup row');
    assert.match(row, /aria-expanded=\{autoFillOpen\}/);
    assert.match(row, /aria-controls=\{SETUP_PANEL_ID\}/);
    assert.match(editor, /<button ref=\{setupRowRef\} type="button" className=\{styles\.lineupSetupRow\}/);
    // ⚰ The frozen lime tone, struck 2026-09-22. Both halves have to stay dead: the state that
    // decided it and the attribute that wore it.
    assert.doesNotMatch(editor, /setupFolded/, 'the frozen-tone state is deleted, not renamed');
    assert.doesNotMatch(row, /data-state=/, 'the setup row carries no tone attribute at all');
    assert.doesNotMatch(css, /\.lineupSetupRow\[data-state="primary"\]/, 'no lime-row rule survives');
  });
  it('the row wrap owns the border and the 52px floor; the row button inside it is transparent', () => {
    // The pill can only sit INSIDE the visible row without nesting a control in a control if the
    // wrap is the row. Same construction as `.lineupReadiness` + its door.
    const wrap = between(css, '.lineupSetupRowWrap {', '}', 'the setup row wrap');
    assert.match(wrap, /min-height: 52px/);
    assert.match(wrap, /border: 1px solid/);
    assert.match(wrap, /border-radius: 10px/);
    const rowCss = between(css, '\n.lineupSetupRow {', '}', 'the setup row rule');
    assert.match(rowCss, /border: 0/, 'the button draws no border of its own');
    assert.match(rowCss, /background: none/, 'and no ground of its own');
  });
  it('the Auto-fill pill rides the row while the game has no lineup — a sibling, never nested', () => {
    const wrap = between(editor, 'className={styles.lineupSetupRowWrap}', '{autoFillOpen &&', 'the setup row wrap');
    assert.match(wrap, /\{!analysis\.hasAssignments && \(/, 'read LIVE — the tone it replaces was frozen');
    // Both classes present; their ORDER in the attribute is meaningless to the cascade (CSS Modules
    // resolve by stylesheet order, not attribute order), so pinning it only breaks on an innocent
    // refactor (/review, 2026-09-22).
    assert.match(wrap, /\$\{styles\.btnPrimary\}/, 'btnPrimary supplies the lime');
    assert.match(wrap, /\$\{styles\.lineupSetupGo\}/, 'the modifier only sets the geometry');
    assert.match(wrap, /onClick=\{handleAutoFill\}/, 'one tap generates — it does not merely open the panel');
    assert.match(wrap, /disabled=\{rows\.length === 0\}/, 'nothing to fill with an empty roster');
    // The pill must be OUTSIDE the row button: a <button> inside a <button> is invalid and
    // unreachable for a keyboard. `between` stops at the row's own closing tag.
    const row = between(editor, 'className={styles.lineupSetupRow}', '</button>', 'the setup row');
    assert.doesNotMatch(row, /lineupSetupGo/, 'the pill is a sibling of the row, never inside it');
    // The lime is never re-pinned here — `.btnPrimary`'s warm override is the single home for it.
    const pill = between(css, '.lineupSetupGo {', '}', 'the pill');
    assert.doesNotMatch(pill, /home-lime|logic-lime/, 'no second home for the lime fill');
    assert.match(pill, /min-height: var\(--tap-min, 44px\)/);
  });
  it('the title reads lineupMode + inningCount; the caption the auto-fill setting', () => {
    const row = between(editor, 'className={styles.lineupSetupRow}', '</button>', 'the setup row');
    // The format's words come from `lineupModeLabel` (lib/lineup-grid) since Copy from (2026-10-02):
    // the builder, the Templates tab and Copy from named it with three hand-copied ternaries.
    assert.match(row, /<strong>\{lineupModeLabel\(lineupMode\)\} · \{inningCount\} \{sportPack\.periodLabelPlural\.toLowerCase\(\)\}<\/strong>/);
    assert.match(row, /<small>Auto-fill · \{autoFillLabel\}<\/small>/);
  });
  it('the panel is the one auto-fill panel — title, Format · Innings, the mode, then Generate with Reshuffle quiet beneath (D12 · B)', () => {
    const panel = between(editor, 'const setupBody = (', '\n  );', 'the panel');
    // Written once, worn two ways (Sheet Frame step 5, `LineupDrawer`): the sheet frame's FORM layer wherever the bar
    // shows, the centred modal above 900 (the modifier that hands its bottom padding to the foot).
    assert.ok(editor.includes('<LineupDrawer label="Lineup setup" form id={SETUP_PANEL_ID} ref={setupPanelRef}'), 'a phone: the frame’s form layer, over the nav');
    assert.ok(editor.includes(`popover={{ className: styles.lineupSetupDrawer, tabIndex: -1, 'aria-modal': 'true' }}`), 'a computer: the centred modal');
    // ⚠ The title markup moved into `LineupDrawerHead` on 2026-09-23 (/simplify reuse pass) —
    // Templates is the second consumer and CallUpSheet is a third, already-drifted copy. What is
    // pinned here is the ORDER on this panel; the head's own shape is pinned in its own case.
    const titleAt = panel.indexOf('<LineupDrawerHead title="Lineup setup"');
    const setupAt = panel.indexOf('{setupFields}');
    const modeAt = panel.indexOf('id="lineup-auto-mode"');
    const moreAt = panel.indexOf('styles.lineupSheetMore}`}');
    const generateAt = panel.indexOf('Generate lineup');
    const reshuffleAt = panel.indexOf('styles.lineupSheetQuiet}`}');
    // The drawer names itself: the scrim covers the row that opened it, so nothing else would.
    assert.ok(titleAt > 0 && titleAt < setupAt, 'the title comes first');
    assert.ok(setupAt > 0 && setupAt < modeAt, 'Format and Innings come next');
    assert.ok(moreAt > modeAt && moreAt < generateAt, 'the folded overrides sit between the mode and Generate');
    assert.ok(reshuffleAt > generateAt, 'Reshuffle is quiet and last');
    assert.ok(panel.includes('<LineupDrawerHead title="Lineup setup"'), 'the drawer titles itself');
    // ⚠ The drawer is TITLED "Lineup setup"; a "Setup" caption directly beneath it was the same
    // word twice. Dropped on the owner's read (2026-09-22) — a copy fix that also bought ~28px.
    assert.ok(!panel.includes('lineupSetupLabel}>Setup<'), 'no caption repeating the title');
    assert.match(editor, /aria-label="Lineup format"/);
    assert.match(editor, /aria-label="Lineup innings"/);
    assert.equal(editor.split('aria-label="Lineup format"').length - 1, 1, 'Format is written once (setupFields) and rendered by width');
  });
  it('D12 · the builder’s phone panels are the portal’s sheet frame — flush, an 18px top radius, a grab line', () => {
    // ⚖ D12/D13 (2026-09-22) made every builder panel a drawer on a phone — flush, 18px corners, a grab line, a dim, and
    // the 28px of height and 29px of width a drawer has over the card it replaced. Since Sheet Frame step 5 (2026-10-06)
    // that drawer IS the portal's sheet frame wherever the bar shows; its geometry is pinned in sheet-frame-guard.
    // ONE shell decides the width for all five (/simplify 2026-10-06): the frame wherever the bar shows, the
    // builder's popover above it — and the drawer's name is written once, so the two widths cannot call it two things.
    assert.match(drawer, /const isPhoneNav = useIsPhoneNav\(\);\s*if \(isPhoneNav\) \{\s*return \(\s*<SheetFrame ref=\{ref\} form=\{form\} full=\{full\} busy=\{busy\} id=\{id\} role="dialog" aria-label=\{label\}/,
      'the frame wherever the bar shows (the bar’s breakpoint, 900)');
    assert.ok(drawer.includes('<div className={bodyClassName ? `${shared.lineupSheetBody} ${bodyClassName}` : shared.lineupSheetBody}>{children}</div>'), 'the body that keeps every line in place');
    assert.ok(drawer.includes('className={className ? `${shared.lineupAutoMenu} ${className}` : shared.lineupAutoMenu} role="dialog" aria-label={label}>'), 'above 900: the popover');
    const wears: [string, string, string][] = [
      ['Setup', editor, '<LineupDrawer label="Lineup setup" form'],
      ['Call up', editor, '<LineupDrawer label="Call up a player" form'],
      ['Print', builder, '<LineupDrawer label="Print" ref={printRef}'],
      ['Copy from', copyFrom, '<LineupDrawer label="Copy from" ref={panelRef} full'],
      ['Save as template', saveTemplate, '<LineupDrawer label="Save as template" form'],
    ];
    for (const [name, src, at] of wears) assert.ok(src.includes(at), `${name}: one of the builder’s drawers`);
    assert.doesNotMatch(editor + builder + copyFrom + saveTemplate, /lineupSheetBody|lineupAutoMenu\}? role="dialog"/, 'no drawer draws its own shell');
    // What is inside keeps its place: the old drawer's 14px inset and the gap its grab line left.
    assert.match(between(css, '.lineupSheetBody {', '}', 'the body'), /gap: 0\.6rem;\s*padding: 0\.6rem 6px 0;/);
    assert.doesNotMatch(css, /@media \(max-width: 900px\) \{\s*\.lineupAutoMenu \{/, 'no second drawer recipe left in this stylesheet');
  });
  it('D12 · a tap on a drawer’s dim never presses what is underneath', () => {
    // ⚠⚠ THIS IS A REPRODUCED DEFECT, NOT A STYLE RULE (/review, 2026-09-22). The row menu's scrim was a SIBLING of the
    // element its dismiss hook watched: a tap on it read as "outside", the hook's POINTERDOWN unmounted the sheet, and the
    // CLICK that followed pressed **Mark ready** underneath and marked the lineup ready — under touch only. Since Sheet Frame
    // step 5 every drawer's dim is the frame's, inside the boundary the frame itself watches (its sheet, its dim, its
    // opener), so the dim's own onClick is the single close path (sheet-frame-guard).
    assert.doesNotMatch(editor + builder + copyFrom + saveTemplate, /LineupSheetScrim/, 'no dim of their own');
    // Above 900 the three Tools panels are popovers hung off the ONE Tools wrap, with ONE dismiss boundary.
    const toolsAt = builder.indexOf('ref={toolsRef}');
    assert.notEqual(toolsAt, -1, 'the Tools wrap carries the dismissable ref');
    for (const [name, at] of [
      ['Print', builder.indexOf('<LineupDrawer label="Print"')],
      ['Save as template', builder.indexOf('<LineupSaveTemplate')],
      ['Copy from', builder.indexOf('<LineupCopyFrom')],
    ] as const) {
      assert.notEqual(at, -1, `${name}: missing`);
      assert.ok(at > toolsAt, `${name}: inside the Tools wrap`);
    }
    // Escape closes and hands focus back to Tools, the button that opened all three (Sheet Frame step 2).
    assert.match(builder, /useDismissable\(toolPanelOpen, toolsRef, closeToolPanels, escapeToolPanels\);/);
  });
  it('D12 · ONE dim for every drawer — the frame’s, in both themes', () => {
    // The builder's own dim (`LineupSheetScrim`, one component for five call sites, the warm remap beside its dark value)
    // retired with Sheet Frame step 5: the frame's dim is the portal's one sheet dim (`--sheet-dim`), so two drawers on
    // one screen can never dim the page differently again — the first thing that drifted in this family.
    assert.ok(!existsSync('components/coaches/LineupSheetScrim.tsx'), 'the component is gone');
    assert.doesNotMatch(css, /\.lineupSheetScrim/, 'and its rule');
  });
  it('D12 · B · Innings to fill and Game rules fold behind ONE 44px row on a phone; the desktop keeps them apart', () => {
    const panel = between(editor, 'const setupBody = (', '\n  );', 'the panel');
    assert.match(panel, /aria-expanded=\{gameRulesOpen\} aria-controls=\{SETUP_MORE_ID\}/);
    assert.match(panel, /'Innings to fill · Game rules' : 'Innings to fill'/, 'the label names only what is actually in there');
    assert.match(panel, /<div id=\{SETUP_MORE_ID\} className=\{styles\.lineupSheetMoreBody\}>\s*\{inningsToFillField\}\s*\{gameRulesFields\}/);
    // The desktop branch still shows Innings to fill outright and Game rules on its own.
    assert.match(panel, /\) : \(\s*<>\s*\{inningsToFillField\}\s*\{gameRules && onGameRulesChange && \(/);
    // Written once, placed by width — never two copies drifting apart.
    assert.equal(editor.split('<span>Innings to fill</span>').length - 1, 1, 'Innings to fill is written once');
    // ⚠ Quieter, never smaller: both new rows keep the tap floor, and the 16px bare "Game rules ▾"
    // the layout sweep had on its known-debt list is gone from the phone form with them.
    // ⚠ ONE RECIPE FOR BOTH ROWS. They were eleven identical declarations apiece and had already
    // drifted on `gap`; the floor now lives in the shared base, so neither row can lose it alone.
    assert.match(between(css, '.lineupSheetRow {', '\n}', 'the shared row'), /min-height: var\(--tap-min, 44px\)/,
      'quieter, never smaller — the floor is in the recipe both rows wear');
  });
  it('D12 · the drawer’s ACTIONS never scroll away — the foot is pinned, the settings scroll under it', () => {
    const panel = between(editor, 'const setupBody = (', '\n  );', 'the panel');
    const foot = between(panel, 'className={styles.lineupSheetFoot}', '</div>', 'the foot');
    assert.ok(foot.includes('Generate lineup'), 'Generate lives in the foot');
    assert.ok(foot.includes('styles.lineupSheetQuiet}`}'), 'so does the quiet Reshuffle');
    // ⚠ WHY THIS EXISTS (owner, 2026-09-22 — “looks like it is still behind the nav”). Below ~640px
    // of viewport the settings stop fitting and the drawer scrolls; what got clipped at its bottom
    // edge was RESHUFFLE — the actions. At a 622-tall window the content was 557 in 538, so the last
    // row sat 18px under the bar. Trimming the settings further only moves the failure to a shorter
    // phone; the foot is pinned instead, so the actions are reachable at EVERY height.
    // ⚠ AND IT MUST REACH THE DRAWER'S BOTTOM EDGE. `bottom: 0` stops at the SCROLLPORT's bottom,
    // which is inside the container's 14px bottom padding — so settings bled through a 14px strip
    // under the foot. Two non-fixes, both tried and measured: a negative bottom margin (a sticky
    // stop does not move) and a `box-shadow` band (it covers the strip, but a TAP still lands on
    // the control behind it). The foot takes that padding instead, so the panel with a foot gives
    // its own up — which is what `lineupSetupDrawer` is for.
    assert.ok(editor.includes('popover={{ className: styles.lineupSetupDrawer,'), 'the setup modal wears the modifier');
    // On a phone the sheet frame hands a pinned foot the sheet's bottom padding (sheet-frame-guard, step 5): the foot says so.
    assert.ok(panel.includes('<div className={styles.lineupSheetFoot} data-sheet-foot>'));
    // ⚰ Both rules were ≤900-gated until 2026-09-23 — "Desktop is untouched, the popover is not a
    // scroller" stopped being true the day the popover became a ≥901 modal with its own max-height
    // and scroll (same reason a phone drawer needed one). Unconditional now, not width-gated.
    assert.match(css, /\.lineupSetupDrawer \{ padding-bottom: 0; \}/, 'it gives up its bottom padding, at every width');
    const pinned = between(css, '.lineupSheetFoot {', '\n}', 'the pinned foot');
    assert.ok(pinned.includes('padding-bottom: var(--sheet-foot-pad, 14px);'), 'and the foot takes it, so a tap there finds the foot — the frame’s own value on a phone');
    assert.ok(pinned.includes('position: sticky;'), 'pinned');
    assert.ok(pinned.includes('bottom: 0;'), 'to the foot');
    assert.ok(pinned.includes('background: var(--card-bg);'), 'its own surface, so settings cannot show through it');
    assert.doesNotMatch(pinned, /@media/, 'no width gate left on the sticky foot itself');
  });
  it('D12 · the true desktop (≥901) gets its own modal, borrowed from this app\'s existing confirm-dialog chrome (owner, 2026-09-23)', () => {
    // ⚰ 641–900 already had this: the panel is the SAME fixed, scrim-backed drawer a phone gets
    // (D13). Only ≥901 was still a small anchored popover with no viewport-edge awareness, which is
    // exactly what ran off the bottom of a shorter window once Format/Innings joined it (D1, above).
    const overlay = between(css, '.lineupSetupModalOverlay { display: none; }', '}\n}', 'the desktop overlay');
    assert.match(overlay, /@media \(min-width: 901px\)/);
    assert.match(overlay, /position: fixed;\s*inset: 0;/);
    // Same values as the app's global confirm-dialog backdrop — reused, not reinvented.
    assert.match(overlay, /background: rgba\(0, 0, 0, 0\.75\);/);
    assert.match(overlay, /backdrop-filter: blur\(4px\);/);
    const drawerModal = between(css, '.lineupSetupDrawer {\n    position: fixed;', '\n  }', 'the desktop modal card');
    // ⚰⚠⚠ REPRODUCED DEFECT, NOT A STYLE PREFERENCE (found live, 2026-09-23 — "this mode dropdown
    // is not working"). The card first centred with `transform: translate(-50%, -50%)`. Mode and
    // A-squad both use `SublinedChoice`, whose own dropdown is `position: fixed` anchored to a rect
    // it measures against the true viewport — SublinedChoice's own header comment says so: "no
    // ancestor of the modal may gain a transform/filter, or fixed re-anchors to it and this clips
    // again." A `transform` on THIS card IS exactly that ancestor: it silently becomes the
    // containing block for every `position: fixed` descendant, so the child's viewport-measured
    // coordinates paint somewhere else while nothing throws. `inset` + `margin: auto` centers a
    // `position: fixed` box with a definite width the same way, without a transform anywhere.
    assert.match(drawerModal, /inset: 0;\s*margin: auto;/, 'centered without a transform');
    assert.doesNotMatch(drawerModal, /transform:/, 'a transform here breaks every SublinedChoice this panel hosts (Mode, A-squad) — see SublinedChoice.tsx’s own header comment');
    assert.match(drawerModal, /overflow-y: auto;/, 'its own scroll — Generate must never depend on the PAGE scrolling');
    // The overlay renders as a sibling in the JSX, right before the panel it dims.
    assert.match(editor, /className=\{styles\.lineupSetupModalOverlay\} aria-hidden="true" onClick=\{closePanelToRow\}/);
    assert.ok(
      editor.indexOf('lineupSetupModalOverlay') < editor.indexOf('{autoFillPanel}', editor.indexOf('lineupAutoWrap')),
      'the overlay sits before the panel it backs, so it paints first and the panel paints over it',
    );
    // A true dialog now, not just a disclosure — matches Call-up and the row sheet, which already
    // carry role="dialog" at every width they render. A MODAL since Sheet Frame step 5: it stands the dialog floor.
    assert.match(editor, /<LineupDrawer label="Lineup setup" form id=\{SETUP_PANEL_ID\} ref=\{setupPanelRef\} onClose=\{closePanelToRow\} opener=\{setupRowRef\}\s+popover=\{\{ className: styles\.lineupSetupDrawer, tabIndex: -1, 'aria-modal': 'true' \}\}>/);
    assert.match(drawer, /<div ref=\{ref\} id=\{id\} \{\.\.\.attrs\} className=/, 'the popover takes the id, the ref, and the modal’s own attributes');
    // The close × exists in the DOM at every width; which widths PAINT it is two questions, and
    // since 2026-09-23 they are answered in two different places on purpose (/simplify altitude):
    // ≤900 is width-only so the stylesheet decides, ≥901 is PER-CONSUMER so the caller asks.
    assert.match(editor, /<LineupDrawerHead title="Lineup setup" onClose=\{closePanelToRow\} desktopClose \/>/,
      'Setup is a centered modal at ≥901, so it asks for the desktop ×');
    const closeBtn = between(css, '.lineupSetupDrawerClose {', '}', 'the close button');
    assert.match(closeBtn, /display: none;/, 'hidden by default — the 641–900 drawer and phone sheet dismiss by scrim/Escape/Generate already');
    // ⚠⚠ A PROP, NOT AN ANCESTOR. This was `.lineupSetupDrawer .lineupSetupDrawerClose` for one
    // afternoon — sniffing an ancestor whose real job is layout, which hands the wrong answer to
    // the next consumer that wants the × without that ancestor (or carries it and does not want
    // the ×). Templates reuses this same head at ≥901 as a plain popover and renders no ×.
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.lineupSetupDrawerClose\.lineupDrawerCloseDesktop \{ display: inline-flex; \}/);
    assert.ok(!css.includes('.lineupSetupDrawer .lineupSetupDrawerClose'), 'never re-scoped to an ancestor');
  });
  it('the trigger names itself: a phone-hidden "Setup" eyebrow (owner, 2026-09-23)', () => {
    const wrap = between(editor, '<div className={styles.lineupAutoWrap}>', 'className={styles.lineupSetupRowWrap}', 'the trigger wrap');
    assert.match(wrap, /className=\{`\$\{styles\.lineupSetupLabel\} \$\{styles\.lineupSetupTriggerLabel\}`\}>Setup</, 'reuses the panel\'s own caption recipe, not a second one');
    const mod = between(css, '.lineupSetupTriggerLabel { display: block;', '\n}', 'the eyebrow modifier');
    assert.match(mod, /@media \(max-width: 640px\) \{\s*\.lineupSetupTriggerLabel \{ display: none; \}/,
      'phone-hidden — the row\'s border, chevron and 44px floor already read as interactive there');
  });
  it('Generate closes the panel and returns focus to the row; Escape does the same', () => {
    assert.match(editor, /runGenerate\(autoFillMode\);\s*closePanelToRow\(\);/);
    // Escape (and Back) close it and hand focus to the row: the frame's floor on a phone, the modal's own above 900
    // (Sheet Frame step 5 — the keyboard is kept inside at both).
    assert.ok(editor.includes('ref={setupPanelRef} onClose={closePanelToRow} opener={setupRowRef}'));
    assert.ok(editor.includes('useDialogFloor(autoFillOpen && !isPhoneNav, setupPanelRef, { onClose: closePanelToRow, opener: setupRowRef });'));
    // ⚰ `if (isPhone)` guarded the focus-return until 2026-09-23 — dead weight once the desktop
    // shares the same trigger and the same close, since a popover returning focus to the button
    // that opened it is correct at every width, not a phone-only courtesy.
    assert.match(editor, /function closePanelToRow\(\) \{\s*setAutoFillOpen\(false\);\s*setupRowRef\.current\?\.focus/);
    assert.doesNotMatch(editor, /if \(isPhone\) setupRowRef\.current\?\.focus/, 'the return-focus is unconditional now');
  });
  it('the Setup & Auto-fill trigger is ONE shape shared by every width (2026-09-23)', () => {
    // ⚰ Until 2026-09-23 this test asserted the OPPOSITE: `{isPhone ? (…) : (…)}` around two
    // entirely different toolbars, the desktop one spelling out a bordered Setup group, a bare
    // Auto-fill button and a standalone Reshuffle button that the drawer version folded away. The
    // fix was to give the desktop the SAME collapsed trigger the phone already had.
    assert.match(editor, /const isPhone = useIsPhone\(\);/);
    const controls = between(editor, '<div className={styles.lineupControls}>', '<div className={styles.lineupToolRow}>', 'the controls');
    assert.doesNotMatch(controls, /\{isPhone \? \(/, 'one shape now, not a phone/desktop fork');
    assert.doesNotMatch(css, /\.lineupSetupGroup \{/, 'the desktop-only bordered wrapper is retired');
    assert.doesNotMatch(editor, /reshuffleButton/, 'Reshuffle has no standalone toolbar skin left — only the drawer\'s quiet row');
    assert.doesNotMatch(editor, /Auto-fill · \{autoFillLabel\} ▾/, 'the bare desktop Auto-fill button is gone with it');
    // The ONE trigger both widths share:
    assert.match(controls, /ref=\{setupRowRef\} type="button" className=\{styles\.lineupSetupRow\}/);
    // ⚰ Call-up rode alone here, beside Setup, for one day. Same-day follow-up: it moved again.
    assert.doesNotMatch(controls, /lineupCallUpWrap/, 'Call-up no longer sits directly in the controls row — it is in the tool row now');
  });
  it('Call-up rides the tool row beside Undo/Redo, a peer square, not an odd height in the middle (owner, 2026-09-23)', () => {
    // ⚰ Call-up spent 2026-09-23 morning beside Setup, alone — a third, in-between height in the
    // row (taller than a square, shorter than Setup's two-line trigger), which the owner flagged
    // from a live screenshot: "can we do something about these button height differences?" The
    // fix folded it into the tool row instead, and shrank it to an icon-only "+" on a phone (house
    // rule 3 — the same recipe as the roster's "+ Add Player") so it now reads as one more square
    // beside Undo/Redo there, not the lone survivor of a full-width banner.
    const toolRow = between(editor, '<div className={styles.lineupToolRow}>', '{controlsExtra}{clearButton}', 'the tool row');
    assert.match(toolRow, /\{callUps && \(/, 'still gated on the game having call-ups at all');
    assert.match(toolRow, /className=\{styles\.lineupCallUpWrap\} ref=\{callUpRef\}/, 'Call-up opens the row, before Undo');
    // ⚰ A bare Plus for one more day (2026-09-23): among five other tool icons it read as "add a
    // row," a job "Not in the lineup" already does below. UserPlus names the actual action.
    assert.match(toolRow, /<UserPlus size=\{16\} aria-hidden \/>/);
    assert.doesNotMatch(editor, /<Plus size=\{16\}/, 'the generic Plus glyph is gone, not just unused');
    assert.match(toolRow, /aria-label="Call up a player"/, 'the accessible name survives the icon-only phone shape');
    assert.match(toolRow, /<span className=\{styles\.headerBtnLabel\}>Call up a player<\/span>/,
      'house rule 3 — words become symbols on a phone, and the aria-label carries them');
    assert.doesNotMatch(toolRow, />\s*\+ Call up a player\s*</, 'no bare-text button left; the label lives in the headerBtnLabel span');
    // The row's own CSS carries no baked-in width or top-margin any more — those were a phone
    // BANNER's shape, wrong for a button that now lives inside a row of squares with its own gap.
    const btnBase = between(css, '.lineupCallUpBtn {', '}', 'the call-up button base rule');
    assert.doesNotMatch(btnBase, /width: 100%/, 'no longer a full-width banner by default');
    assert.doesNotMatch(btnBase, /margin-top/, 'the row\'s own gap spaces it now, not a hand-tuned margin');
    const phoneBtn = between(phoneCss, '.lineupCallUpBtn {', '}', 'the call-up button on a phone');
    assert.match(phoneBtn, /width: var\(--tap-min, 44px\)/, 'a 44px square, matching its row-neighbours');
    assert.match(phoneBtn, /height: var\(--tap-min, 44px\)/);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * A FORM COVERS THE NAV; A MENU SITS ON TOP OF IT (owner ruling 2026-09-23, binding, portal-wide)
 *
 * The owner asked it as a question about looks — *"don't we usually open drawers like this over
 * the nav?"* — and the honest answer was that the portal has TWO layers and had been choosing
 * between them by WHAT OPENED the surface rather than by what is inside it. The test is the
 * surface's contract with the coach:
 *
 *   · A MENU — tap an item, it acts, it closes — stops at the bar's top and leaves the nav lit
 *     and tappable. The bar is the way out of a menu opened by mistake.
 *   · A FORM — it stays open, you type or set things, you commit — COVERS the nav.
 *
 * ⚠⚠ THE DEFECT IS NOT COSMETIC, WHICH IS WHY IT IS PINNED HERE AND NOT ONLY IN THE STYLESHEET.
 * A drawer that dims the page while the bar underneath stays ARMED reads as modal and is not one:
 * a thumb on Schedule leaves the builder mid-Setup, or with a template name half-typed, and
 * nothing on screen warned the coach that the bar was still live. No layout sweep, linter or type
 * check can see this — it is a z-index and a `bottom` agreeing with each other or not.
 *
 * Three of the builder's six drawers hold work (Setup & Auto-fill, Save as template, Call up a
 * player) and three are menus (Print, Copy from, the row-actions sheet). Save as template took the
 * Templates drawer's place with Copy from (2026-10-02), which is a MENU — tap and it acts. The split is asserted BOTH WAYS on purpose:
 * a sixth drawer added without a decision fails this, whichever side it lands on.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('The two drawer layers — a form covers the nav, a menu sits on top of it', () => {
  it('THE SPLIT: the three drawers that hold work are the frame’s FORM layer on a phone; the three menus its MENU layer', () => {
    // Since Sheet Frame step 5 (2026-10-06) the layer is the frame's `form` prop, and the frame carries everything the
    // ruling needs — the screen's foot and 390 (over the nav, under a dialog), the dim over the bar, the bar taken out
    // of reach of the thumb, the keyboard and the screen reader, the keyboard kept inside — pinned in sheet-frame-guard.
    // The five drawers reach the frame through `LineupDrawer`, which passes `form` straight to it.
    assert.match(drawer, /<SheetFrame ref=\{ref\} form=\{form\} full=\{full\}/);
    const forms: [string, string, string][] = [
      ['Setup & Auto-fill', editor, '<LineupDrawer label="Lineup setup" form id={SETUP_PANEL_ID}'],
      ['Call up a player', editor, '<LineupDrawer label="Call up a player" form busy={callUps.busy}'],
      ['Save as template', saveTemplate, '<LineupDrawer label="Save as template" form busy={busy}'],
    ];
    for (const [name, src, tag] of forms) assert.ok(src.includes(tag), `${name}: the form layer`);
    // ⚠ AND THE OTHER WAY ROUND. Print, Copy from and the row-actions sheet act-and-close; raising them would take the
    // bar away from a coach who only meant to look at a list.
    const menus: [string, string, string][] = [
      ['Print', builder, '<LineupDrawer label="Print" ref={printRef}'],
      ['Copy from', copyFrom, '<LineupDrawer label="Copy from" ref={panelRef} full busy={busy}'],
      ['the row-actions sheet', editor, '<SheetFrame ref={rowSheetRef} onClose={() => setRowActionsFor(null)}'],
    ];
    for (const [name, src, tag] of menus) {
      assert.ok(src.includes(tag), `${name}: on the frame`);
      const line = src.slice(src.indexOf(tag), src.indexOf('\n', src.indexOf(tag)));
      assert.doesNotMatch(line, /\bform\b/, `${name}: a MENU — never over the bar`);
    }
    // The count is the guard: six drawers, three of them forms — a seventh added without a decision fails this.
    const all = editor + builder + copyFrom + saveTemplate;
    assert.equal(all.split('<LineupDrawer ').length - 1 + all.split('<SheetFrame').length - 1, 6, 'six builder drawers on the frame');
    assert.equal(all.split(/<LineupDrawer label="[^"]+" form\b/).length - 1, 3, 'exactly three cover the nav');
  });
  it('a drawer that covers the navigation offers an explicit way out, at the portal’s 44px floor', () => {
    // ⚰ "Close is a DESKTOP-only affordance" rested on a bar that was still tappable underneath. It is not under a form;
    // the visible dim is a 12px strip; and Escape and the back gesture are both absent on an iPhone run from the home screen.
    const close = between(css, '  .lineupSetupDrawerClose {\n    display: inline-flex;', '\n  }', 'the drawer’s close at ≤900');
    assert.match(close, /display: inline-flex;/);
    assert.match(close, /width: var\(--tap-min, 44px\);/);
    assert.match(close, /height: var\(--tap-min, 44px\);/);
    // The desktop × is asked for by the CALLER through `desktopClose` (/simplify altitude pass), never inferred.
    assert.ok(css.includes('.lineupSetupDrawerClose.lineupDrawerCloseDesktop { display: inline-flex; }'));
    assert.match(head, /desktopClose\?: boolean/, 'and it is a real prop on the shared head');
    // Save as template: no desktop × (a popover there); its head turns into "‹ Save as template" on the question.
    assert.match(saveTemplate, /<LineupDrawerHead title="Save as template" onClose=\{onClose\} onBack=\{replacing \? backToName : undefined\} backDisabled=\{busy\} \/>/,
      'Save as template names itself and carries the close, without the desktop ×; on the question its head is Back');
    assert.match(builder, /<LineupSaveTemplate[\s\S]{0,400}onClose=\{\(\) => setSaveTemplateOpen\(false\)\}/, 'the builder hands the window its close');
    // ⚠ ONE HEAD, N CALL SITES. Call up's own head — an <h3> in the display face and a bare `.modalCloseBtn` × — was a
    // third, already-drifted copy; it wears the shared head since Sheet Frame step 5 (owner D9, 2026-10-06, drawn on the hub).
    const callUp = readCode('components/coaches/CallUpSheet.tsx');
    assert.ok(callUp.includes('<LineupDrawerHead title="Call up a player" onClose={onClose} desktopClose />'), 'it kept a × on a computer, where it always had one');
    assert.doesNotMatch(callUp, /modalCloseBtn|<h3/, 'no head of its own');
    assert.equal(head.split('styles.lineupSetupDrawerHead').length - 1, 1, 'the head markup has exactly one home');
    assert.ok(head.includes('<p className={styles.lineupSheetTitle}>{title}</p>'), 'the title is the head\'s');
    assert.equal((editor + builder + callUp + saveTemplate).split('styles.lineupSetupDrawerHead').length - 1, 0, 'and no call site hand-rolls it');
  });
  it('⚠⚠ COVERING THE NAV IS NOT TAKING IT AWAY — the frame takes the bar away for every form, and nothing else needs to', () => {
    /* The first build was geometry alone, which defends the THUMB and nothing else — the bar's tabs stayed in the tab
       order and the accessibility tree. `useOverlayOpen` takes them out; since Sheet Frame step 5 the frame calls it
       for its form layer (sheet-frame-guard), so no builder file calls it itself — a second call would count twice. */
    for (const src of [editor, builder, saveTemplate, copyFrom]) assert.doesNotMatch(src, /useOverlayOpen\(/);
  });
  it('every drawer is still escapable by Back — a covered nav makes that the LAST way out, not a nicety', () => {
    // §219. On a phone the frame's floor stands one step for every drawer (sheet-frame-guard); above 900 the popovers
    // stand their own, and Setup's centred modal its own floor.
    assert.ok(editor.includes('useDialogFloor(autoFillOpen && !isPhoneNav, setupPanelRef, { onClose: closePanelToRow, opener: setupRowRef });'));
    assert.ok(editor.includes('useBackStep(callUpPopoverOpen, () => callUps?.onCloseSheet());'));
    assert.ok(builder.includes('useBackStep(saveTemplateOpen && !isPhoneNav, () => setSaveTemplateOpen(false));'));
    assert.ok(builder.includes('useBackStep(copyOpen && !isPhoneNav, () => setCopyOpen(false));'));
    assert.ok(copyFrom.includes('useBackStep(!!chosen, '), 'Copy from\'s question is a level of its own — Back returns to the list');
  });
});

describe('D14 — the status row on a phone', () => {
  it('the state word and its sentence are ONE wrapper, and that wrapper is invisible above 640', () => {
    // The mark comes from LineupCheck.module.css and cannot be named from coaches.module.css, so
    // stacking the row's middle two children means wrapping them — not :nth-child, whose indices
    // move when `stripMark` is absent.
    const face = between(editor, 'const stripFace = (', '</>);', 'the strip face');
    assert.match(face, /\{stripMark && <LineupStateMark state=\{stripMark\.state\} label=\{stripMark\.label\} \/>\}/);
    // ⚠ STRUCTURAL, NOT SUBSTRING-ORDER (/review, 2026-09-22). This first read
    //   `…lineupReadinessText}>[\s\S]*State[\s\S]*Detail[\s\S]*</span>` — four fragments in
    //   left-to-right order, which an EMPTIED wrapper with the two spans pulled back out beside it
    //   satisfies perfectly. That is exactly the pre-D14 shape this wrapper replaced, and
    //   `display: contents` is only correct while they are genuinely its CHILDREN. `\s*` only.
    assert.match(face, /<span className=\{styles\.lineupReadinessText\}>\s*<span className=\{styles\.lineupReadinessState\}>\{strip\.label\}<\/span>\s*<span className=\{styles\.lineupReadinessDetail\}>\{strip\.detail\}\.<\/span>\s*<\/span>/,
      'the state and the sentence are CHILDREN of the wrapper, not siblings of it');
    // ⚠ The desktop row must not notice the wrapper exists.
    assert.match(css, /\.lineupReadinessText \{ display: contents; \}/, 'display:contents at base — the desktop flex row is unchanged');
    const phone = phoneBlocks(css);
    assert.match(phone, /\.lineupReadinessText \{[^}]*flex-direction: column/, 'and a real column on a phone');
  });
  it('⚠ the door\'s basis is ZERO so the Mark ready pill can never be pushed onto its own line', () => {
    // ⚰ Written `flex: 1 1 auto` first — a CONTENT basis. The strip must stay `wrap` (the error
    // paragraph is `flex: 1 1 100%`), so a caption long enough to push the door's content past the
    // line evicted the pill to a second line, left-aligned, with the empty space beside it: the
    // exact defect this row was built to remove, reintroduced by its own fix. Caught by the owner's
    // screenshot, NOT by any gate — nothing in this repo measures whether a flex row wrapped, and
    // asserting the CSS property is not the same as asserting the result. A zero basis makes the
    // eviction impossible at every width rather than unlikely at the two we happen to sweep.
    const phone = phoneBlocks(css);
    const door = between(phone, '.lineupReadinessDoor {', '}', 'the phone door');
    assert.match(door, /flex: 1 1 0(?!\d)/, 'basis ZERO, never auto — auto lets the caption evict the pill');
    assert.doesNotMatch(door, /flex: 1 1 auto/, 'a content basis must never come back here');
    // ⚠ `between` reads the FIRST match, so a SECOND phone-scoped rule for this selector further
    //   down the file could restore a content basis at equal specificity and this case would never
    //   see it — the "same specificity resolves by source order" trap this stylesheet has been bitten
    //   by before. Cheapest honest mitigation: there must be exactly one, so a second one fails loudly.
    assert.equal((phone.match(/\.lineupReadinessDoor \{/g) ?? []).length, 1,
      'exactly one phone-scoped door rule — a second would win on source order and be invisible here');
    // The strip itself must stay wrappable, or the error paragraph loses its own line.
    assert.match(css, /\.lineupReadiness \{[^}]*flex-wrap: wrap/, 'the strip stays wrap for the error line');
    assert.match(css, /\.lineupReadiness \.errorText \{ flex: 1 1 100%/, 'which is the thing that needs it');
  });
  it('⚠ EVERY control in both rows keeps the 44px floor — a wrapper\'s height never discharges it', () => {
    // ⚰ This case first asserted the OPPOSITE — that the door's floor was cleared at ≤640 because
    // "the row carries it now". check:layout caught it on 2026-09-22: a thumb targets the BUTTON
    // and so does the gate, so the door rendered 36px inside a 52px row that looked correct, at
    // 361 and 390, on the screen a coach uses one-handed at a pitch. Stage 2 hit the identical
    // shape ("a 36px pill inside its 44px box"). The floor belongs on each control, full stop.
    assert.match(css, /button\.lineupReadinessDoor \{ min-height: var\(--tap-min, 44px\); \}/, 'the door keeps the ≤768 floor');
    const phone = phoneBlocks(css);
    assert.doesNotMatch(phone, /button\.lineupReadinessDoor \{ min-height: 0/, 'and ≤640 must NEVER clear it again');
    // The Setup row's button lost its border to the wrap; it must not lose its floor with it.
    const rowCss = between(css, '\n.lineupSetupRow {', '}', 'the setup row rule');
    assert.match(rowCss, /min-height: var\(--tap-min, 44px\)/, 'the inner button carries its own floor');
    // Both pills too — one from the shared ≤768 rule, one from its own.
    assert.match(css, /\.lineupReadiness \.btnPrimary \{ min-height: var\(--tap-min, 44px\); \}/);
    assert.match(between(css, '.lineupSetupGo {', '}', 'the pill'), /min-height: var\(--tap-min, 44px\)/);
  });
  it('"Review" becomes a chevron but survives for assistive tech, inside a positioned parent', () => {
    assert.match(editor, /<span className=\{styles\.lineupReadinessGo\}>\s*<span className=\{styles\.lineupReadinessGoWord\}>Review<\/span>\s*<ChevronRight size=\{15\} aria-hidden \/>\s*<\/span>/,
      'the word is its own span so a phone rule can hide it without taking the icon with it');
    const phone = phoneBlocks(css);
    // ⚠ `.srOnly` is absolutely positioned. With no positioned ancestor its containing block is
    // the viewport, which parks the 1px span outside every clip and scrolls the page sideways.
    assert.match(phone, /\.lineupReadinessGo \{[^}]*position: relative/, 'the containing block for the 1px span');
    assert.match(phone, /\.lineupReadinessGoWord \{[^}]*position: absolute[^}]*clip: rect\(0, 0, 0, 0\)/, 'hidden the srOnly way, not display:none');
  });
  it('the Mark ready pill drops D11\'s count on a phone and keeps it on the desktop', () => {
    const mark = between(editor, 'canMarkLineupReady(analysis) && readyState.status === \'draft\'', '</button>', 'the mark ready button');
    assert.match(mark, /\$\{styles\.btnPrimary\}/);
    assert.match(mark, /\$\{styles\.lineupReadinessMark\}/);
    // ⚠⚠ THE PILL'S PHONE GEOMETRY MUST OUT-SPECIFY `.btnPrimary`, NOT MERELY EXIST (/review,
    //   2026-09-22). It wears both classes; `.btnPrimary` is declared ~700 lines LOWER, and a media
    //   query adds no specificity — so as a bare `.lineupReadinessMark` the rule TIED and lost on
    //   source order, and padding/radius/font-size were silently `.btnPrimary`'s desktop values.
    //   `min-height` survived only because its rule was already compound, which is why every
    //   tap-floor gate stayed green over it. Compound here means order stops mattering.
    const phone = phoneBlocks(css);
    assert.match(phone, /\.lineupReadiness \.lineupReadinessMark \{/,
      'scoped to the row (0,2,0) so it beats .btnPrimary (0,1,0) wherever either sits in the file');
    assert.doesNotMatch(phone, /\n\s*\.lineupReadinessMark \{/,
      'never a bare single-class rule again — that is the tie it loses');
    assert.match(mark, /isPhone[\s\S]*'Mark ready'/, 'the phone pill says just the words');
    assert.match(mark, /openInnings\.length[\s\S]*\$\{periodLc\}[\s\S]*open`/, 'the desktop button still carries the count');
    // It is a SIBLING of the door — D11's rule, and the reason a pill can ride the row at all.
    const door = between(editor, 'className={styles.lineupReadinessDoor} onClick', '</button>', 'the door');
    assert.doesNotMatch(door, /lineupReadinessMark/, 'never nested inside the door');
  });
  it('the Ready promise moves into the check on a phone — and only when the check is reachable', () => {
    assert.match(editor, /const draftPromiseMovedToCheck = isPhone && checkHasRows && !!readyState && !readyState\.gameStarted && badge === 'ready'/,
      'gated on the check EXISTING, so the sentence is relocated and never deleted');
    // One flag, both ends: dropped from the strip exactly when the check picks it up.
    assert.match(editor, /readyState\.gameStarted \|\| draftPromiseMovedToCheck \? '' : '\. An edit before game time returns this to Draft'/);
    assert.match(editor, /draftPromiseMovedToCheck \? 'An edit before game time returns this to Draft' : null/);
  });
});

describe('D2 — the tool row', () => {
  it('Undo · Redo are the page\'s two footerIconBtn, handed over BARE; Tools trails the editor\'s Clear', () => {
    const tools = between(builder, 'const lineupTools = (', '\n  );', 'the tools');
    const labels = [...tools.matchAll(/className=\{styles\.footerIconBtn\} aria-label="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(labels, ['Undo', 'Redo']);
    assert.match(builder, /controlsExtra=\{lineupTools\}\s*controlsTrailing=\{toolsControl\}/, 'handed over bare — the EDITOR builds the row');
    assert.doesNotMatch(builder, /toolbarExtras/, 'the page no longer wraps them');
  });
  it('CLEAR is the editor\'s fifth square, INSIDE the row at every width — the text link is gone', () => {
    const button = between(editor, 'const clearButton = (', '\n  );', 'the clear tool');
    assert.match(button, /className=\{styles\.footerIconBtn\} aria-label="Clear positions" title="Clear positions"/);
    assert.match(button, /disabled=\{!analysis\.hasAssignments\}/, 'greys out when there is nothing to erase');
    assert.match(button, /onClick=\{handleClear\}/);
    assert.match(button, /<Eraser size=\{18\} \/>/);
    // ⚰ Until 2026-09-23 this row only existed on a phone (`isPhone ? <div className={lineupToolRow}>
    // … : <>…</>`) — the desktop's four tools sat bare in the toolbar, left-packed after Setup. The
    // wrapper is unconditional now, and the CSS pushes it to the row's right edge above the phone
    // column instead of a JS fork changing what renders.
    assert.match(editor, /<div className=\{styles\.lineupToolRow\}>\s*\{callUps && \(/, 'Call-up opens the row (it joined 2026-09-23); Undo · Redo · Clear · Tools close it');
    assert.match(editor, /\{controlsExtra\}\{clearButton\}\{controlsTrailing\}\s*<\/div>\s*<\/div>/, 'Clear, then the trailing Tools');
    assert.doesNotMatch(editor, /isPhone \? <div className=\{styles\.lineupToolRow\}/, 'no JS fork left — one wrapper, every width');
    assert.match(between(css, '.lineupToolRow {', '}', 'the tool row'), /margin-left: auto/,
      'the CSS pushes it right in the row layout; harmless in the phone column, which stretches it full width');
    assert.match(editor, /confirm\(\{ title: 'Clear all positions\?'/, 'the confirm behind it is unchanged');
    assert.doesNotMatch(editor, /lineupClearBtn/, 'the stranded text link is gone');
    assert.doesNotMatch(css, /lineupClearBtn/, 'and so is its rule');
  });
  it('⋯ Tools is the portal\'s toolbar menu: Copy from, Print and Save as template, in that order (D11, 2026-10-02)', () => {
    const control = between(builder, 'const toolsControl = (', '\n  );', 'tools');
    assert.match(control, /<CoachToolbarMenu label="Tools" icon=\{<MoreHorizontal size=\{16\} aria-hidden \/>\}\s*collapseOnPhone bareOnPhone drawerOnPhone drawerTitle="Tools"/,
      'the club Ledger\'s Tools: a worded trigger on the desktop, a bare ⋯ opening a sheet on a phone');
    const items = [...control.matchAll(/<CoachToolbarMenuItem label="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(items, ['Copy from…', 'Print…', 'Save as template…']);
    // A BUTTON named Print — the panel itself names itself "Print" since Sheet Frame step 2 (2026-10-05).
    assert.doesNotMatch(control, /<button[^>]*aria-label="Print"/, 'Print is no longer a square of its own');
    assert.doesNotMatch(builder, /LayoutTemplate|aria-label="Templates"/, 'nor is Templates');
    assert.match(control, /<LineupSaveTemplate\b/, 'Save as template is the form (its body is its own component since D13)');
    assert.match(control, /triggerClassName=\{styles\.lineupToolsTrigger\}/, 'the trigger takes the row\'s height, styled beside the row\'s other controls');
  });
  it('Save as template can replace one you have — the name decides, and the question stays in the window (D13–D15, 2026-10-02)', () => {
    const save = readCode('components/coaches/LineupSaveTemplate.tsx');
    // The name decides: a name the team already has (capitals and spaces aside — the server's own
    // uniqueness rule) turns the button into Replace, which opens the question rather than saving.
    assert.match(save, /libraryNameMatch\(templates, name\)/);
    assert.match(save, /className=\{shared\.btnDanger\}>Replace “\{match\.name\}”…<\/button>/, 'the red button names what it replaces');
    // "Are you sure" is a second view, with its own Back step — never a confirm pop-up, which is what
    // closed the old Templates drawer behind it (Mobile plan §13.6 #5).
    assert.match(save, /useBackStep\(!!replacing, backToName\);/);
    assert.doesNotMatch(save, /useConfirm|confirm\(\{/, 'no pop-up');
    assert.match(save, /This can’t be undone\. Undo takes back changes to the lineup, not to a saved template\./);
    // Replacing PATCHes the template it names; a new name POSTs.
    assert.match(builder, /lineup-templates\/\$\{replace\.id\}`, \{\s*method: 'PATCH'/);
    // D15: call-ups never reach a template — the server would refuse the whole save.
    assert.match(builder, /const templateRows = sortLineupRows\(lineupRows\)\.filter\(row => !isCallUp\(row\.player\)\);/);
    assert.match(builder, /return templateRows\.map\(row => \{/, 'the payload is built from the rows without call-ups');
  });
  it('a copy is ONE undo step, and it takes the copied game rules back too (/review, 2026-10-02)', () => {
    // "Order and positions" brings the source game's rules override across. The undo step used to
    // hold rows, format and innings only, so Undo left the copied rules behind and the next autosave
    // wrote them — while the panel promised "Undo brings it back".
    assert.match(builder, /type LineupSnap = \{ rows: LineupPlayerRow\[\]; mode: RepLineupMode; innings: number; rules\?: typeof gameRules \};/);
    assert.match(builder, /if \(s\.rules\) setGameRules\(s\.rules\);/, 'a step that carries rules restores them');
    assert.match(builder, /const cur = lineupSnap\(!!prev\.rules\);/, 'and Redo gets them back');
    assert.match(builder, /pushLineupUndo\(bringsRules\);/, 'the copy pushes its step with the rules when it brings rules');
    assert.match(builder, /function markLineupDirty\(\) \{\s*setLineupNotice\(''\);/, 'the line above the grid ends on the next EDIT, not on a save');
  });
  it('Copy from is full screen at ≤640 — ABOVE the nav, which it leaves alone (D7, 2026-10-02)', () => {
    // On the frame since Sheet Frame step 5: `full` fills the screen above the bar at ≤640 and keeps the bar's top
    // (geometry in sheet-frame-guard); the body gives the list the height that is left.
    assert.ok(copyFrom.includes('<LineupDrawer label="Copy from" ref={panelRef} full busy={busy}'));
    assert.ok(copyFrom.includes('bodyClassName={styles.body}>'), 'the body that takes the height left');
    const copyCss = stripComments(readSource('components/coaches/LineupCopyFrom.module.css'));
    assert.match(phoneBlocks(copyCss), /\.body\.body \{ flex: 1 1 auto; min-height: 0; padding: 0; \}/);
    // Two classes on every override: `.lineupAutoMenu` and `.lineupSheetBody` live in another module at one class,
    // and equal specificity across modules resolves by bundle order.
    assert.doesNotMatch(copyCss, /(^|\n)\s*\.(panel|body) \{/, 'never a single-class override of a shared class');
    assert.ok(copyFrom.includes('popover={{ className: styles.panel, tabIndex: -1 }}'), 'the popover above 900');
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
    assert.match(editor, /const sensors = useReorderSensors\(\);/, 'the D8 sensors, from the one shared hook');
    const hook = readSource('lib/hooks/useReorderSensors.ts');
    assert.match(hook, /useSensor\(TouchSensor, \{ activationConstraint: \{ delay: 250, tolerance: 5 \} \}\)/, 'the D8 hold, unchanged');
    assert.match(hook, /useSensor\(MouseSensor, \{ activationConstraint: \{ distance: 6 \} \}\)/, 'the D8 mouse travel, unchanged');
  });
  it('the number is the D8 handle, unchanged: lineupBatHandle, the sortable listeners, a tap opens the row sheet', () => {
    // The tap names the handle — where the row menu hands focus back (Sheet Frame step 4; iOS never focuses it).
    assert.match(list, /className=\{coach\.lineupBatHandle\}[^>]*\{\.\.\.attributes\} \{\.\.\.listeners\} onClick=\{e => onRowActions\(row\.player\.id, e\.currentTarget\)\}/);
    assert.match(editor, /onRowActions=\{openRowActions\}/);
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
  /* ⚠⚠ A REPRODUCED DEFECT, NOT A STYLE PREFERENCE (owner, 2026-09-22, from a phone screenshot of
     the pill reading "INNING 2 OF 6 · ⚠ 2 clas…": "if we can't fit this message I think the symbol
     is enough"). TWO items could give width, so both did: the fact ellipsised itself into a
     fragment that says nothing the red pill and the ⚠ had not already said, AND the chevron — the
     door's own affordance — shrank to a sliver beside it. The rule now: the trailing fact reads
     WHOLE or drops away to the bare mark, and nothing but the fact may ever go. Pinned
     structurally, because every way back to this bug is small — a `text-overflow` here, a lost
     `flex: none` there, the mark folded back into the sentence it is supposed to outlive. */
  it('⚠ the pill\'s trailing fact is ALL-OR-NOTHING — the mark outlives it, it never ellipsises, the chevron never shrinks', () => {
    const pill = between(list, 'className={s.stepPill}', '</button>', 'the stepper pill');
    // The mark is its OWN element and comes FIRST, so a dropped sentence still leaves "· ⚠".
    assert.match(pill, /<small className=\{s\.stepMark\}>· ⚠<\/small>\s*<small className=\{s\.stepFact\}>\{clash\}<\/small>/);
    assert.doesNotMatch(pill, /stepFact\}>· ⚠/, 'the mark never goes back inside the droppable fact');
    // The chevron is a SIBLING of the wrapping box — inside it, it would wrap away with the fact.
    assert.match(pill, /<\/span>\s*<span className=\{s\.stepChev\} aria-hidden>›<\/span>/);
    // One line tall, wrapping, clipped: the drop is the browser's line breaking, not a measurement.
    const inner = between(listCss, '.stepInner {', '}', '.stepInner');
    for (const rule of [/flex-wrap: wrap;/, /align-content: flex-start;/, /line-height: var\(--step-line\);/, /max-height: var\(--step-line\);/, /overflow: hidden;/]) {
      assert.match(inner, rule);
    }
    // Neither the fact nor the chevron may give width — an item that CAN shrink squeezes itself
    // illegible instead of dropping, which is how "2 clashes" became "2 clas…" with no chevron.
    assert.match(between(listCss, '.stepFact {', '}', '.stepFact'), /flex: none;/);
    assert.doesNotMatch(listCss, /\.stepFact \{[^}]*text-overflow/, 'the fact never ellipsises again');
    assert.match(listCss, /\.stepChev \{ flex: none;/);
    // The SPOKEN pill is unchanged: the whole fact is in the label whatever the width paints.
    assert.ok(pill.includes("who is at each position${pillTitle ? ` (${pillTitle})` : ''}"), 'the label still carries the whole fact');
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
    assert.match(editor, /onPickPosition=\{openPositionSheet\}/);
    assert.doesNotMatch(sheet, /confirm\(/);
    // Its container, layer and keys are the shared sheet frame's since Sheet Frame step 4 (a dialog in the menu
    // layer, never modal, the frame owning Escape, Back and focus) — held by sheet-frame-guard.
    assert.match(sheet, /<SheetFrame grabCloses onClose=\{onClose\} opener=\{opener\} role="dialog"/);
  });
  /**
   * ⚰ The phone hint ("Hold a number to move a player · ‹ › for the innings") was REMOVED on
   * 2026-09-22 (owner: "we don't need this message"), so this test flipped from asserting its
   * placement to asserting its absence — deliberately, rather than being deleted. Both halves of it
   * had become self-evident: the stepper directly above the list is a labelled "Inning 1 of 6" with
   * two arrows, and every row's number carries a visible grip. It spent a line of the page's most
   * contested space narrating controls that already read.
   *
   * ⚠ The DESKTOP hint stays and is still asserted: it says something the phone's did not — that
   * the grid scrolls sideways — which is the one thing about that surface a coach cannot see.
   */
  it('the phone shows no interaction hint; the desktop keeps the swipe hint', () => {
    const dnd = between(editor, '<DndContext sensors={sensors}', '</DndContext>', 'the DndContext');
    assert.ok(dnd.indexOf('<LineupInningList') > 0, 'the phone still renders the inning list');
    assert.doesNotMatch(
      dnd, /lineupScrollHintUnder/,
      'The phone hint is back. It was removed because the stepper and the row grips already say '
      + 'everything it said, and it cost a line of the phone\'s most contested space.',
    );
    assert.match(
      dnd, /Hold a number to move a player · swipe across innings →/,
      'The DESKTOP hint is gone too. That one earns its place — it names the sideways scroll, which '
      + 'is the one thing about the grid a coach cannot see.',
    );
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
  /*
   * ⚠ THE SCHEDULE'S PEEK RETIRED (the Schedule deep dive, stage 1 · E3, owner ruling 2026-09-25 —
   * "rows; the peek retires"): the look-only batting order with its inning flip left the event sheet
   * with the tabs, because since D5 the builder's first screen IS the order, one inning at a time.
   * D3's two rules it carried survive on the sheet's Lineup ROW — the door turns by the clock (now
   * at every width, which ends F07's desk exception), and the builder is handed the way back to the
   * game. The row's words and its clock are pinned in coach-schedule-sheet(.guard).test.ts.
   */
  const row = between(schedule, 'const liveDoor = lineupDoor(', 'const scoutingRow =', 'the Lineup row');
  it('the Lineup row carries the clock-turned door — the builder before first pitch, Game day from it — at every width', () => {
    assert.match(schedule, /const started = gameHasStarted\(ev, nowMs\);/);
    assert.match(row, /const liveDoor = lineupDoor\(\{ started, hasLineup, mismatch: !!lineupMismatch, liveWindow: gameDayLive \}\);/);
    assert.match(row, /href=\{liveDoor === 'game-day' \? `\$\{base\}\/game\/\$\{ev\.id\}` : editHref\}/);
    assert.doesNotMatch(row, /isPhone/, 'one door at every width — no phone-only heading door, no desk-only foot door');
    assert.doesNotMatch(css, /\.lineupPeek(Door|Footer) \{/, 'the peek\'s two door forms are gone from the stylesheet');
  });
  it('the peek is gone: no look-only order, no inning flip, and nothing reads the console\'s inning', () => {
    assert.doesNotMatch(schedule, /peekInning|initialPeekInning|data-lineup-peek-flip|setLineupRows/);
    assert.doesNotMatch(schedule, /sessionStorage\.(get|set)Item\(gameDayPeriodKey/, 'the console\'s own per-game memory stays the console\'s');
  });
  it('the four doors send their own address; the room\'s rows send none', () => {
    assert.match(row, /const editHref = lineupBuilderHref\(base, ev\.id, \{ returnTo: `\$\{base\}\/schedule\?event=\$\{ev\.id\}&tab=lineup` \}\);/);
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
