'use client';
/**
 * "AT A GLANCE" — Teams' readouts as ONE section card of closed rows above the teams (Tournament admin
 * redesign Stage 2, T1: Q 6.1 ruled "reshape"; the /design review's D2, D4, D12). A white section with
 * its heading inside (16/700), so the rows read as facts ABOUT the list, not a second list of records:
 *
 *   Registration health — every division (RegistrationHealthPanel).
 *   Payments            — this division; one figure in three states; CLOSED by default and never
 *                         remembered open (today it opened at 287px on a phone and pushed the list down).
 *                         Tournament Plus and above (Club Stage 7's seam: fees reaching a club's ledger).
 *   Registration        — this division; expands in place to the switch under its consequence in one
 *                         sentence (a lone "Close" read as "close this panel", and closing asked nothing).
 *
 * The counts card that used to sit here is gone: each of its facts is said once elsewhere (the
 * Registration row's "6 of 6", each pool band's "3 of 3", the review band's count).
 */
import { useState, type ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import { RowAction } from '@/components/admin/kit/club/RepKit';
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

export default function TeamsGlance({ health, payments, registration }: {
  /** The health row, already built (it owns the demo tour's anchor), or null when it doesn't apply. */
  health: ReactNode;
  /** The division's money, or null (Tournament plan, or no fee set). */
  payments: { divisionName: string; summary: PaymentSummary; fee: FeeSchedule; today: string } | null;
  /** The division's registration switch, or null (no division, or a locked event). */
  registration: {
    divisionName: string;
    accepted: number;
    capacity: number | null;
    closed: boolean;
    busy: boolean;
    onToggle: () => void;
  } | null;
}) {
  if (!health && !payments && !registration) return null;
  return (
    <section className={styles.glance} aria-labelledby="teams-glance-heading">
      <h2 id="teams-glance-heading" className={styles.glanceHeading}>{TEAMS_WORDS.glance}</h2>
      {health}
      {payments && <PaymentsRow {...payments} />}
      {registration && <RegistrationRow {...registration} />}
    </section>
  );
}

function PaymentsRow({ divisionName, summary, fee, today }: { divisionName: string; summary: PaymentSummary; fee: FeeSchedule; today: string }) {
  const [open, setOpen] = useState(false);
  const { scheduled, expected, collected, outstanding, depositRequired, depositComplete, paidInFull, pastDue, pastDueAmount } = summary;
  const pctCollected = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const pctPaidTeams = scheduled > 0 ? Math.round((paidInFull / scheduled) * 100) : 0;
  const pctDeposits = depositRequired > 0 ? Math.round((depositComplete / depositRequired) * 100) : 0;
  const showDeposit = depositRequired > 0;
  // One figure in three states (D12): past due in the danger ink only once a date has passed (bad
  // news, the standard's one allowance for colour on a figure); to collect in plain ink before; all in.
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
    <div className={styles.glanceItem}>
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

function RegistrationRow({ divisionName, accepted, capacity, closed, busy, onToggle }: {
  divisionName: string; accepted: number; capacity: number | null; closed: boolean; busy: boolean; onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const spots = capacity == null ? TEAMS_WORDS.noLimit(accepted)
    : accepted >= capacity ? TEAMS_WORDS.spotsFull(accepted, capacity)
      : TEAMS_WORDS.spotsLeft(accepted, capacity);
  return (
    <div className={styles.glanceItem}>
      <GlanceRow
        title={closed ? TEAMS_WORDS.registrationClosed : TEAMS_WORDS.registrationOpen}
        caption={`${divisionName} · ${spots}`}
        open={open}
        onToggle={() => setOpen(o => !o)}
      >
        <p className={styles.glanceSentence}>{closed ? TEAMS_WORDS.closedSentence(divisionName) : TEAMS_WORDS.closeSentence(divisionName)}</p>
        <RowAction onClick={onToggle} disabled={busy}>
          {closed ? TEAMS_WORDS.reopenRegistration : TEAMS_WORDS.closeRegistration}
        </RowAction>
      </GlanceRow>
    </div>
  );
}
