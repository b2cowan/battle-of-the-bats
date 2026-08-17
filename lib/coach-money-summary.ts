/* The Money hub's shared shape and its one money formatter.
 *
 * These sat inside OverviewDashboard while the operate dashboard was their only
 * consumer. The rail now renders on BOTH Overview shapes (owner ruling
 * 2026-08-12), so dashboard ↔ rail would have imported each other. A module
 * neither of them owns breaks the cycle rather than tolerating it. */

export interface MoneySummary {
  stage: 'plan' | 'collect' | 'operate';
  orgLinked: boolean;
  /**
   * ⚠⚠ `total` IS THE CASH LINE, AND `duesCollected` IS NOT ONE OF ITS TERMS (money redesign P3,
   * 2026-08-17). Two figures answer two different questions and had been quietly conflated:
   *   · `duesCollected` — capped at each schedule's total, per schedule. The COLLECTIONS number.
   *   · `duesReceived`  — every payment dollar that arrived, uncapped and schedule-less payments
   *     included. The CASH number, and what `total` adds.
   * `recordedIncome` and `recordedMoneyBack` are new terms, not a re-slicing: money a coach recorded
   * as arriving was previously counted in NO cash figure anywhere in the product.
   */
  moneyIn: {
    duesCollected: number; duesReceived: number; fundraisingRaised: number; orgFunding: number;
    recordedIncome: number; recordedMoneyBack: number; total: number;
  };
  moneyOut: { expensesPaid: number; allocationsPaid: number; orgPayments: number; total: number };
  /**
   * Cash on hand.
   *
   * ⚠ THE REGISTER'S RUNNING BALANCE AT TODAY IS THIS NUMBER, decomposed into the movements that
   * produced it (`/api/coaches/.../register`). They are computed by two routes from the same
   * records; a source added to one and not the other breaks the identity silently.
   */
  onHand: number;
  headroom: number | null;
  budget: {
    /** The optional ESTIMATED total. When set it IS `effectiveTotal`, in both directions. */
    seasonTotal: number | null;
    /** Σ cost lines. Expected funding is never in here. */
    itemizedTotal: number;
    effectiveTotal: number;
    /** estimate − itemized, SIGNED: negative means the lines have outgrown the estimate. */
    buffer: number;
    overItemized: boolean;
    expectedFunding: number;
    fundedByPlayers: number;
    lineCount: number;
    fundingLineCount: number;
    hasInstallments: boolean;
    rosterCount: number;
    perPlayer: number | null;
  };
  dues: {
    expected: number;
    collected: number;
    outstanding: number;
    overdueCount: number;
    overdueAmount: number;
    neverPaidCount: number;
    schedulesCount: number;
  };
  /**
   * Money coming in from outside dues — SPLIT BY KIND, because the Overview rail carries a row for
   * each (owner ruling 2026-08-15).
   *
   * ⚠ `totalRaised` is drives + received sponsors and NEVER the pledged figure. A pledge is
   * carried as its own number so a row can say so out loud; folding it in is the exact flattering
   * the pledged/received split exists to prevent, and it has already been shipped wrong once.
   */
  fundraisers: {
    activeCount: number;
    totalRaised: number;
    creditsIssued: number;
    /** Drives: how many, and what they actually raised. */
    driveCount: number;
    driveRaised: number;
    /** Sponsors: how many, what has ARRIVED, and what is still only promised. */
    sponsorCount: number;
    sponsorReceived: number;
    sponsorPledged: number;
  };
  expenses: { paidTotal: number; loggedCount: number; unpaidCount: number; upcomingDueCount: number };
  allocations: { count: number; totalAllocated: number; outstanding: number; overdueCount: number };
  paymentRequests: { pendingCount: number };
}

/** Every Money destination either Overview shape can send a coach to.
 *
 *  The seven SURFACE keys double as the rail's row keys (see MoneyRail) — a row is a
 *  destination, so the two can't be listed twice and drift. The three DEEP-LINK keys
 *  below open a surface with something already running and are excluded there. */
export interface DashboardHrefs {
  dues: string;
  budget: string;
  budgetVsActual: string;
  /** The Fundraising tab, filtered to DRIVES. */
  fundraisers: string;
  /**
   * The Fundraising tab, filtered to SPONSORS (owner ruling 2026-08-15, revising a single combined
   * row). Two rail rows rather than one, and what earns the second is that each opens the tab
   * ALREADY FILTERED — two doors onto an identical view would be a second navigation system.
   */
  sponsorships: string;
  /**
   * ⚠ TWO SURFACES WHERE THERE WAS ONE (Money split P1, 2026-08-16), and the rail gains a row to
   * match. `expenses` used to point at a screen holding both what had happened and what was owed,
   * which is why its single rail row had to carry two unrelated stats — "$4,120 paid · 3 due" —
   * squeezed onto one line. They are separate questions and now separate doors.
   */
  transactions: string;
  payables: string;
  allocations?: string;
  paymentRequests?: string;
  // ── deep links, not surfaces ──
  /** Budget, with the guided starter open (Chunk G). */
  budgetStarter: string;
  /** Budget, with the generate-installments flow open. */
  budgetGenerate: string;
  /** Payables, on its payment-schedule view (the tab's own default, addressed explicitly so a
   *  caller that means "the schedule" survives a change of default). */
  payablesSchedule: string;
  /**
   * The register, opened on one kind with the scheduled overlay ON (money redesign P3, plan §4.5).
   *
   * ⚠ THIS IS WHAT MAKES THE NEXT-30-DAYS PANEL A WINDOW rather than a summary. Every row there is
   * money that has not moved yet, and every one of them is ALREADY on the register's scheduled
   * block — so "View" should land the coach on that row in context, with the settled book beneath
   * it, instead of on a workspace where they have to find it again.
   */
  registerFrom: Record<'dues' | 'expense' | 'club', string>;
}

/**
 * Money for the coach money hub — the SINGLE formatter these screens share.
 *
 * ⚠ NEGATIVES RENDER IN BRACKETS, never with a minus sign (owner ruling 2026-08-14). `($152.86)`,
 * not `-$152.86`. Two reasons it is worth the churn:
 *   • the accounting convention is what a treasurer reads without being taught, and these screens
 *     are read by parents doing a team's books, not by developers;
 *   • it is a NON-COLOUR cue. The warm palette's amber and danger sit at ΔE ~1.0 for deutan
 *     vision, so a figure whose meaning is the OPPOSITE of its neighbours cannot rely on being
 *     drawn red — the brackets say it independently of hue.
 *
 * ⚠ Known and accepted: brackets mean "negative in THIS column", so the direction flips between
 * surfaces — a bracketed dues balance is a family in credit (good), a bracketed settlement refund
 * is a family who owes the team (bad). The column heading and colour separate them; both are the
 * standard reading of their own column. Deliberately not special-cased.
 *
 * The CSV/PDF exports do NOT come through here (lib/coach-money-exports.ts formats its own), so
 * spreadsheet parsing is unaffected.
 */
export function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${abs})` : `$${abs}`;
}

/**
 * Compact money for a GRID CELL — a month column can't afford ".00" twelve times over.
 *
 * Returns null for "nothing here" rather than "0", because a zero and a nothing are different
 * facts and only the caller knows how it wants to draw the second one. Both money grids (Budget
 * vs. Actual's month grid and the budget plan's period view) use this; they had a copy each.
 */
export function fmtCompact(n: number | undefined | null): string | null {
  if (n == null || Math.abs(n) < 0.005) return null;
  return n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ⚠ There is deliberately NO "does this team have anything falling due?" helper here.
 *
 * One existed, and review killed it. The setup Overview wanted to skip rendering the
 * upcoming-payables panel when it would only say "nothing due" three times, and doing
 * that from the summary looked free — three counts were already in this payload. But
 * the payables route's org-allocation lane is scoped by ORG and has no due-date lower
 * bound, while this payload's `allocations.count` is scoped by PROGRAM YEAR. A team
 * carrying an unpaid allocation from a previous season therefore had real money owed
 * and a count of zero, and the panel that would have shown it was never rendered.
 *
 * The rule that came out of it: **only the thing that fetches the lanes may decide
 * they are empty.** The panel now owns that call via its own `hideWhenEmpty` prop.
 * Showing an empty panel is a cosmetic miss; hiding a populated one is a money bug. */
