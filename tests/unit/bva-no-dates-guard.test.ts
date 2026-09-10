/**
 * **NEITHER BUDGET-VS-ACTUAL REPORT RENDERS A DATE ON A ROW** — the teeth on the owner ruling of
 * 2026-09-10 ("Things, not dates"), raised on the §157 walk.
 *
 * WHY THIS EXISTS, PRECISELY. Opening `Fundraising · Merchandise sales` on the Statement unfolded it
 * to a single sub-row reading **Feb 2027**, against money that arrived on **Aug 31** and **Sep 10**.
 * That was not one bad row. The fold showed the **plan's** periods, and real money was then PLACED
 * against them by a rule — each amount landing in the first planned slot on or after the day it
 * moved, anything later or undated landing in the last one. So the fold was **dated on the budget
 * side and swept on the actual side**. On a line planned across five months it read correctly and
 * usefully; on a line with one planned slot in February it reported every dollar of the season as
 * February.
 *
 * ⚠⚠ **IT COULD NOT BE REPAIRED, ONLY REMOVED, AND THE ARGUMENT IS A PROOF RATHER THAN A TASTE.**
 * Dating one side honestly requires dating the other, and dating the other means a row per line per
 * month on BOTH halves of a report a treasurer is meant to read in one screen. *There is no version
 * of the fold that is both truthful and short.* A future session WILL rediscover the fold as a good
 * idea — it is genuinely useful-looking — so the argument is pinned here rather than left in a
 * comment somebody can delete in the same edit that re-adds the feature.
 *
 * ⚠ **THE ROW ALREADY HAD TWO BETTER ANSWERS, WHICH IS WHY NOTHING IS LOST.** Every item row carries
 * two doors (owner ruling 2026-09-04, §132 round three): the Budget figure opens the plan — its
 * schedule included, because those are the PLAN's dates and claim nothing about when money moved —
 * and the Actual figure opens the records that made it, which on a revenue row are the drives and
 * sponsors BY NAME, each linking to its own room. The fold was a third, weaker answer crowding two
 * good ones.
 *
 * ⚠ **WHAT IS KNOWINGLY LOST, so nobody re-opens it as a defect:** *"we are over on ice time —
 * which month?"* The Months view answers by CATEGORY, not by line. The owner accepted that
 * explicitly. If you are about to rebuild a per-line month breakdown, you are re-opening a settled
 * trade, not fixing an oversight.
 *
 * ⚠⚠ **AND THE DATES ARE STILL IN THE PAYLOAD, ON PURPOSE.** `item.periods` survives and MUST: it
 * drives the **To date** comparison basis (`budgetedOn`) and it is the list behind a Budget figure.
 * Deleting it would silently turn every to-date reading into a whole-season one, with nothing on
 * screen saying so. What was deleted is the *placement of actuals onto those dates*, at source.
 *
 * ⚠ IT SCANS CODE, NOT PROSE, and it uses the REPO'S OWN helper to do it (`/simplify`, 2026-09-10).
 * These files explain themselves at length and the explanations contain the very strings this guard
 * forbids, so a guard that read raw text would fail on a comment describing the design it removed —
 * and, far worse, would PASS if someone deleted the code and left the paragraph explaining it. The
 * first pass here rolled its own stripper, which made a FOURTH copy of a rule `tests/unit/_source-code.ts`
 * already owns and had already hardened: that one is string-aware, so a `//` inside a literal cannot
 * silently eat the rest of a line and WEAKEN an assertion. A guard that fails quiet is the thing
 * these files exist to stop, so this one borrows the careful version rather than keeping a naive twin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const PANEL = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx';
const ROLLUP = 'lib/coach-budget-rollup.ts';
const EXPORTS = 'lib/coach-money-exports.ts';
const DUES = 'lib/coach-dues-revenue.ts';

const panel = readCode(PANEL);
const rollup = readCode(ROLLUP);
const exportsSrc = readCode(EXPORTS);
const dues = readCode(DUES);

/**
 * The body of one top-level function, so an assertion can be about ONE component rather than about
 * a 3,000-line file.
 *
 * ⚠ IT READS LINES, NOT BRACES, AND THAT IS NOT LAZINESS — brace counting from the declaration is
 * WRONG on this codebase, and it failed on this guard's first run in two different ways. A
 * destructured parameter list (`function CatFoldRow({ name, open, ... })`) opens and closes a pair
 * before the body, and so does an inline return type (`): { rows: ExportRow[]; ... }`), so a
 * counter returns the signature and the assertion then passes or fails for the wrong reason. Every
 * top-level function in these files closes on a line that is exactly `}`, which is unambiguous.
 */
function bodyOf(src: string, decl: string): string {
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith(decl));
  assert.notEqual(
    start, -1,
    '`' + decl + '` is gone from the file this guard scans. If it was renamed, rename it here too — '
    + 'do not delete the assertion.',
  );
  const end = lines.findIndex((l, i) => i > start && l === '}');
  assert.notEqual(end, -1, 'could not find the end of `' + decl + '`');
  return lines.slice(start, end + 1).join('\n');
}

test('an item row renders no date, and nothing under it', () => {
  /* The whole finding, in one assertion. `ItemRows` draws every line of both report shapes; if it
     cannot see a period, it cannot print one. Scoped to the component rather than the file because
     `RecordsBehind` legitimately lists the PLAN's schedule behind a Budget figure — that is a date
     belonging to the plan, which is a ruled exception (plan §7, ruling 2). */
  const rows = bodyOf(panel, 'function ItemRows(');
  assert.ok(
    !/\bperiods\b/.test(rows),
    'The statement\'s item rows can see `item.periods` again. That is how the fold came back: the '
    + 'periods are the PLAN\'s dates, and pairing them with an actual is what reported August money '
    + 'as February. If a row needs to say when something moved, the answer is the Months view (both '
    + 'sides dated the same way) or the panel behind the Actual figure (each RECORD on its own day).',
  );
  assert.ok(
    !/formatStoredDate|fmtMonth|periodDate/.test(rows),
    'An item row is formatting a date again. Neither report may render one on a row — see this '
    + 'file\'s header for why the fold could not be made truthful and short at the same time.',
  );
});

test('item rows have no expander; CATEGORY rows still do', () => {
  /* Both halves matter and they pull in opposite directions. A chevron on an item row promises the
     fold that was removed; losing the chevron on a CATEGORY row would take away the fold onto
     THINGS, which is the point of the whole change ("Player dues" folds to families through it). */
  const rows = bodyOf(panel, 'function ItemRows(');
  assert.ok(
    !/aria-expanded|Chevron/.test(rows),
    'An item row has an expander again. There is nothing behind it to open: the two figures are the '
    + 'row\'s doors, and the periods it used to unfold are the plan\'s dates with real money swept '
    + 'onto them.',
  );
  const cat = bodyOf(panel, 'function CatFoldRow(');
  assert.ok(
    /aria-expanded/.test(cat) && /Chevron/.test(cat),
    'The CATEGORY row has lost its fold. That fold is onto THINGS — a category\'s items, and since '
    + '2026-09-10 a family\'s dues row — which is the half of this ruling that ADDS an answer '
    + 'rather than removing one.',
  );
});

test('the sweep is deleted at source, not merely unrendered', () => {
  /* ⚠ THE PAYLOAD IS THE HALF THAT ROTS SILENTLY. A figure nobody can date honestly, left sitting
     in the payload, is a wrong figure waiting for its next reader — and the next reader gets a
     compiling field with a plausible name and no idea it lies. */
  assert.ok(
    !/const actuals = new Array/.test(rollup),
    'The rollup is placing actual money onto planned dates again. That rule put every dollar of a '
    + 'February-planned line into February whenever it arrived. It has no honest form: dating the '
    + 'actual side properly means a row per line per month on both halves of the report.',
  );
  assert.ok(
    !/date: string \| null; amount: number; actual: number/.test(rollup),
    'A budget period carries an `actual` again. Keep the field off the type — that is what forces '
    + 'the next person to argue with this test instead of quietly re-adding the placement.',
  );
});

test('a door lives on an ITEM number, never on a CATEGORY number', () => {
  /* ⚠ THE RULE THE DUES CHANGE SETTLED REPORT-WIDE (owner, 2026-09-10). Player dues was the only
     violation on the report: a synthetic category carrying a drill-in on a category row while every
     other category rendered three plain cells. Folding it to families moved that door DOWN onto an
     item number, where every other door already lives. */
  const group = bodyOf(panel, 'function CategoryGroup(');
  const bar = group.slice(group.indexOf('<CatFoldRow'), group.indexOf('</CatFoldRow>'));
  assert.ok(
    bar.length > 0 && !/figureBtn|<button/.test(bar),
    'A CATEGORY row is carrying a door on one of its figures. Doors belong on item numbers: a '
    + 'category total is the sum of rows a coach can already open, so a door there is a second way '
    + 'into what the fold beneath it already shows. This was the report\'s one violation and it was '
    + 'resolved by moving the door down, not by making an exception.',
  );
});

test('the dues category folds to families, and the to-date basis rides on their own dates', () => {
  assert.ok(
    /buildDuesFamilyRows/.test(dues),
    'The per-family dues rows are gone. Player dues was the largest figure on the report and the '
    + 'one row a coach could not open — a variance with no way to ask "who?".',
  );
  assert.ok(
    !/dues\.billedToDate/.test(panel),
    'The report is reading a whole-team `billedToDate` again — the special case `rebaseReport` shed '
    + 'when dues gained items. It is not wrong so much as a second source: each family row carries '
    + 'its own installment dates, so the ordinary rule (plan dated on or before today) already '
    + 'lands on that figure. Two derivations of one number is how this report has twice drifted.',
  );
  /* ⚠ PINNED ON THE BEHAVIOUR, NOT ON A VARIABLE NAME. The first cut asserted the literal
     `periods: schedule.get(owner)`, and a `/simplify` pass that merged two maps into one — changing
     nothing a coach can see — broke it the same day. A guard that fires on a rename teaches people
     to edit the guard, which is how a guard stops being believed. What must stay true is that a
     family row's periods are built FROM THAT FAMILY'S INSTALLMENT DUE DATES. */
  const familyRows = bodyOf(dues, 'export function buildDuesFamilyRows(');
  assert.match(
    familyRows,
    /date: i\.dueDate/,
    'The family rows have stopped carrying their installment due dates. Without them the ordinary '
    + 'to-date rule contributes NOTHING for dues, and the whole revenue band reads $0.00 under '
    + '"To date" on a team billing perfectly on schedule — with nothing on screen saying so.',
  );
  assert.match(
    familyRows,
    /periods: /,
    'A dues family row no longer carries a `periods` array at all — see above; this is the field '
    + 'the to-date basis reads.',
  );
});

/**
 * **A HEADING THAT CANNOT FOLD STILL EXPLAINS ITS OWN DASH — AND EXPLAINS IT ONCE** (`/review`,
 * 2026-09-10).
 *
 * The category row carries a hidden sentence for a screen reader, because a dash and a colour are
 * not readable. Two things went wrong when Player dues became an ordinary category:
 *
 *   · `aria-describedby` sat only on the FOLDABLE branch's button, so an unfoldable heading rendered
 *     the hidden sentence with nothing referencing it — a description a screen reader meets as loose
 *     prose rather than as this row's explanation.
 *   · Worse, the sentence was WRONG. The generic one reads "Nothing in <category> was budgeted for
 *     this season", which is true of an unplanned category and false of Player dues, where the dash
 *     means **no schedule has been set**. A not-set dues row satisfies `!inPlan`, so a screen reader
 *     got that sentence CONTRADICTING the visible "Not set yet · Set player dues" caption beside it.
 *
 * Both are invisible to every other gate in this repo: nothing throws, nothing renders wrong for a
 * sighted reader, and the rendered layout sweep cannot hear a sentence.
 */
test('an unfoldable heading explains its dash once, and to everyone', () => {
  const cat = bodyOf(panel, 'function CatFoldRow(');
  const split = cat.indexOf(') : (');
  assert.notEqual(split, -1, 'CatFoldRow no longer has a foldable / plain split to check.');
  const foldable = cat.slice(0, split);
  const plain = cat.slice(split);
  assert.match(
    foldable, /aria-describedby={noteId}/,
    'The foldable category row has lost its description reference. A dash and an ink have no '
    + 'reading; that sentence is the only carrier for anyone not looking at the colour.',
  );
  assert.match(
    plain, /aria-describedby={noteId}/,
    'A category row that draws no chevron renders the hidden sentence with NOTHING referencing it. '
    + 'Put the description reference on the name in the non-foldable branch too, or the sentence is '
    + 'loose prose rather than that row\'s explanation.',
  );
  const group = bodyOf(panel, 'function CategoryGroup(');
  assert.match(
    group, /cat\.inPlan \|\| caption \? undefined/,
    'A category with a CAPTION is asserting the generic "nothing was budgeted" sentence again. For '
    + 'Player dues that sentence is false — its dash means no schedule has been SET — so a screen '
    + 'reader would hear it contradict the visible "Not set yet" caption. A caption replaces the '
    + 'note; it does not join it.',
  );
});

/**
 * **THE EXPORT KEEPS ITS SINGLE PLAYER DUES ROW — a deliberate, named exception to
 * `EXPORT SHAPE = SCREEN SHAPE`** (owner ruling 2026-09-10).
 *
 * The Statement exports to a file a treasurer emails to a board. Following the screen would put
 * twelve families' names and **what each still owes** into that file, where it is forwarded,
 * printed and left on a table — and the coach who pressed Export never chose to publish it. Drives
 * and sponsors stay named, because they are businesses and events rather than children.
 *
 * ⚠ THE STANDING LESSON SAYS THESE TWO SHAPES MUST NOT DRIFT, which is exactly why the exception is
 * guarded rather than commented. Without this test a later session "fixes" the divergence with a
 * perfectly good local argument.
 */
test('the exported statement names no family', () => {
  const push = bodyOf(exportsSrc, 'export function bvaCategoryRows(');
  assert.match(
    push,
    /if \(isDues\) return;\s*pushItemRows\(cat\.items, push\);/,
    'The statement export is walking the dues category\'s items again — which since 2026-09-10 is '
    + 'one row per FAMILY, each carrying what that family still owes. The file is emailed to a '
    + 'board. Restore the guard, or take the ruling back to the owner: the alternative was '
    + 'considered and rejected because it changes what a treasurer hands round a table.',
  );
  const activity = bodyOf(exportsSrc, 'export function bvaActivityRows(');
  const cut = activity.indexOf('if (isDues(block.categoryId)) continue;');
  assert.notEqual(cut, -1, 'the by-activity export no longer separates its dues loop');
  assert.ok(
    !/pushItemRows/.test(activity.slice(0, cut)),
    'The by-activity export has started writing the dues block\'s item rows. Same ruling, same '
    + 'file, same board: the per-family rows are SCREEN-ONLY. Until 2026-09-10 this loop wrote a '
    + 'bare row because the block genuinely had no items — that is no longer why it is safe.',
  );
});
