import type { CoachTournamentStatus } from '@/lib/coach-status-model';
import type { CoachTournamentPhase } from '@/lib/coach-tournament-phase';
import { formatMoney } from '@/lib/coach-register';
import { formatStoredDate } from '@/lib/timezone';
import styles from './TournamentRegistrationCard.module.css';

/**
 * Registration — ONE card on the coach's tournament page (Club Tier Stage 7d, drawing 7, T4): the
 * entry's Fee, Check-in, Questions and Registered, as a label/value list. It replaced the A3 "Status
 * & Payment" block: the status left for the chip under the page title (no second "Accepted"), and
 * every date reads in one short form on the CLUB's clock (`formatStoredDate` — a timestamp resolves
 * through the org zone, so an evening entry never reads as the next day; T7).
 *
 * There is NO pay button — payment is organizer-recorded. Fee rows are hidden exactly as before: for a
 * money-off assistant and a tournament that does not track payments (`hideFeeRow`), and the club's
 * own team owes nothing (`clubOwnTeam`).
 */

const money = formatMoney;

const short = (value: string | null | undefined) => (value ? formatStoredDate(value, { withYear: false }) : null);

/** The Fee row's words — "$475.00 · paid Sep 12", "Deposit paid · $375.00 owing", "No fee · your club's team". */
function registrationFeeWords(
  fee: CoachTournamentStatus['fee'] | null,
  opts: { clubOwnTeam: boolean; pendingFeeAmount: number | null },
): string | null {
  if (opts.clubOwnTeam) return 'No fee · your club’s team';
  if (!fee) return opts.pendingFeeAmount != null && opts.pendingFeeAmount > 0 ? `${money(opts.pendingFeeAmount)} · due if accepted` : null;
  if (!fee.hasSchedule) return 'No fee set by the organizer';
  if (fee.isPaid) {
    const paid = short(fee.collectedAt);
    return [fee.totalFee != null ? money(fee.totalFee) : null, paid ? `paid ${paid}` : 'paid'].filter(Boolean).join(' · ');
  }
  const owing = fee.amountDue != null ? `${money(fee.amountDue)} owing` : 'Owing';
  if (fee.state === 'deposit-paid') return `Deposit paid · ${owing}`;
  const due = short(fee.dueDate);
  return due ? `${owing} · due ${due}` : owing;
}

const CHECK_IN_WORDS: Record<string, string> = {
  not_arrived: 'Not checked in yet',
  checked_in: 'Checked in',
  no_show: 'Marked no-show',
};

export default function TournamentRegistrationCard({
  phase,
  status,
  contactEmail,
  showCheckIn,
  registeredAt,
  paymentInstructions,
  hideFeeRow = false,
  clubOwnTeam = false,
  pendingFeeAmount = null,
  rosterPointer = false,
  waitlisted = false,
}: {
  phase: CoachTournamentPhase;
  /** 5b status model — accepted teams only; null for pending/waitlist/rejected. */
  status: CoachTournamentStatus | null;
  /** The organizer's contact for coaches, or null when they hid it. */
  contactEmail: string | null;
  showCheckIn: boolean;
  registeredAt: string | null;
  /** The organizer's "how to pay" text, shown to an ACCEPTED coach who owes. */
  paymentInstructions?: string | null;
  /** WI-5 + "not tracked here": no Fee row at all (a "No fee set" line would read as data). */
  hideFeeRow?: boolean;
  clubOwnTeam?: boolean;
  /** Pending phase: the organizer's scheduled fee, "due if accepted". */
  pendingFeeAmount?: number | null;
  /** Accepted, the organizer requires a roster, none submitted — the submit card is below. */
  rosterPointer?: boolean;
  /** Waitlist shares the 'pending' phase; its decision row must not promise a review turnaround. */
  waitlisted?: boolean;
}) {
  const pendingLike = phase === 'pending';
  const rejected = phase === 'rejected';
  const fee = status?.fee ?? null;
  const feeWords = hideFeeRow ? null : registrationFeeWords(fee, { clubOwnTeam, pendingFeeAmount });
  const owed = Boolean(status && fee?.hasSchedule && !fee.isPaid && !hideFeeRow && !clubOwnTeam);

  const checkIn = status && showCheckIn
    ? [CHECK_IN_WORDS[status.checkIn.state], status.checkIn.state === 'checked_in' ? short(status.checkIn.checkedInAt) : null].filter(Boolean).join(' ')
    : null;
  const roster = status
    ? status.roster.state === 'confirmed' ? ['Confirmed', short(status.roster.confirmedAt)].filter(Boolean).join(' ')
      : status.roster.state === 'submitted' ? ['Submitted', short(status.roster.submittedAt)].filter(Boolean).join(' ')
        : rosterPointer ? 'Not submitted yet' : null
    : null;

  return (
    <section className={styles.card} aria-labelledby="registration-heading">
      <h2 id="registration-heading" className={styles.heading}>Registration</h2>
      <dl className={styles.rows}>
        {pendingLike && (
          <div className={styles.row}>
            <dt>Decision</dt>
            <dd>{waitlisted ? 'The organizer will reach out if a spot opens in your division' : 'Awaiting organizer — usually within a few days'}</dd>
          </div>
        )}
        {feeWords && (
          <div className={styles.row}>
            <dt>Fee</dt>
            <dd>{feeWords}</dd>
          </div>
        )}
        {checkIn && (
          <div className={styles.row}>
            <dt>Check-in</dt>
            <dd>{checkIn}</dd>
          </div>
        )}
        {roster && (
          <div className={styles.row}>
            <dt>Roster</dt>
            <dd>{roster}</dd>
          </div>
        )}
        {contactEmail && (
          <div className={styles.row}>
            <dt>Questions</dt>
            <dd><a className={styles.contact} href={`mailto:${contactEmail}`}>{contactEmail}</a></dd>
          </div>
        )}
        {registeredAt && (
          <div className={styles.row}>
            <dt>Registered</dt>
            <dd>{short(registeredAt)}</dd>
          </div>
        )}
      </dl>

      {owed && (
        <div className={styles.pay}>
          {paymentInstructions && <p className={styles.payInstructions}>{paymentInstructions}</p>}
          <p className={styles.note}>Your organizer records payment manually.</p>
        </div>
      )}
      {pendingLike && (
        <p className={styles.note}>We&apos;ll email you the moment your status changes — your schedule and payment details appear here.</p>
      )}
      {rejected && contactEmail && (
        <p className={styles.note}>Interested in another division or a future event? Reach out to the organizer.</p>
      )}
    </section>
  );
}
