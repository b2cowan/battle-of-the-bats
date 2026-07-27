import type { CoachTournamentStatus } from '@/lib/coach-status-model';
import type { CoachTournamentPhase } from '@/lib/coach-tournament-phase';
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
 * A3 "Status & Payment" zone — the ONE authoritative block for registration status, fee,
 * check-in, roster state, how-to-pay, and the single organizer-contact line on the record
 * page (the hero's fee preview/strip, checklist, and contact lines all folded in here —
 * approved mockups 2026-07-26). There is NO pay button anywhere — payment is
 * organizer-recorded (manual fee tracking only).
 *
 * Renders for every phase now, not just accepted: pending/waitlist get the decision row +
 * fee preview + "we'll email you" promise; rejected gets status + the reach-out line.
 */
export default function TournamentStatusBlock({
  phase,
  statusLabel,
  statusBadgeClass,
  status,
  contactEmail,
  showCheckIn,
  paymentInstructions,
  hideFeeRow = false,
  pendingFeeAmount = null,
  rosterPointer = false,
  waitlisted = false,
}: {
  phase: CoachTournamentPhase;
  /** Registration status pill (same source as the hero badge — one vocabulary). */
  statusLabel: string;
  statusBadgeClass: string;
  /** 5b status model — present for accepted teams only; null for pending/waitlist/rejected. */
  status: CoachTournamentStatus | null;
  contactEmail: string | null;
  showCheckIn: boolean;
  /**
   * The organizer's "how to pay" text (tournament settings → payment_instructions), shown
   * verbatim to an ACCEPTED coach who owes a fee. Null when unset or the fee is already paid.
   */
  paymentInstructions?: string | null;
  /**
   * WI-5 (security): hide every fee element for a money='off' assistant coach. The caller
   * already flattens `fee.hasSchedule` to false, which would otherwise render the "No fee set"
   * fallback — that reads as data ("this event is free"), so suppress the whole row instead.
   */
  hideFeeRow?: boolean;
  /** Pending-phase fee preview (moved from the hero) — "$N · due if accepted". */
  pendingFeeAmount?: number | null;
  /** Accepted + organizer requires a roster + none submitted yet → a pointer row that
   *  hands the coach to the Your Team zone (the actionable submit card lives there). */
  rosterPointer?: boolean;
  /** Waitlist shares the 'pending' phase — the Decision row must not promise a review
   *  turnaround to a team that's waiting for a SPOT, not a decision. */
  waitlisted?: boolean;
}) {
  const pendingLike = phase === 'pending';
  const rejected = phase === 'rejected';

  const fee = status?.fee ?? null;
  const paidDate = formatDate(fee?.collectedAt ?? null);
  const dueDate = formatDate(fee?.dueDate ?? null);
  const confirmedDate = formatDate(status?.roster.confirmedAt ?? null);
  const submittedDate = formatDate(status?.roster.submittedAt ?? null);

  // The fee-owed panels below already end with the contact mailto, so the standalone
  // "Questions?" line only renders when they don't — exactly ONE contact statement.
  const owed = Boolean(status && fee?.hasSchedule && !fee.isPaid && !hideFeeRow);

  return (
    <div className={styles.block} aria-label="Status and payment">
      <div className={styles.row}>
        <span className={styles.label}>Status</span>
        <div className={styles.value}>
          <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
        </div>
      </div>

      {pendingLike && (
        <>
          <div className={styles.row}>
            <span className={styles.label}>Decision</span>
            <div className={styles.value}>
              <span className={styles.muted}>
                {waitlisted
                  ? 'The organizer will reach out if a spot opens in your division'
                  : 'Awaiting organizer — usually within a few days'}
              </span>
            </div>
          </div>
          {!hideFeeRow && pendingFeeAmount != null && pendingFeeAmount > 0 && (
            <div className={styles.feePreview}>
              <span className={styles.feePreviewLabel}>Entry fee preview</span>
              <span className={styles.feePreviewAmount}>{formatMoney(pendingFeeAmount)} · due if accepted</span>
            </div>
          )}
          <p className={styles.note}>
            We&apos;ll email you the moment your status changes — your schedule and payment details appear here.
          </p>
        </>
      )}

      {status && !hideFeeRow && (
        <div className={styles.row}>
          <span className={styles.label}>Fee</span>
          <div className={styles.value}>
            {/* "No fee set" deliberately wins over a 'paid' state with no schedule (marking a free
                tournament paid is a non-action) — don't "fix" this to show Paid. */}
            {!fee!.hasSchedule ? (
              <span className={styles.muted}>No fee set by the organizer</span>
            ) : fee!.isPaid ? (
              <span className="badge badge-success">Paid{paidDate ? ` · ${paidDate}` : ''}</span>
            ) : (
              <>
                <span className="badge badge-warning">
                  Owed{fee!.amountDue != null ? ` · ${formatMoney(fee!.amountDue)}` : ''}
                </span>
                {dueDate && <span className={styles.due}>Due {dueDate}</span>}
              </>
            )}
          </div>
        </div>
      )}

      {status && showCheckIn && (
        <div className={styles.row}>
          <span className={styles.label}>Check-in</span>
          <div className={styles.value}>
            <span className={`badge ${CHECK_IN_BADGE[status.checkIn.state]}`}>{CHECK_IN_LABEL[status.checkIn.state]}</span>
          </div>
        </div>
      )}

      {status && (status.roster.state !== 'none' ? (
        <div className={styles.row}>
          <span className={styles.label}>Roster</span>
          <div className={styles.value}>
            {status.roster.state === 'confirmed' ? (
              <span className="badge badge-success">Confirmed{confirmedDate ? ` · ${confirmedDate}` : ''}</span>
            ) : (
              <span className="badge badge-info">Submitted{submittedDate ? ` · ${submittedDate}` : ''}</span>
            )}
          </div>
        </div>
      ) : rosterPointer ? (
        <div className={styles.row}>
          <span className={styles.label}>Roster</span>
          <div className={styles.value}>
            <span className={styles.muted}>Not submitted — see Your Team below</span>
          </div>
        </div>
      ) : null)}

      {owed && (
        paymentInstructions ? (
          // How-to-pay detail — the organizer's instructions, verbatim.
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

      {/* THE one contact line (A3). Rejected keeps its softer reach-out copy (moved from the
          hero); everyone else gets "Questions?" — skipped while the owed panels above carry it. */}
      {rejected && contactEmail && (
        <p className={styles.note}>
          Interested in another division or a future event? Reach out to{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      )}
      {!rejected && !owed && contactEmail && (
        <p className={styles.note}>
          Questions? <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      )}
    </div>
  );
}
