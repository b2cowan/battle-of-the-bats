'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
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
import type { GuardianPayload } from '@/lib/family-guardian-view';

/**
 * The family team view (S3) — one scrolling schedule, opened at what's next.
 *
 * Owner ruling #2: chronological, NO sections. Games and practices interleave; completed
 * games carry their score, upcoming ones carry time and place. Everything the tier
 * boundary excludes is excluded by the DTO, not by this component — there is no player
 * data in `FamilyScheduleEntry` to accidentally render.
 *
 * The initial scroll is done here rather than with a URL fragment so it happens once, on
 * mount, without putting an anchor in the address bar the family would then share.
 */

function placeLabel(entry: FamilyScheduleEntry): string {
  return [entry.location, entry.fieldNumber].filter(Boolean).join(' · ');
}

/** The warm consumer token set's rendering of a result tone. The public page maps the same
 *  tone to the dark public tokens — the LABELS are shared, the palettes are not. */
const TONE_CLASS: Record<'win' | 'loss' | 'neutral', string> = {
  win: styles.scoreWin,
  loss: styles.scoreLoss,
  neutral: '',
};

function ScoreCell({ entry }: { entry: FamilyScheduleEntry }) {
  const score = scheduleScoreText(entry);
  if (!score) return null;
  return <b className={`${styles.score} ${TONE_CLASS[scheduleResultTone(entry)]}`}>{score}</b>;
}

/**
 * The GUARDIAN-only half. Rendered from a payload the server attaches only for a verified
 * guardian link — a follower's response has no `guardian` object at all, so there is nothing
 * here for them to receive. The tier boundary is in the DATA, not in this component.
 */
/** The recap door (Chunk D 3.2). Two honest states and no third: it is here, or it is written
 *  when the coach closes the season. Never "coming soon", never a disabled button. */
export type FamilyRecapDoor =
  | { href: string; comingAfter?: never }
  | { comingAfter: string; href?: never };

function GuardianSections({ guardian, recap }: { guardian: GuardianPayload; recap?: FamilyRecapDoor | null }) {
  return (
    <>
      {guardian.player && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Your player</h2>
          <div className={styles.playerBand}>
            <span className={styles.playerMark} aria-hidden>
              {guardian.player.playerFirstName.charAt(0).toUpperCase()}
            </span>
            <div className={styles.rowMain}>
              <div className={styles.playerName}>
                {guardian.player.playerFirstName}
                {guardian.player.playerNumber ? ` · #${guardian.player.playerNumber}` : ''}
              </div>
              <div className={styles.rowSub}>
                {[guardian.player.primaryPosition, guardian.player.relationship]
                  .filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          {recap?.href && (
            <div className={styles.recapDoor}>
              <span className={styles.recapDoorText}>
                {guardian.player.playerFirstName}’s season recap is ready — attendance, what the
                coach worked on, awards, and a keepsake card.
              </span>
              <Link className={styles.recapDoorLink} href={recap.href}>Read it →</Link>
            </div>
          )}
          {recap?.comingAfter && (
            <div className={styles.recapDoor}>
              <span className={styles.recapDoorText}>
                {guardian.player.playerFirstName}’s season recap is written when the coach closes
                the {recap.comingAfter} season. It stays here to keep.
              </span>
            </div>
          )}
        </div>
      )}

      {guardian.announcements.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>From the coach</h2>
          {guardian.announcements.map(a => (
            <div key={a.id} className={styles.announcement}>
              <div className={styles.announcementSubject}>{a.subject}</div>
              <div className={styles.rowSub}>{scheduleDayLabel(a.sentAt)}</div>
              <div className={styles.announcementBody}>{a.body}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function FamilyTeamClient({ view, guardian, recap }: {
  view: FamilyTeamView;
  /** Present only for a verified guardian; a follower never receives this. */
  guardian?: GuardianPayload | null;
  /** Resolved server-side through the shared recap gate. A follower never receives this
   *  either — it renders inside the guardian half only. */
  recap?: FamilyRecapDoor | null;
}) {
  const nextUpRef = useRef<HTMLDivElement | null>(null);
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    // 'auto' rather than 'smooth': the list should already BE at the right place when the
    // family looks at it, not animate there while they read the wrong rows.
    nextUpRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, []);

  async function subscribe() {
    if (subscribing) return;
    setSubscribing(true);
    setCalendarError(null);
    try {
      const res = await fetch(`/api/family/teams/${view.repTeamId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error('Could not create your calendar link.');
      setCalendarUrl(data.url);
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Could not create your calendar link.');
    } finally {
      setSubscribing(false);
    }
  }

  const { wins, losses, ties } = view.record;
  const hasRecord = wins + losses + ties > 0;

  return (
    <div className={warm.warm}>
      <div className={styles.page}>
        <div className={styles.teamHead}>
          <h1 className={styles.teamName}>{view.teamName}</h1>
          <span className={styles.teamMeta}>
            {hasRecord ? `${wins}–${losses}–${ties}` : view.seasonYear ?? ''}
          </span>
        </div>

        {/* Their own child first — it is why a guardian opened the page. */}
        {guardian && <GuardianSections guardian={guardian} recap={recap} />}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Schedule</h2>

          {view.entries.length === 0 ? (
            <p className={styles.empty}>
              Nothing on the schedule yet. This is where games and practices will appear.
            </p>
          ) : (
            view.entries.map((entry, index) => {
              const completed = isScheduleEntryCompleted(entry);
              const cancelled = entry.status === 'cancelled';
              const body = (
                <div className={styles.rowMain}>
                  <div className={`${styles.rowTitle} ${cancelled ? styles.rowCancelled : ''}`}>
                    {scheduleRowTitle(entry, view.teamName)}
                  </div>
                  <div className={styles.rowSub}>
                    {[scheduleDayLabel(entry.startsAt), completed ? null : scheduleTimeLabel(entry.startsAt), placeLabel(entry)]
                      .filter(Boolean)
                      .join(' · ')}
                    {cancelled && ' · Cancelled'}
                  </div>
                </div>
              );

              if (entry.isNextUp) {
                return (
                  <div key={entry.id} ref={nextUpRef} className={styles.upNext}>
                    <div className={styles.upNextLabel}>Up next</div>
                    <div className={styles.row}>
                      {body}
                      {directionsHref(entry.locationAddress) && (
                        <a
                          className={styles.rowLink}
                          href={directionsHref(entry.locationAddress)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Directions →
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={entry.id}>
                  {index > 0 && <div className={styles.divider} />}
                  <div className={`${styles.row} ${completed ? styles.rowDone : ''}`}>
                    {body}
                    {entry.shared && (
                      <Link
                        className={styles.rowLink}
                        href={`/${view.orgSlug}/teams/${view.teamSlug}/games/${entry.id}`}
                      >
                        Game page →
                      </Link>
                    )}
                    <ScoreCell entry={entry} />
                  </div>
                </div>
              );
            })
          )}

          <div className={styles.divider} />
          <div className={styles.calendarRow}>
            <span aria-hidden>📅</span>
            <span>Add this schedule to your calendar — it stays current automatically</span>
            <button type="button" className={styles.calendarButton} onClick={subscribe} disabled={subscribing}>
              {subscribing ? 'Creating…' : calendarUrl ? 'New link' : 'Subscribe'}
            </button>
          </div>
          {calendarUrl && (
            <>
              <p className={styles.rowSub}>
                Copy this address into your calendar app’s “subscribe to calendar” option. Keep it
                private — anyone with it can see this team’s schedule.
              </p>
              <div className={styles.calendarUrl}>{calendarUrl}</div>
            </>
          )}
          {calendarError && <p className={styles.error} role="alert">{calendarError}</p>}
        </div>
      </div>
    </div>
  );
}
