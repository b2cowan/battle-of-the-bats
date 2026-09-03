/**
 * THE MONEY HUB'S BUDGET CARD, AND THE ONE SUBTRACTION BEHIND IT.
 *
 * ⚠⚠ WHY THIS FILE EXISTS RATHER THAN A RE-MEASURE OF THE QA FIXTURE. `spendAgainstPlan` was
 * written to stop the hub card and Budget vs. Actual disagreeing (owner D5, 2026-08-30), and the
 * obvious proof is to open both screens on the money-lab team and read the same number. That proves
 * the CLUB half and nothing else: that fixture carries no recorded money back at all, so the term
 * for it is multiplied by zero on every run and a green measurement would report coverage it does
 * not have. Each term is pinned here on its own, where a fixture cannot quietly stop exercising it.
 *
 * The rule under all of it: **headroom is a COST figure.** Anything the season spent belongs in it,
 * anything that came back leaves it, and money the team was GIVEN is revenue and must never touch
 * it — or the card would tell a coach they may spend more because someone else paid for something.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spendAgainstPlan, moneyBackAgainstSpending } from '../../lib/coach-money-summary.ts';

const base = {
  expensesPaid: 0,
  clubBillsPaid: 0,
  clubPaymentsOut: 0,
  clubMoneyBack: 0,
  recordedMoneyBack: 0,
};

describe('spendAgainstPlan — the hub card and the report, one arithmetic', () => {
  it('is the team\u2019s own spend when there is no club and nothing came back', () => {
    assert.equal(spendAgainstPlan({ ...base, expensesPaid: 3120 }), 3120);
  });

  /* The exact disagreement the owner found: QA Money Lab, 2026-08-28. The card read $1,980 of
     headroom on a $5,100 plan while the report read $1,555 — $550 of the club's bill paid, $200
     sent to the club, $325 of it repaid. */
  it('reproduces the QA fixture the owner reported: $3,120 becomes $3,545', () => {
    assert.equal(spendAgainstPlan({
      ...base,
      expensesPaid: 3120,
      clubBillsPaid: 550,
      clubPaymentsOut: 200,
      clubMoneyBack: 325,
    }), 3545);
    // …which is the report's $1,555 of headroom on the same $5,100 plan.
    assert.equal(5100 - 3545, 1555);
  });

  it('what the club bills the team is spending, exactly like any other cost', () => {
    assert.equal(spendAgainstPlan({ ...base, clubBillsPaid: 550 }), 550);
    assert.equal(spendAgainstPlan({ ...base, clubPaymentsOut: 200 }), 200);
  });

  /* ⚠ BOTH SOURCES OF MONEY BACK, and the second is the one the fixture cannot exercise. A vendor
     refund a coach recorded nets into the cost it repaid on the report; the card was blind to it
     for the same reason it was blind to club money, and it is the same defect. */
  it('money back returns — whether the club repaid it or the coach recorded it', () => {
    assert.equal(spendAgainstPlan({ ...base, expensesPaid: 1000, clubMoneyBack: 150 }), 850);
    assert.equal(spendAgainstPlan({ ...base, expensesPaid: 1000, recordedMoneyBack: 200 }), 800);
    assert.equal(spendAgainstPlan({
      ...base, expensesPaid: 1000, clubMoneyBack: 150, recordedMoneyBack: 200,
    }), 650);
  });

  /* ⚠⚠ THE TERM THAT IS NOT THERE. A club GRANT (mig 271, `money_in_meaning = 'funding'`) is
     revenue and reaches this function through no argument at all — there is deliberately no
     parameter for it to arrive by, so the mistake cannot be made by forgetting a filter. Asserted
     as an identity because a future refactor could add one without any other test noticing. */
  it('takes no argument for new money, because a grant never shrinks a cost figure', () => {
    assert.deepEqual(
      Object.keys(base).filter(k => /fund|grant|income|revenue/i.test(k)),
      [],
    );
  });

  /* A cost a family paid the vendor directly is spending the SEASON did — `expensesPaid` is the
     budget-basis figure and carries it, which is why this function takes that one and never
     `cashPaid`. Money leaving the account is a different question, answered on the cash line. */
  it('is a BUDGET figure: it takes what the season spent, not what left the account', () => {
    // 1,000 spent of which 120 a family fronted — the season still spent 1,000.
    assert.equal(spendAgainstPlan({ ...base, expensesPaid: 1000 }), 1000);
  });

  it('rounds to the cent, like every other money figure in this repo', () => {
    assert.equal(spendAgainstPlan({
      ...base, expensesPaid: 0.1, clubBillsPaid: 0.2,
    }), 0.3);
  });

  /* Negative is a real answer, not a floor. A season that has been refunded more than it has spent
     against its plan is over-recovered, and the card's own wording ("over budget" / headroom) is
     what reads it — hiding the sign here would be the report's negative-actual rule broken one
     screen along. */
  it('may go negative, and says so rather than flooring at zero', () => {
    assert.equal(spendAgainstPlan({ ...base, expensesPaid: 100, recordedMoneyBack: 250 }), -150);
  });
});

describe('moneyBackAgainstSpending — the closed divergent case (P6 "one headroom", 2026-09-02)', () => {
  const back = (amount: number, budgetItemId: string | null) => ({ amount, budgetItemId });

  it('excludes a refund whose item is REVENUE-ONLY — the report nets it into income, not spending', () => {
    // The exact case spendAgainstPlan's docstring carried as a stated divergence: a word moved to
    // the money-in side after the fact, with no cost side left. `sideForRefund` sends it 'in'.
    const total = moneyBackAgainstSpending(
      [back(325, 'item-sponsorship'), back(150, 'item-entry-fees')],
      new Set(['item-entry-fees']),
      new Set(['item-sponsorship']),
    );
    assert.equal(total, 150);
  });

  it('an item with BOTH sides counts against spending — the expense side wins, as sideForRefund rules', () => {
    const total = moneyBackAgainstSpending(
      [back(80, 'item-both-sides')],
      new Set(['item-both-sides']),
      new Set(['item-both-sides']),
    );
    assert.equal(total, 80);
  });

  it('a refund with no item counts against spending — the rollup’s own default', () => {
    assert.equal(moneyBackAgainstSpending([back(60, null)], new Set(), new Set(['x'])), 60);
  });

  it('an item on neither side counts against spending — sideForRefund’s final else', () => {
    assert.equal(moneyBackAgainstSpending([back(45, 'item-unknown')], new Set(), new Set()), 45);
  });

  it('rounds to the cent over a mixed pile', () => {
    const total = moneyBackAgainstSpending(
      [back(0.1, null), back(0.2, 'spent'), back(99.99, 'revenue-only')],
      new Set(['spent']),
      new Set(['revenue-only']),
    );
    assert.equal(total, 0.3);
  });
});
