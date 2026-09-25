'use client';
import Link from 'next/link';
import { CalendarDays, ChevronRight, NotebookPen } from 'lucide-react';
import { formatInOrgZone } from '@/lib/timezone';
import { formatStoredClock } from '@/lib/utils';
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
  const fit = planFit(startsAt, endsAt, plan, record);
  // The day and the clock share one line on a desktop; the phone stacks them (the frame's 390).
  const when = (
    <span className={styles.ppDocWhenLine}>
      <span className={styles.ppDocWhenDay}>{withYear ? fmtDate(startsAt) : fmtDay(startsAt)}</span>
      <span className={styles.ppDocWhenSep}> · </span>
      {fmtTime(startsAt)}
      {fit.length != null && endsAt ? `–${fmtTime(endsAt)} · ${fit.length} min` : ''}
      {where ? ` · ${where}` : ''}
    </span>
  );
  if (fit.why) {
    return (
      <>
        {when}
        {fit.planned} · {fit.why}
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
      {fit.planned}
      {fit.remainder && <> · <span className={fit.tone}>{fit.remainder}</span></>}
    </>
  );
}

/**
 * How the plan fills the practice — the when-line's second half, shared by the desk line and the
 * phone door so the two can never word it differently: "75 of 90 min planned · 15 rest of
 * practice", or, with no usable end, "20 min planned" and the reason (`why`).
 */
function planFit(startsAt: string, endsAt: string | null | undefined, plan: PracticePlan, record: boolean) {
  const length = practiceLengthMinutes(startsAt, endsAt ?? null);
  const fit = practicePlanFit(plan, length);
  const planned = practicePlannedLabel(fit, { record });
  // Without an end the frame cannot be drawn; the fix is on the schedule. An end that IS set but
  // sits at or before the start is said so — "no end set" would be a lie about a field the coach
  // can see filled (/review, 2026-09-14).
  const why = length == null ? (endsAt ? 'the end is before the start' : 'no end set') : null;
  return {
    length, planned, why,
    remainder: why ? null : practiceRemainderLabel(fit),
    // Unplanned time and an overrun are both worth a coach's eye; the rest block is spoken for.
    tone: fit.remainder?.kind === 'rest' ? undefined : styles.ppDocWhenAmber,
  };
}

/**
 * THE SHEET'S HEAD ON A PHONE (practice plans on a phone, stage 4 · N1 = A, owner 2026-09-25) — one
 * door to the schedule where the desk has the when-line and a "View on schedule" link of its own.
 * Line 1 the day and the time together; line 2 WHERE, and when to arrive — the page never said
 * either, though the printed sheet and the notification both do; line 3 how the plan fills the
 * practice, in the desk's words. The whole block is the link, a chevron says so, and its accessible
 * name starts "View on schedule". A record states the place and no arrival: an arrival time is an
 * instruction, and a record has nobody to instruct.
 * ⚠ The desk's "Set it on the schedule ›" is itself a link and cannot sit inside this one; on a
 * phone the block IS that door, so the fit line keeps only its words.
 */
export function PracticeWhenDoor({
  startsAt, endsAt, plan, record, href, place, arrivalTime,
}: {
  startsAt: string;
  endsAt: string | null | undefined;
  plan: PracticePlan;
  record: boolean;
  /** The practice on the schedule. */
  href: string;
  /** Where — `practicePlaceLabel`, the paper's own join. Empty when the schedule has none. */
  place: string;
  /** The schedule's stored "HH:mm", or null. Never shown on a record. */
  arrivalTime: string | null | undefined;
}) {
  const fit = planFit(startsAt, endsAt, plan, record);
  const arrive = !record && arrivalTime ? `Arrive by ${formatStoredClock(arrivalTime)}` : null;
  /* ⚠ A clock never breaks across lines ("Arrive by 5:45 / p.m." — measured at 360 on the first
     build): every piece that carries a time or a count is its own no-wrap bit, so a line breaks at a
     "·" between pieces. The place alone may wrap — a long park name must not push the page sideways.
     The chevron sits beside the FIRST line only, so the two lines under it get the column's whole
     width (with it beside all three, "75 of 90 min planned · 15 rest of practice" wrapped at 360). */
  return (
    <Link href={href} className={`${styles.ppDocHead} ${styles.ppWhenDoor}`} data-testid="practice-when">
      <span className={styles.ppDocWhen}>
        <span className="sr-only">View on schedule: </span>
        <span className={styles.ppDocWhenLine}>
          {fmtDay(startsAt)} · <span className={styles.ppWhenBit}>{fmtTime(startsAt)}{fit.length != null && endsAt ? `–${fmtTime(endsAt)}` : ''}</span>
        </span>
        {/* A space between the lines: they are blocks on screen, but the link's accessible name is
            their text run together ("7:30 p.m.UAT Fields") without one. It renders nothing. */}
        {' '}
        {(place || arrive) && (
          <span className={styles.ppWhenLine}>
            {place}{place && arrive ? ' · ' : ''}{arrive && <span className={styles.ppWhenBit}>{arrive}</span>}
          </span>
        )}
        {' '}
        <span className={styles.ppWhenLine}>
          <span className={styles.ppWhenBit}>{fit.planned}</span>
          {fit.why ? <> · <span className={styles.ppWhenBit}>{fit.why}</span></>
            : fit.remainder ? <> · <span className={`${styles.ppWhenBit}${fit.tone ? ` ${fit.tone}` : ''}`}>{fit.remainder}</span></> : null}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden className={styles.ppWhenDoorChevron} />
    </Link>
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
 * ⚠ **ABOUT THE PRACTICE, NEVER ABOUT A CHILD** — D17's hard guardrail. The placeholder steers
 * away from names (the helper line that also did was removed at the §227 walk, owner 2026-09-23),
 * there is deliberately no per-player equivalent, and none may be added: per-child commentary
 * would drift into behavioural profiling on minors.
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
          {/* Only the autosave's word, and only while it has one — the standing disclaimers under
              the box were removed at the §227 walk (owner, 2026-09-23); the placeholder alone now
              carries D17's steer. The live region stays mounted so the word is announced. */}
          <span className={styles.formHint} aria-live="polite">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
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
