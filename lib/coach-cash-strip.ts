import { orgDayKey } from './timezone';
import { monthKeyOf, type MonthKey } from './coach-budget-months';

/**
 * The Months view's cash-flow strip, ACTUAL lens — every dollar that actually moved, by the month
 * it moved, GROSS both directions.
 *
 * ⚠⚠ THIS IS DELIBERATELY A SECOND ARITHMETIC BESIDE THE REPORT'S, and the difference is the whole
 * point (owner ruling 2026-08-23, reversing 2026-07-30's "Money in is player dues only" —
 * `memory/design_decisions.md`). The report NETS money back and club reimbursements into the costs
 * they repaid, which is right for a report; cash is gross in both directions, which is right for a
 * bank balance. Reusing the report's netted cells for Money out while adding the same refunds to
 * Money in would double-count them — so the strip is assembled from the PRIMITIVE records here,
 * never from the rollup's cells.
 *
 * ⚠ THE REGISTER IS THE CONTRACT. Each input's dating and inclusion rule below matches the register
 * route's row assembly exactly — same fallbacks, same exclusions — because `check:money-report`
 * asserts the two agree month-by-month, both directions, to the cent. Change a rule here and the
 * register together, or the build's own guard says no.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT A ROUTE HELPER: the same reason `paidMovements` moved out of the
 * report route — a helper inside a route handler is an untestable one, and this one carries five
 * inclusion/dating rules worth pinning individually.
 */

export interface CashStripInputs {
  /** Dues a family actually paid, the day it arrived (mig 232). */
  duesPayments: Array<{ amount: number; receivedDate: string | null }>;
  /** Recorded arrivals — BOTH kinds. `money_back` is cash IN even though the report nets it. */
  moneyInRecords: Array<{ amount: number; receivedDate: string | null }>;
  /**
   * Realised drive/sponsor entries, GROSS. A rebate is a CREDIT — a family sends less dues — never
   * cash moving twice; gross fundraising + actual dues receipts is the identity the register
   * already proves. Dated the day the money arrived when the record knows it (mig 261), else the
   * day it was recorded — the register's exact fallback.
   * ⚠ The caller passes realised rows only (`getRealisedFundraiserEntries`); a pledge is not cash.
   */
  realisedEntries: Array<{ amountRaised: number; receivedDate: string | null; createdAt: string }>;
  /**
   * Approved club requests, settled the day they were DECIDED (approval posts the transfer).
   * A reimbursement (`charge_to_org`) is cash in; anything else is cash out.
   */
  clubRequests: Array<{
    amount: number; isReimbursement: boolean; reviewedAt: string | null; createdAt: string;
  }>;
  /**
   * One entry per expense PAYMENT (the standings' movements), on the day the money left.
   * ⚠ `familyPaidDirect` rows are the one spend that never moves team cash — a family paid the
   * vendor themselves. The register marks them `movesCash: false`; the strip must drop them too,
   * or it can never equal the register.
   */
  expensePayments: Array<{ amount: number; paidDate: string | null; familyPaidDirect: boolean }>;
  /** Money handed BACK to a family (mig 234) — real cash out, missing from this strip until now. */
  duesPayouts: Array<{ amount: number; paidDate: string | null }>;
  /** Club allocation installments; only PAID ones are cash (on the day the team paid). */
  clubInstallments: Array<{ amount: number; paidAt: string | null }>;
}

export interface CashStrip {
  in: Record<MonthKey, number>;
  out: Record<MonthKey, number>;
  /**
   * Every day a cash event landed on — fed into the month grid's range derivation so a month where
   * cash moved always has a column (owner ruling 2026-08-23, Exhibit C: the grid GROWS the column;
   * silently dropping off-range cash from the strip was rejected with the mockups).
   */
  dates: string[];
}

function add(map: Record<MonthKey, number>, date: string | null, amount: number, dates: string[]) {
  if (!amount) return;
  const m = monthKeyOf(date);
  if (!m) return;
  map[m] = Math.round(((map[m] ?? 0) + amount) * 100) / 100;
  dates.push(date as string);
}

export function buildActualCashStrip(x: CashStripInputs): CashStrip {
  const inMap: Record<MonthKey, number> = {};
  const outMap: Record<MonthKey, number> = {};
  const dates: string[] = [];

  for (const p of x.duesPayments) add(inMap, p.receivedDate, p.amount, dates);
  for (const m of x.moneyInRecords) add(inMap, m.receivedDate, m.amount, dates);
  for (const e of x.realisedEntries) {
    add(inMap, e.receivedDate ?? orgDayKey(e.createdAt), e.amountRaised, dates);
  }
  for (const r of x.clubRequests) {
    const settledOn = orgDayKey(r.reviewedAt ?? r.createdAt);
    add(r.isReimbursement ? inMap : outMap, settledOn, r.amount, dates);
  }
  for (const p of x.expensePayments) {
    if (p.familyPaidDirect) continue;
    add(outMap, p.paidDate, p.amount, dates);
  }
  for (const p of x.duesPayouts) add(outMap, p.paidDate, p.amount, dates);
  for (const i of x.clubInstallments) {
    if (!i.paidAt) continue;
    add(outMap, orgDayKey(i.paidAt), i.amount, dates);
  }

  return { in: inMap, out: outMap, dates };
}
