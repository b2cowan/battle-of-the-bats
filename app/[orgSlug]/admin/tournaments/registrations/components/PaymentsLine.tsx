'use client';
/**
 * PAYMENTS, ONE SLIM LINE ABOVE THE TEAM LIST (owner 2026-10-21) — the row Teams' "At a glance" card used to hold, without
 * the card and its heading around it. Health says HOW MANY teams owe; this line says how much, for the division the picker
 * is on, which nothing else on the page adds up. Closed by default and never remembered open; opened (in place) it is the
 * detail it always was: the collected bar, the figures, the due dates. One figure in three states (D12): past due in the
 * danger ink only once a date has passed, to collect in plain ink before, all in.
 *
 * It is absent where there is nothing to say: Tournament Plus and above (the payment tools), an event that tracks
 * payments, and a division with accepted teams (the page decides, and passes null otherwise).
 */
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { TEAMS_WORDS } from '@/lib/registration-words';
import { formatMoney, type FeeSchedule } from '@/lib/tournament-teams';
import GlanceRow from './GlanceRow';
import styles from '../teams-admin.module.css';

export interface PaymentSummary {
  scheduled: number;
  expected: number;
  collected: number;
  outstanding: number;
  depositRequired: number;
  depositComplete: number;
  paidInFull: number;
  pastDue: number;
  pastDueAmount: number;
}

export default function PaymentsLine({ divisionName, summary, fee, today }: {
  divisionName: string;
  summary: PaymentSummary;
  fee: FeeSchedule;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const { scheduled, expected, collected, outstanding, depositRequired, depositComplete, paidInFull, pastDue, pastDueAmount } = summary;
  const pctCollected = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const pctPaidTeams = scheduled > 0 ? Math.round((paidInFull / scheduled) * 100) : 0;
  const pctDeposits = depositRequired > 0 ? Math.round((depositComplete / depositRequired) * 100) : 0;
  const showDeposit = depositRequired > 0;
  const figure = pastDue > 0 ? TEAMS_WORDS.pastDue(formatMoney(pastDueAmount))
    : outstanding > 0 ? TEAMS_WORDS.toCollect(formatMoney(outstanding))
      : TEAMS_WORDS.allCollected;
  const dueDates: Array<{ label: string; date: string; overdue: boolean }> = [];
  if (showDeposit && fee.depositDueDate) {
    dueDates.push({ label: 'Deposit due', date: formatStoredDate(fee.depositDueDate, { withYear: false }), overdue: fee.depositDueDate < today });
  }
  if (fee.totalFeeDueDate) {
    dueDates.push({ label: showDeposit ? 'Balance due' : 'Payment due', date: formatStoredDate(fee.totalFeeDueDate, { withYear: false }), overdue: fee.totalFeeDueDate < today });
  }

  return (
    <div className={styles.payLine}>
      <GlanceRow
        title={TEAMS_WORDS.payments}
        caption={`${divisionName} · ${TEAMS_WORDS.paymentsIn(formatMoney(collected), formatMoney(expected))}`}
        figure={figure}
        figureBad={pastDue > 0}
        open={open}
        onToggle={() => setOpen(o => !o)}
      >
        <div className={styles.payProgress}>
          <div className={styles.payProgressTop}>
            <span className={styles.payProgressLabel}>Collected</span>
            <span className={styles.payProgressValue}>
              <strong>{formatMoney(collected)}</strong> of {formatMoney(expected)} · {pctCollected}%
            </span>
          </div>
          <div className={styles.payProgressTrack} role="progressbar" aria-valuenow={pctCollected} aria-valuemin={0} aria-valuemax={100} aria-label="Fees collected">
            <div className={styles.payProgressFill} style={{ width: `${pctCollected}%` }} />
          </div>
        </div>
        <div className={styles.payGrid} data-cols={showDeposit ? 4 : 3}>
          <div className={styles.glanceTile} data-tone={scheduled > 0 && paidInFull === scheduled ? 'good' : undefined}>
            <span>Paid in full</span>
            <strong>{paidInFull} / {scheduled}</strong>
            <small>{pctPaidTeams}% of teams</small>
          </div>
          {showDeposit && (
            <div className={styles.glanceTile} data-tone={depositComplete === depositRequired ? 'good' : undefined}>
              <span>Deposits in</span>
              <strong>{depositComplete} / {depositRequired}</strong>
              <small>{pctDeposits}% of teams</small>
            </div>
          )}
          <div className={styles.glanceTile}>
            <span>Outstanding</span>
            <strong>{formatMoney(outstanding)}</strong>
            <small>{outstanding > 0 ? 'still to collect' : 'all fees in'}</small>
          </div>
          <div className={styles.glanceTile} data-tone={pastDue > 0 ? 'danger' : 'good'}>
            <span>Past due</span>
            <strong>{formatMoney(pastDueAmount)}</strong>
            <small>{pastDue === 0 ? 'none overdue' : `${pastDue} team${pastDue === 1 ? '' : 's'} overdue`}</small>
          </div>
        </div>
        {dueDates.length > 0 && (
          <div className={styles.payDueDates}>
            {dueDates.map(d => (
              <span key={d.label} className={styles.payDueItem} data-overdue={d.overdue || undefined}>
                <CalendarClock size={12} aria-hidden />
                {d.label} {d.date}
              </span>
            ))}
          </div>
        )}
      </GlanceRow>
    </div>
  );
}
