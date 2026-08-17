/**
 * What an expense actually PAID, and WHEN — one movement per amount that left the account.
 *
 * ⚠⚠ **A PAYABLE'S DEPOSIT AND BALANCE ARE TWO MOVEMENTS, NEVER ONE.** This is the rule the money
 * report's three feeds all now depend on, and until 2026-08-17 the report merged the two halves into
 * a single record dated by the EARLIER of them. That merged record is a fiction — no such payment was
 * ever made — and every feed that read dates off it put a July balance in May: the cumulative chart
 * and the statement's own expand-a-row payment schedule both did. The Months grid was right, alone,
 * because it walked the two stamps separately.
 *
 * ⚠⚠ WHY THIS IS A MODULE AND NOT A HELPER INSIDE THE ROUTE (`/review`, verification-integrity lens,
 * 2026-08-17 — a **Critical** finding, and the most valuable one of that review). It began life
 * inside `budget-vs-actual/route.ts`, which made it **untestable**, and that mattered far more than it
 * looked: consolidating the report onto one arithmetic also made the report's build-blocking identity
 * check (`scripts/check-money-report-arithmetic.mjs`) unable to see a bug in HERE. Before the
 * refactor the statement, the grid and the chart were three independent walks of the database, so a
 * disagreement between them was evidence. Afterwards they are three readings of ONE list — so if this
 * function dates a dollar wrongly, **all three agree on the wrong answer and the check goes green.**
 * A safeguard that got weaker as the refactor succeeded is exactly the failure this whole project
 * exists to remove, so the rule now lives where `tests/unit/coach-expense-movements.test.ts` can
 * assert it directly. The identity check guards the PLUMBING; that test guards the ROOT. Neither
 * replaces the other.
 *
 * ⚠ THE SIBLING THAT LOOKS LIKE A DUPLICATE AND IS NOT: `paidLedgerLegs` in `lib/expense-ledger.ts`
 * splits the same record into the same two halves and answers a **different question** — what posted
 * to the team's BOOKS. Three differences, all deliberate:
 *   · it **excludes an out-of-pocket cost** (a family's money moved, the team's did not, so there is
 *     no cash entry to reverse). This one **includes** it: it is real spending against the plan,
 *     whoever fronted it.
 *   · it carries **no dates**. Dates are the entire point of this one.
 *   · it falls back to the record's full `amount` when a half's own amount is null; this one treats a
 *     null or non-positive half as **nothing moved** (see `positiveAmount`).
 * A third encoding exists in `upcoming-payables/route.ts` for what is COMMITTED by DUE date. Three
 * questions, one structural fact, and the fact has no single owner — merging them means deciding
 * whose amount fallback is right inside money-WRITING code, which is an owner decision rather than a
 * cleanup. Logged in the Owner QA Ledger (§51 §F) rather than guessed at.
 *
 * Pure: no IO, no React, no Date, and no timezone library. See `paidDayOf` for why the date handling
 * is a naive slice and must stay one.
 */

/**
 * The columns this needs, named exactly as the database names them.
 *
 * ⚠ SNAKE_CASE ON PURPOSE. The report route selects a narrow set of columns and never maps them to
 * the `RepTeamExpense` domain type (it does not fetch the fields that type requires). Taking the raw
 * shape means there is no hand-written field mapping between the query and this rule — and a
 * mis-typed mapping is precisely the kind of silent, untypecheckable error that would survive
 * everything else in this file's defences.
 */
export interface PaidExpenseRow {
  id: string;
  description: string;
  expense_type?: string | null;
  amount?: number | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  expense_paid_at?: string | null;
  deposit_paid_at?: string | null;
  balance_paid_at?: string | null;
}

/** One amount that actually left the account, on the day it left. */
export interface PaidMovement {
  id: string;
  description: string;
  /** ALWAYS POSITIVE — see `positiveAmount`. */
  amount: number;
  /** `YYYY-MM-DD`, always present: a movement with no date is not a movement. */
  paidDate: string;
}

/**
 * The day an expense stamp fell on, in the COACH's calendar.
 *
 * ⚠⚠ A NAIVE SLICE, AND THAT IS CORRECT HERE — do not "fix" it to `orgDayKey()`
 * (COACH_MONEY_ONE_ARITHMETIC_PLAN.md §1b, which is a retraction of exactly that "fix"). Every
 * `*_paid_at` on `rep_team_expenses` is written at ORG NOON (`orgDayAsStoredInstant`) precisely so
 * this slice lands on the coach's own day — twelve hours from either midnight, which no timezone this
 * platform serves can cross. Club money carries click-time instants with no such anchoring, which is
 * exactly why the route reads THOSE with `orgDayKey()`. Two treatments of two differently-stored
 * columns, both right. Keeping it a slice is also what keeps this module pure.
 */
function paidDayOf(stamp: string): string {
  return stamp.slice(0, 10);
}

/**
 * A half's amount, or null when nothing moved.
 *
 * ⚠ NON-POSITIVE IS "NOTHING MOVED", and that is a convergence rather than a new rule (`/review`,
 * 2026-08-17). `deposit_amount + balance_amount == amount` is enforced by nothing — no CHECK, no app
 * validation (DATA_DICTIONARY, `rep_team_expenses` gotcha 2) — so a negative half IS storable. Before
 * this module the report's two readers disagreed about one: the Months grid required `> 0` and
 * dropped it, while the statement's `paidAmount()` summed it in, so one screen reported two totals for
 * the same row. They now share the grid's rule, which is also the safe one: `RollupSpend.amount` is
 * contractually always positive and the rollup's variance signs depend on that.
 */
function positiveAmount(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Every movement this record has actually paid, in the order the money moved.
 *
 * A `tournament_payable` yields up to two (its paid halves, each on its own day); anything else
 * yields at most one. An unpaid record, or a paid one with no positive amount, yields none — absent,
 * never zero, so nothing downstream has to filter.
 *
 * The ids and descriptions are what the Months grid's cell drill-in has always shown, so a coach
 * opening a cell and a coach expanding a statement row read the same two lines.
 */
export function paidMovements(exp: PaidExpenseRow): PaidMovement[] {
  if (exp.expense_type === 'tournament_payable') {
    const out: PaidMovement[] = [];
    const dep = positiveAmount(exp.deposit_amount);
    const bal = positiveAmount(exp.balance_amount);
    if (exp.deposit_paid_at && dep !== null) {
      out.push({
        id: `${exp.id}-deposit`,
        description: `${exp.description} — deposit`,
        amount: dep,
        paidDate: paidDayOf(exp.deposit_paid_at),
      });
    }
    if (exp.balance_paid_at && bal !== null) {
      out.push({
        id: `${exp.id}-balance`,
        description: `${exp.description} — balance`,
        amount: bal,
        paidDate: paidDayOf(exp.balance_paid_at),
      });
    }
    return out;
  }
  const amount = positiveAmount(exp.amount);
  if (exp.expense_paid_at && amount !== null) {
    return [{
      id: exp.id,
      description: exp.description,
      amount,
      paidDate: paidDayOf(exp.expense_paid_at),
    }];
  }
  return [];
}
