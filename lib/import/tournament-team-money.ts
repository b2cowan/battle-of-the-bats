/**
 * The spreadsheet team import and a team's money (TEAM_PAYMENTS_LIST_PLAN.md §4 + §9 call 3, owner 2026-10-21).
 *
 * A team's paid money is a list of dated payments; `teams.total_paid` / `deposit_paid` are a cache the database keeps. The
 * import therefore never WRITES a paid figure. It reads what the sheet states as money, compares it with what is recorded, and
 * the commit records one "Imported payment" for the difference. A lower figure is never applied: the preview says so in words.
 *
 * Pure (no database, no `server-only`) so the unit tests and both the preview and the commit read the same arithmetic.
 */

export const IMPORTED_PAYMENT_LABEL = 'Imported payment' as const;

const cents = (value: number | null | undefined) => Math.round((value ?? 0) * 100);

/** The sheet's stated money: the larger of Total Paid and Deposit Paid among the figures it states; null when it states neither. */
export function statedImportMoney(depositPaid: number | null | undefined, totalPaid: number | null | undefined): number | null {
  const figures = [depositPaid, totalPaid].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (figures.length === 0) return null;
  return Math.max(...figures);
}

export type ImportMoneyPlan =
  | { kind: 'none'; amount: 0 }       // the sheet states no money
  | { kind: 'same'; amount: 0 }       // it states exactly what is recorded
  | { kind: 'add'; amount: number }   // it states more: record the difference
  | { kind: 'lower'; amount: 0 };     // it states less: skip, and say so

/** What the commit does with the sheet's money for a team that has `recorded` dollars received. */
export function planImportMoney(recorded: number | null | undefined, stated: number | null): ImportMoneyPlan {
  if (stated == null) return { kind: 'none', amount: 0 };
  const have = cents(recorded);
  const want = cents(stated);
  if (want === have) return { kind: 'same', amount: 0 };
  if (want < have) return { kind: 'lower', amount: 0 };
  return { kind: 'add', amount: (want - have) / 100 };
}

/** The Total Paid the preview shows after the import: never below what is recorded. */
export function importTotalAfter(recorded: number | null | undefined, stated: number | null): number | null {
  return stated != null && cents(stated) > cents(recorded) ? stated : recorded ?? null;
}

function money(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}

/** The preview sentence for a sheet that states less than is recorded. */
export function lowerFigureNote(recorded: number): string {
  return `Paid figure is lower than what is recorded (${money(recorded)}); remove the payment on the team to lower it.`;
}

/** A sheet "pending" never lowers a team that has payments: the payments decide, and the status follows them. */
export function importKeepsPaidStatus(
  sheetStatus: 'pending' | 'paid',
  currentStatus: string | null | undefined,
  recorded: number | null | undefined,
): boolean {
  return sheetStatus === 'pending' && currentStatus === 'paid' && cents(recorded) > 0;
}

/** The preview sentence for the case above. */
export const KEEPS_PAID_STATUS_NOTE = 'Payment Status “pending” is ignored: this team has recorded payments. Remove the payment on the team to change it.';

/**
 * After the sheet's money is recorded, does a sheet "paid" still need the rest of the fee recorded?
 * Yes when the team is not already paid and the sheet does not state MORE money than is recorded: it states none (owner call
 * 3, point 4) or only what the template round-tripped (the export fills Total Paid, so flipping the status to paid in a
 * template leaves the old figure behind: that is the organizer saying "paid", not "still $100").
 */
export function importPaysTheRest(
  sheetStatus: 'pending' | 'paid',
  currentStatus: string | null | undefined,
  plan: ImportMoneyPlan,
): boolean {
  return sheetStatus === 'paid' && currentStatus !== 'paid' && plan.kind !== 'add';
}
