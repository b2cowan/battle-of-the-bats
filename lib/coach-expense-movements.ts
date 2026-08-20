/**
 * What a commitment actually PAID, and WHEN — one movement per amount that left the account.
 *
 * ⚠⚠ **A COMMITMENT'S PAYMENTS ARE SEPARATE MOVEMENTS, NEVER ONE.** This is the rule the money
 * report's three feeds all depend on, and until 2026-08-17 the report merged a payable's two halves
 * into a single record dated by the EARLIER of them. That merged record is a fiction — no such
 * payment was ever made — and every feed that read dates off it put a July balance in May: the
 * cumulative chart and the statement's own expand-a-row payment schedule both did.
 *
 * ⚠⚠ **REWRITTEN FOR THE PAYABLES REBUILD (P1, mig 255), AND THE RULE GOT STRONGER RATHER THAN
 * DIFFERENT.** It used to reconstruct movements from the deposit/balance paid stamps, which could
 * express exactly two payments and could not express a PART payment at all — a $600 bill the club
 * took $200 of today had no way to appear on this report as $200. It now reads the payments a
 * commitment actually has, so one movement per payment, however many there are, on the day each one
 * happened. The two agree exactly on every record that existed before the migration, which is P1's
 * whole acceptance test.
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
 * splits the same record into halves and answers a **different question** — what posted to the
 * team's BOOKS. Two differences survive the rebuild, both deliberate:
 *   · it **excludes an out-of-pocket cost** (a family's money moved, the team's did not, so there is
 *     no cash entry to reverse). This one **includes** it: it is real spending against the plan,
 *     whoever fronted it.
 *   · it carries **no dates**. Dates are the entire point of this one.
 * That module still reads the legacy columns because it is money-WRITING code, which P1 deliberately
 * leaves alone; it moves in P2 alongside `Record a payment` and Undo.
 *
 * Pure: no IO, no React, no Date, and no timezone library. Dates arrive already resolved to the
 * org's own day (`rep_payable_payments.paid_date` is a `date` column), so there is nothing left here
 * to get wrong about timezones — which is a real simplification over the stamps this replaced.
 */
import { paymentLabel, type CommitmentStanding } from './payable-standing';

/**
 * The record a movement is named after. Two fields, because that is genuinely all this needs now:
 * every amount and every date comes from the commitment's own payments.
 *
 * ⚠ IT USED TO TAKE EIGHT SNAKE_CASE COLUMNS so there would be no hand-written mapping between the
 * report's query and this rule. That defence is no longer needed and its absence is not an
 * oversight: the money now arrives through `getCommitmentStandings`, which does the mapping once,
 * in `lib/db.ts`, for every caller.
 */
export interface PaidExpenseRow {
  id: string;
  description: string;
}

/** One amount that actually left the account, on the day it left. */
export interface PaidMovement {
  id: string;
  description: string;
  /** ALWAYS POSITIVE — the column carries a `CHECK (amount > 0)` and the guard below keeps it true. */
  amount: number;
  /** `YYYY-MM-DD`, always present: a movement with no date is not a movement. */
  paidDate: string;
}

/**
 * Every movement this commitment has actually paid, in the order the money moved.
 *
 * A commitment with nothing recorded against it yields none — absent, never zero, so nothing
 * downstream has to filter.
 *
 * ⚠ THE ID CARRIES THE COMMITMENT, and that is a payload contract rather than a convenience.
 * `scripts/check-money-report-arithmetic.mjs` proves the report contains a commitment paid across
 * two calendar months — the shape that broke the chart and the statement together — by grouping the
 * drill-in's rows back to the record behind them. A bare payment id would make every payment its own
 * record, the detector would report the fixture as lacking the shape, and the check would fail while
 * reading like a seeding problem.
 *
 * The ids and descriptions are what the Months grid's cell drill-in shows, so a coach opening a cell
 * and a coach expanding a statement row read the same lines.
 */
export function paidMovements(exp: PaidExpenseRow, standing: CommitmentStanding | undefined): PaidMovement[] {
  if (!standing) return [];
  const count = standing.installments.length;
  return standing.payments
    .filter(p => Number.isFinite(p.amount) && p.amount > 0)
    .map(p => ({
      id: `${exp.id}-payment-${p.id}`,
      description: paymentLabel(exp.description, p, count),
      amount: p.amount,
      paidDate: p.paidDate,
    }));
}
