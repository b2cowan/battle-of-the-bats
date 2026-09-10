/**
 * **THE BY-PERIOD GRID'S ROWS OPEN THE PLAN, AND THEY OPEN THE RIGHT LINE** — the teeth on the
 * owner's question of 2026-09-10: *"in the budget by period, should I be able to click a number in
 * the report and open up the edit modal? why am I only allowed to edit on the list view?"*
 *
 * WHY THIS FILE EXISTS. Three of the four ways this can break are SILENT — nothing throws, nothing
 * logs, and the screen still renders perfectly:
 *
 *   · **A door built from `row.id`.** That id is `group|rowKey`, a name for a POSITION in the view
 *     which matches no record anywhere. The month grid shipped exactly this door once: the cell
 *     handed the budget page a composite id, the lookup found nothing, and it returned without a
 *     word. Here the panel's `find` would come back undefined and the tap would simply do nothing —
 *     a dead control that looks alive, which is the politer face of a dead end.
 *   · **A chevron that forgets to stop propagation.** The category row folds on a tap anywhere now,
 *     so an un-stopped chevron toggles the fold TWICE on one click and the category never opens.
 *     The most-used control on the grid becomes inert, and it fails by doing its job twice.
 *   · **A lost text-selection guard.** Highlighting an amount to copy it would open the edit form
 *     over the top of the number the coach was reading.
 *   · **A row tappable for a coach who cannot write.** The form would open and the server would
 *     refuse the save — the affordance lying about what the role can do.
 *
 * ⚠ WHY THE TAP IS THE ROW AND NOT THE FIGURE, since that is the thing a future reader will want
 * to change. Underlining figures is Budget vs. Actual's notation and it means *"show me what is
 * behind this"* — three rounds of owner rulings (QA §132) settled that it never navigates. This tab
 * has never used that notation: the List's rows have opened the form on a tap anywhere since
 * 2026-08-13, and the By-period grid is the same worklist wearing a different view. Clicking the
 * number still opens the form, because the number is inside the row.
 *
 * ⚠ IT SCANS CODE, NOT PROSE — same `codeOnly` shape and same reason as
 * `bva-figure-doors-guard`: this file's own explanations contain the strings it forbids, and a
 * scan that counted comments would punish the documentation that makes the rule findable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUDGET = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx';
/* The view that decides WHICH rows can carry a door. The grid can only be as honest as this is:
   drop `lineId` here and every assertion below still passes over a screen that opens nothing. */
const VIEW = 'lib/coach-budget-periods-view.ts';

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

const budget = codeOnly(readFileSync(join(ROOT, BUDGET), 'utf8'));
const view = codeOnly(readFileSync(join(ROOT, VIEW), 'utf8'));

test('the view still carries the one line behind a row, so a door has something true to open', () => {
  assert.match(
    view,
    /lineId:\s*rowKey === NO_ITEM_ROW_KEY \? null : line\.id/,
    'The period view has stopped naming the budget line behind each row. Without `lineId` the only '
    + 'id a row has is `group|rowKey`, which matches no record — so every door on the grid would '
    + 'either open nothing or have to guess.',
  );
  assert.match(
    view,
    /if \(row\.lineId !== line\.id\) row\.lineId = null;/,
    'The view no longer drops `lineId` when a second line merges into a row. One word carries one '
    + 'line since migration 286, so this should be unreachable — but if it is ever reached, the '
    + 'door would open a real form on the wrong half of the row\'s figure, and nothing on screen '
    + 'would say so. "Never guess which line" has to be structural, not an assumption.',
  );
});

test('the grid builds its door from the LINE id and never from the row id', () => {
  /* One pattern, because the shape IS the rule: read the line id off the row, and build a door
     only when there is one. Written out in full so a rewrite has to restate both halves rather
     than keeping the words and losing the condition. */
  assert.match(
    budget,
    /const lineId = row\.lineId;\s*\n\s*const openLine = onEditLine && lineId \? \(\) => onEditLine\(lineId\) : null;/,
    'The By-period grid\'s door is no longer built from the row\'s `lineId`. If it now passes '
    + '`row.id`, that is `group|rowKey` — a name for a position in the view which matches no '
    + 'record, so the lookup returns nothing and the tap dies in silence. If the condition went '
    + 'instead, the "Not itemized" bucket starts opening one of its several lines at random.',
  );
  const calls = budget.split('\n').filter(l => /onEditLine\(/.test(l));
  assert.ok(calls.length > 0, 'The By-period grid no longer opens a line at all.');
  for (const line of calls) {
    assert.ok(
      !/row\.id\b/.test(line),
      `A door on the By-period grid is being handed the row id:\n${line.trim()}`,
    );
  }
});

test('a coach who cannot write money gets no tappable rows', () => {
  assert.match(
    budget,
    /onEditLine=\{moneyCanWrite/,
    'The By-period grid is handed its edit door regardless of role. An assistant would get rows '
    + 'that open a form the server then refuses — an affordance lying about what the role can do.',
  );
});

test('every tap on the grid survives a copy gesture — on the row AND on the control inside it', () => {
  /* Four handlers, not two: the category row and the line row each tap, and each has a full-width
     button sitting on top of it.

     ⚠⚠ THE BUTTON IS WHERE THE GUARD ACTUALLY MATTERS, and putting it only on the row is a guard
     that never runs (`/review` correctness lens, 2026-09-10). `.moneyGridToggle` fills its cell, so
     a drag across the category or line name ends its mouseup on the BUTTON — which swallows the
     click with `stopPropagation` before the row's guard is ever consulted. Both halves, or the
     feature is: select the line name to copy it, and the edit form opens over the top of it.

     ⚠ PINNED BY THE CALL EACH HANDLER MAKES, NOT COUNTED ACROSS THE FILE. The List already carries
     five of these guards, so any threshold over the whole panel passes with every one of the grid's
     missing — a green check over an empty fixture, and the first draft of this test was exactly
     that. */
  /* ⚠⚠ EACH PATTERN MUST ONLY MATCH ITS OWN HANDLER, and one of them did not — found by
     mutation-testing this very file (delete a guard, the test must go red). The category ROW's
     pattern allowed a newline between the guard and the call, so it was satisfied by the category
     BUTTON's handler a few lines below: deleting the row's guard left the test green. Both are
     pinned to their own layout now — the row guards inline on one line, the button across three
     after its `stopPropagation`. A guard that passes over the broken thing is worse than none. */
  const GUARD = String.raw`if \(window\.getSelection\(\)\?\.toString\(\)\) return;`;
  const STOPPED = (call: string) =>
    new RegExp(`e\\.stopPropagation\\(\\);\\s*\\n\\s*${GUARD}\\s*\\n\\s*${call}`);
  const TAPS: Array<[string, RegExp]> = [
    ['the category row (folds)', new RegExp(`\\(\\) => \\{ ${GUARD} onToggle\\(group\\.key\\); \\}`)],
    ['the category button (folds)', STOPPED(String.raw`onToggle\(group\.key\)`)],
    ['the line row (opens the form)', new RegExp(`\\(\\) => \\{ ${GUARD} openLine\\(\\); \\}`)],
    ['the line-name button (opens the form)', STOPPED(String.raw`openLine\(\)`)],
  ];
  for (const [what, pattern] of TAPS) {
    assert.match(
      budget, pattern,
      `${what} on the By-period grid has lost its text-selection guard. Selecting a line name or an `
      + 'amount to copy it would fold the category, or open the edit form over the number being read.',
    );
  }
});

test('the tappable row keeps a control a keyboard can actually reach', () => {
  /* ⚠ A ROW `onClick` IS POINTER-ONLY. A `<tr>` takes no focus, has no role and announces nothing,
     so the form this view just gained would open for a thumb and a mouse and for nobody else —
     invisible to every other gate in this repo, because the screen renders perfectly either way.
     The List answers this with its pencil and the category row above with its chevron; this row
     answers it by making the line's own name the control, which is also the only thing that fits
     inside a pinned, nowrap first column without pushing period columns off a phone. */
  assert.match(
    budget,
    /<button[\s\S]{0,400}?shared\.moneyGridToggle[\s\S]{0,400}?title=\{`Edit \$\{row\.description\}`\}/,
    'The By-period grid\'s line rows have lost their keyboard door. The row\'s onClick reaches a '
    + 'pointer only — restore the name-as-button (or another real control inside the row), and keep '
    + 'the `title` that says which line it opens.',
  );
  /* ⚠ AND IT MUST STAY THE SHARED CLASS. A local copy was written first and shipped nothing: the
     rendered sweep found eleven of these at 26px against the 44px floor, because `.moneyGridToggle`
     is inside the ≤768 touch band and a fresh copy of its declarations was not. Dressing this
     button locally again would pass every static gate in the repo and fail only in a browser. */
  assert.ok(
    !/periodGridLineBtn/.test(budget),
    'The line-name button is being dressed by a local class again. `.moneyGridToggle` carries the '
    + 'tap floor for every control inside a money-grid cell; a copy of its declarations does not, '
    + 'and nothing short of the rendered sweep will tell you.',
  );
  /* ⚠⚠ AND IT MUST NOT BE AN `aria-label` (`/review` accessibility lens, 2026-09-10). One was
     written here first and it made things WORSE for the readers this button exists for: it is the
     sole content of a `<th scope="row">`, and a labelled descendant contributes its own accessible
     NAME when a header's name is computed from content — so the row header read "Edit Dome Time"
     and a screen reader re-announced the verb against every figure in the row while paging across
     the period columns. `title` never becomes the name while text content is present, so the
     header stays "Dome Time" and the verb travels as the description. This is the sort of
     regression no other gate in this repo can see. */
  assert.ok(
    !/aria-label=\{`Edit \$\{row\.description\}`\}/.test(budget),
    'The line-name button is labelled with `aria-label` again. It is the only content of the row\'s '
    + '`<th scope="row">`, so its label BECOMES the row header\'s name — every cell in that row then '
    + 'announces "Edit <line>, $500" during table navigation. Use `title`, which stays a '
    + 'description while the button has text content.',
  );
});

test('the chevron stops the row underneath it from toggling as well', () => {
  /* ⚠ THE FAILURE IS THE FUNNIEST KIND: without this the click toggles the fold twice — once on the
     button, once on the row it bubbles to — so the category NEVER OPENS. The control does its job
     perfectly, exactly two times, and reads as broken. */
  assert.match(
    budget,
    /onClick=\{e => \{\s*\n\s*e\.stopPropagation\(\);[\s\S]{0,160}?onToggle\(group\.key\);/,
    'The By-period grid\'s category chevron no longer stops propagation. The whole row folds on a '
    + 'tap now, so a click on the chevron toggles the fold twice and the category never opens.',
  );
});
