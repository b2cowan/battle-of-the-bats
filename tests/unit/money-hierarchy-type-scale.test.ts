import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * ONE TYPE SCALE FOR A MONEY HIERARCHY.
 *
 * ⚠⚠ THIS FILE USED TO GUARD TWO FAMILIES AGAINST EACH OTHER, AND ONE OF THEM NO LONGER EXISTS.
 * The Money hub drew the same category → line → total tree two ways: as an OUTLINE (`.ledger*`, a
 * card stack) and as a GRID (`.moneyGrid*`, a real table). On the Budget tab they were ONE TOGGLE
 * APART, they drifted apart twice in a single day, and both times the fix was applied only to the
 * half being looked at:
 *   1. The grids' bodies were left alone when their heading rows were unified — owner: *"these
 *      still look like 2 differently formatted tables."*
 *   2. The grid adopted the ruling that a category is the LARGEST name in its group, and the
 *      outline kept small caps — owner: *"shouldn't we also be consistent between list and by
 *      period?"* One toggle turned "Tournaments" into "TOURNAMENTS" and inverted the hierarchy.
 * A comment asking the next contributor to change both had failed twice, so this parsed the real
 * stylesheet and failed the build instead.
 *
 * ⚰ THE OUTLINE WAS RETIRED ON 2026-09-05 (owner ruling, one-surface pass, mockup artifact
 * `dde45c3f-7faf-4d5c-869f-627c0c52fb8b`): its only two adopters — Budget vs. Actual's Statement
 * and By activity, and the Budget tab's List — became tables, so the whole `.ledger*` family was
 * deleted. **Every equality assertion in this file compared the two families and is therefore
 * gone with the second family.** That is a deliberate retirement, not a dropped guard.
 *
 * ⚠ WHAT STILL GENUINELY NEEDS GUARDING, and is asserted below, is what a shared variable cannot
 * express — the RELATIONSHIPS inside the surviving family, plus the one cross-family pair that
 * outlived the outline:
 *   · a category reads LARGER than the lines it groups (the 2026-08-13 ruling that a parent row is
 *     the biggest name in its group, never a small-caps eyebrow above it);
 *   · a category is never set in small caps — the original defect, stated directly;
 *   · the dues table's `<tfoot>` total measures the same as the grid's closing total. This one
 *     forked ON ARRIVAL in 2026-08-13, written with a hand-copied `0.92rem` and a typed `700`, so
 *     the dues totals rendered a full weight step lighter than every other closing total in the
 *     hub. It was compared against the outline's total; it is compared against the grid's now,
 *     which is the same number by way of the same variable.
 *
 * ⚠ IT READS THE STYLESHEET rather than restating the numbers, for the same reason the warm-palette
 * contrast test does: a copy of the values is a second source that goes stale on its own.
 *
 * ⚠ IF A SECOND WAY OF DRAWING A MONEY HIERARCHY IS EVER ADDED, the equality assertions belong
 * back here — see the tombstone at the top of the retired family in `coaches.module.css`, which
 * states plainly that a new card-stack recipe needs an owner ruling first.
 */

const CSS = readFileSync(
  path.join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'coaches.module.css'),
  'utf8',
);

/**
 * The statement's own stylesheet. The closing answer lives here rather than in the shared recipe,
 * because "Season net" is a fact only Budget vs. Actual has — so the one relationship that says it
 * outranks its own subtotals spans TWO files, and neither file can hold it alone.
 */
const BVA = readFileSync(
  path.join(process.cwd(), 'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'accounting',
    'budget-vs-actual', 'bva.module.css'),
  'utf8',
);

/** The declaration block of a rule whose selector list contains `selector` exactly. */
function block(selector: string, src: string = CSS): string {
  // Match a rule whose selector list includes this exact class (not a longer one sharing a prefix),
  // and take the FIRST such block — later overrides live in media queries, which are scoped and are
  // not what this test is about.
  const re = new RegExp(
    `(^|[,{}])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(,[^{]*)?\\{([^}]*)\\}`,
    'm',
  );
  const m = src.match(re);
  assert.ok(m, `No rule found for "${selector}" — the class was renamed or removed. Update this test WITH the rename; do not delete it.`);
  return m![3];
}

function prop(selector: string, name: string, src: string = CSS): string {
  const b = block(selector, src);
  const m = b.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  assert.ok(m, `"${selector}" no longer declares ${name} — if it moved, move this assertion with it.`);
  return m![1].trim();
}

/**
 * Resolve a declaration to a number of rem, following ONE level of `var(--x)` indirection.
 *
 * The grid reads its scale from custom properties, so `prop()` legitimately returns
 * `var(--money-cat-size)` rather than a length. The string comparisons below are stronger for it —
 * they prove both sides reference the SAME variable, which also catches someone hard-coding one
 * side back to a literal. Only the RELATIONAL assertion needs a real number, so only it resolves.
 */
function rem(value: string): number {
  const varRef = value.match(/^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/);
  if (varRef) {
    const decl = CSS.match(new RegExp(`${varRef[1]}\\s*:\\s*([^;]+)`));
    assert.ok(decl, `${varRef[1]} is referenced but never declared — the money type scale lost its source.`);
    value = decl![1].trim();
  }
  const n = parseFloat(value);
  assert.ok(Number.isFinite(n), `Could not read a length from "${value}".`);
  return n;
}

test('money hierarchy — one type scale, and it never inverts', async (t) => {
  await t.test('the TABLE FOOTER total measures the same as the grid\'s closing total', () => {
    assert.equal(
      prop('.footValue', 'font-size'),
      prop('.moneyGrid tbody tr.moneyGridTotal th', 'font-size'),
      'The dues table footer total and the grid\'s closing total disagree on size.',
    );
    assert.equal(
      prop('.footValue', 'font-weight'),
      prop('.moneyGrid tbody tr.moneyGridTotal th', 'font-weight'),
      'The dues table footer total and the grid\'s closing total disagree on weight. '
      + 'Every closing total in Money takes --money-cat-*; a literal here is the drift this file exists to catch.',
    );
  });

  /**
   * ⚠⚠ THE CLOSING ANSWER IS THE SAME SIZE AS ITS SUBTOTALS, BY RULING — and this assertion exists
   * because that question was answered wrongly twice in three files before it was answered once on
   * a screen.
   *
   * Season net, Total revenue and Total expenses all measure `--money-cat-size`. Two pieces of prose
   * used to claim otherwise: a stylesheet comment saying the subtotals wore a thinner cap than the
   * net (they wear the same 2px cap), and an owner-QA walk step saying the net read "larger and
   * bolder" (it read identically). Both were written by someone looking at the screen they
   * described, and both passed review.
   *
   * Shown the difference, the owner ruled the OTHER way (2026-09-06, QA §146): a step up to 1rem was
   * built for him and reverted on sight — *"go back to making the font size the same as the
   * revenue/expense rows. It keeps it in line with the other monthly statement and looks better."*
   * Budget vs. Actual is ONE report behind a View pill, and a coach switching to Months must not
   * find its last row grown.
   *
   * ⚠ SO THIS PINS EQUALITY, WHICH CATCHES BOTH FAILURES. Bigger is the ruling above. SMALLER is the
   * original defect: the closing row once rendered at ordinary line size because a bare `.netRow th`
   * lost to the shared row-heading reset, leaving the row this report ends on quieter than the
   * subtotals above it. Size is not what sets this row apart — its padding, its heavier cap and its
   * position are — so anything that moves the size at all is a regression in one direction or a
   * reopened ruling in the other, and both belong here rather than in a diff nobody re-measures.
   */
  await t.test('the CLOSING ANSWER measures exactly what its subtotals measure', () => {
    assert.equal(
      prop('.reportTable tbody tr.netRow th', 'font-size', BVA),
      prop('.moneyGrid tbody tr.moneyGridTotal th', 'font-size'),
      'Season net and the band subtotals (Total revenue / Total expenses) no longer measure the '
      + 'same. Owner ruling 2026-09-06 (QA §146), taken twice on the built screen: the closing '
      + 'answer is set apart by space and position, never by size — Months is the same report '
      + 'behind a View pill and its closing row is this size. If it is now SMALLER, that is the '
      + 'original specificity defect returning, and the row this report ends on is quieter than '
      + 'its own subtotals.',
    );
    assert.equal(
      prop('.reportTable tbody tr.netRow th', 'font-weight', BVA),
      prop('.moneyGrid tbody tr.moneyGridTotal th', 'font-weight'),
      'Season net and the band subtotals disagree on weight. Same ruling as the size above.',
    );
  });

  await t.test('a CATEGORY outranks its own lines — the hierarchy never inverts again', () => {
    const cat = rem(prop('.moneyGrid tbody tr.moneyGridCat th', 'font-size'));
    const line = rem(prop('.moneyGrid tbody th', 'font-size'));
    assert.ok(
      cat > line,
      `A category (${cat}rem) must read LARGER than the lines it groups (${line}rem). `
      + 'Owner ruling 2026-08-13: a parent row is the largest name in its group. '
      + 'Small caps do not count as "louder" — uppercase has no ascenders or descenders, so it '
      + 'measures a SHORTER cap-height at the same nominal size.',
    );
  });

  await t.test('a CATEGORY is never set in small caps', () => {
    // The whole original defect in one assertion: the category used to be an uppercase eyebrow.
    const g = block('.moneyGrid tbody tr.moneyGridCat th');
    assert.ok(
      !/text-transform\s*:\s*uppercase/.test(g),
      'The grid\'s category row is back in small caps. A category is a NAME at the top of its '
      + 'group, not an eyebrow above it (owner ruling 2026-08-13).',
    );
  });

  // ⚠ A BAND IS THE ONE ROW KIND THAT IS *MEANT* TO BE SMALL CAPS, and it must not be confused with
  // a category — they are adjacent tinted rows, and telling them apart is the reason the band also
  // carries a gutter above it (design pass 2026-08-24).
  //
  // ⚠⚠ THIS ASSERTION EXISTS BECAUSE THE BAND'S TEXT TREATMENT WAS INERT FOR THREE WEEKS. It lived
  // on a leading-cell class at specificity (0,1,0) while `.moneyGrid tbody th` — the "a row heading
  // is not a column heading" reset — sets font-size, weight, colour, letter-spacing AND
  // text-transform at (0,1,1). Every declaration lost, so the month grid rendered "Revenue" and
  // "Expenses" as ordinary dark sentence-case row headings and nobody noticed: a file-reading gate
  // cannot see an inherited cascade, and the band still got its TINT, because that half was written
  // on the row at (0,2,3). The fix put the text treatment on the row selector too. This test pins
  // the OUTCOME, so a future move back onto a cell class fails here rather than silently.
  await t.test('a BAND heading is small caps, and wins over the row-heading reset', () => {
    const band = block('.moneyGrid tbody tr.moneyGridBand th');
    assert.ok(
      /text-transform\s*:\s*uppercase/.test(band),
      'The band heading (Revenue / Expenses) lost its small caps. It names the half of a statement '
      + 'the rows below it belong to, and it is the one row kind that IS an eyebrow.',
    );
    assert.ok(
      /font-size\s*:/.test(band) && /color\s*:/.test(band),
      'The band heading no longer sets its own size and colour on the ROW selector. Moving them to '
      + 'a leading-cell class puts them at (0,1,0), where `.moneyGrid tbody th` at (0,1,1) silently '
      + 'outranks every one of them — the exact defect this assertion was added for.',
    );
  });
});
