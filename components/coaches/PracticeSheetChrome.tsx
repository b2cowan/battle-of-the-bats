'use client';
import Link from 'next/link';
import { CalendarDays, NotebookPen } from 'lucide-react';
import { formatInOrgZone } from '@/lib/timezone';
import {
  practiceLengthMinutes, practicePlanFit, practicePlannedLabel, practiceRemainderLabel,
} from '@/lib/practice-state';
import { MAX_RECAP_LEN, type PracticePlan } from '@/lib/rep-practice-plan';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The sheet's CHROME — its first line and its "How it went" block — shared by the plan page (live,
 * and as a finished practice's record) and the closed-season reader (practices re-evaluation
 * stage 6, owner rulings R2 · R3 · R5, 2026-09-18). One document, three modes: the pieces the
 * editor does not own live here once, so the record's face on a live team and on a finished
 * season cannot drift on a word.
 */

const fmtTime = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
/** "Tue, May 5" — the live sheet's first line, which is about THIS week, not a year. */
const fmtDay = (iso: string) => formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' });
/** "Tue, May 5, 2026" — a record from another season must say which year. */
const fmtDate = (iso: string) => formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/**
 * The sheet's first line (stage 1, D3) — when and how long, then how the plan fills it:
 *   · no end → "20 min planned · no end set" — and, LIVE, "· Set it on the schedule ›"
 *   · an end → "0 of 120 min planned · 120 unplanned" (the remainder in amber)
 * On a RECORD (R2) the line is a fact: no schedule link (a record does not ask for an end), and
 * "Nothing planned" without its "yet". `withYear` for a finished season's reader (the year matters
 * there and nowhere else); `where` for the reader, which has no schedule to point at.
 */
export function PracticeWhenLine({
  startsAt, endsAt, plan, record, scheduleHref, withYear, where,
}: {
  startsAt: string | null | undefined;
  endsAt: string | null | undefined;
  plan: PracticePlan;
  /** The practice is a record — a fact, no invitation. */
  record: boolean;
  /** The LIVE page's way to fix a missing end; never passed on a record. */
  scheduleHref?: string;
  withYear?: boolean;
  where?: string | null;
}) {
  if (!startsAt) return <span className={styles.ppDocWhenLine}>Plan this practice.</span>;
  const practiceLength = practiceLengthMinutes(startsAt, endsAt ?? null);
  const fit = practicePlanFit(plan, practiceLength);
  const remainderLabel = practiceRemainderLabel(fit);
  // Unplanned time and an overrun are both worth a coach's eye; the rest block is spoken for.
  const remainderTone = fit.remainder?.kind === 'rest' ? undefined : styles.ppDocWhenAmber;
  // The day and the clock share one line on a desktop; the phone stacks them (the frame's 390).
  const when = (
    <span className={styles.ppDocWhenLine}>
      <span className={styles.ppDocWhenDay}>{withYear ? fmtDate(startsAt) : fmtDay(startsAt)}</span>
      <span className={styles.ppDocWhenSep}> · </span>
      {fmtTime(startsAt)}
      {practiceLength != null && endsAt ? `–${fmtTime(endsAt)} · ${practiceLength} min` : ''}
      {where ? ` · ${where}` : ''}
    </span>
  );
  if (practiceLength == null) {
    // Without an end the frame cannot be drawn; the fix is on the schedule. An end that IS set
    // but sits at or before the start is said so — "no end set" would be a lie about a field
    // the coach can see filled (/review, 2026-09-14).
    const why = endsAt ? 'the end is before the start' : 'no end set';
    return (
      <>
        {when}
        {practicePlannedLabel(fit, { record })} · {why}
        {!record && scheduleHref && (
          <>
            {' · '}
            <Link href={scheduleHref} className={styles.ppDocWhenLink}>
              {endsAt ? 'Fix it on the schedule ›' : 'Set it on the schedule ›'}
            </Link>
          </>
        )}
      </>
    );
  }
  return (
    <>
      {when}
      {practicePlannedLabel(fit, { record })}
      {remainderLabel && <> · <span className={remainderTone}>{remainderLabel}</span></>}
    </>
  );
}

/** The "View on schedule" link in the sheet's head — the live page's; the reader has none. */
export function PracticeScheduleLink({ href }: { href: string }) {
  return (
    <Link href={href} className={styles.ppDocHeadLink}>
      <CalendarDays size={12} aria-hidden /> View on schedule
    </Link>
  );
}

/**
 * "How it went" (D17, frame 07) — the ONE thing on a practice's page allowed to say what happened,
 * and it earns that because a coach sat down at home and typed it. On the live page it renders at
 * the sheet's FOOT once the practice has started (stage 1, D7; stage 6, R3 kept the start); on a
 * record it renders FIRST, under the head (R2) — the same block, one component, the page decides
 * where. The closed-season reader mounts it read-only for everyone (R5): a closed season is a
 * record, and writing into it is the one thing the whole ruling forbids.
 *
 * ⚠ **ABOUT THE PRACTICE, NEVER ABOUT A CHILD** — D17's hard guardrail. The placeholder and the
 * helper line both steer away from names, there is deliberately no per-player equivalent, and
 * none may be added: per-child commentary would drift into behavioural profiling on minors.
 *
 * ⚠ This does NOT reopen D4. An unhurried note written at home is a different act from an
 * abandoned tick-box mid-drill — nothing at the field records anything, and there are still no
 * per-block "we ran it" ticks. Silence is stated, never rendered blank.
 */
export function HowItWent({
  recap, onChange, status, error, first,
}: {
  recap: string;
  /** Absent = read: a viewer, or anyone on a finished season. */
  onChange?: (next: string) => void;
  /** The autosave's word under the box — the page's own state (`recapDirty`/`recapSaved`). */
  status?: 'saving' | 'saved' | 'idle';
  /** A failed save, said under the box — on a record the page's floating pill is not there to say it. */
  error?: string;
  /** FIRST on the record (under the head, above the sheet) rather than at the foot. */
  first?: boolean;
}) {
  return (
    <div className={first ? styles.ppDocRecap : styles.ppDocFoot} data-testid="how-it-went">
      <h2 className={styles.ppRecordedTitle}><NotebookPen size={15} aria-hidden /> How it went</h2>
      <p className={styles.formHint}>For you and your staff. Families never see this.</p>
      {onChange ? (
        <label className={styles.ppField}>
          <span className="sr-only">How it went</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={recap}
            maxLength={MAX_RECAP_LEN}
            placeholder="What would you do differently next time?"
            aria-label="How it went"
            onChange={e => onChange(e.target.value)}
          />
          <span className={styles.formHint} aria-live="polite">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved · about the practice, not about a player'
              : 'About the practice, not about a player'}
          </span>
          {error && <span className={styles.errorText} role="alert">{error}</span>}
        </label>
      ) : recap ? (
        <p className={styles.ppReadTxt}>{recap}</p>
      ) : (
        // ⚠ Silence is stated, never rendered blank — a practice with nothing written must not
        // read as a practice where nothing happened.
        <p className={styles.ppRecapNone}>Nothing written down for this one.</p>
      )}
    </div>
  );
}

/** A record with no plan: one sentence, the reader's own (R2 · R5), where the sheet would be. */
export function NoPlanRecord() {
  return <p className={styles.ppRecordNone} data-testid="no-plan-record">No plan was written for this practice.</p>;
}
