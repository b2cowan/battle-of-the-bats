import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';
import { rowStateLabel, sessionName, sessionTitle } from '../../lib/development-session-view.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * PRACTICE WEEK & SKILLS ON A PHONE (phone re-evaluation stage 4, owner rulings 2026-09-22:
 * E1 = option A · E2 · E3 · E4 · E5 as drawn — plan §10)
 *
 *   E1 **THE PRACTICE PLAN'S TOOLBAR IS ONE 44px ROW** at ≤640: `Run practice` as the primary and a
 *      44px "⋯" glyph square whose DRAWER (stage 3 · D13's form, not a card) holds the desk work.
 *      Measured before: three rows, 148px, four controls, on a screen a coach opens at the field.
 *      The members are built as ONE list (`deskActions`) that both presentations read, so a label
 *      is never written twice — and the gates ride on the list, which is what the vocabulary guard
 *      pins. Library stays OUT of it (a width decision and an `aria-pressed` toggle); Run practice
 *      stays the row's own primary and survives a record (the P10 no-clock ruling, 2026-09-17).
 *
 *   E2 **A SKILL ROW IS ONE 56px ROW AND THE ROW IS THE DOOR.** Measured before: 117px a player,
 *      two tap targets, the state and both actions at 12px. `Mark not assessed` leaves the row's
 *      edge entirely (stage 3's Templates ruling: no destructive control on the edge of a row whose
 *      body is the tap) and becomes the dialog's fourth answer — so a row already MARKED is a door
 *      too, or the mark would have no way back on a phone. A row the coach may not write keeps the
 *      old composition, because that one reads the observation's NOTE on its face.
 *
 *   E3 **THE DIALOG'S FOOT DOCKS, AND THE DESCRIPTORS BECOME 56px ROWS.** The stage's real find, and
 *      it was in none of the plan's questions: a 33px Save and a 33px Cancel — under the portal's
 *      44px floor, on a screen whose siblings use 56 — floating mid-panel with 392px of dead space
 *      beneath, over a 37px select. Tapped twelve times a session. `Save & next player` opens the
 *      next UNRECORDED row, skipping anyone outside a scoped session.
 *
 *   E4 **THE COUNT AND THE WAY OUT DOCK ABOVE THE NAV**, and this INVENTS the idiom for this screen.
 *      The plan's card claiming one already existed on the practice plan is wrong — measured for.
 *      Two changes and a third that must not be made: the foot-clearance token, no safe-area padding
 *      of its own, and NO z-index (the clearance is geometric; the game-day console's z-index 301
 *      buried 68px of its own sheet).
 *
 *   E5 **ONE TITLE, ONE DATE, AND THE CREATE IS A "+".** The page titles itself with the session's
 *      NAME; the day lives on the when-line and nowhere else. `sessionTitle` — the long form — stays
 *      where a session is one among many (the list, the review, the sheet's "dated by the session").
 *
 * Asserted against SOURCE with comments stripped (see `_source-code.ts`: a guard that reads prose
 * proves the prose, and both directions have bitten), and against the view module's pure functions.
 * The rendered numbers — 44, 56, the docked foot, the warm scrim, no fall-through under touch — are
 * the layout sweep's and the build session's probes'; this file pins the DECISIONS that produce them.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const read = (rel: string) => stripComments(readSource(rel));

const PLAN_PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx';
const MENU = 'components/coaches/CoachToolbarMenu.tsx';
const MENU_CSS = 'components/coaches/CoachToolbarMenu.module.css';
const GRID = 'components/coaches/SessionRecordGrid.tsx';
const SESSION_PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/development/sessions/[sessionId]/page.tsx';
const DIALOG = 'components/coaches/RecordObservationDialog.tsx';
const DIALOG_CSS = 'components/coaches/RecordObservationDialog.module.css';
const SESSION_CSS = 'components/coaches/DevelopmentSession.module.css';
const HUB = 'app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx';
/* The two PLAYER pages' host for the observation sheet — where a subtitle is still earned. */
const OBSERVATION_HOST = 'components/coaches/observation-sheet-host.ts';

describe('E1 — the practice plan toolbar is one row, and the "⋯" opens a drawer', () => {
  const page = read(PLAN_PAGE);
  const menu = read(MENU);
  const menuCss = readSource(MENU_CSS);

  it('the phone branch is the portal\'s 44px glyph trigger, and its panel is a drawer with a title', () => {
    assert.ok(page.includes('variant="glyph"'), 'the "⋯" is the shared 44px glyph square, not a new control');
    assert.ok(page.includes('drawerOnPhone'), 'and its panel is D13\'s drawer');
    assert.ok(page.includes('drawerTitle="Practice plan"'), 'the drawer names itself — the scrim hides the row that opened it');
    assert.ok(page.includes('isPhone ?'), 'the branch is a width read, because the two forms are different DOM');
  });

  it('ONE list, two presentations — every label written exactly once', () => {
    for (const label of ['Save as template…', 'Print the sheet', 'Send to staff', 'Edit the plan']) {
      const hits = page.split(`'${label}'`).length - 1;
      assert.equal(hits, 1, `"${label}" appears ${hits}× — a second copy is how one word becomes two spellings`);
    }
  });

  it('the gates ride on the list, and each one is still there', () => {
    assert.ok(page.includes('if (canWrite) {'), 'Save as template — a writer only');
    assert.ok(page.includes('writing && (data?.staffPeople?.length ?? 0) > 1'), 'Send to staff — gated, never deleted');
    assert.ok(page.includes('recordMode && canWrite'), 'Edit the plan — a writer, on a record');
  });

  it('Library is NOT a drawer row — a width decision cannot reach the only surface the drawer has', () => {
    assert.ok(page.includes('{writing && canDock && ('), 'Library stays in the row, gated on the working column');
    assert.ok(!page.includes("testId: 'library-toggle'"), 'and it is not a member of deskActions');
    assert.ok(page.includes('data-testid="library-toggle"'), 'its own button survives');
  });

  it('Run practice stays the row\'s primary at every width, and is never demoted into the drawer', () => {
    assert.ok(page.includes('data-testid="run-practice"'));
    assert.ok(!page.includes("testId: 'run-practice'"), 'the P10 no-clock ruling keeps it on the row, on ANY day');
  });

  it('the drawer\'s scrim renders INSIDE the element the dismiss hook watches', () => {
    // ⚠ The defect this pins was reproduced next door on 2026-09-22 under TOUCH emulation: a scrim
    // rendered as a SIBLING let the dismiss hook's pointerdown unmount the overlay, and the click
    // that followed pressed the button underneath — it marked a lineup READY, a state with no
    // product path back. A mouse passed that test every single time. The ORDER in the source is the
    // whole assertion: the scrim must sit inside `rootRef`'s element, above the panel.
    const root = menu.indexOf('<div ref={rootRef}');
    const scrim = menu.indexOf('<LineupSheetScrim');
    const panel = menu.indexOf('ref={panelRef}');
    assert.ok(root >= 0 && scrim > root, 'the scrim is inside the watched root element');
    assert.ok(scrim < panel, 'and behind the panel');
    assert.ok(menu.includes('useDismissable(open, rootRef'), 'rootRef is what the dismiss hook watches');
    assert.ok(!menu.includes('createPortal'), 'nothing here is portalled — the drawer inherits --coach-foot-clear in-tree');
  });

  it('the drawer clears the nav with the TOKEN, takes no inset of its own, and never outranks the nav', () => {
    const drawer = menuCss.slice(menuCss.indexOf('.drawer {'));
    assert.ok(drawer.includes('bottom: var(--coach-foot-clear)'), 'the token, never hand-copied arithmetic');
    assert.ok(!/\.drawer \{[^}]*safe-area-inset-bottom/.test(menuCss), 'no second helping of the home-indicator inset');
    assert.ok(drawer.includes('z-index: 260'), 'the portal\'s sheet value — over the save pill (250), UNDER the nav (300)');
    assert.ok(!/z-index:\s*3\d\d/.test(menuCss), 'nothing here rises above the nav: that buried the console\'s own sheets');
    assert.ok(menuCss.includes('@media (max-width: 640px)'), 'and every drawer declaration is inert on a mouse');
  });
});

describe('E2 — a player is one 56px row, and the row is the door', () => {
  const grid = read(GRID);
  const css = readSource(SESSION_CSS);
  /* The row's controls and the sheet that replaced them are ONE rule, so they are asserted together. */
  const page = read(SESSION_PAGE);

  it('the door row is a BUTTON carrying the row marker, only at ≤640, only for a writable skill row', () => {
    assert.ok(grid.includes('if (isPhone && isSkill && !readOnly) {'), 'the one branch — and `readOnly` keeps the old row');
    const branch = grid.slice(grid.indexOf('if (isPhone && isSkill && !readOnly) {'), grid.indexOf('return (\n          <div key={p.id}'));
    assert.ok(branch.includes('data-player-row={p.id}') && branch.includes('data-observation-door'), 'the row IS the door');
    assert.ok(/<button\b/.test(branch), 'and it is a button, so it is one tap target rather than two');
  });

  it('nothing on the row is disabled at rest — game day\'s dead screen is not repeated', () => {
    const branch = grid.slice(grid.indexOf('if (isPhone && isSkill && !readOnly) {'), grid.indexOf('return (\n          <div key={p.id}'));
    assert.ok(!branch.includes('disabled'), 'a recording row never waits on a prior selection');
  });

  it('"Mark not assessed" and the row\'s Edit link are gone from the phone row', () => {
    const branch = grid.slice(grid.indexOf('if (isPhone && isSkill && !readOnly) {'), grid.indexOf('return (\n          <div key={p.id}'));
    assert.ok(!branch.includes('onMarkNotAssessed') && !branch.includes('onUnmarkNotAssessed'), 'the mark moved into the dialog (E3)');
    assert.ok(grid.includes('onMarkNotAssessed'), 'and the desktop row still carries it — gated, never deleted');
  });

  it('the row is 56, and the chip and chevron are drawn INSIDE it', () => {
    // ⚠ The sweep measures an element's OWN rect, so a 44px `::after` on a small control reads as
    // under-floor even though it passes a hit-test. The ROW takes the height.
    assert.match(css, /\.doorRow \{[^}]*min-height: 3\.5rem/, 'the row itself is 56px');
    assert.ok(!/\.doorState[^{]*\{[^}]*min-height/.test(css), 'the chip does not claim a floor of its own');
    assert.ok(!/\.doorRow::after/.test(css), 'and nothing wears a pseudo-element as its tap area');
  });

  it('the state word is ONE rule — EVERY row says Recorded, and nothing says Saved', () => {
    /* ⚠ The skill/test split went on 2026-09-23 (owner: "that seems inconsistent"). The chip is
       permanent and states that a record EXISTS; the bar's figure, the Review table's column and the
       sessions list all already call that state "recorded", so switching the test dropdown must not
       change the word. "Saving…" and "Not saved — retry" stay: those are about the write. */
    assert.equal(rowStateLabel('saved'), 'Recorded');
    assert.equal(rowStateLabel('saving'), 'Saving…');
    assert.equal(rowStateLabel('error'), 'Not saved — retry');
    assert.ok(!grid.includes('skill: true') && !grid.includes('skill: isSkill'), 'no caller can ask for a second word');
    assert.equal(rowStateLabel.length, 1, 'and the rule has no option left to pass');
  });

  it('the door row gives its second line the whole width, not the name cell\'s', () => {
    /* ⚠ Owner, 2026-09-23: the chip sits "in line with the name only, so there was room under for
       text". Inside the name cell the descriptor shared a column with the chip and the chevron and
       truncated at about half the screen. */
    assert.ok(grid.includes('css.doorUnder'), 'the descriptor is the ROW\'s second line');
    assert.ok(!/doorName[^>]*>\s*<strong>[\s\S]{0,120}?<small>/.test(grid), 'and no longer nested inside the name');
    assert.ok(/\.doorUnder\s*\{[^}]*grid-column:\s*2 \/ -1/.test(css), 'spanning from the name\'s column to the end');
  });

  it('a phone TEST row carries no mark and no Edit \u2014 and the review is the door that replaces them', () => {
    /* ⚠⚠ THE HEADLINE CHANGE OF 2026-09-23 HAD NO TEST AT ALL (/review, same day). The row lost
       "Mark not assessed" and "Edit" on a phone, and the ONLY thing that makes that safe is the
       review sheet gaining the write. Nothing tied the two together, so deleting the review’s door
       while leaving the row’s removal in place would have shipped a mark a coach could set and
       never clear — and CI would have been silent. These assertions are that tie. */
    assert.ok(grid.includes('const phoneTest = isPhone && !isSkill && !readOnly;'), 'the gate is phone + a TEST + writable');
    assert.ok(grid.includes('!readOnly && !phoneTest && state === \'not_recorded\''), 'Mark not assessed is off the phone row');
    assert.ok(grid.includes('!readOnly && !phoneTest && state === \'saved\''), 'and so is Edit');
    assert.ok(/!readOnly && state === 'error'/.test(grid), 'Retry stays at BOTH widths \u2014 an errored row has no saved value to tap');
    assert.ok(page.includes('onMark={async (playerId, typeId, reason)'), 'the review sheet is where the mark went');
    assert.ok(page.includes('onUnmark={async (playerId, typeId)'), 'and it is how a mark comes back off');
  });

  it('a mark the review cannot reach keeps its own Undo', () => {
    /* ⚠ The review lists only players IN the plan. A player marked and then dropped from the plan
       is absent from it — so if the row had no Undo either, that mark would be permanent. */
    assert.ok(grid.includes("(!phoneTest || !row.inScope) && state === 'not_assessed'"),
      'an out-of-scope row keeps Undo even on a phone');
  });

  it('the review\'s write is gated like the grid, and cannot be left mid-flight', () => {
    /* ⚠ Internal notes, not just the Development grant: writing on a SKILL needs both, which is
       what the grid’s own readOnly says. Without this clause an assistant the head coach left
       without notes could mark a skill here — a control the rest of the screen hides from them. */
    assert.ok(page.includes("canWrite && !r.retired && (r.type.kind !== 'skill' || canWriteObservations)"),
      'the sheet mirrors the grid\u2019s readOnly formula');
    assert.ok(page.includes('canWriteObservations={canWriteObservations}'), 'and the page actually passes it');
    /* ⚠ The sheet owns its own in-flight state: the page’s busy flag is never set by this write. */
    assert.ok(page.includes('const working = busy || pending !== null;'), 'the sheet knows when its own write is in the air');
    assert.ok(page.includes('<button type="button" className={styles.btnSecondary} disabled={working} onClick={onBack}>'),
      'and neither way out is tappable while it is');
    assert.ok(page.includes('disabled={working} onClick={onClose}'), 'both footer buttons, not just one');
  });

  it('a refused mark is printed where the coach is looking, not on the banner behind the sheet', () => {
    /* ⚠ `rowErr` paints above the grid. A full-screen sheet covers it, which is the trap this
       file’s own neighbour already documents for the observation dialog. */
    assert.ok(page.includes('const failure = await run();'), 'the write is awaited, not fired and forgotten');
    assert.ok(page.includes('if (failure) { setWriteErr(failure); return; }'), 'a refusal keeps the panel open, holding the reason');
    assert.ok(page.includes('css.reviewWhyErr'), 'and prints it inside that panel');
    assert.ok(/\.reviewWhyErr\s*\{/.test(css), 'the class is declared \u2014 an undeclared one renders unstyled and silent');
    assert.ok(page.includes('): Promise<string | null> {'), 'the write hands back the refusal\u2019s own words');
  });

  it('every figure on the bar comes from ONE object, so the headline cannot contradict its breakdown', () => {
    /* ⚠⚠ The first build read the headline from progress() and the breakdown from counts — two
       different rules. chipProgressByType EXCLUDES a mark on a session with no stated plan, while
       sessionScopeCounts always counts one, so an unplanned session holding a mark read
       "3 of 5 accounted for · 3 recorded · 1 not assessed" and could never pin the way out. */
    assert.ok(page.includes('const accounted = chipProgress(counts);'), 'the headline is the canonical accounted-for figure');
    assert.ok(page.includes('${accounted.done} of ${accounted.total} accounted for'), 'and the breakdown beside it is the same object');
    assert.ok(!page.includes('${progress(selectedType.id)} accounted for'), 'never the chip helper, which follows a different rule when unplanned');
    assert.ok(page.includes('counts.scoped && counts.total > 0 && counts.notRecorded === 0'),
      'and a session with NO PLAN never claims completeness \u2014 sessionState() returns null for one');
  });

  it('the bar that holds only the count is ONE line', () => {
    /* ⚠ It was meant to get smaller and did not: dropping the pill removed its 56px floor but left
       the figure stacked over its test name, so the bar still stood two lines tall. */
    assert.ok(/\.dockThin \.dockCount\s*\{[^}]*display:\s*flex/.test(css), 'the count and the test name share a line');
    assert.ok(/\.dockThin\s*\{[^}]*min-height:\s*0/.test(css), 'with no floor of its own');
  });
});

describe('E3 — the dialog docks its foot and turns the select into answers', () => {
  const dialog = read(DIALOG);
  const css = readSource(DIALOG_CSS);
  const page = read(SESSION_PAGE);

  /**
   * ⚠ IT DOES NOT WEAR THE SHELL'S `scroll` VARIANT, AND THAT IS THE ASSERTION. The first build did,
   * because that variant is the portal's proven pinned-header-and-foot recipe — and the layout sweep
   * measured its rule for a form's fields (`.modalScrollBody > form > .formGrid`, a bleed sized for
   * the DESKTOP panel's padding) putting a 407px grid inside a 359px form and spilling 24px at every
   * one of 361 · 390 · 768 · 1440. The sheets that use it successfully make the FORM the scroller.
   * Rather than move eight other sheets for a ≤640 stage, the form is stretched by three
   * declarations in the component's own module. Pinned from both ends so neither half drifts back.
   */
  it('the foot docks by stretching the form in the component\'s OWN module, not with the shell\'s scroll variant', () => {
    assert.doesNotMatch(dialog, /<QuestionShell[^>]*\sscroll\b/, 'the variant that spilled 24px at all four widths');
    assert.ok(dialog.includes('${css.phoneForm}') && dialog.includes('${css.phoneScroll}'), 'the form and its fields carry this module\'s classes');
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.phoneForm \{[^}]*flex: 1 1 auto/, 'the form stretches, ≤640 only');
    assert.match(css, /\.phoneScroll \{[^}]*overflow-y: auto/, 'and the fields are the scroller');
    assert.ok(!/\.phone(Form|Scroll) \{[^}]*margin-inline: -/.test(css), 'and neither bleeds by a guessed gutter');
    assert.ok(!dialog.includes('position: fixed'), 'nothing here hand-rolls a docked foot');
  });

  it("four answers as 56px rows, the fourth being the session's mark", () => {
    assert.ok(dialog.includes('Not assessed today'), 'the fourth answer');
    assert.match(css, /.pick {[^}]*min-height: 3.5rem/, 'every answer is 56px');
    // ⚠ Not colour alone: the chosen answer also carries a tick and a heavier label, on the one
    // screen in this portal read standing up in daylight (/review, 2026-09-22).
    assert.ok(dialog.includes('className={css.pickTick}'), 'the chosen answer wears a tick');
    assert.ok(css.includes("[aria-pressed='true'] .pickText { font-weight: 700; }"), 'and a heavier label');
  });
  it('the descriptor SELECT survives above 640 — and with it "No descriptor"', () => {
    assert.ok(dialog.includes('asRows ?'), 'the rows are the phone branch');
    assert.ok(dialog.includes('<option value="">No descriptor</option>'), 'the desktop keeps the explicit clear');
    assert.ok(dialog.includes("const noteLabel = naToday ? 'Why not?' : asRows ? 'Anything to add?' : 'What did you see?';"), 'one label per field, and it follows the answer');
  });

  /**
   * ⚠ THE ANSWERS ARE TOGGLE BUTTONS, NOT A `radiogroup`, AND "WHICH ANSWER" IS **ONE** PIECE OF
   * STATE (/review, 2026-09-22). The first build got both wrong in ways only a reviewer caught:
   *   · it declared `role="radiogroup"` + `role="radio"` and never wrote the arrow-key roving that
   *     word promises — the same failure `CoachToolbarMenu`'s own comment warns about for
   *     `role="menu"`, one file away in this very diff; and radio semantics were the wrong
   *     description anyway, because this control is "pick AT MOST ONE" and a radio cannot be
   *     unchecked by re-activating it;
   *   · it held the choice as a `descriptor` string AND a `naToday` boolean, so a row carrying both
   *     a saved descriptor and a session mark showed nothing selected while the descriptor was
   *     still in state — and the coach's first tap on it ran the clear branch.
   * Both are pinned here so neither can come back.
   */
  it('the answers are aria-pressed toggles in a group — no unkept radio promise', () => {
    assert.ok(dialog.includes('role="group"'), 'a group, which owes no roving keyboard pattern');
    assert.ok(!dialog.includes('role="radiogroup"') && !dialog.includes('role="radio"'), 'and not a radio promise it does not keep');
    assert.ok(!dialog.includes('aria-checked'), 'aria-pressed says "toggle", which is what this is');
    assert.equal((dialog.match(/aria-pressed=\{chosen\(/g) ?? []).length, 3, 'every answer row is a toggle');
  });
  it('ONE state holds the chosen answer, and both widths write it', () => {
    assert.ok(dialog.includes('const [answer, setAnswer] = useState<Answer | null>('), 'one value');
    assert.ok(dialog.includes("const descriptor = answer?.kind === 'descriptor' ? answer.value : '';"), 'the descriptor is derived');
    assert.ok(dialog.includes("const naToday = answer?.kind === 'not-assessed';"), 'and so is the mark');
    assert.ok(!dialog.includes('setDescriptor('), 'nothing sets a second, shadow copy');
    assert.ok(dialog.includes("setAnswer(e.target.value ? { kind: 'descriptor', value: e.target.value } : null)"), 'the desktop select writes the same one');
  });
  it('the fourth answer is offered only where the desktop offers its link — a row with no record', () => {
    // A record outranks a mark everywhere (rowState checks hasEntries first; the counts score a
    // mark only for a player with no record), so the dialog must not claim otherwise.
    assert.ok(dialog.includes('const offerNa = !!notAssessed && !editing;'));
  });
  it('a sentence typed beside the mark is SAVED as the mark\'s reason, never dropped', () => {
    assert.ok(dialog.includes('const noteLimit = naToday ? MAX_NOT_ASSESSED_REASON_LEN : MAX_OBSERVATION_NOTE_LEN;'), 'the limit follows the answer');
    assert.ok(dialog.includes('maxLength={noteLimit}'), 'and so does the field');
    assert.ok(dialog.includes('A reason can be ${noteLimit} characters'), 'an over-long reason is REFUSED, never truncated');
    assert.ok(page.includes('markNotAssessed(player, true, skill, v.note.trim() || null)'), 'the host sends it as the reason');
    assert.ok(page.includes('...(reason ? { reason } : {})'), 'and the row link, which never asks for one, sends none');
  });
  it('⚠ THE DESTRUCTIVE HALF GOES LAST — the record is written before the mark is cleared', () => {
    const fn = page.slice(page.indexOf('async function submitObservation'), page.indexOf('async function patchSession'));
    const write = fn.indexOf('await fetch(url');
    const clear = fn.indexOf('markNotAssessed(player, false, skill)');
    assert.ok(write > 0 && clear > write, 'clearing the mark comes AFTER the observation write lands');
    // The first build cleared first: a failed write then left neither a mark nor a record, while
    // the dialog said "Not saved — try again" as though nothing had happened.
    assert.ok(fn.includes('if (wasMarked) await markNotAssessed(player, false, skill);'));
  });
  it('the page banner is cleared when the dialog opens — it renders behind a full-screen sheet', () => {
    const fn = page.slice(page.indexOf('function openObservation'), page.indexOf('async function submitObservation'));
    assert.ok(fn.includes("setRowErr('')"), 'a stale error from an earlier player does not survive the next door');
  });
  it('the fourth answer is an ANSWER — it needs no note, and it writes the MARK, not an observation', () => {
    assert.ok(dialog.includes('if (!naToday && !note.trim() && !descriptor)'), 'the mark satisfies the form on its own');
    assert.ok(page.includes('markNotAssessed(player, true, skill, v.note.trim() || null)'), 'it goes to the mark\'s own route, carrying the reason');
    assert.ok(page.includes('forType ?? selectedType'), 'against the skill the sheet CAPTURED, never the live chip');
  });

  it('it never deletes an observation on the way — that would be destructive behind a radio row', () => {
    const fn = page.slice(page.indexOf('async function submitObservation'), page.indexOf('async function patchSession'));
    assert.ok(!/method: 'DELETE'/.test(fn), 'Remove stays the sheet\'s own control');
  });

  it('"Save & next player" is the next UNRECORDED row, forward only, and absent when there is none', () => {
    assert.ok(page.includes('const nextUnrecordedAfter ='), 'the host owns the rule — only it knows the scope');
    const fn = page.slice(page.indexOf('const nextUnrecordedAfter ='), page.indexOf('const obsNext ='));
    assert.ok(fn.includes('!r.inScope || r.pastParticipant'), 'out of scope and past participants are skipped');
    assert.ok(fn.includes('r.observation || r.notAssessed'), 'and so is anyone already accounted for');
    assert.ok(fn.includes('rows.slice(at + 1)'), 'FORWARD only — a button that says "next" never doubles back');
    assert.ok(page.includes('nextLabel={obsNext ? playerName(obsNext) : null}'), 'no one ahead, no offer');
    assert.ok(dialog.includes('{isPhone && nextLabel && ('), 'and it is a phone control');
  });

  it('the next player is read BEFORE the write, so it cannot go stale on the reload', () => {
    const fn = page.slice(page.indexOf('async function submitObservation'), page.indexOf('async function patchSession'));
    assert.ok(fn.indexOf('nextUnrecordedAfter(player.id)') < fn.indexOf('await fetch'), 'read first, write after');
  });

  it('Cancel is a desktop control: the phone foot is the two saves, and the header closes', () => {
    assert.ok(dialog.includes('{!isPhone && ('), 'Cancel hides at ≤640');
    assert.ok(dialog.includes('onClose={close}'), 'and the shell still closes through the guarded closer');
  });
});

describe('E4 — the count and the way out dock above the nav', () => {
  const css = readSource(SESSION_CSS);
  const page = read(SESSION_PAGE);

  it('the bar is the FOOT made sticky, at the clearance token, with no inset and no z-index of its own', () => {
    const dock = css.slice(css.indexOf('@media (max-width: 640px) {', css.indexOf('.dock {')));
    assert.ok(dock.includes('position: sticky'), 'sticky, so the page end lands it in flow where the foot always was');
    assert.ok(dock.includes('bottom: var(--coach-foot-clear)'), 'the token — a bar at zero is drawn UNDER the nav');
    assert.ok(/\.dock \{[\s\S]*?\}/.test(css) && !/\.dock \{[^}]*safe-area-inset/.test(css), 'no second helping of the inset');
    assert.ok(dock.includes('z-index: 2'), 'the low value');
    assert.ok(!/z-index:\s*(2[5-9]\d|3\d\d)/.test(css.slice(css.indexOf('.dock {'))), 'never above the nav or the sheets that open over it');
  });

  it('the figure is the CHIP\'S OWN, so the screen cannot show two counts that disagree', () => {
    /* ⚠ The CHIP reads progress(); the BAR reads counts. They agree in every case — planned or
       not — which is why the bar could stop borrowing the chip's helper without the screen ever
       showing two figures that disagree. */
    assert.ok(page.includes('progress(chip.type.id)'), 'the chip dropdown still carries its own count');
    assert.ok(!page.includes('progress(selectedType.id)'), 'and the bar no longer borrows it — it reads counts');
    /* ⚠ The bar stopped calling a mark a record on 2026-09-23 rather than stopping saying so:
       "12 of 12 recorded · 2 not assessed" reads as fourteen of twelve, so the headline becomes
       "accounted for" the moment a mark is part of the figure, and the two numbers follow it. */
    assert.ok(page.includes('counts.notAssessed > 0'), 'a session holding marks still says so');
    assert.ok(page.includes('accounted for'), 'and it stops calling a mark a record when it does');
    /* ⚠ The bar stopped reading `progress()` entirely on 2026-09-23 (/review): that helper
       excludes a mark on an unplanned session while the breakdown beside it always counts one,
       so the two could contradict. Both now come off `counts`. The CHIP still reads `progress()`,
       which is what the first assertion above is about, and the two agree in every case. */
    assert.ok(page.includes('${counts.recorded} of ${counts.total} recorded'),
      'with no marks the bar reads recorded-of-total, off the same object as the breakdown');
  });

  it('the way out waits at the end of the list, and only a full house pins it', () => {
    /* ⚠⚠ OWNER DESIGN, 2026-09-23 — and "accounted for" is the load-bearing word. The trigger
       reads the SAME figure the bar prints beside it (a result, an observation OR a mark); gating
       on typed values would let the bar say "12 of 12" while withholding the way out, which is the
       disagreement the test above exists to stop. */
    assert.ok(page.includes('counts.notRecorded === 0'), 'accounted for — a value OR a mark, never "has a value"');
    assert.ok(page.includes('counts.scoped &&'), 'and a session with no plan stated never claims to be complete');
    assert.ok(page.includes('{!allAccounted && ('), 'while anyone is outstanding the door sits under the LAST player');
    assert.ok(page.includes('{allAccounted && ('), 'and only then does it move up into the pinned bar');
    assert.ok(!/tailOut[\s\S]{0,400}?dockPill/.test(page.slice(page.indexOf('{!allAccounted && ('), page.indexOf('{allAccounted && ('))),
      'never both at once — one door, in one place');
    assert.ok(css.includes('.dockThin'), 'and with only the count in it the bar gives the rest back to the roster');
  });

  it('the desktop foot is untouched, and the past-participant note stays with the list on a phone', () => {
    assert.ok(page.includes('{scopeSentence(counts)} · {selectedType.name}'), 'the desktop sentence survives');
    assert.ok(page.includes('className={css.pastNote}'), 'the note about the LIST stays in flow, off the bar');
  });

  it('the pill is 44 as the ELEMENT — never a small control wearing a big pseudo-element', () => {
    assert.match(css, /\.dockPill \{[^}]*min-height: var\(--tap-min/);
    assert.ok(!/\.dockPill::after/.test(css));
  });
});

describe('E5 — one title, one date, and the create is a "+"', () => {
  const page = read(SESSION_PAGE);
  const hub = read(HUB);

  it('the page title is the session\'s NAME; the long form stays where a session is one among many', () => {
    assert.equal(sessionName({ sessionDate: '2026-09-21', note: 'Probe session' }), 'Probe session');
    assert.equal(sessionTitle({ sessionDate: '2026-09-21', note: 'Probe session' }), 'Mon, Sep 21 — Probe session');
    assert.ok(page.includes('const pageTitle = sessionName(session);'));
    assert.ok(page.includes('title={pageTitle}'), 'the h1 takes the name');
    assert.ok(page.includes('subtitle={plan ? `${title} · ${plan}` : title}'), 'the review still names the day');
    /* ⚠ THE SESSION’S OWN DOOR PASSES NO SUBTITLE (owner, 2026-09-23). It used to repeat the
       session’s date and name back at a coach who was standing on that very page — the screen
       talking to itself. The player’s pages still send one, because there the sheet hides the date
       field and the list spans many days, so the line is the only thing saying WHEN. */
    assert.ok(!page.includes('dated by the session'), 'the session’s own sheet does not name the session it is already on');
    assert.ok(read(OBSERVATION_HOST).includes('dated by the session it was taken in'), 'a PLAYER’s page still says which session dates it');
  });

  it('an unnamed session falls back to the day rather than to no title at all', () => {
    assert.equal(sessionName({ sessionDate: '2026-09-21', note: null }), 'Mon, Sep 21');
    assert.equal(sessionName({ sessionDate: '2026-09-21', note: '   ' }), 'Mon, Sep 21');
  });

  it('the hub\'s create is the portal\'s phone corner shape, words carried by the aria-label', () => {
    assert.ok(hub.includes('styles.headerPrimaryBtn'), 'the shared header-create geometry');
    assert.ok(hub.includes('aria-label="Start session"'), 'house rule 3 — the words survive as the name');
    assert.ok(hub.includes('<span className={styles.headerBtnLabel}>Start session</span>'), 'and hide at ≤640');
    assert.ok(hub.includes('actionsPhoneInTitleRow'), 'so the row of its own goes');
  });
});
