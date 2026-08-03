import Link from 'next/link';
import styles from './RepTeamPublicSchedule.module.css';
import {
  directionsHref,
  isScheduleEntryCompleted,
  scheduleDayLabel,
  scheduleResultTone,
  scheduleRowTitle,
  scheduleScoreText,
  scheduleTimeLabel,
} from '@/lib/family-schedule-format';
import type { FamilyScheduleEntry, FamilyTeamView } from '@/lib/family-view';

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

/** The dark public token set's rendering of a result tone. The warm consumer view maps the
 *  same tone to its own tokens — the LABELS are shared, the palettes deliberately are not. */
const TONE_CLASS: Record<'win' | 'loss' | 'neutral', string> = {
  win: styles.scoreWin,
  loss: styles.scoreLoss,
  neutral: '',
};

function Row({ entry, view }: { entry: FamilyScheduleEntry; view: FamilyTeamView }) {
  const completed = isScheduleEntryCompleted(entry);
  const cancelled = entry.status === 'cancelled';
  const score = scheduleScoreText(entry);

  return (
    <div className={`${styles.row} ${completed ? styles.rowDone : ''}`}>
      <div className={styles.rowMain}>
        <div className={`${styles.rowTitle} ${cancelled ? styles.rowCancelled : ''}`}>
          {scheduleRowTitle(entry)}
        </div>
        <div className={styles.rowSub}>
          {[
            scheduleDayLabel(entry.startsAt),
            completed ? null : scheduleTimeLabel(entry.startsAt),
            entry.location,
          ].filter(Boolean).join(' · ')}
          {cancelled && ' · Cancelled'}
        </div>
      </div>
      {entry.shared && (
        <Link className={styles.link} href={`/${view.orgSlug}/teams/${view.teamSlug}/games/${entry.id}`}>
          Details →
        </Link>
      )}
      {score && <b className={`${styles.score} ${TONE_CLASS[scheduleResultTone(entry)]}`}>{score}</b>}
    </div>
  );
}

export default function RepTeamPublicSchedule({ view }: { view: FamilyTeamView }) {
  if (view.entries.length === 0) return null;

  const nextUp = view.entries.find(e => e.isNextUp) ?? null;
  const rest = view.entries.filter(e => !e.isNextUp);

  return (
    <div className={styles.section}>
      <p className={styles.kicker}>Schedule</p>

      {nextUp && (
        <div className={styles.upNext}>
          <div className={styles.upNextLabel}>Up next</div>
          <div className={styles.row} style={{ borderBottom: 'none', padding: 0 }}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>{scheduleRowTitle(nextUp)}</div>
              <div className={styles.rowSub}>
                {[scheduleDayLabel(nextUp.startsAt), scheduleTimeLabel(nextUp.startsAt), nextUp.location]
                  .filter(Boolean).join(' · ')}
              </div>
            </div>
            {directionsHref(nextUp.locationAddress) && (
              <a
                className={styles.link}
                href={directionsHref(nextUp.locationAddress)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Directions →
              </a>
            )}
          </div>
        </div>
      )}

      <div className={styles.list}>
        {rest.map(entry => <Row key={entry.id} entry={entry} view={view} />)}
      </div>
    </div>
  );
}
