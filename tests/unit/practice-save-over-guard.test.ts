import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * SAVE OVER A PRACTICE TEMPLATE, A DRILL OR A CIRCUIT (owner rulings D1–D12, 2026-10-02 —
 * docs/projects/active/COACH_PRACTICE_SAVE_OVER_PLAN.md)
 *
 *   D1  The NAME decides, in all three windows: a name the team already has turns Save into the red
 *       "Replace “X”…" / "Update “X”…", and the question is a second view INSIDE the window
 *       (`SaveOverQuestion`) with its own Back step — never a confirm pop-up.
 *   D3  A saved drill reaches what hasn't happened yet: the drill route re-copies it into the team's
 *       upcoming practices (and templates and circuits, D7) — never a retire, never the past.
 *   D4  The circuit window sends ITS name (bug 1: it used to send the block's empty title) and stops
 *       a new circuit past the limit before any drill is made (bug 2).
 *   D9  Tonight's station rejoins the drill after an Update, and the open plan follows the drill
 *       only while the practice hasn't started.
 *   D11 A block placed from a circuit gets the save door.
 *
 * The rules' own behaviour is unit-tested in `rep-drill-refresh.test.ts`; this pins the WIRING, the
 * part a later edit can drop without any type error.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const editor = stripComments(readSource('app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx'));
const page = stripComments(readSource('app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx'));
const drillRoute = stripComments(readSource('app/api/coaches/[orgSlug]/teams/[teamId]/development/drills/[drillId]/route.ts'));
const refresh = stripComments(readSource('lib/rep-drill-refresh.ts'));

describe('D1 — the name decides, and the question stays in the window', () => {
  it('Save as template matches the team’s templates by name and replaces through the template PATCH', () => {
    assert.match(page, /libraryNameMatch\(templates, name\)/);
    assert.match(page, /className=\{styles\.btnDanger\}>Replace “\{match\.name\}”…<\/button>/);
    assert.match(page, /plan-templates\/\$\{replace\.id\}`, \{\s*method: 'PATCH'/);
    // D2: a replace carries this practice's tags, as a new template does.
    assert.match(page, /body: JSON\.stringify\(\{ tagIds: planTagIds, plan \}\)/);
    assert.match(page, /useBackStep\(!!replacing, backToName\)/);
  });

  it('Save to my drills / circuits has a Name field whose match turns the button into Update', () => {
    assert.match(editor, /libraryNameMatch\(targets, name\)/);
    assert.match(editor, /Update &ldquo;\{match\.name\}&rdquo;…/);
    assert.match(editor, /useBackStep\(!!updating, backToForm\)/);
    assert.match(editor, /<SaveOverQuestion/);
  });

  it('a club drill is never a save-over target (D12)', () => {
    assert.match(editor, /activeDrills\.filter\(d => d\.teamId !== null\)/);
  });

  it('tags picked against one match never travel to another (review 2026-10-02)', () => {
    assert.ok(editor.includes('const tagIds = tagPick && tagPick.for === matchKey ? tagPick.tagIds : (match?.tagIds ?? []);'));
  });

  it('a save window is not torn down under its own request — × waits while it saves (review 2026-10-02)', () => {
    const promote = editor.slice(editor.indexOf('function PromoteDialog('), editor.indexOf('function PromoteDialog(') + 12000);
    assert.match(promote, /className=\{styles\.modalCloseBtn\} aria-label="Close" disabled=\{busy\} onClick=\{onClose\}/);
    const templateWindow = page.slice(page.indexOf('function SaveAsTemplateDialog('));
    assert.match(templateWindow, /className=\{styles\.modalCloseBtn\} aria-label="Close" disabled=\{busy\} onClick=\{onClose\}/);
  });

  it('on the question, Back is the window bar — never a link at the top of the body (owner, 2026-10-02)', () => {
    const question = stripComments(readSource('components/coaches/SaveOverQuestion.tsx'));
    assert.doesNotMatch(question, /> Back\b|ChevronLeft|ArrowLeft/, 'the shared question carries no Back of its own');
    assert.match(page, /\{replacing \? \(\s*<button type="button" className=\{`\$\{styles\.modalBackBtn\} \$\{styles\.modalBackLabelled\}`\}\s*aria-label="Back to Save as template"/);
    assert.match(editor, /\{updating \? \(\s*<button type="button" className=\{`\$\{styles\.modalBackBtn\} \$\{styles\.modalBackLabelled\}`\}\s*aria-label=\{`Back to Save to my \$\{noun\}`\}/);
  });

  it('no window asks with a pop-up', () => {
    const question = stripComments(readSource('components/coaches/SaveOverQuestion.tsx'));
    assert.doesNotMatch(question, /useConfirm|confirm\(\{/);
  });
});

describe('D3 · D7 — a saved drill reaches what hasn’t happened yet', () => {
  it('the drill route re-copies after a save, and a retire/restore returns before it', () => {
    const retireAt = drillRoute.indexOf("typeof body.isActive === 'boolean' && Object.keys(body).length === 1");
    const refreshAt = drillRoute.indexOf('refreshDrillAcrossTeam(teamId, drill, previousName)');
    assert.ok(retireAt > 0 && refreshAt > retireAt, 'the walk runs only on the edit path, after the retire branch has returned');
  });

  it('the walk is the live season’s practices that have not started, plus templates and circuits', () => {
    assert.match(refresh, /\.eq\('program_year_id', season\.id\)/);
    assert.match(refresh, /\.gt\('starts_at', new Date\(\)\.toISOString\(\)\)/);
    assert.match(refresh, /from\('rep_team_plan_templates'\)/);
    assert.match(refresh, /from\('rep_team_circuits'\)/);
  });
});

describe('D4 — the circuit window checks before anything is saved', () => {
  it('a new circuit takes the window’s name, never the block’s title', () => {
    assert.match(editor, /onCreateCircuit!\(\{ name, tagIds, block: shape \}\)/);
    assert.doesNotMatch(editor, /onCreateCircuit\(\{ name: block\.title\.trim\(\)/);
  });

  it('Save stays off with no name or past the limit', () => {
    assert.match(editor, /disabled=\{busy \|\| !name\.trim\(\) \|\| !!limitLine\}/);
    assert.match(editor, /activeCircuits\.length >= MAX_CIRCUITS_PER_TEAM/);
  });
});

describe('D9 · D11 — the open plan follows, and a placed circuit can be saved back', () => {
  it('after an Update the saved station relinks, and the rest follow only while the practice is upcoming', () => {
    assert.match(editor, /if \(update && result\.drill\) followDrill\(result\.drill, station\?\.id \?\? null\)/);
    // The one "has it started" rule (`practiceStarted`) — never a second hand-rolled one.
    assert.match(editor, /const upcoming = !practiceStarted\(eventStartsAt, Date\.now\(\)\);/);
    assert.match(editor, /refreshStationFromDrill\(s, drill\)/);
  });

  it('a block placed from a circuit is no longer refused the door', () => {
    assert.doesNotMatch(editor, /if \(block\.circuitId\) return null;/);
  });
});
