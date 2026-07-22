import type { CoachTournamentStatus } from '@/lib/coach-status-model';
import styles from './TournamentStatusBlock.module.css';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  // Date-only (YYYY-MM-DD) values (due dates) render as the literal calendar day via T00:00:00.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    return new Date(value + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Timestamps (paid / submitted / confirmed) render in the app's assumed timezone
  // (America/Toronto) so an evening event shows the calendar day a Canadian user expects,
  // not the UTC server day.
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' });
}

const CHECK_IN_LABEL: Record<string, string> = {
  not_arrived: 'Not arrived',
  checked_in:  'Checked in',
  no_show:     'No-show',
};

const CHECK_IN_BADGE: Record<string, string> = {
  not_arrived: 'badge-info',
  checked_in:  'badge-success',
  no_show:     'badge-danger',
};

/**
 * Read-only payment / check-in / roster status for a coach's tournament record.
 * There is NO pay button anywhere — payment is organizer-recorded (manual fee
 * tracking only); the coach is shown where they stand and who to contact.
 *
 * Phase 5b is read-only status reporting: the roster line shows positive state
 * (Submitted / Confirmed) only, never a "submit your roster" prompt — the
 * requirement-driven checklist arrives with organizer roster requirements (5f/5k).
 */
export default function TournamentStatusBlock({
  status,
  contactEmail,
  showCheckIn,
  paymentInstructions,
  hideFeeRow = false,
}: {
  status: CoachTournamentStatus;
  contactEmail: string | null;
  showCheckIn: boolean;
  /**
   * The organizer's "how to pay" text (tournament settings → payment_instructions), shown
   * verbatim to an ACCEPTED coach who owes a fee. This is the DETAIL layer the hero fee strip
   * deliberately withholds (per the coach-surface addendum: strip = the glance alert, block =
   * how much / by when / the process). Null when unset or the fee is already paid.
   */
  paymentInstructions?: string | null;
  /**
   * WI-5 (security): hide the Fee row entirely for a money='off' assistant coach. The caller
   * already flattens `fee.hasSchedule` to false, which would otherwise render the "No fee set"
   * fallback — that reads as data ("this event is free"), so suppress the whole row instead.
   */
  hideFeeRow?: boolean;
}) {
  const { fee, checkIn, roster } = status;
  const paidDate = formatDate(fee.collectedAt);
  const dueDate = formatDate(fee.dueDate);
  const confirmedDate = formatDate(roster.confirmedAt);
  const submittedDate = formatDate(roster.submittedAt);

  return (
    <div className={styles.block} aria-label="Your status">
      {!hideFeeRow && (
      <div className={styles.row}>
        <span className={styles.label}>Fee</span>
        <div className={styles.value}>
          {/* "No fee set" deliberately wins over a 'paid' state with no schedule (marking a free
              tournament paid is a non-action) — don't "fix" this to show Paid. */}
          {!fee.hasSchedule ? (
            <span className={styles.muted}>No fee set by the organizer</span>
          ) : fee.isPaid ? (
            <span className="badge badge-success">Paid{paidDate ? ` · ${paidDate}` : ''}</span>
          ) : (
            <>
              <span className="badge badge-warning">
                Owed{fee.amountDue != null ? ` · ${formatMoney(fee.amountDue)}` : ''}
              </span>
              {dueDate && <span className={styles.due}>Due {dueDate}</span>}
            </>
          )}
        </div>
      </div>
      )}

      {fee.hasSchedule && !fee.isPaid && (
        paymentInstructions ? (
          // How-to-pay detail. The hero strip only signals THAT a fee is owed; this panel is
          // where the coach learns HOW to pay it — the organizer's instructions, verbatim.
          <div className={styles.payPanel}>
            <p className={styles.payPanelLabel}>How to pay</p>
            <p className={styles.payInstructions}>{paymentInstructions}</p>
            <p className={styles.payNote}>
              Your organizer records payment manually.
              {contactEmail && (
                <> Questions? <a href={`mailto:${contactEmail}`}>{contactEmail}</a></>
              )}
            </p>
          </div>
        ) : (
          <p className={styles.note}>
            Your organizer records payment manually
            {contactEmail ? (
              <> — contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a> to arrange.</>
            ) : (
              '.'
            )}
          </p>
        )
      )}

      {showCheckIn && (
        <div className={styles.row}>
          <span className={styles.label}>Check-in</span>
          <div className={styles.value}>
            <span className={`badge ${CHECK_IN_BADGE[checkIn.state]}`}>{CHECK_IN_LABEL[checkIn.state]}</span>
          </div>
        </div>
      )}

      {roster.state !== 'none' && (
        <div className={styles.row}>
          <span className={styles.label}>Roster</span>
          <div className={styles.value}>
            {roster.state === 'confirmed' ? (
              <span className="badge badge-success">Confirmed{confirmedDate ? ` · ${confirmedDate}` : ''}</span>
            ) : (
              <span className="badge badge-info">Submitted{submittedDate ? ` · ${submittedDate}` : ''}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
