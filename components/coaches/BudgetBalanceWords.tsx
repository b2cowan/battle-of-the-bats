/**
 * The words a BALANCE is described in, shared by every surface that speaks them (owner ruling F,
 * 2026-09-13: the Set-dues sheet now says what a schedule does to the plan wherever it is opened,
 * so the Budget plan's own sentence builders moved out of the panel to be read by both).
 *
 * ⚠ ONE SPELLING: "September 2026 closes ($1,533.00)" is the status line's, the extra-expense
 * preview's and the Set-dues sheet's one way of naming the first month below zero — three
 * surfaces, one phrase, so a wording change lands on all of them or none.
 */
import type { ReactNode } from 'react';
import { formatMonthLong } from '@/lib/coach-budget-months';
import { fmt as fmtSigned } from '@/lib/coach-money-summary';
import type { PeriodBalance } from '@/lib/coach-budget-periods-view';

/** "September 2026 closes ($1,533.00)" — the shortfall, said ONE way. */
export function shortfallPhrase(shortfall: NonNullable<PeriodBalance['shortfall']>): string {
  return `${formatMonthLong(shortfall.monthKey)} closes ${fmtSigned(-shortfall.amount)}`;
}

/** The clause a before → after sentence ends on: the first month below zero, or the all-clear. */
export function closingClause(balance: PeriodBalance, suffix = ''): ReactNode {
  if (balance.shortfall) return <>; <strong>{shortfallPhrase(balance.shortfall)}</strong>{suffix}.</>;
  return balance.months.length > 0 ? '; every month stays at or above zero.' : '.';
}

/**
 * "On the plan: season closing $1,000 → $1,000; September 2026 closes ($1,000)." — what a
 * previewed dues schedule does to the plan, from the plan built WITHOUT it and the plan built WITH
 * it. `kept` names the schedules a run leaves as they are, which are not in the draft.
 */
export function onThePlanSentence(before: PeriodBalance, after: PeriodBalance, kept: number): ReactNode {
  return (
    <>
      <strong>On the plan:</strong> season closing {fmtSigned(before.seasonClosing)} → <strong>{fmtSigned(after.seasonClosing)}</strong>
      {closingClause(after)}
      {kept > 0 && <> The {kept === 1 ? 'schedule' : `${kept} schedules`} being kept {kept === 1 ? 'is' : 'are'} not in the draft.</>}
    </>
  );
}
