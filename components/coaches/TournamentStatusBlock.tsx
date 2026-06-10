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
}: {
  status: CoachTournamentStatus;
  contactEmail: string | null;
  showCheckIn: boolean;
}) {
  const { fee, checkIn, roster } = status;
  const paidDate = formatDate(fee.collectedAt);
  const dueDate = formatDate(fee.dueDate);
  const confirmedDate = formatDate(roster.confirmedAt);
  const submittedDate = formatDate(roster.submittedAt);

  return (
    <div className={styles.block} aria-label="Your status">
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

      {fee.hasSchedule && !fee.isPaid && (
        <p className={styles.note}>
          Your organizer records payment manually
          {contactEmail ? (
            <> — contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a> to arrange.</>
          ) : (
            '.'
          )}
        </p>
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
