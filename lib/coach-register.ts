/**
 * The Register — one dated book of every dollar a team's season moved, and the balance beside it.
 *
 * ⚠⚠ THE RULE THIS MODULE EXISTS TO KEEP: **the running balance at Today IS Cash on hand, and every
 * row is one of its movements.** That is the whole design (money redesign plan §4.2, owner-ruled
 * 2026-08-16), and it is what forces the book to carry money the coach never typed on this screen —
 * dues arriving, fundraiser proceeds, sponsor receipts, money handed back to families, everything
 * settled with the club. A book that showed only what was typed here would print a balance that is
 * not the team's cash, which is worse than printing no balance at all.
 *
 * ⚠⚠ AND THE RULE WAS UNBUILDABLE WHEN THIS FILE WAS WRITTEN. Cash on hand did not contain recorded
 * income or refunds at all — `rep_team_money_in` was read by nothing behind that figure — so the
 * identity above could not hold for any register. That is corrected in the same release, from the
 * arithmetic BELOW rather than beside it. See COACH_MONEY_REGISTER_P3_PLAN.md §0.
 *
 * ⚠⚠ `cashOnHandCents` IS THE ONE DEFINITION, AND `money-summary` CALLS IT. That is deliberate and it
 * is load-bearing: the first draft of this file claimed the two routes "reconciled to it" while
 * `money-summary` in fact hand-rolled `r2(moneyIn - moneyOut)` over nine float totals and never
 * imported this module. Two independent arithmetics held together by a comment is exactly how Cash
 * on hand broke three ways in the first place, so the summary now hands its own category totals to
 * this function as movements and takes the answer. A source added to one and not the other is now a
 * missing argument rather than a silent drift.
 *
 * ⚠ THE SEASON CLOSE-OUT POT IS THE REMAINING EXCEPTION, and it is stated rather than glossed.
 * `lib/season-settlement.ts` computes `cashHeld` from the same inputs in its own integer-cent
 * arithmetic, because it is a pure module with no dependencies that runs under plain `node --test`
 * and its pot carries terms this function has no notion of (hold-back, share-paid, owed-back).
 * It takes the same figures; it does not take this function. **If you add a money source, it is the
 * third place to change.**
 *
 * ⚠ NOTHING IS EVER CREATED IN THE REGISTER. It is a view. "One row, one source" is untouched
 * because a view cannot double-count, and this module must never grow a write path that could.
 *
 * ⚠ INTEGER CENTS THROUGHOUT, exactly like `lib/season-settlement.ts` next door. The balance is
 * compared against a figure computed in another route; a float sum that lands a cent away would
 * make the register's headline claim read as false on a screen where it is true.
 *
 * Pure: no IO, no React, no Date. The route assembles the records, this decides what they mean.
 */

import type { CoachMoneySection } from './coach-money-links';

// ⚠ Coerces rather than validating — a `numeric` column arrives from PostgREST as a STRING, and a
// `Number.isFinite` guard would treat "250.00" as invalid and silently substitute zero. Money
// vanishing quietly is worse than money throwing loudly; `|| 0` catches only genuine NaN.
export const toCents = (n: number | string | null | undefined) => Math.round(Number(n) * 100) || 0;
export const toDollars = (c: number) => c / 100;

/**
 * Dollars, written the way this product writes money in a sentence — always two decimals.
 *
 * ⚠⚠ EXPORTED BECAUSE IT KEEPS GETTING RE-TYPED (`/simplify`, 2026-08-19). This exact expression
 * already exists, unexported and character-for-character identical, in `lib/dues-reminder-email.ts`,
 * the allocation and dues reminder routes, and the installment-preview route. This is the fifth
 * caller and the first shared home; **migrate the other four here rather than adding a sixth.**
 *
 * ⚠ ALWAYS TWO DECIMALS, deliberately — NOT the same function as `money()` in
 * `lib/insight-findings.ts`, which drops the cents on a whole figure so a narrative sentence reads
 * naturally. This one sits beside other figures in a ledger, where `$200` above `$450.00` looks like
 * a different kind of number.
 */
export const formatMoney = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The six kinds a row can be, which are also the six filters (plus All).
 *
 * ⚠ THE FILTER STRIP IS THIS LIST, not a second copy of it. `All · Expenses · Income · Refunds ·
 * from Dues · from Fundraising · from Club` (plan §4.3) — a seventh source of money would otherwise
 * be renderable on the book and unreachable from the strip.
 *
 * ⚠ `dues` CARRIES BOTH DIRECTIONS, and so does `club`. A dues payment arrives and a dues payout
 * leaves; the club bills the team and funds it. The kind names the WORKSPACE a row belongs to, and
 * the amount column names its direction — which is exactly why the register needs no signed column.
 */
export type RegisterKind = 'expense' | 'income' | 'refund' | 'dues' | 'fundraising' | 'club';

export type RegisterFilter = 'all' | RegisterKind;

export const REGISTER_FILTERS: { id: RegisterFilter; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'expense',     label: 'Expenses' },
  { id: 'income',      label: 'Income' },
  { id: 'refund',      label: 'Refunds' },
  { id: 'dues',        label: 'from Dues' },
  { id: 'fundraising', label: 'from Fundraising' },
  { id: 'club',        label: 'from Club' },
];

/**
 * What one row calls itself — in its chip, and in the Kind column of the export.
 *
 * ⚠ A LIST MAY LABEL A ROW; THE REPORT STILL MAY NOT. Budget vs. Actual carries no "money back" chip
 * because a refund NETS into the row it repaid and there is nothing left to tag (owner ruling
 * 2026-08-15). This is the record book, where two different events share one table and a coach
 * auditing the season has to tell a $325 grant from a $325 reimbursement.
 */
export const REGISTER_KIND_LABEL: Record<RegisterKind, string> = {
  expense:     'Expense',
  income:      'Income',
  refund:      'Refund',
  dues:        'Player Dues',
  fundraising: 'Fundraising',
  club:        'Club',
};

/** What a row is called in its own chip. Only DERIVED rows carry one. */
export const REGISTER_SOURCE_LABEL: Record<'dues' | 'fundraising' | 'club', string> = {
  dues:        'Player Dues',
  fundraising: 'Fundraising',
  club:        'Club',
};

/** Where tapping a row takes the coach. */
export type RegisterOpen =
  /** A recorded cost or commitment half — the money form, fully editable. */
  | { kind: 'expense'; id: string }
  /** A recorded arrival — income or money back. Same form. */
  | { kind: 'money-in'; id: string }
  /** A derived row: it is edited where it was made, never here. */
  | { kind: 'workspace'; section: CoachMoneySection };

/* ⚖ `RegisterHalf` IS GONE (Payables Rebuild P2): a scheduled row settles through `Record a
   payment` aimed at its own installment, so there is no half vocabulary left to speak. */

export interface RegisterRow {
  /** Unique across the whole book — the row key, and what a filter re-render is stable against. */
  id: string;
  /**
   * The day this money moved, or is due to.
   *
   * ⚠ NULL IS A REAL STATE, on exactly one row: an unpaid plain expense, which has no due date at
   * all (a commitment is the record that carries dates). It sorts last inside the scheduled block
   * rather than being dropped — a cost the coach logged and never dated is precisely the thing they
   * are looking for when they open this screen.
   */
  date: string | null;
  kind: RegisterKind;
  description: string;
  categoryName: string | null;
  itemName: string | null;
  /** Positive dollars, in exactly one of the two columns. Never signed, never both. */
  moneyOut: number;
  moneyIn: number;
  /** Above Today: money that has NOT moved yet. Its balance is a projection. */
  scheduled: boolean;
  /**
   * Whole days past due, for a scheduled row whose date has already passed — null on every other
   * row (settled, undated, or genuinely still upcoming). Computed by the route from the org's own
   * "today" so this module never has to know what day it is: a fact handed in, not derived.
   *
   * ⚠ NULL, NOT ZERO OR NEGATIVE. A scheduled row due exactly today is not overdue and carries
   * null here — `0` would read as "overdue by zero days", which is a different claim.
   */
  overdueDays: number | null;
  /**
   * ⚠⚠ FALSE ONLY ON AN OUT-OF-POCKET COST, and it is why this field exists rather than a boolean
   * hidden in the amount. A cost a family paid the vendor direct is real spending on a real record —
   * it belongs on the book — but no TEAM cash moved, so it must not move the balance. The row shows
   * its amount in Money out, carries a chip saying the family paid direct, and repeats the previous
   * balance beside it. Hiding the row would lose a record; moving the balance would break the one
   * identity this whole screen rests on.
   */
  movesCash: boolean;
  open: RegisterOpen | null;
  /** Present only on a SCHEDULED money-out row. Opens Record a payment pre-aimed at this piece,
   *  suggesting its REMAINDER — the coach's override of the application rule (R3), not a lock. */
  recordPayment: { expenseId: string; installmentId: string | null; amount: number } | null;
  /** The workspace chip on a derived row; null on a recorded one. */
  sourceLabel: string | null;
  /** A second line under the description — a player's name, a due note, why a date is what it is. */
  detail: string | null;
}

/** A row with the balance standing after it. */
export interface RegisterBookRow extends RegisterRow {
  /**
   * The balance AFTER this row.
   *
   * ⚠ On a row that moves no team cash this is the balance BEFORE it too — unchanged, deliberately,
   * and the row says why in its own words.
   */
  balance: number;
}

/**
 * The four fields the cash arithmetic actually reads.
 *
 * ⚠ NARROW ON PURPOSE, so `money-summary` can hand this function its own category totals as
 * movements without inventing dates, ids and descriptions for figures that have none. The register
 * passes whole `RegisterRow`s and they satisfy this shape for free.
 */
export interface CashMovement {
  moneyOut: number;
  moneyIn: number;
  movesCash: boolean;
  /** Above Today: a projection, so it is not cash yet and never reaches the close. */
  scheduled: boolean;
}

/** How a movement is signed, in cents. Zero when no team cash moved. */
function movementCents(r: CashMovement): number {
  if (!r.movesCash) return 0;
  return toCents(r.moneyIn) - toCents(r.moneyOut);
}

/**
 * A date that sorts after every real one, so a dateless row lands at the end of its block without
 * branching every comparison. The same trick the payables route uses for its unbounded window.
 */
const LAST = '9999-12-31';

/** Oldest first — the order a balance accumulates in. */
export function byDateAscending(a: RegisterRow, b: RegisterRow): number {
  return (a.date ?? LAST).localeCompare(b.date ?? LAST) || a.id.localeCompare(b.id);
}

/**
 * The season's closing cash, in cents: every SETTLED movement, from an opening balance of zero.
 *
 * ⚠ ZERO IS A FACT HERE, NOT A CONVENTION. Every figure behind Cash on hand is scoped to the working
 * program year — dues, fundraising, expenses, allocations, and club requests as of migration 247 —
 * so the season's book genuinely starts empty and its last settled row's balance IS the cash.
 * If anything season-less is ever folded into that figure again, this stops being true and the
 * register's headline claim quietly becomes false. That is the trap migration 247 closed.
 *
 * ⚠ TWO CALLERS, AND THAT IS THE POINT: the register sums its rows, and `money-summary` sums its
 * category totals. One arithmetic, so the two cannot disagree by a rounding step.
 */
export function cashOnHandCents(movements: readonly CashMovement[]): number {
  let cents = 0;
  for (const m of movements) if (!m.scheduled) cents += movementCents(m);
  return cents;
}

/**
 * The book, in the order it is READ, with each row's balance attached.
 *
 * ⚠⚠ ONE CHRONOLOGICAL LIST, OLDEST TO NEWEST, TOP TO BOTTOM (reading-order ruling, follow-up to
 * P3). The book used to read newest-first above a Today boundary, with everything unsettled
 * bucketed into its own ascending block regardless of how overdue it was. Both choices fought how
 * a coach actually reads a page: a row's own transaction explained the row ABOVE it, not below,
 * and a bill three months late sat shelved beside one due next week. Now:
 *
 *   · every row — settled or overdue — sits at its own true date, oldest at the top;
 *   · an OVERDUE row (`overdueDays !== null`) never moves the real balance — it carries forward
 *     whatever real cash existed immediately before it in true date order, exactly the treatment
 *     `movesCash: false` rows already use, for the same reason (no cash actually moved);
 *   · genuinely future rows (scheduled, not overdue) sit after Today and keep the existing
 *     PROJECTION, continuing forward from Cash on hand — unchanged from before.
 *
 * `todayIndex` names where in `book` the Today divider belongs (also the auto-scroll target): the
 * first `todayIndex` rows are the settled + overdue past; everything from `todayIndex` on is the
 * forward projection.
 *
 * ⚠ THE BALANCE IS ACCUMULATED FORWARDS. Two interleaved walks — one through real settled rows,
 * one through overdue rows merged in by date — both moving strictly oldest to newest, so neither
 * list is ever built backwards and reversed.
 */
export function buildBook(rows: readonly RegisterRow[]): {
  book: RegisterBookRow[];
  /** Index into `book` where the Today divider sits — also the auto-scroll landing point. */
  todayIndex: number;
  /** The closing settled balance — Cash on hand, in dollars. */
  cashOnHand: number;
  /** Where the balance ends up if everything scheduled happens. Null when nothing is scheduled. */
  projectedBalance: number | null;
} {
  // ⚠ `.filter` already returns a fresh array, so sorting it in place cannot reorder the caller's.
  const settledAsc = rows.filter(r => !r.scheduled).sort(byDateAscending);
  const scheduledAsc = rows.filter(r => r.scheduled).sort(byDateAscending);
  const overdueAsc = scheduledAsc.filter(r => r.overdueDays !== null);
  const futureAsc = scheduledAsc.filter(r => r.overdueDays === null);

  let cents = 0;
  const settledCents: { row: RegisterRow; cents: number }[] = settledAsc.map(r => {
    cents += movementCents(r);
    return { row: r, cents };
  });
  const cashOnHand = toDollars(cents);

  // Merge overdue rows into the settled sequence at their true chronological position. An
  // overdue row's own balance is whatever real cash had accumulated up to that point — it never
  // advances the running total itself.
  const merged: RegisterBookRow[] = [];
  let si = 0, oi = 0, carriedCents = 0;
  while (si < settledCents.length || oi < overdueAsc.length) {
    const s = settledCents[si];
    const o = overdueAsc[oi];
    const takeOverdueNext = !!o && (!s || byDateAscending(o, s.row) <= 0);
    if (takeOverdueNext) {
      merged.push({ ...o, balance: toDollars(carriedCents) });
      oi++;
    } else {
      carriedCents = s.cents;
      merged.push({ ...s.row, balance: toDollars(s.cents) });
      si++;
    }
  }

  let projected = cents;
  const futureWithBalance: RegisterBookRow[] = futureAsc.map(r => {
    projected += movementCents(r);
    return { ...r, balance: toDollars(projected) };
  });

  return {
    book: merged.concat(futureWithBalance),
    todayIndex: merged.length,
    cashOnHand,
    projectedBalance: futureWithBalance.length > 0 ? toDollars(projected) : null,
  };
}

/**
 * Narrows the book to a date window. A real, unconditional window — a row outside it is hidden,
 * full stop, whether it's settled, overdue or future. There is exactly one exemption: an undated
 * row (an unpaid expense with no due date at all) has no date to compare against a window, and
 * the register's standing rule is that an undated row never vanishes — it sorts to the end of the
 * unsettled block instead. That is a fact about dates, not a carve-out for THIS control.
 *
 * ⚠⚠ OVERDUE MONEY IS NOT EXEMPTED HERE — a real-data correction. The first version of this
 * function let every unsettled row ignore the range, on the theory that a coach should never lose
 * sight of something still owed. In practice that made "2026-07-19–2026-09-17" show rows from
 * March, which reads as the control being broken, not as a safety net. The actual safety net is
 * the Overdue count in the filter strip, computed BEFORE this function ever runs — it is always
 * accurate regardless of the range, and the panel keeps every overdue row out of this function's
 * reach: they are split off before it runs and unioned back after, in every Status selection (an
 * Overdue-only audit skips the function entirely — an audit of what's overdue has no business
 * being cropped by a browsing convenience window). A date range a coach sets should mean exactly
 * that date range.
 *
 * ⚠ BALANCE IS NOT RECOMPUTED HERE. Every row already carries the true cumulative figure from
 * `buildBook`; narrowing by date hides rows from a continuous timeline rather than excluding a
 * category from a sum, so every visible balance stays honest — unlike a type filter, which has to
 * fake the arithmetic to keep a column at all and is why THAT narrowing still hides Balance
 * (`balanceIsMeaningful`).
 *
 * ⚠ `startingBalance` READS LIKE A STATEMENT'S OPENING LINE — the true cumulative balance as of
 * the moment right before the window opens (0 if the window starts before any recorded history).
 * A coach reading rows from mid-window outward should never have to wonder what came before; the
 * row this powers says so in dollars rather than "N rows not shown."
 */
export function applyDateRange(
  book: readonly RegisterBookRow[],
  fromKey: string,
  toKey: string,
): { rows: RegisterBookRow[]; startingBalance: number } {
  const rows: RegisterBookRow[] = [];
  let lastBeforeRange = 0;
  for (const r of book) {
    const inRange = r.date === null || (r.date >= fromKey && r.date <= toKey);
    if (inRange) {
      rows.push(r);
    } else if (r.date !== null && r.date < fromKey) {
      lastBeforeRange = r.balance;
    }
  }
  return { rows, startingBalance: lastBeforeRange };
}

/**
 * Does this row belong under the chosen type filter?
 *
 * ⚠ ONE PREDICATE, TWO CALLERS — the screen and its export. An export that filtered differently from
 * the list above it is the "two buttons, one name, different files" defect the export module's own
 * header was written about.
 */
export function matchesFilter(row: RegisterRow, filter: RegisterFilter): boolean {
  return filter === 'all' || row.kind === filter;
}

/**
 * ⚠⚠ WHEN A FILTER HIDES ROWS, THE BALANCE COLUMN HIDES WITH IT (plan §4.3).
 *
 * A running balance over a subset of the book is a number that looks like cash and isn't — a coach
 * reading "Expenses only" would see a column of figures descending from zero and have every reason
 * to think it was the team's position. The column is removed rather than blanked, so there is no
 * empty space inviting the question.
 *
 * ⚠ EVERY NARROWING COUNTS, which is why the extras are variadic rather than one named argument.
 * The strip has grown from one control to three (type · budget word · money tag) and will grow
 * again; a signature that named them one at a time is how the fourth one ships without taking the
 * column, which is the failure this function exists to prevent.
 */
export function balanceIsMeaningful(
  filter: RegisterFilter,
  ...narrowings: (string | null | undefined)[]
): boolean {
  return filter === 'all' && narrowings.every(n => !n);
}
