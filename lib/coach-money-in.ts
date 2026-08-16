/**
 * The vocabulary of money ARRIVING, and what one arrival puts on the team's books (mig 243).
 *
 * ⚠⚠ THE ONE DISTINCTION THIS MODULE EXISTS TO HOLD: a coach describes both of these as
 * *"a parent paid me back"*, and they are opposites.
 *
 *   · **Paid out of pocket** — `rep_team_expenses.paid_by_player_id`. The team's cash never moved;
 *     the team now **owes that family a credit**. Not in this module at all.
 *   · **Money back** — a `rep_team_money_in` row. The team's cash went out and some returned; the
 *     team owes **nobody**. The cash is simply back.
 *
 * Merging them either credits a family twice or loses a credit entirely — real money in a real
 * family's ledger. The wording below is deliberately different for that reason, and
 * `received_from: 'family'` is a LABEL that creates no credit and settles none.
 *
 * ⚠ AND A REFUND IS NOT INCOME. A refunded tournament entry means the team spent $150 less, not
 * that it earned $150 — booking it as income overstates both sides and corrupts every per-item
 * cost figure downstream. Where it lands is `lib/coach-budget-rollup.ts` rule 7's job; naming it
 * is this one's.
 *
 * Pure and dependency-free, like `lib/expense-ledger.ts` beside it, so the confirmation dialog a
 * coach reads and the reversal the server runs can share one answer without dragging the
 * service-role client into a client bundle.
 */

import type { MoneyInKind, MoneyInSource, RepTeamMoneyIn } from './types';

export const MONEY_IN_KINDS: MoneyInKind[] = ['income', 'money_back'];

/**
 * What the coach called it on the form. ⚠ These three answers — a cost, income, money back — are
 * the whole taxonomy; "a cost" lives on the expenses side and is not a `MoneyInKind`.
 */
export const MONEY_IN_KIND_LABEL: Record<MoneyInKind, string> = {
  income:     'Income',
  money_back: 'Money back on something',
};

/** The one-line explanation under each choice. Concrete, because the definitions did not land. */
export const MONEY_IN_KIND_HINT: Record<MoneyInKind, string> = {
  income:     'Money the team earned or was given',
  money_back: 'A refund, credit or reimbursement of something already recorded',
};

/** What a row in a list says it is. Short, because it sits in a column. */
export const MONEY_IN_KIND_ROW: Record<MoneyInKind, string> = {
  income:     'Income',
  money_back: 'Money back',
};

export const MONEY_IN_SOURCES: MoneyInSource[] = ['club', 'vendor', 'sponsor', 'family', 'other'];

export const MONEY_IN_SOURCE_LABEL: Record<MoneyInSource, string> = {
  club:    'The club',
  vendor:  'A vendor',
  sponsor: 'A sponsor',
  family:  'A family',
  other:   'Someone else',
};

/**
 * What the team-ledger entry is called.
 *
 * ⚠ SHARED BY THE WRITE AND THE EDIT so a record whose description changes carries its entry with
 * it, rather than leaving a posted entry in the club's ledger described as something that no
 * longer exists. (The delete path uses the stored entry id and never matches on words — the
 * mig 236 lesson applied from birth. This is only about the entry reading correctly.)
 *
 * ⚠ THE REFUND SUFFIX IS FOR THE LEDGER, NOT THE REPORT. Budget vs. Actual carries no "money back"
 * chip and no "refund" tag — the figures and the blanks between them are the story (owner ruling
 * 2026-08-15). A club treasurer reading the raw ledger has no such context and needs the word.
 */
export function moneyInEntryDescription(
  record: Pick<RepTeamMoneyIn, 'kind' | 'description'>,
  itemName: string | null,
): string {
  const base = (record.description ?? '').trim() || (itemName ?? '').trim()
    || (record.kind === 'income' ? 'Money in' : 'Money back');
  return record.kind === 'money_back' ? `${base} — money back` : base;
}

/**
 * What deleting this record takes back off the books, for the confirmation the coach reads.
 *
 * Every money-in row posts exactly one income entry on the day it arrived, so unlike an expense
 * there are no halves to count — but the sentence still has to name dollars. Deleting one lowers
 * cash on hand, which is the opposite direction from deleting an expense and must not be worded
 * as if it were the same event.
 *
 * ⚠ `owesFamily` IS DELIBERATELY ABSENT. No money-in record ever creates or settles a family
 * credit, on either kind and whatever `receivedFrom` says. If a future change makes that untrue it
 * must add the field here and the sentence with it, rather than letting the dialog stay silent
 * about a household's balance changing.
 */
export function moneyInReversalPreview(record: RepTeamMoneyIn): { amount: number; posted: boolean } {
  return {
    amount: record.amount,
    posted: Boolean(record.accountingEntryId),
  };
}
