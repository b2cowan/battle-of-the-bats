// What an expense or payable has actually posted to the team's books — pure, no I/O.
//
// Owner review 2026-08-15 (Q4). Delete had to be able to give money back, which means two places
// need the same answer to "what did this put on the books?": the CONFIRMATION the coach reads
// before pressing delete, and the REVERSAL that runs after. Those living apart is the classic way a
// dialog ends up promising $1,300 while the code gives back $800 — so they share this one function
// and neither decides for itself what counts as paid.
//
// Pure and dependency-free so the browser can import it: lib/db.ts pulls in the service-role
// client, and a confirmation dialog must never be the reason that reaches a client bundle.

import type { RepTeamExpense } from './types';

/** One posted money-out entry, and how confidently we know which ledger row it is. */
export interface ExpenseLedgerLeg {
  /** 'expense' = a lump payment; the other two are a payable's halves. */
  half: 'expense' | 'deposit' | 'balance';
  amount: number;
  /** The description the ledger entry was written with — the fallback match key for old rows. */
  entryDescription: string;
  /** Recorded since mig 236; null for anything paid before it, which matches instead. */
  entryId: string | null;
}

/**
 * Every leg of this record that actually moved team money. Unpaid halves are absent, not zero.
 *
 * ⚠ AN OUT-OF-POCKET EXPENSE HAS NO LEG. It is created already-paid, but a family's money moved and
 * the team's did not, so no cash entry was ever posted (mig 234, owner Call 5). Reversing an entry
 * that was never written would credit the team for spending it never did — the same trap that
 * `markExpensePaid` already refuses for the same records.
 */
export function paidLedgerLegs(e: RepTeamExpense): ExpenseLedgerLeg[] {
  if (e.expenseType === 'tournament_payable') {
    const legs: ExpenseLedgerLeg[] = [];
    if (e.depositPaidAt) {
      legs.push({
        half: 'deposit',
        amount: e.depositAmount ?? e.amount,
        entryDescription: `${e.description} — Deposit`,
        entryId: e.depositEntryId,
      });
    }
    if (e.balancePaidAt) {
      legs.push({
        half: 'balance',
        amount: e.balanceAmount ?? e.amount,
        entryDescription: `${e.description} — Balance`,
        entryId: e.balanceEntryId,
      });
    }
    return legs;
  }
  if (e.expensePaidAt && !e.paidByPlayerId) {
    return [{
      half: 'expense',
      amount: e.amount,
      entryDescription: e.description,
      entryId: e.accountingEntryId,
    }];
  }
  return [];
}

/**
 * What deleting this record would put back on the books, for the confirmation the coach reads.
 *
 * `owesFamily` is separate and NOT money coming back: an out-of-pocket expense carries a credit the
 * team owes a family, which the delete removes by cascade. That changes what a household is owed
 * without a dollar moving through the ledger, so it has to be said in its own sentence rather than
 * folded into an amount.
 */
export function ledgerReversalPreview(e: RepTeamExpense): {
  amount: number;
  legs: number;
  owesFamily: boolean;
} {
  const legs = paidLedgerLegs(e);
  return {
    amount: Math.round(legs.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    legs: legs.length,
    owesFamily: Boolean(e.paidByPlayerId),
  };
}

/** Which figures on a saved record can no longer be changed, and when it was paid. */
export interface ExpenseLocks {
  /** The lump amount, or a payable's total. */
  amount: boolean;
  deposit: boolean;
  balance: boolean;
  /** The most decisive paid-at we know, for saying WHEN in the explanation. Null if unpaid. */
  paidOn: string | null;
}

/**
 * The paid-record lock rule (owner ruling 2026-08-15): descriptive fields stay open forever,
 * anything that has already posted to the books locks.
 *
 * ⚠ ONE DEFINITION, THREE READERS — and that is the point. The form reads it to SHOW a lock and its
 * reason, the form's save reads it to omit fields it must not send, and the API reads it to REFUSE.
 * Those three were each deriving the rule for themselves, which is the shape that lets a later
 * change (say, locking category once posted) get applied in two places out of three — and the one
 * most likely to be missed is the client's send-filter, which fails silently rather than loudly.
 * Same reasoning that put `paidLedgerLegs` here: the server still owns the REFUSAL, only the
 * predicate is shared.
 *
 * ⚠ THE GATE IS PER HALF ON A PAYABLE, not per record. A payable whose deposit is paid and whose
 * balance is still open must keep the balance fully editable — freezing the whole row because one
 * half settled would strand the coach on exactly the commitment they still have to manage. Its
 * TOTAL is a third thing: the commitment, not a half, so it locks only once both halves have paid.
 *
 * ⚠ "PAID BY" IS NOT IN HERE, and that is not an omission. It is locked on every saved record, paid
 * or not — an out-of-pocket expense carries a reimbursement credit owed to a named family, and
 * moving it later would change who is owed without touching the credit, leaving a debt recorded
 * against the wrong household. An unconditional rule is not a predicate: a field that would always
 * read `true` invites a caller to branch on it as though it might not, so the rule is stated once
 * here and applied directly where it bites (the form omits the control; the API refuses a change).
 */
export function lockedFields(e: RepTeamExpense | null): ExpenseLocks {
  if (!e) return { amount: false, deposit: false, balance: false, paidOn: null };
  const bothHalvesPaid = Boolean(e.depositPaidAt) && Boolean(e.balancePaidAt);
  return {
    amount: e.expenseType === 'tournament_payable' ? bothHalvesPaid : Boolean(e.expensePaidAt),
    deposit: Boolean(e.depositPaidAt),
    balance: Boolean(e.balancePaidAt),
    paidOn: e.expensePaidAt ?? e.balancePaidAt ?? e.depositPaidAt ?? null,
  };
}
