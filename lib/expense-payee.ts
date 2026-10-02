import type { RepTeamExpense } from './types';
import type { PayeeSelection } from '@/components/accounting/PayeeCombobox';

/** What the Payees window changed (Ledger Parity round 3) — for whatever is open under it. */
export type PayeeChange =
  | { kind: 'renamed'; id: string; name: string }
  | { kind: 'merged'; from: string; into: string; intoName: string }
  | { kind: 'deleted'; id: string }
  | { kind: 'added'; name: string };

/**
 * A payee picked in an open form or bill, after a change made in the Payees window over it: a rename reads
 * the new name, a merge points at the payee kept (the server already moved the records — a merged-away id
 * would be refused on the next save). Anything else leaves the pick as it was. ONE rule for the bill's draft
 * and the money form's pick.
 */
export function followPayeeChange(pick: PayeeSelection | null, change: PayeeChange): PayeeSelection | null {
  if (!pick?.payeeId) return pick;
  if (change.kind === 'renamed' && change.id === pick.payeeId) return { ...pick, displayName: change.name };
  if (change.kind === 'merged' && change.from === pick.payeeId) return { ...pick, payeeId: change.into, displayName: change.intoName };
  return pick;
}

/**
 * THE NAME A BILL'S PAYEE READS AS (Ledger Parity D9b, found drawing round 3, 2026-10-02).
 *
 * A bill stores its payee two ways: `payeeId` (a payee from the team's list) and `payeePayer` (the name as
 * it was typed when the bill was entered). Every screen printed the TEXT, so a rename or a merge — which
 * repoint and rename the listed payee, never the text — never reached a bill, and a bill pointing at a
 * payee with no text beside it (an import, the test fixture) showed an empty Payee. Worse, the bill window
 * then saved that empty field back on the next unrelated edit, and the payee was gone.
 *
 * The listed payee's CURRENT name wins; the typed text is only for a payee that was never chosen from the
 * list ("Use as one-time"). ⚠ Every display of a bill's payee — the bill window, the money form's seed and
 * its unchanged-check, the export — goes through here, so the screens cannot disagree about one bill.
 */
export function expensePayeeName(e: Pick<RepTeamExpense, 'payeeId' | 'payeePayer' | 'payeeName'>): string | null {
  return (e.payeeId && e.payeeName) || e.payeePayer || null;
}
