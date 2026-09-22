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
const scrimCmp = readCode('components/coaches/LineupSheetScrim.tsx');
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
    assert.match(row, /<strong>\{lineupMode === 'nine_player' \? '9 player ball' : 'Everyone bats'\} · \{inningCount\} \{sportPack\.periodLabelPlural\.toLowerCase\(\)\}<\/strong>/);
    assert.match(row, /<small>Auto-fill · \{autoFillLabel\}<\/small>/);
  });
  it('the panel is the one auto-fill panel — title, Format · Innings, the mode, then Generate with Reshuffle quiet beneath (D12 · B)', () => {
    const panel = between(editor, 'const autoFillPanel = (', '\n  );', 'the panel');
    assert.ok(panel.includes('id={SETUP_PANEL_ID} className={`${styles.lineupAutoMenu} ${styles.lineupSetupDrawer}`}'),
      'the panel is the shared drawer, wearing the modifier that hands its bottom padding to the foot');
    const titleAt = panel.indexOf('className={styles.lineupSheetTitle}>Lineup setup');
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
    assert.ok(panel.includes("<p className={styles.lineupSheetTitle}>Lineup setup</p>"), 'the drawer titles itself');
    // ⚠ The drawer is TITLED "Lineup setup"; a "Setup" caption directly beneath it was the same
    // word twice. Dropped on the owner's read (2026-09-22) — a copy fix that also bought ~28px.
    assert.ok(!panel.includes('lineupSetupLabel}>Setup<'), 'no caption repeating the title');
    assert.match(editor, /aria-label="Lineup format"/);
    assert.match(editor, /aria-label="Lineup innings"/);
    assert.equal(editor.split('aria-label="Lineup format"').length - 1, 1, 'Format is written once (setupFields) and rendered by width');
  });
  it('D12 · the four phone panels are DRAWERS — flush, an 18px top radius, a grab line, and 28px more room than the card they replace', () => {
    const drawer = between(css, '@media (max-width: 900px) {\n  .lineupAutoMenu {', '\n  }', 'the drawer');
    assert.match(drawer, /left: 0;/);
    assert.match(drawer, /right: 0;/);
    assert.match(drawer, /border-radius: 18px 18px 0 0;/);
    // Flush to the BAR'S TOP — no gap term, which is where the 28px comes from. The card used
    // `+ 1.25rem` on the bottom and `- 2.5rem` on the cap; a drawer uses neither.
    // ⚠ PIN THE TOKEN, NOT THE ARITHMETIC. `--coach-foot-clear` is the nav plus the home indicator,
    // declared once on `.coachesShell` at this same breakpoint; this file warns against hand-copying
    // that formula and the first draft of these rules did exactly that, twice. The literal is
    // allowed to move; the clearance contract is not.
    assert.ok(drawer.includes('bottom: var(--coach-foot-clear);'));
    assert.ok(drawer.includes('max-height: calc(100dvh - var(--coach-foot-clear) - 12px);'));
    assert.doesNotMatch(drawer, /1\.25rem|2\.5rem|0\.9rem/, 'no gap and no side gutters — that is the whole difference');
    // The grab line is sticky, so it stays at the head while the content scrolls under it.
    const grab = between(css, '.lineupAutoMenu::before {', '\n  }', 'the grab line');
    assert.match(grab, /position: sticky;/);
    assert.match(grab, /height: 4px;/);
  });
  it('D12 · every scrim sits INSIDE the element `useDismissable` watches — a tap on it must not press what is underneath', () => {
    // ⚠⚠ THIS IS A REPRODUCED DEFECT, NOT A STYLE RULE (/review, 2026-09-22). The row menu's scrim
    // was a SIBLING of its ref'd sheet, where the other three drawers render the scrim INSIDE their
    // ref'd wrapper. Outside the boundary a scrim tap reads as "outside": `useDismissable`'s
    // document-level POINTERDOWN fires first and unmounts the overlay, and the CLICK that follows
    // lands on whatever the dismissal just revealed at that screen position. Reproduced under touch
    // emulation on the real page: dismissing the row menu pressed **Mark ready** underneath it and
    // marked the lineup ready — a state change the coach never asked for. ⚠ A MOUSE NEVER SHOWED
    // IT; only touch did, which is the only input this feature exists for. No linter, type check or
    // layout sweep can see this, which is why it is pinned here.
    const editorScrims: [string, string][] = [
      ['the row menu', 'onClose={() => setRowActionsFor(null)}'],
      ['the phone Setup drawer', 'onClose={closePanelToRow}'],
      ['the 641–900 Setup drawer', 'onClose={() => setAutoFillOpen(false)}'],
    ];
    // Every scrim must come AFTER the opening tag that carries its dismissable's ref, so it is a
    // descendant of the watched element rather than a sibling of it.
    const boundaries: Record<string, string> = {
      'the row menu': '<div ref={rowSheetRef}>',
      'the phone Setup drawer': 'ref={autoFillRef}',
      'the 641–900 Setup drawer': 'ref={autoFillRef}',
    };
    for (const [name, onClose] of editorScrims) {
      const scrimAt = editor.indexOf(`<LineupSheetScrim ${onClose}`);
      assert.notEqual(scrimAt, -1, `${name}: scrim missing`);
      const wrapAt = editor.lastIndexOf(boundaries[name], scrimAt);
      assert.notEqual(wrapAt, -1, `${name}: no dismissable boundary opens before its scrim`);
    }
    // ⚠ The row sheet's ref belongs to the WRAPPER, never to the panel — putting it back on the
    // panel is exactly the shape that shipped the defect.
    assert.ok(!editor.includes('<div ref={rowSheetRef} className='), 'the row sheet ref is the wrapper, not the panel');
    for (const [name, ref] of [['Templates', 'ref={templatesRef}'], ['Print', 'ref={pdfRef}']] as const) {
      const scrimAt = builder.indexOf('<LineupSheetScrim onClose=', builder.indexOf(ref));
      assert.notEqual(scrimAt, -1, `${name}: its scrim must come after its dismissable's ref`);
    }
  });
  it('D12 · every panel that opens on a phone carries a scrim, and the scrim never dims the bar', () => {
    // The desktop renders nothing: the class is display:none until the bottom nav exists, so no
    // call site needs a width branch of its own.
    assert.match(css, /\.lineupSheetScrim \{ display: none; \}/);
    const scrim = between(css, '  .lineupSheetScrim {', '\n  }', 'the scrim');
    assert.match(scrim, /display: block;/);
    assert.ok(scrim.includes('bottom: var(--coach-foot-clear);'), 'stops at the bar’s top — the nav stays lit and tappable');
    assert.match(scrim, /z-index: 259;/, 'directly under the panel (260), over the autosave pill (250)');
    // ⚠⚠ THE SAME DIM AS THE PORTAL'S OTHER FOUR SHEETS, IN BOTH THEMES. This scrim cannot WEAR
    // `.sheetScrim` (that one positions against `.sheetAnchor`; this panel is standalone because it
    // is shared with the desktop popover), so it copies the values — and a copy that takes the dark
    // value WITHOUT the warm one is a bug on the portal's DEFAULT theme: two drawers on one screen
    // dimmed the page different colours until /simplify caught it.
    assert.ok(scrim.includes('rgba(13, 17, 26, 0.45)'), 'the dark dim matches .sheetScrim');
    assert.ok(css.includes('.lineupSheetScrim {\n    background: rgba(36, 30, 21, 0.28);'),
      'and the warm remap matches it too — warm is the portal default');
    // D13: all four of the builder's phone panels, not just Setup. Three live in the editor
    // (the phone Setup drawer, the 641–900 Setup drawer, the row-actions drawer) and two on the
    // builder page (Templates, Print). Converting only one would sharpen the inconsistency.
    // ⚠ ONE COMPONENT, FIVE CALL SITES. They were five copied <div>s, and the copy had already
    // drifted (the warm colour above). The class is now spelled exactly once, in the component.
    // ⚠ FOUR since mig 309: the phone Setup drawer, the 641–900 Setup drawer, the row-actions
    // drawer, and the "Call up a player" sheet. The call-up sheet deliberately reuses this same
    // recipe rather than bringing a shell of its own — a fifth builder panel that looked like the
    // other four until one of them changed is exactly what this count exists to prevent.
    assert.equal(editor.split('<LineupSheetScrim onClose=').length - 1, 4, 'the editor’s four drawers');
    assert.equal(builder.split('<LineupSheetScrim onClose=').length - 1, 2, 'Templates and Print');
    assert.equal(scrimCmp.split('styles.lineupSheetScrim').length - 1, 1, 'the class has exactly one home');
    assert.ok(scrimCmp.includes('aria-hidden="true"'), 'and the markup cannot drift either');
  });
  it('D12 · B · Innings to fill and Game rules fold behind ONE 44px row on a phone; the desktop keeps them apart', () => {
    const panel = between(editor, 'const autoFillPanel = (', '\n  );', 'the panel');
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
    const panel = between(editor, 'const autoFillPanel = (', '\n  );', 'the panel');
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
    assert.ok(panel.includes('${styles.lineupAutoMenu} ${styles.lineupSetupDrawer}'), 'the setup drawer wears the modifier');
    assert.ok(between(css, '  .lineupSetupDrawer {', '}', 'the setup drawer').includes('padding-bottom: 0'), 'it gives up its bottom padding');
    const pinned = between(css, '  .lineupSheetFoot {', '\n  }', 'the pinned foot');
    assert.ok(pinned.includes('padding-bottom: 14px;'), 'and the foot takes it, so a tap there finds the foot');
    assert.ok(pinned.includes('position: sticky;'), 'pinned');
    assert.ok(pinned.includes('bottom: 0;'), 'to the foot');
    assert.ok(pinned.includes('background: var(--card-bg);'), 'its own surface, so settings cannot show through it');
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
