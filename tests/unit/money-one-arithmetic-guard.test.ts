/**
 * **MONEY ARITHMETIC HAS ONE HOME PER QUESTION.** This file is the teeth on that rule for the one
 * place it kept regrowing: Budget vs. Actual.
 *
 * WHY THIS EXISTS, PRECISELY. That report answered "what did we actually spend?" THREE times, from
 * three independent walks of the same records — the statement (via `rollupMoneyReport`), the Months
 * grid, and the cumulative chart rendered directly above the statement. Nothing connected them, so
 * adding a kind of money meant finding all three from memory. Getting two of three produced no
 * error, no failing test, and a screen that simply read low. By the time it was consolidated
 * (2026-08-17) **two of the three already disagreed, both predating any club money**:
 *
 *   · the chart never netted MONEY BACK — a $500 hire with $200 refunded read $500 there and $300
 *     six inches below;
 *   · a commitment paid in two instalments was handed over as ONE payment dated by the earlier half,
 *     so a July balance was charted in May — and reported in May by the statement's own expand-a-row
 *     payment schedule too. The Months grid was right, alone, because it walked the stamps itself;
 *   · club money reached the statement and the grid and was silently absent from the chart. That
 *     third instance is what stopped the patching and started the refactor.
 *
 * The three arithmetics the platform HAS, and which are meant to be one:
 *   · **cash on hand** — `cashOnHandCents` in `lib/coach-register.ts`. Already one: the register and
 *     `money-summary` both call it, so a source added to one and not the other is a missing
 *     argument, not a silent drift.
 *   · **the season close-out pot** — `lib/coach-season-settlement.ts`. ⛔ **Deliberately separate and
 *     staying that way.** A pure, dependency-free module that runs under plain `node --test`; its
 *     isolation is why it is the best-tested money module in the repo. Naming it here is so a reader
 *     knows it was considered, not so somebody folds it in.
 *   · **the report** — `lib/coach-budget-rollup.ts`, and now only there. This file guards that.
 *
 * TWO RULES, catching different failures — neither subsumes the other:
 *   1. **the paid stamps have ONE reader.** `deposit_paid_at` / `balance_paid_at` /
 *      `expense_paid_at` may only be turned into money by `paidMovements`
 *      (`lib/coach-expense-movements.ts`). A second walk of them is literally the defect above.
 *   2. **category identity is not derived privately.** The Months grid must key categories with the
 *      rollup's own `categoryKey`, or the two views of one report bucket it two different ways —
 *      which shipped, and put a cost and the refund netting against it under two different headings.
 *
 * ⚠⚠ WHAT NONE OF THIS PROVES, STATED PLAINLY BECAUSE A SAFEGUARD THAT OVERSTATES ITSELF IS THE
 * DISEASE. Three things guard this report and they guard three different layers:
 *   · **this file** — the source-level rules above: one reader, no private identity.
 *   · **`tests/unit/coach-expense-movements.test.ts`** — the ROOT: that a movement carries the right
 *     amount on the right day. ⚠ It exists because consolidating the report onto one arithmetic made
 *     the identity check below **blind to a mistake in that root**: the three feeds are now three
 *     readings of one list, so a mis-dated movement makes them agree on the wrong answer.
 *   · **`npm run check:money-report`** — the PLUMBING, against a real season: that a kind of money
 *     reaching the statement also reaches the grid and the chart. It needs a database and a rendered
 *     payload, and it refuses to pass over a fixture too thin to disagree.
 * Remove any one of the three and a whole class of defect stops being visible.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMonthGrid, type GridLine, type CategoryEvent } from '../../lib/coach-budget-months.ts';
import { categoryKey, NO_CATEGORY_LABEL } from '../../lib/coach-budget-rollup.ts';

const ROOT = process.cwd();
const ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts';

/**
 * What the route may not turn into money for itself.
 *
 * The three legacy paid stamps, which used to be the answer to "what has this paid?" and are still
 * present on the table — and, since the Payables Rebuild (P1, mig 255), **the two tables that
 * replaced them**. That second half is the load-bearing addition: the rule "the paid stamps have one
 * reader" would otherwise have been satisfied trivially the moment the columns stopped being read,
 * while a fresh private walk of `rep_payable_payments` reintroduced the identical defect under a new
 * name. What the rule has always meant is **the report does not decide for itself what a commitment
 * has paid** — `getCommitmentStandings` decides, `paidMovements` dates it, and this route reads the
 * answer.
 */
const PAID_STAMPS = [
  'expense_paid_at', 'deposit_paid_at', 'balance_paid_at',
  'rep_payable_payments', 'rep_payable_installments',
];

/**
 * Comments stripped, because this guard is about CODE. Half the reason the rule is discoverable at
 * all is that the route explains itself at length, and a guard that counted prose would punish that.
 *
 * Block comments go wholesale; line comments only when the line is nothing but a comment, so a `//`
 * living inside a string literal is never mistaken for one.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

/**
 * Uses of a paid stamp INSIDE THE ROUTE that are not a second walk of it.
 *
 * ⚠ A pattern here is a decision, not a formality. Each one must be a use that CANNOT produce a money
 * figure — if it can, it belongs in `lib/coach-expense-movements.ts` instead.
 *
 * ⚠ ANCHORED TO THE START OF THE LINE (`/review`, 2026-08-17). The select exemption used to be a bare
 * `/\.select\(/`, which exempted **any** line containing that substring anywhere — so a future
 * one-liner that both selected columns and did arithmetic on a stamp would have walked straight
 * through the guard. This repo already writes long single-line selects, so that was not far-fetched.
 */
const ALLOWED_STAMP_USES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^\.select\(/,
    reason: 'the query that FETCHES the columns, and nothing else on the line. Naming them in a '
      + 'select produces no arithmetic.',
  },
];

/*
 * ⚠⚠ THE EXEMPTION THAT RETIRED, RECORDED RATHER THAN QUIETLY DELETED (Payables Rebuild P1).
 * `paid: !!exp.deposit_paid_at` used to be allowed here — the Scheduled drill-in's "settled or still
 * owed" flag, which read whether a stamp EXISTED and never its date or amount, so it could not place
 * money in a month. It is gone because the flag now comes off the standing (`inst.state ===
 * 'settled'`), which is also a stricter answer: R4 means part-paid reads as unpaid, and the boolean
 * it replaced could not tell the difference. There is nothing left in the route to exempt, and an
 * empty list is the strongest form this rule has ever taken.
 */

describe('one arithmetic — the paid stamps have exactly one reader', () => {
  const src = codeOnly(readFileSync(join(ROOT, ROUTE), 'utf8'));

  /* ⚠ THE RULE GOT SIMPLER AND STRONGER WHEN THE READER MOVED OUT (`/review`, 2026-08-17). While
     `paidMovements` lived in the route this had to excise its body by brace balance before scanning —
     machinery that silently read a TYPE as a body once already. The reader is now a module, so the
     claim is flat: **the route turns no paid stamp into money at all.** */
  it('the route decides nothing for itself about what a commitment has paid', () => {
    const offenders = src.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => PAID_STAMPS.some(s => line.includes(s)))
      .filter(({ line }) => !ALLOWED_STAMP_USES.some(a => a.pattern.test(line)));

    assert.deepStrictEqual(offenders, [],
      'The report is reading what a commitment has paid for itself:\n'
      + offenders.map(o => `  · line ${o.n}: ${o.line}`).join('\n')
      + '\n\n  "Where does this commitment stand" is `getCommitmentStandings` (lib/db.ts), and "what'
      + '\n  did it pay, and when" is `paidMovements` (lib/coach-expense-movements.ts), which emits ONE'
      + '\n  MOVEMENT PER PAYMENT and is unit-tested directly. A second walk here is how a $600 balance'
      + '\n  paid in July got reported in May by two of the three feeds on this screen. If your use'
      + '\n  genuinely cannot produce a money figure, add it to ALLOWED_STAMP_USES with the reason —'
      + '\n  that edit IS the decision.');
  });

  it('the route reads the movements module rather than re-deriving it', () => {
    assert.match(src, /from '@\/lib\/coach-expense-movements'/,
      'the route no longer imports the one reader — see this file\'s header');
    assert.match(src, /rollupSpend[\s\S]{0,600}paidMovements\(/,
      'the rollup is no longer fed from `paidMovements` — see this file\'s header');
  });

  it('the report is rolled up ONCE', () => {
    const calls = src.split('rollupMoneyReport(').length - 1;
    assert.strictEqual(calls, 1,
      `rollupMoneyReport is called ${calls} times in one route. Two grouping passes over one season`
      + ' is the shape this whole guard exists to prevent — read the payload you already have.');
  });
});

describe('one arithmetic — the Months grid does not derive category identity privately', () => {
  const event = (over: Partial<CategoryEvent>): CategoryEvent =>
    ({ categoryName: 'Facilities', date: '2026-05-10', amount: 100, ...over });
  const gridLine = (over: Partial<GridLine>): GridLine =>
    ({ id: 'l1', description: 'Permits', categoryName: 'Facilities', itemId: null, itemName: null,
      totalAmount: 100, periods: [{ date: '2026-05-01', amount: 100 }], ...over });

  /* ⚠⚠ THE SEAM THE FIRST DRAFT OF THIS FILE DID NOT COVER (`/simplify` altitude pass, 2026-08-17).
     The tests below only ever handed BOTH sides a name that had already been through the rollup, so
     they passed while `categoryKey(null, null)` and `categoryKey(null, NO_CATEGORY_LABEL)` were still
     two different identities for one fact — and the report only landed on the right one because a
     route helper remembered to pre-normalise. A guard that tests the happy path of a convention is
     testing the convention's obedience, not the rule. */
  it('a nameless category has ONE identity, however it is spelled', () => {
    assert.strictEqual(
      categoryKey(null, NO_CATEGORY_LABEL), categoryKey(null, null),
      'the label this module gives a nameless category keys differently from a genuinely absent one,'
      + ' so a feed that has been through the rollup and a raw one split into two rows');
    assert.strictEqual(categoryKey(null, '   '), categoryKey(null, null),
      'whitespace is not a category name');
    // ⚠ Any casing, or the label typed by hand as free text on an expense — all one bucket. An
    // exact-string test left "no category" as its own near-identical heading (`/review`, 2026-08-17).
    assert.strictEqual(categoryKey(null, 'no category'), categoryKey(null, null));
    assert.strictEqual(categoryKey(null, '  NO CATEGORY  '), categoryKey(null, null));
    // And an id still wins outright — normalising the nameless case must not blur real identity.
    assert.notStrictEqual(categoryKey('cat-1', NO_CATEGORY_LABEL), categoryKey(null, null));
  });

  it('every category it returns is keyed exactly as the statement keys it', () => {
    const shapes = [
      { categoryId: 'cat-1', categoryName: 'Facilities' },
      { categoryId: null,    categoryName: 'Typed By Hand' },
      { categoryId: null,    categoryName: NO_CATEGORY_LABEL },
    ];
    const g = buildMonthGrid({
      lines: shapes.map((s, i) => gridLine({ id: `l${i}`, ...s })),
      actuals: shapes.map(s => event(s)),
      scheduled: [],
      priorLines: [],
      todayMonth: '2026-05',
    });
    for (const s of shapes) {
      const want = categoryKey(s.categoryId, s.categoryName);
      assert.ok(g.categories.some(c => c.categoryKey === want),
        `no grid category keyed \`${want}\` for ${JSON.stringify(s)} — the grid has re-derived`
        + ' identity of its own. Two reports cannot line up on identity they each compute privately.');
    }
  });

  it('two categories sharing a NAME stay two rows, as they are on the statement', () => {
    // `budget_categories.name` carries no unique index, and an org's list is the platform defaults
    // ∪ its own customs — so one name with two ids is a shape the product cannot reject.
    const g = buildMonthGrid({
      lines: [
        gridLine({ id: 'a', categoryId: 'cat-default', categoryName: 'Equipment', totalAmount: 100 }),
        gridLine({ id: 'b', categoryId: 'cat-custom',  categoryName: 'Equipment', totalAmount: 250 }),
      ],
      actuals: [
        event({ categoryId: 'cat-default', categoryName: 'Equipment', amount: 90 }),
        event({ categoryId: 'cat-custom',  categoryName: 'Equipment', amount: 200 }),
      ],
      scheduled: [], priorLines: [], todayMonth: '2026-05',
    });
    const equipment = g.categories.filter(c => c.categoryName === 'Equipment');
    assert.strictEqual(equipment.length, 2, 'two ids with one name collapsed into one grid row');
    assert.deepStrictEqual(equipment.map(c => c.total.actual).sort((x, y) => x - y), [90, 200]);
  });

  it('spending with NO category lands on the row its own budget is on', () => {
    // The live defect: events arrived as `null` (bucket "Uncategorized") while the rows arrived from
    // the rollup as NO_CATEGORY_LABEL, so a cost and the refund netting against it never met.
    const g = buildMonthGrid({
      lines: [gridLine({ categoryId: null, categoryName: NO_CATEGORY_LABEL, totalAmount: 0, periods: [] })],
      actuals: [
        event({ categoryId: null, categoryName: NO_CATEGORY_LABEL, amount: 200 }),
        event({ categoryId: null, categoryName: NO_CATEGORY_LABEL, amount: -125 }),
      ],
      scheduled: [], priorLines: [], todayMonth: '2026-05',
    });
    const nameless = g.categories.filter(c => c.categoryName === NO_CATEGORY_LABEL);
    assert.strictEqual(nameless.length, 1, 'the nameless bucket split into more than one row');
    assert.strictEqual(nameless[0].total.actual, 75);
  });

  /* ⚠⚠ THE SHAPE THAT ACTUALLY BROKE, END TO END (`/review`, 2026-08-17). Every case above hands
     `buildMonthGrid` a name that has ALREADY been through the rollup — but the live defect was a RAW
     event arriving with `categoryName: null` while its own budget row arrived pre-labelled. Proving
     `categoryKey` normalises the pair in isolation is not the same claim: an early return or a default
     added to the grid's own wrapper would break the null path with every test above still green. */
  it('a RAW null-named event lands on the pre-labelled row from the rollup', () => {
    const g = buildMonthGrid({
      lines: [gridLine({ categoryId: null, categoryName: NO_CATEGORY_LABEL, totalAmount: 0, periods: [] })],
      actuals: [
        event({ categoryId: null, categoryName: null, amount: 200 }),          // raw, unnormalised
        event({ categoryId: null, categoryName: NO_CATEGORY_LABEL, amount: -125 }), // via the rollup
      ],
      scheduled: [event({ categoryId: null, categoryName: null, amount: 40 })],
      priorLines: [], todayMonth: '2026-05',
    });
    assert.strictEqual(g.categories.length, 1,
      'a raw null-named event split off into its own row — the exact shipped defect');
    assert.strictEqual(g.categories[0].total.actual, 75);
    assert.strictEqual(g.categories[0].total.scheduled, 40,
      'a raw null-named COMMITMENT missed the row its payments land on');
  });
});
