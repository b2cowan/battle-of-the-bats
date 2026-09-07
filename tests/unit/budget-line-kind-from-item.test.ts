/**
 * A BUDGET LINE'S KIND COMES FROM THE WORD IT IS FILED AGAINST — and the pairing that used to be
 * offerable is now unexpressible.
 *
 * WHY THIS EXISTS, PRECISELY. Adding a budget line asked TWO questions: "This line is: Expense /
 * Expected fundraising / Expected sponsorship / Expected other income", and then "Category & Item".
 * The item picker filters by DIRECTION and never by the kind just chosen, so *Expected sponsorship*
 * with *Tournaments → Concession revenue* was offerable — and that is a trap rather than
 * untidiness. The kind decides where the row's ACTUAL comes from: a sponsorship line takes its
 * actual from sponsor arrivals and CLOSES the row to a typed income record, deliberately, so the
 * same dollar is never counted twice (lib/coach-money-derived.ts). A coach who made that pairing got
 * a budget line they could never record their concession takings against, and nothing on screen
 * said why.
 *
 * Migration 280 moves where the answer is DECLARED — from a question the coach answers to a
 * property of the word they pick — and this file states the consequence as arithmetic:
 *
 *   1. the kind and the item can no longer disagree about where the actual comes from (§1);
 *   2. the mapping is a BIJECTION with `LINE_KIND_ACTUAL_SOURCE`, so the two directions of one fact
 *      cannot drift apart (§2);
 *   3. a word a coach invents is TYPED, which keeps its rows open to the only way their money can
 *      be recorded (§3);
 *   4. every budget line that exists on either database derives to exactly the kind it already
 *      stores, so no figure moves (§4).
 *
 * ⚠ THE STORED ENUM IS UNTOUCHED, deliberately. It is read by the plan list, the summary ladder,
 * the period grid, both report shapes, the exports and a whole-source-tree guard. Removing the
 * QUESTION is a form change; removing the CONCEPT is a migration across six readers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  budgetLineKindForItem, MONEY_IN_KIND_BY_ACTUAL_SOURCE, LINE_KIND_ACTUAL_SOURCE,
  FUNDING_LINE_KINDS, DERIVED_INCOME_LINE_KINDS, BUDGET_LINE_KINDS, computeBudgetTotals,
  type BudgetItemActualSource, type BudgetLineKind,
} from '../../lib/coach-budget-totals.ts';

/** Every source a word can declare — the three the database CHECK allows (mig 280). */
const SOURCES: BudgetItemActualSource[] = ['typed', 'fundraiser', 'sponsor'];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * §1 — THE PAIRING THAT BROKE A ROW CANNOT BE MADE
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the kind and the item can never disagree about where the actual comes from', () => {
  it('agrees with the item on EVERY word the library can hold', () => {
    for (const actualSource of SOURCES) {
      const kind = budgetLineKindForItem({ direction: 'in', actualSource });
      assert.equal(
        LINE_KIND_ACTUAL_SOURCE[kind], actualSource,
        `a money-in word sourced from "${actualSource}" derived the kind "${kind}", whose actual is `
        + `taken from "${LINE_KIND_ACTUAL_SOURCE[kind]}". That is the exact contradiction migration `
        + '280 exists to make impossible: the row would look for its money in the wrong place, '
        + 'forever, and nothing on screen would say so.',
      );
    }
  });

  it('cannot produce the concession-revenue-as-sponsorship line the old form allowed', () => {
    // Tournaments → Concession revenue: money in, and nobody reports it but the coach.
    const concession = { direction: 'in', actualSource: 'typed' } as const;
    const kind = budgetLineKindForItem(concession);

    assert.notEqual(
      kind, 'sponsorship',
      'the pairing the old two-question form offered is back: a concession line filed as '
      + 'sponsorship takes its actual from sponsor cheques, which will never contain concession '
      + 'money, and REFUSES the figure the coach types.',
    );
    assert.ok(
      !DERIVED_INCOME_LINE_KINDS.includes(kind),
      `a concession line derived "${kind}", which is on the DERIVED list — so the coach would be `
      + 'refused when they tried to record what actually came in. It must stay on the typed path.',
    );
    assert.equal(kind, 'other_income');
  });

  it('makes a money-OUT word a cost whatever its source says', () => {
    // The database refuses a money-out word that is not typed (budget_items_out_is_typed_check),
    // but the derivation must not DEPEND on that: a constraint is a belt, not the trousers. A
    // spending line is a cost, full stop.
    for (const actualSource of SOURCES) {
      assert.equal(
        budgetLineKindForItem({ direction: 'out', actualSource }), 'cost',
        `a money-out word sourced from "${actualSource}" must still be a COST. Anything else lands `
        + 'a spending line in the money-IN bucket, where it SUBTRACTS from what the season costs '
        + 'instead of adding to it — so every family is under-billed by twice its amount.',
      );
    }
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * §2 — ONE FACT, TWO DIRECTIONS, PINNED IN STEP
 *
 * `LINE_KIND_ACTUAL_SOURCE` says where a KIND's actual comes from; `MONEY_IN_KIND_BY_ACTUAL_SOURCE`
 * says which kind a SOURCE produces. They are the same fact read two ways, they live three lines
 * apart, and nothing in the compiler makes one follow the other. A fifth money-in kind, or a fourth
 * source, is exactly the event that separates them — and §1 above would still pass while the map
 * quietly lost a kind, because it only ever asks about sources that ARE mapped.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the source map is the exact inverse of the kind map', () => {
  it('gives every money-in kind back from its own declared source', () => {
    for (const kind of FUNDING_LINE_KINDS) {
      assert.equal(
        MONEY_IN_KIND_BY_ACTUAL_SOURCE[LINE_KIND_ACTUAL_SOURCE[kind]], kind,
        `"${kind}" declares its actual comes from "${LINE_KIND_ACTUAL_SOURCE[kind]}", but that `
        + 'source maps back to a DIFFERENT kind. A budget line filed against such a word would be '
        + 'stored as one thing and read as another.',
      );
    }
  });

  it('has exactly one kind per source — no money-in kind is unreachable', () => {
    const claimed = FUNDING_LINE_KINDS.map(k => LINE_KIND_ACTUAL_SOURCE[k]);
    assert.equal(
      new Set(claimed).size, claimed.length,
      'two money-in kinds declare the same actual source, so one of them can no longer be reached '
      + 'from any word — the form would silently store the other in its place. Adding a kind on the '
      + 'typed path (beside other_income) is how this happens; it needs its own source, or its own '
      + 'answer in MONEY_IN_KIND_BY_ACTUAL_SOURCE.',
    );
    assert.deepEqual(
      [...new Set(Object.values(MONEY_IN_KIND_BY_ACTUAL_SOURCE))].sort(),
      [...FUNDING_LINE_KINDS].sort(),
      'every money-in kind must be produced by some source, and no source may produce a cost',
    );
  });

  it('covers every source the database CHECK allows', () => {
    assert.deepEqual(
      Object.keys(MONEY_IN_KIND_BY_ACTUAL_SOURCE).sort(), [...SOURCES].sort(),
      'budget_items.actual_source accepts a value the derivation has never heard of — a line filed '
      + 'against such a word would be stored `undefined` and refused by the column CHECK.',
    );
    // The four kinds the column accepts are unchanged by mig 280: the QUESTION went, the enum stayed.
    assert.deepEqual(BUDGET_LINE_KINDS, ['cost', 'funding', 'sponsorship', 'other_income']);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * §3 — A WORD A COACH INVENTS IS THEIRS TO RECORD AGAINST
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("a coach-created word defaults to 'the coach types it'", () => {
  it('produces a kind whose actuals the coach records themselves', () => {
    // The database default for every club- and coach-created row (mig 280). There is no machinery
    // behind a name somebody just invented, and defaulting it to a derived source would CLOSE its
    // rows to typed income — the §1 failure reached from the other side.
    const invented = budgetLineKindForItem({ direction: 'in', actualSource: 'typed' });
    assert.equal(LINE_KIND_ACTUAL_SOURCE[invented], 'typed');
    assert.ok(
      !DERIVED_INCOME_LINE_KINDS.includes(invented),
      'a word a coach invented derived a kind on the DERIVED list, so the money form would refuse '
      + 'the only figure that can ever reach that row.',
    );
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * §4 — NO FIGURE MOVES
 *
 * The five pairings below are not invented: they are every money-in budget line that exists, read
 * off dev AND production on 2026-09-07, with the platform library's sources as migration 280 sets
 * them. Each derives to exactly the kind it already stores, so every total on the plan, the ladder,
 * the month grid and both report shapes is identical before and after — asserted, not eyeballed.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const LIVE_LINES: Array<{
  where: string; item: string; stored: BudgetLineKind;
  direction: 'in' | 'out'; actualSource: BudgetItemActualSource; amount: number;
}> = [
  { where: 'riverdale-ridge (dev + prod)', item: 'Fundraising → Fundraising drive', stored: 'funding',      direction: 'in', actualSource: 'fundraiser', amount: 2400 },
  { where: 'uat-test-org',                 item: 'Fundraising → Fundraising drive', stored: 'funding',      direction: 'in', actualSource: 'fundraiser', amount: 1800 },
  { where: 'qa-money-lab',                 item: 'Fundraising → Fundraising drive', stored: 'funding',      direction: 'in', actualSource: 'fundraiser', amount: 1000 },
  { where: 'qa-money-lab',                 item: 'Sponsorship → Team sponsorship',  stored: 'sponsorship',  direction: 'in', actualSource: 'sponsor',    amount: 2000 },
  { where: 'uat-test-org',                 item: 'Other Income → Interest',         stored: 'other_income', direction: 'in', actualSource: 'typed',      amount: 120 },
  { where: 'every cost line, both DBs',    item: 'any money-out word',              stored: 'cost',         direction: 'out', actualSource: 'typed',     amount: 8000 },
];

describe('every budget line that exists derives the kind it already stores', () => {
  for (const line of LIVE_LINES) {
    it(`${line.item} — ${line.where}`, () => {
      assert.equal(
        budgetLineKindForItem({ direction: line.direction, actualSource: line.actualSource }),
        line.stored,
        `this line is stored as "${line.stored}" and would now be derived differently — which means `
        + 're-saving it silently re-files it, and the plan, the ladder, the grid and both reports '
        + 'move money between sections.',
      );
    });
  }

  it('adds up to exactly the same season, line for line', () => {
    const stored  = LIVE_LINES.map(l => ({ totalAmount: l.amount, lineKind: l.stored }));
    const derived = LIVE_LINES.map(l => ({
      totalAmount: l.amount,
      lineKind: budgetLineKindForItem({ direction: l.direction, actualSource: l.actualSource }),
    }));
    assert.deepEqual(
      computeBudgetTotals({ lines: derived, estimatedTotal: null, rosterCount: 10 }),
      computeBudgetTotals({ lines: stored,  estimatedTotal: null, rosterCount: 10 }),
      'the change is about a QUESTION, not an amount — every figure the ladder quotes, and the '
      + 'per-player dues generated from them, must be identical.',
    );
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * §5 — NEITHER WRITE DOOR ACCEPTS A KIND
 *
 * The rules above are about the derivation. This is about the only two places a kind can be
 * STORED: if either route ever reads one off the request again, the impossible pairing is
 * expressible again — from a stale tab, a replayed request, or a second client — and every
 * assertion above stays green while it happens.
 *
 * ⚠ THE EDIT DOOR IS THE ONE THAT MATTERS. It was the create route that got hardened during the
 * Chunk G review while its PATCH sibling was not, twice (the category, then the item), and both
 * times the gap was "the door nobody thought of as a write path". Stated over both.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const LINE_WRITE_ROUTES = [
  'app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/route.ts',
  'app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/lines/[lineId]/route.ts',
];

/** The three shapes the two routes actually used, before mig 280 retired them. */
const RETIRED_BODY_READS = [
  `const lineKind: string = body.lineKind === undefined ? 'cost' : String(body.lineKind);`,
  `if ('lineKind' in body) { updates.line_kind = body.lineKind; }`,
  `const kind = body['lineKind'];`,
];
const BODY_KIND_READ = /body\s*\.\s*lineKind|['"`]lineKind['"`]\s*in\s+body|body\[\s*['"`]lineKind['"`]\s*\]/;

describe('a budget line kind is never taken from the request', () => {
  it('proves it can still see the offence (the guard is not looking at nothing)', () => {
    for (const sample of RETIRED_BODY_READS) {
      assert.ok(
        BODY_KIND_READ.test(sample),
        `this guard no longer recognises the shape it exists to catch: ${sample}`,
      );
    }
    // …and does not fire on the derivation, or on the word "lineKind" appearing in a payload the
    // route SENDS. Flagging those would push the next author into working around the guard.
    for (const ok of [
      `line_kind: budgetLineKindForItem(linked.item!),`,
      `updates.line_kind = budgetLineKindForItem(resolved.item);`,
    ]) {
      assert.ok(!BODY_KIND_READ.test(ok), `this guard flags a correct line: ${ok}`);
    }
  });

  for (const route of LINE_WRITE_ROUTES) {
    it(`${route} derives it from the item`, () => {
      /* ⚠ COMMENTS ARE STRIPPED AS BLOCKS, NOT LINE BY LINE. Both routes explain the retired shape
         in order to warn about it, and the warning must not be the offence — but they write it as
         an indented block comment whose continuation lines do NOT start with an asterisk, which is
         this repo's dominant comment style inside a route. A line-prefix filter (the shape the
         sibling kind guard uses) walks straight past those and fails on the documentation. */
      const source = readFileSync(join(process.cwd(), route), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      assert.ok(
        source.includes('budgetLineKindForItem('),
        `${route} writes a budget line without deriving its kind from the item.`,
      );
      assert.ok(
        !BODY_KIND_READ.test(source),
        `${route} reads a line kind off the request body again. That is the second question the `
        + 'form no longer asks, and accepting it re-opens the pairing migration 280 closed: a '
        + 'sponsorship kind on a concession item stores a row whose actual is sought in sponsor '
        + 'cheques and which refuses the figure the coach types. Derive it from the resolved item.',
      );
    });
  }
});
