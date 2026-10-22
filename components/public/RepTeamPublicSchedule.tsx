import { Navigation } from 'lucide-react';
import styles from './RepTeamPublicSchedule.module.css';
import kit from './ClubKit.module.css';
import {
  directionsHref,
  scheduleDayLabel,
  scheduleResultTone,
  scheduleRowTitle,
  scheduleScoreText,
  scheduleTimeLabel,
} from '@/lib/family-schedule-format';
import type { FamilyScheduleEntry, FamilyTeamView } from '@/lib/family-view';
import TeamSubscribeButton from './TeamSubscribeButton';
import { splitPublicSchedule } from '@/lib/club-team-page';

/**
 * The standing public team schedule (Chunk D 1.9).
 *
 * Rendered on the org's public team page ONLY when the coach has set schedule visibility
 * to "Public link" — the caller does that check by asking `getFamilyTeamView` for
 * `public_link`, so this component can never be the thing that decides. It receives a
 * view or it isn't rendered.
 *
 * Team-level forever: the DTO it consumes has no player field, so there is nothing here
 * that could name a child even by mistake.
 */

/** The club frame's rendering of a result tone (green = the club's one status green). The warm consumer view maps the
 *  same tone to its own tokens — the LABELS are shared, the palettes deliberately are not. */
const TONE_CLASS: Record<'win' | 'loss' | 'neutral', string> = {
  win: styles.scoreWin,
  loss: styles.scoreLoss,
  neutral: '',
};

/**
 * One event (Club Tier Stage 4b-2a, the one calendar recipe C5/C8): the date and time lead as plain text, then what and
 * where. Up next is marked by the club's edge and its words (C7) and carries Directions as its own 44 px button; a
 * cancelled event stays, struck through, with its Cancelled chip (C9); a played game shows its score.
 */
function Row({ entry }: { entry: FamilyScheduleEntry }) {
  const cancelled = entry.status === 'cancelled';
  const score = scheduleScoreText(entry);
  const directions = entry.isNextUp && !cancelled ? directionsHref(entry.locationAddress) : null;

  return (
    <div className={`${styles.row} ${entry.isNextUp ? styles.next : ''} ${cancelled ? styles.cancelled : ''}`}>
      <div className={styles.when}>
        {scheduleDayLabel(entry.startsAt)}<br />{scheduleTimeLabel(entry.startsAt)}
      </div>
      <div className={styles.what}>
        {entry.isNextUp && <span className={styles.nextLabel}>Up next</span>}
        <div className={styles.title}>{scheduleRowTitle(entry)}</div>
        {entry.location && <div className={styles.where}>{entry.location}</div>}
      </div>
      {cancelled ? <span className={styles.cancelChip}>Cancelled</span>
        : score ? <b className={`${styles.score} ${TONE_CLASS[scheduleResultTone(entry)]}`}>{score}</b>
        : directions ? (
          <a className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.directions}`} href={directions}
            target="_blank" rel="noopener noreferrer" aria-label="Directions">
            <Navigation size={18} aria-hidden />
            <span className={styles.directionsLabel}>Directions</span>
          </a>
        ) : null}
    </div>
  );
}

export default function RepTeamPublicSchedule({ view, subscribe }: {
  view: FamilyTeamView;
  /** Club Tier 6d (B3): the Subscribe button on the heading line — passed by the page exactly when it renders the
   *  schedule, because both come from one question (getPublicTeamSchedule), which the public feed asks too. */
  subscribe?: { feedPath: string; calendarName: string };
}) {
  if (view.entries.length === 0) return null;

  // What already happened folds above Up next (C3); the next few show; the rest of the season is on demand. A season
  // that is all played lists its games plainly — a fold over everything would hide the whole section.
  const { earlier, upcoming, later } = splitPublicSchedule(view.entries);

  return (
    <section className={kit.section} aria-labelledby="schedule">
      <div className={styles.kickRow}>
        <h2 id="schedule" className={kit.sectionTitle}>Schedule</h2>
        {subscribe && <TeamSubscribeButton feedPath={subscribe.feedPath} calendarName={subscribe.calendarName} />}
      </div>
      <div className={kit.list}>
        {upcoming.length === 0 ? earlier.map(e => <Row key={e.id} entry={e} />) : earlier.length > 0 && (
          <details className={styles.fold}>
            <summary className={styles.foldTop}>Earlier this season ({earlier.length})</summary>
            {earlier.map(e => <Row key={e.id} entry={e} />)}
          </details>
        )}
        {upcoming.map(e => <Row key={e.id} entry={e} />)}
        {later.length > 0 && (
          <details className={styles.fold}>
            <summary className={styles.foldBottom}>Show the rest of the season ({later.length} more)</summary>
            {later.map(e => <Row key={e.id} entry={e} />)}
          </details>
        )}
      </div>
    </section>
  );
}
