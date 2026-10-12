'use client';
/**
 * THE TEAM'S BUDGET READS THE CLUB'S BILL (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimen 14 step 6; Ask 25,
 * narrowed by build question A; D1: the club never writes a team's book).
 *
 * A club schedule's bill (split `time`, made at Finalize) arrives filed under the club line's word ONLY where the team's
 * budget already has a line under that platform word (build question A). Where the coach's own plan for that word
 * differs from the bill, ONE white callout with the olive edge says so once: "The club billed 15U AAA $2,700.00 for
 * Dome Time · Your plan says $10,000.00 for it." · **Keep mine** · **Use $2,700.00**. Use is the COACH's press writing
 * the COACH's own line (D1); either answer clears it. The line itself names the club's bill and its payments under the
 * word, and its Planned cell carries "the club's bill $2,700.00" — so the plan reads where a figure came from.
 *
 * Keep mine is the portal's one dismiss idiom (`useCoachNudgeDismiss`, per team and per bill figure): a later
 * correction (a new figure) asks again. ⚠ DEPARTURE: the drawing's "was your $10,000.00" after Use is said once in the
 * Budget's own notice, not stored on the line (a line has no field for a remembered figure, and writing it into the
 * coach's notes would be the club writing the coach's words).
 */
import { useState } from 'react';
import { useCoachNudgeDismiss } from './useCoachNudgeDismiss';
import own from './ClubSlot.module.css';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { fmt } from '@/lib/coach-money-summary';
import { isFundingKind } from '@/lib/coach-budget-totals';
import { formatStoredDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { SCHEDULE_COACH_WORDS as C } from '@/lib/club-schedule-words';

/** A club bill as the coach's allocations read returns it (the fields this needs). */
export interface ClubBillSplit {
  id: string; amount: number; splitMethod: string; budgetItemId: string | null; budgetItemName: string | null;
  allocationDescription: string; installments: { dueDate: string; amount: number }[];
}
/** A budget line as the Budget reads it (the fields this needs). */
export interface PlanLine { id: string; itemId: string | null; description: string; totalAmount: number; lineKind: string }

export interface ClubBillOnLine {
  itemId: string;
  lineId: string;
  word: string;
  /** What the club's schedule bills, in dollars, summed over its bills under the word (a correction adds to it). */
  amount: number;
  plan: number;
  /** "The club's bill: Winter dome · Sundays · $2,700.00 in 3 payments (Oct 1, Dec 1, Feb 1)". */
  caption: string;
}

/** Each word the club's SCHEDULE bills the team under, against the line the team's plan has for it. */
export function clubBillsOnLines(splits: readonly ClubBillSplit[], lines: readonly PlanLine[]): ClubBillOnLine[] {
  const byItem = new Map<string, ClubBillSplit[]>();
  for (const s of splits) {
    if (s.splitMethod !== 'time' || !s.budgetItemId) continue;
    (byItem.get(s.budgetItemId) ?? byItem.set(s.budgetItemId, []).get(s.budgetItemId)!).push(s);
  }
  const out: ClubBillOnLine[] = [];
  for (const [itemId, list] of byItem) {
    // A bill is something the team PAYS, so it lands on a cost line, never one that brings money in.
    const line = lines.find(l => l.itemId === itemId && !isFundingKind(l.lineKind));
    if (!line) continue;
    const cents = list.reduce((n, s) => n + Math.round(s.amount * 100), 0);
    const dues = [...new Set(list.flatMap(s => s.installments.map(i => i.dueDate)))].sort();
    const first = list[0];
    out.push({
      itemId, lineId: line.id, word: first.budgetItemName ?? line.description, amount: cents / 100, plan: line.totalAmount,
      caption: C.budgetLineBill(first.allocationDescription, fmt(cents / 100),
        `${pluralize(dues.length, 'payment')}${dues.length ? ` (${dues.map(d => formatStoredDate(d, { withYear: false })).join(', ')})` : ''}`),
    });
  }
  return out;
}

export default function ClubBillBudgetCallout({ teamId, teamName, bill, canWrite, onUse }: {
  teamId: string;
  teamName: string;
  bill: ClubBillOnLine;
  canWrite: boolean;
  /** The coach's press: write the coach's own line to the club's figure. Resolves with an error sentence, or null. */
  onUse: (bill: ClubBillOnLine) => Promise<string | null>;
}) {
  const { dismissed, dismiss } = useCoachNudgeDismiss(teamId, `club-bill:${bill.itemId}:${Math.round(bill.amount * 100)}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (dismissed || !canWrite || Math.abs(bill.amount - bill.plan) < 0.005) return null;
  return (
    <div className={own.budgetCall} role="status">
      <div className={own.budgetCallBody}>
        <b>{C.budgetCallTitle(teamName, fmt(bill.amount), bill.word)}</b>
        <span>{C.budgetCallBody(fmt(bill.plan))}</span>
        {error && <span className={styles.errorText} role="alert">{error}</span>}
      </div>
      <div className={own.budgetCallActions}>
        <button type="button" className="btn btn-outline btn-sm" onClick={dismiss} disabled={busy}>{C.budgetKeep}</button>
        <button type="button" className="btn btn-lime btn-sm" disabled={busy}
          onClick={async () => {
            setBusy(true); setError('');
            const failed = await onUse(bill);
            setBusy(false);
            if (failed) setError(failed);
          }}>
          {C.budgetUse(fmt(bill.amount))}
        </button>
      </div>
    </div>
  );
}
