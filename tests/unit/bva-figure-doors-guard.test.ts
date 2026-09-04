/**
 * **EVERY FIGURE ON A BUDGET-VS-ACTUAL ROW OPENS WHAT IS BEHIND IT** — the teeth on the owner
 * ruling of 2026-09-04 (QA §132, round three).
 *
 * WHY THIS EXISTS, PRECISELY. The statement's rows explained themselves in three different
 * registers at once, and each one had a plausible local reason:
 *
 *   · the ACTUAL column had a permanent sub-row — `"$815.00 paid · $125.00 back"` — rendered
 *     OUTSIDE the row's own expander. On an item with no dated periods there was no expander at
 *     all, so the strip read as the expansion of something that could not be expanded, in card
 *     white against the tint of the rows above it. It named two totals and no records: *which*
 *     payments made that figure was unanswerable on this screen under every data shape. Reproducing
 *     the owner's $815 took five database queries against the live fixture, and that is the whole
 *     case for this file.
 *   · the BUDGET column had a door (the `N lines` caption, added one day earlier) and the actual
 *     column did not, so one report answered "what is behind this number?" on one column and
 *     refused on the other. ⚠ The fix moved the door onto the FIGURE, which immediately made the
 *     caption a second way into the same panel a thumb's width away — so it went back to being
 *     plain text hours later (owner: *"why do I need the 2 lines link at all when I can click the
 *     2500?"*). Both states are pinned below, because the caption has now changed hands twice in
 *     two days and the next reader deserves the RULE rather than the outcome: a caption earns a
 *     click only when the number beside it is not already a door.
 *   · the category bar opened on a click anywhere on the row; the item row opened only on its 13px
 *     chevron — two rows in one table with two different rules.
 *
 * ⚠⚠ **THE PAYLOAD IS THE HALF THAT ROTS SILENTLY, WHICH IS WHY IT IS GUARDED FIRST.** The route
 * used to strip `costs` off every item on the way out, and its comment gave a GOOD reason: the
 * report rendered neither list, and shipping both would have been two arrays of raw records per row
 * for nothing. That reason expired the moment a figure became a door, and nothing about the screen
 * would fail if somebody reinstated the optimisation — the panel would simply open on an empty
 * list. A door onto nothing is the politer face of the dead end this change removed, so it fails
 * here instead.
 *
 * ⚠ **AND THE WORD, WHICH HAS NOW BEEN ARGUED THREE TIMES.** `not planned` beside an unplanned
 * row's name was trimmed (2026-08-15), restored (D5.5, 2026-09-02) and removed again on the built
 * screen (2026-09-04) — *"empty budget items give that away clearly"*. The third reading is the one
 * with the evidence behind it: with a tint AND a dash AND a word all saying one thing, the tint
 * stopped reading as a status and started reading as a GROUPING. This guard does not re-litigate
 * that; it pins the CONSEQUENCE, which is that the row must keep a non-visual carrier. A tint is
 * not readable, so removing the visible word without leaving the hidden sentence would take the
 * fact away from a screen reader entirely — and that regression is invisible to every other gate
 * in this repo.
 *
 * ⚠ IT SCANS CODE, NOT PROSE. Both files explain themselves at length and both explanations
 * contain the exact strings this guard forbids; a scan that counted comments would punish the
 * documentation that makes the rule discoverable. Same `codeOnly` shape as
 * `money-one-arithmetic-guard`, and the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PANEL = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx';
const ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts';

/**
 * Comments stripped, because this guard is about CODE. Block comments go wholesale; line comments
 * only when the line is nothing but a comment, so a `//` inside a string literal is never mistaken
 * for one.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

const panel = codeOnly(readFileSync(join(ROOT, PANEL), 'utf8'));
const route = codeOnly(readFileSync(join(ROOT, ROUTE), 'utf8'));

test('the payload keeps the records behind a row — both lists, or the doors open onto nothing', () => {
  assert.ok(
    !/costs:\s*_costs|_costCount/.test(route),
    'The report route is stripping `costs` off its items again. Both figures on a statement row are '
    + 'doors now: the Budget figure opens the plan lines, the Actual figure opens the payments. '
    + 'Removing either list does not break a render — it opens an empty panel, which is exactly the '
    + 'dead end QA §132 closed. If the payload weight is the problem, the answer is paging the list '
    + 'inside the panel, never dropping it here.',
  );
});

test('the client type still declares both lists, so a dropped field is a type error and not a blank panel', () => {
  for (const field of ['lines:', 'costs:', 'refunds:']) {
    assert.ok(
      panel.includes(field),
      `The statement's item type no longer declares \`${field}\`. That is the only thing standing `
      + 'between a payload regression and a panel that silently opens empty.',
    );
  }
});

test('an unplanned row keeps a carrier a screen reader can actually read', () => {
  /* The visible word is gone by ruling; the tint cannot replace it, because a colour has no
     reading. What must survive is the item row's hidden sentence and the category header's
     `aria-describedby` twin — remove either and the fact leaves the product for a non-visual
     reader without a single gate noticing. */
  assert.ok(
    /srOnly[\s\S]{0,80}not planned/.test(panel),
    'The item row lost its visually hidden "not planned" sentence. The visible word was removed on '
    + '2026-09-04 precisely BECAUSE the dash and the tint already carry it for a sighted reader — '
    + 'neither carries it for anyone else. Restore the hidden sentence, or put the visible word back.',
  );
  assert.ok(
    panel.includes('aria-describedby={noteId}'),
    'The category header lost its `aria-describedby` sentence — see the note above; same reason.',
  );
});

test('the visible "not planned" word has not crept back beside the tint', () => {
  const visible = panel
    .split('\n')
    .filter(l => /not planned/.test(l))
    .filter(l => !/srOnly/.test(l));
  assert.deepEqual(
    visible, [],
    'A visible "not planned" label is back on the statement. It has been argued three times and '
    + 'settled: the em-dash under Budget states it, the tint scans it, and a hidden sentence reads '
    + 'it. A fourth signal is what made the tint read as a grouping rather than a status.',
  );
});

test('both newly-shipped record lists are read through a deploy-skew guard', () => {
  /* ⚠ BOTH FIELDS ARE NEWER THAN A CLIENT THAT MAY ASK FOR THEM — the same deleted helper stripped
     `lines` and `costs` together, so a rolling deploy really does pair a new bundle with a route
     that still omits them. `lines` was guarded on the first pass and `costs` was not, and the
     unguarded read sat in a predicate that runs for EVERY row on every render: the whole statement
     threw before a single figure painted. Typing them optional is what forces the guard; this pins
     the reads themselves. */
  /* ⚠ IT LOOKS FOR THE UNGUARDED FORM, NOT FOR THE GUARDED ONE. Asserting "a guarded read exists"
     passes as soon as ANY one read is guarded, which is exactly the state this finding was: the
     `.map` was safe and the predicate was not. There are only two ways to touch these arrays, so
     both spellings of the raw access are named. */
  for (const field of ['lines', 'costs']) {
    for (const raw of [`item.${field}.length`, `item.${field}.map`, `item.${field}.filter`]) {
      assert.ok(
        !panel.includes(raw),
        `\`${raw}\` is read without a deploy-skew guard. Read it as \`item.${field}?.length ?? 0\` `
        + `or \`(item.${field} ?? [])\`, and keep the field optional so the compiler insists.`,
      );
    }
    assert.ok(
      panel.includes(`${field}?:`),
      `\`${field}\` is no longer optional on the item type — without that, the guard above is advice `
      + 'rather than something the compiler enforces on the next reader.',
    );
  }
});

test('the records panel stands on the portal\'s shared dialog floor', () => {
  /* A hand-rolled overlay has no Escape, no Tab trap, no focus restore and no dialog role. That is
     the defect the §134 walk found on the bill room, and the reason the shared shell exists — so
     this panel uses it rather than re-deriving it and missing the same four things again. */
  assert.ok(
    panel.includes('<QuestionShell'),
    'The records panel is a hand-rolled overlay again. Use QuestionShell: it carries Escape, the '
    + 'Tab trap, focus into the panel on open and focus back to the opener on close. A coach who '
    + 'opens this panel with the keyboard must be able to close it with the keyboard.',
  );
});

test('the row itself opens, on both levels of the table', () => {
  assert.ok(
    panel.includes('shared.rowTappable'),
    'The statement\'s item rows are no longer tappable as a whole. The category bar above them has '
    + 'always opened on a click anywhere; an item row that opens only on its 13px chevron is the '
    + 'same table teaching two rules (owner, 2026-09-04, restating the plan page\'s 2026-08-13 rule).',
  );
  assert.ok(
    /window\.getSelection\(\)\?\.toString\(\)/.test(panel),
    'The tappable row lost its text-selection guard. A click that ends a selection is a copy '
    + 'gesture, not a tap — without this, highlighting an amount to copy it folds the row.',
  );
});

test('every control inside the tappable row stops the row from also toggling', () => {
  /* A nested control that forgets this does TWO things on one click — opens its panel and folds
     the row underneath it, so the panel appears over a table that just moved. */
  const opens = panel.split('\n').filter(l => /openBehind\(item, '(plan|actual)'\)/.test(l));
  assert.equal(
    opens.length, 2,
    `Exactly two controls on a row open the records panel — the Budget figure and the Actual figure — `
    + `and found ${opens.length}. A THIRD is how the "2 lines" caption came to be a second door onto `
    + `the panel the figure beside it already opened (owner, 2026-09-04: "why do I need the 2 lines `
    + `link at all when I can click the 2500?"). One row, one way in per column.`,
  );
  for (const line of opens) {
    assert.ok(
      line.includes('e.stopPropagation()'),
      `A control opening the records panel does not stop propagation:\n${line.trim()}`,
    );
  }
});

test('the "N lines" caption is a caption, not a second door', () => {
  /* ⚠ IT HAS CHANGED HANDS TWICE IN TWO DAYS and the rule that settles it is a question, not a
     preference: is the number beside it already a door? It is, so the caption announces the merge
     and nothing more — which is also how the Budget tab's by-period grid has always rendered it,
     so the two views of one report agree again. */
  const caption = panel.split('\n').find(l => /\{item\.lineCount\} lines/.test(l));
  assert.ok(caption, 'the "N lines" caption is gone entirely — it is the only thing on the row that '
    + 'says the row is a merge, which is why the words survived when the link did not');
  assert.ok(
    !/<button/.test(caption) && !/onClick/.test(caption),
    `The "N lines" caption is a control again:\n${caption.trim()}\n`
    + 'Before re-dressing it, answer the test: is the number beside it already a door?',
  );
  assert.ok(
    !panel.includes('lineCountBtn'),
    'The caption\'s control styling is back. It was a dotted underline, a focus ring and a 44px '
    + 'touch box — all correct for a button, and all wrong for text that no longer clicks.',
  );
});
