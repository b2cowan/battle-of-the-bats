import type { RegisterBookRow } from './coach-register';

/**
 * A PAYEE'S MONEY THIS SEASON (Ledger Parity round 3, D9 + D9a, owner 2026-10-02).
 *
 * The payee window shows what the team paid a payee, what is still to pay, when it last paid and what is
 * due next — and the list behind it shows the same three figures per payee. Every one of them is read from
 * the LEDGER'S OWN ROWS (the season's whole book the Ledger already holds), never from a second query:
 * a payee's entries ARE Ledger rows, so the payee and the Ledger can never disagree about one payment.
 *
 *   paid      money out on the rows that happened (a payment, a cost recorded as paid) — including one a
 *             family paid the payee direct (`movesCash: false`): the payee was paid, the team's cash simply
 *             did not move, and the Ledger's balance is the place that difference is told
 *   toPay     money out still to come: an unpaid installment, overdue or not
 *   lastPaid  the latest day money went out to it
 *   nextDue   the earliest row still to come (an overdue one first, by its date)
 *
 * ⚠ THIS SEASON ONLY (D9a): the book is the live season's. A payee kept from year to year shows what THIS
 * season paid it; a finished season is read on its own closed-season page (owner ruling 2026-08-18).
 */
export interface PayeeMoney {
  paid: number;
  toPay: number;
  /** Something still to pay is past its due date. */
  overdue: boolean;
  lastPaid: string | null;
  nextDue: { date: string | null; amount: number } | null;
  /** The payee's rows, in the book's own order (oldest first). */
  rows: RegisterBookRow[];
}

const cents = (n: number) => Math.round(n * 100);

/**
 * Group the book's rows by the payee each names. `payeeOf` answers for one row — the panel reads it from
 * the bill behind the row (`payeeId`); a row naming no listed payee is skipped. ⚠ Only a BILL names a payee:
 * money in (income, money back) is its own record with no payee, so a payee's figures are all money out — no
 * "received" figure is offered that the data could never fill (/review 2026-10-02).
 */
export function payeeMoneyByPayee(
  book: readonly RegisterBookRow[],
  payeeOf: (row: RegisterBookRow) => string | null,
): Map<string, PayeeMoney> {
  const acc = new Map<string, { paid: number; toPay: number; m: PayeeMoney }>();
  for (const r of book) {
    const id = payeeOf(r);
    if (!id) continue;
    let a = acc.get(id);
    if (!a) {
      a = { paid: 0, toPay: 0, m: { paid: 0, toPay: 0, overdue: false, lastPaid: null, nextDue: null, rows: [] } };
      acc.set(id, a);
    }
    a.m.rows.push(r);
    if (!r.scheduled) {
      a.paid += cents(r.moneyOut);
      if (r.moneyOut > 0 && r.date && (!a.m.lastPaid || r.date > a.m.lastPaid)) a.m.lastPaid = r.date;
    } else {
      a.toPay += cents(r.moneyOut);
      if (r.overdueDays != null) a.m.overdue = true;
      if (r.moneyOut > 0) {
        const due = a.m.nextDue;
        // The earliest date wins; an undated row is "some time", after every dated one.
        if (!due || (r.date && (!due.date || r.date < due.date))) a.m.nextDue = { date: r.date, amount: r.moneyOut };
      }
    }
  }
  const out = new Map<string, PayeeMoney>();
  for (const [id, a] of acc) out.set(id, { ...a.m, paid: a.paid / 100, toPay: a.toPay / 100 });
  return out;
}
