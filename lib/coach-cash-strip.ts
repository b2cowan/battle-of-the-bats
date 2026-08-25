import { orgDayKey } from './timezone';
/* ⚠ THE BAND VOCABULARY LIVES IN `coach-budget-months`, NOT HERE, and is imported rather than
   re-exported: a type with two import paths is a type two readers can disagree about where it
   belongs. This module decides which RECORDS are cash; that one owns what the grid CALLS them. */
import {
  monthKeyOf, PAYOUT_CATEGORY_ID, PAYOUT_CATEGORY_NAME,
  type MonthKey, type RevenueGroupKey,
} from './coach-budget-months';

/**
 * The Months view's CASH arithmetic — every dollar that actually moved, by the month it moved,
 * GROSS both directions, and (since the Option D merge, 2026-08-23) grouped the way the screen
 * reads it: revenue by source, spending by the category+item it was filed under.
 *
 * ⚠⚠ THIS IS DELIBERATELY A SECOND ARITHMETIC BESIDE THE REPORT'S, and the difference is the whole
 * point (owner ruling 2026-08-23, reversing 2026-07-30's "Money in is player dues only" —
 * `memory/design_decisions.md`). The report NETS money back and club reimbursements into the costs
 * they repaid, which is right for a report; cash is gross in both directions, which is right for a
 * bank balance. Reusing the report's netted cells for the expense band while adding the same
 * refunds to the revenue band would double-count them — so both bands are assembled from the
 * PRIMITIVE records here, never from the rollup's cells.
 *
 * ⚠ THE REGISTER IS THE CONTRACT. Each input's dating and inclusion rule below matches the register
 * route's row assembly exactly — same fallbacks, same exclusions — because `check:money-report`
 * asserts the two agree month-by-month, both directions, to the cent. Change a rule here and the
 * register together, or the build's own guard says no.
 *
 * ⚠⚠ `in` / `out` ARE SUMMED FROM THE EMITTED EVENTS, NEVER COMPUTED BESIDE THEM. They are the same
 * fact at a coarser grain, and the one way this module could quietly start telling two stories is a
 * second pass that adds a stream to one and not the other — which is precisely how payouts and
 * drive money went missing from the strip for weeks. One walk, two grains.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT A ROUTE HELPER: the same reason `paidMovements` moved out of the
 * report route — a helper inside a route handler is an untestable one, and this one carries six
 * inclusion/dating rules worth pinning individually.
 */

/** Where a cash-out event sits in the budget taxonomy — resolved by the caller, carried by us. */
export interface CashPlacement {
  categoryId: string | null;
  categoryName: string | null;
  itemId: string | null;
}

export interface CashStripInputs {
  /** Dues a family actually paid, the day it arrived (mig 232). */
  duesPayments: Array<{ amount: number; receivedDate: string | null }>;
  /**
   * Recorded arrivals — BOTH kinds. `money_back` is cash IN even though the report nets it, and the
   * kind decides which revenue group it lands in ("Other income" vs "Money back & reimbursements").
   */
  moneyInRecords: Array<{ amount: number; receivedDate: string | null; kind: 'income' | 'money_back' }>;
  /**
   * Realised drive/sponsor entries, GROSS. A rebate is a CREDIT — a family sends less dues — never
   * cash out; gross fundraising + actual dues receipts is the identity the register already proves.
   * Dated the day the money arrived when the record knows it (mig 261), else the day it was
   * recorded — the register's exact fallback.
   * ⚠ The caller passes realised rows only (`getRealisedFundraiserEntries`); a pledge is not cash.
   * ⚠ `kind` splits the two revenue groups: a drive is Fundraising, a sponsor is Sponsorships.
   */
  realisedEntries: Array<{
    amountRaised: number; receivedDate: string | null; createdAt: string;
    kind: 'fundraiser' | 'sponsor';
  }>;
  /**
   * Approved club requests, settled the day they were DECIDED (approval posts the transfer).
   * A reimbursement (`charge_to_org`) is cash in — and lands in the Money back group, because the
   * club repaying a cost is the same species of arrival as a vendor refunding one. Anything else is
   * cash out, filed where the request itself was filed.
   */
  clubRequests: Array<CashOutRecord & { isReimbursement: boolean; reviewedAt: string | null; createdAt: string }>;
  /**
   * One entry per expense PAYMENT (the standings' movements), on the day the money left.
   * ⚠ `familyPaidDirect` rows are the one spend that never moves team cash — a family paid the
   * vendor themselves. The register marks them `movesCash: false`; the band must drop them too,
   * or it can never equal the register.
   */
  expensePayments: Array<CashOutRecord & { paidDate: string | null; familyPaidDirect: boolean }>;
  /** Money handed BACK to a family (mig 234) — real cash out, its own expense-band group. */
  duesPayouts: Array<{ id: string; amount: number; paidDate: string | null }>;
  /** Club allocation installments; only PAID ones are cash (on the day the team paid). */
  clubInstallments: Array<CashOutRecord & { paidAt: string | null }>;
}

/**
 * What every cash-out record carries beyond its date.
 *
 * ⚠ THE ID AND THE WORDS ARE NOT DECORATION. An Actual cell on the Months grid opens a drill-in
 * listing what makes it up, and that list is now CASH rather than the report's movements — so the
 * words a coach reads behind a figure have to travel with the figure, from the one place that
 * decided the figure was cash at all.
 */
export interface CashOutRecord {
  id: string;
  description: string;
  amount: number;
  place: CashPlacement;
}

/** One dollar of revenue, in its group, on the day it arrived. */
export interface RevenueCashEvent {
  group: RevenueGroupKey;
  date: string | null;
  amount: number;
}

/** One dollar of spending that actually left the team's cash, where it was filed. */
export interface ExpenseCashEvent extends CashOutRecord {
  date: string | null;
}

export interface CashStrip {
  /** Revenue by month — the sum of `revenue` below, at a coarser grain. */
  in: Record<MonthKey, number>;
  /** Cash spending by month — the sum of `expenses` below. */
  out: Record<MonthKey, number>;
  /** Every revenue arrival, grouped for the REVENUE band. */
  revenue: RevenueCashEvent[];
  /** Every cash departure, placed for the EXPENSES band (payouts carry the synthetic placement). */
  expenses: ExpenseCashEvent[];
  /**
   * What this arithmetic DELIBERATELY LEFT OUT — spending a family paid the vendor directly.
   *
   * ⚠⚠ IT IS REPORTED BY THE THING THAT EXCLUDED IT, and that is the whole point. The Statement
   * counts these (the season really did incur them); cash cannot (no team money moved). Something
   * has to explain that gap to a coach, and the only safe source is here — anywhere else would be a
   * SECOND copy of the exclusion rule, free to drift from the one that actually runs. Re-derived in
   * the route, a rule change here would silently stop matching the explanation on screen.
   */
  excluded: ExpenseCashEvent[];
  /**
   * Every day a cash event landed on — fed into the month grid's range derivation so a month where
   * cash moved always has a column (owner ruling 2026-08-23, Exhibit C: the grid GROWS the column;
   * silently dropping off-range cash from the strip was rejected with the mockups).
   */
  dates: string[];
}

const PAYOUT_PLACE: CashPlacement = {
  categoryId: PAYOUT_CATEGORY_ID, categoryName: PAYOUT_CATEGORY_NAME, itemId: null,
};

export function buildActualCashStrip(x: CashStripInputs): CashStrip {
  const revenue: RevenueCashEvent[] = [];
  const expenses: ExpenseCashEvent[] = [];
  const excluded: ExpenseCashEvent[] = [];
  const dates: string[] = [];

  /* ⚠ A ZERO IS NOT AN EVENT. Emitting it would put a row on the grid for a record that moved
     nothing and, worse, would widen the month range to the day it did not happen. */
  const income = (group: RevenueGroupKey, date: string | null, amount: number) => {
    if (!amount) return;
    revenue.push({ group, date, amount });
    if (date) dates.push(date);
  };
  /* ⚠ THE EVENT IS BUILT FIELD BY FIELD, NEVER SPREAD FROM THE INPUT. An input row carries its own
     raw date under its own name (`paidDate`, `paidAt`, `reviewedAt`) and the whole job here is to
     resolve which of those the money actually moved on — so spreading would put a second, unresolved
     date on the event beside the answer, and the next reader has no way to know which one is real. */
  const spend = (rec: CashOutRecord, date: string | null) => {
    if (!rec.amount) return;
    expenses.push({ id: rec.id, description: rec.description, amount: rec.amount, place: rec.place, date });
    if (date) dates.push(date);
  };

  for (const p of x.duesPayments) income('dues', p.receivedDate, p.amount);
  for (const m of x.moneyInRecords) {
    income(m.kind === 'money_back' ? 'moneyback' : 'other', m.receivedDate, m.amount);
  }
  for (const e of x.realisedEntries) {
    income(
      e.kind === 'sponsor' ? 'sponsorship' : 'fundraising',
      e.receivedDate ?? orgDayKey(e.createdAt),
      e.amountRaised,
    );
  }
  for (const r of x.clubRequests) {
    const settledOn = orgDayKey(r.reviewedAt ?? r.createdAt);
    if (r.isReimbursement) income('moneyback', settledOn, r.amount);
    else spend(r, settledOn);
  }
  for (const p of x.expensePayments) {
    /* ⚠ RECORDED, NOT DISCARDED. The season spent this and the team's cash did not — the Statement
       counts it, this arithmetic must not, and the difference is a real question a coach asks. */
    if (p.familyPaidDirect) {
      if (p.amount) excluded.push({ id: p.id, description: p.description, amount: p.amount, place: p.place, date: p.paidDate });
      continue;
    }
    spend(p, p.paidDate);
  }
  for (const i of x.clubInstallments) {
    if (!i.paidAt) continue;
    spend(i, orgDayKey(i.paidAt));
  }
  /* ⚠ LAST ON PURPOSE. The month grid orders categories it learns from events by first appearance,
     and "Paid back to families" belongs at the FOOT of the expense band (the Option D mockup draws
     it there) rather than interleaved with the team's real spending categories. */
  for (const p of x.duesPayouts) {
    spend({ id: p.id, description: PAYOUT_CATEGORY_NAME, amount: p.amount, place: PAYOUT_PLACE }, p.paidDate);
  }

  const inMap: Record<MonthKey, number> = {};
  const outMap: Record<MonthKey, number> = {};
  const bucket = (map: Record<MonthKey, number>, date: string | null, amount: number) => {
    const m = monthKeyOf(date);
    if (!m) return;
    map[m] = Math.round(((map[m] ?? 0) + amount) * 100) / 100;
  };
  for (const e of revenue) bucket(inMap, e.date, e.amount);
  for (const e of expenses) bucket(outMap, e.date, e.amount);

  return { in: inMap, out: outMap, revenue, expenses, excluded, dates };
}
