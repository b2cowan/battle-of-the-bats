import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET_ITEM_REFERENCES, NO_BUDGET_ITEM_USAGE, describeBudgetItemUsage, sumBudgetItemUsage,
  type BudgetItemUsage,
} from '../../lib/coach-budget-item-usage.ts';
import { itemOfferedToClub, itemVisibleToTeam } from '../../lib/coach-budget-item-tiers.ts';

/**
 * THE SENTENCE THE FOLD IS JUDGED ON.
 *
 * "6 records move onto Grants — 2 budget lines, 3 recorded costs and 1 money in" is the whole of
 * what a coach reads before the only button in the product that removes a word with history behind
 * it. Everything below is about that sentence being true and reading the same way wherever it
 * appears — the confirmation, the delete tooltip and the refusal all build on these two functions.
 */
const usage = (byKind: Array<[string, number]>): BudgetItemUsage => ({
  total:  byKind.reduce((n, [, c]) => n + c, 0),
  byKind: byKind.map(([label, count]) => ({ label, count })),
});

const LINES = BUDGET_ITEM_REFERENCES[0].label;
const COSTS = BUDGET_ITEM_REFERENCES[1].label;
const IN    = BUDGET_ITEM_REFERENCES[2].label;

describe('describeBudgetItemUsage — one wording for the four kinds', () => {
  test('nothing at all', () => {
    assert.equal(describeBudgetItemUsage(NO_BUDGET_ITEM_USAGE), 'nothing');
  });

  test('one kind has no comma and no "and"', () => {
    assert.equal(describeBudgetItemUsage(usage([[LINES, 2]])), `2 ${LINES}`);
  });

  test('two kinds join with "and", never a comma', () => {
    assert.equal(describeBudgetItemUsage(usage([[LINES, 2], [COSTS, 6]])), `2 ${LINES} and 6 ${COSTS}`);
  });

  test('three kinds put the "and" only before the last', () => {
    assert.equal(
      describeBudgetItemUsage(usage([[LINES, 2], [COSTS, 3], [IN, 1]])),
      `2 ${LINES}, 3 ${COSTS} and 1 ${IN}`,
    );
  });
});

describe('sumBudgetItemUsage — the fold confirms about a SELECTION, not a word', () => {
  test('adds the same kind across words', () => {
    const merged = sumBudgetItemUsage([usage([[LINES, 2]]), usage([[LINES, 3]])]);
    assert.equal(merged.total, 5);
    assert.deepEqual(merged.byKind, [{ label: LINES, count: 5 }]);
  });

  test('keeps BUDGET_ITEM_REFERENCES order however the words were ticked', () => {
    /* ⚠ THE COACH TICKS IN THEIR OWN ORDER. If the phrase followed that, the same fold would read
       "1 money in and 2 budget lines" one time and "2 budget lines and 1 money in" the next — and
       the refusal on the very same words would disagree with both. */
    const merged = sumBudgetItemUsage([usage([[IN, 1]]), usage([[LINES, 2]]), usage([[COSTS, 3]])]);
    assert.deepEqual(merged.byKind.map(k => k.label), [LINES, COSTS, IN]);
    assert.equal(describeBudgetItemUsage(merged), `2 ${LINES}, 3 ${COSTS} and 1 ${IN}`);
  });

  test('a word with nothing filed against it contributes nothing and is not named', () => {
    const merged = sumBudgetItemUsage([usage([[LINES, 1]]), NO_BUDGET_ITEM_USAGE]);
    assert.deepEqual(merged.byKind, [{ label: LINES, count: 1 }]);
  });

  test('a word whose counts have not arrived yet is skipped, not counted as zero-of-everything', () => {
    /* The manage screen fetches usage separately from the word list, so a coach can tick a box in
       the gap. Undefined must read as "nothing known", never crash the confirmation. */
    const merged = sumBudgetItemUsage([undefined, usage([[COSTS, 4]]), undefined]);
    assert.equal(merged.total, 4);
  });

  test('nothing selected is nothing filed — the sentence a fold of unused words rests on', () => {
    const merged = sumBudgetItemUsage([]);
    assert.equal(merged.total, 0);
    assert.equal(describeBudgetItemUsage(merged), 'nothing');
  });
});

describe('the reference list carries what the fold has to move', () => {
  test('every reference names a category column beside its item column', () => {
    /* ⚠⚠ THE CATEGORY IS STORED BESIDE THE ITEM ON ALL FOUR TABLES and Budget vs. Actual PREFERS it
       over the item's own. A reference that named only the item column would let a cross-category
       fold leave those records filed under the heading the folded word used to live under — every
       dollar present, none of it lining up with the plan. The schema-backed half of this check is in
       budget-item-references-guard.test.ts; this is the half that says the field may never be blank. */
    const bare = BUDGET_ITEM_REFERENCES.filter(r => !r.categoryColumn).map(r => r.table);
    assert.deepEqual(bare, []);
  });

  test('the coach-facing labels are distinct — the phrase would collapse two kinds otherwise', () => {
    const labels = BUDGET_ITEM_REFERENCES.map(r => r.label);
    assert.equal(new Set(labels).size, labels.length,
      'Two references share a label, so sumBudgetItemUsage would merge them into one count and the '
      + 'confirmation would under-report where a coach\'s records actually live.');
  });
});

/**
 * WHICH WORDS A CLUB MAY FILE ITS OWN BUDGET AGAINST.
 *
 * ⚠⚠ THIS RULE HAD NO ENFORCEMENT AT ALL UNTIL 2026-08-17 (`/review`, security lens). The club's
 * taxonomy endpoint dropped team-owned rows, so the planner only ever OFFERED standard and club
 * words — but the save behind it stored whatever `itemId` arrived, unchecked. A club could therefore
 * file its budget against any word in the database, including another club's team-private one, and
 * the cost surfaced somewhere else: that row counts as usage, so the owning team's coach is refused
 * when they try to remove their own unused word, naming records they cannot see or reach.
 *
 * ⚠ TESTED HERE RATHER THAN THROUGH THE ROUTES because the club budget-plan routes require the
 * accounting module, and the UAT fixture org is on a plan without it —
 * `scripts/check-budget-item-fold.mjs` says so out loud rather than skipping quietly. The predicate
 * is the thing both the list and the save now read, so it is the thing worth pinning.
 */
describe('itemOfferedToClub — a club plan uses shared words, never a team’s', () => {
  const OURS = 'org-a';
  const THEIRS = 'org-b';

  test('a standard word belongs to everybody', () => {
    assert.equal(itemOfferedToClub({ org_id: null, team_id: null }, OURS), true);
  });

  test('the club’s own shared word is offered', () => {
    assert.equal(itemOfferedToClub({ org_id: OURS, team_id: null }, OURS), true);
  });

  test('⚠ a word one of OUR OWN teams invented is REFUSED', () => {
    /* The club cannot see, rename or remove it, and the owning team can — so a club plan filed
       against it names a word the club does not control. */
    assert.equal(itemOfferedToClub({ org_id: OURS, team_id: 'team-1' }, OURS), false);
  });

  test('⚠⚠ another club’s word is REFUSED, at every tier', () => {
    assert.equal(itemOfferedToClub({ org_id: THEIRS, team_id: null }, OURS), false);
    assert.equal(itemOfferedToClub({ org_id: THEIRS, team_id: 'team-9' }, OURS), false);
  });

  test('it is strictly narrower than the team rule it sits beside', () => {
    /* ⚠ THE PAIR IS THE POINT. A team may pick its own words; a club may not pick any team's. If
       these two ever agreed on a team-owned word, the club tier would have absorbed the team tier —
       the exact direction the owner ruling forbids ("clubs never absorb teams"). */
    const teamWord = { org_id: OURS, team_id: 'team-1' };
    assert.equal(itemVisibleToTeam(teamWord, OURS, 'team-1'), true);
    assert.equal(itemOfferedToClub(teamWord, OURS), false);
  });
});
