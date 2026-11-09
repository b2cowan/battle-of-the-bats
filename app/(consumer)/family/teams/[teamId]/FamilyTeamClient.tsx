'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
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
import type { FamilyScheduleEntry } from '@/lib/family-view';
import type { GuardianPayload } from '@/lib/family-guardian-view';
import { FAMILY_HOME_WORDS as W } from '@/lib/family-home-words';
import { possessive } from '@/lib/utils';

/**
 * The family team page (S3; Signed-in family accounts Stage 4a, Part 6, drawing tab 3) — one scrolling schedule, opened at
 * what's next. Both kinds: a rep team (Your player as the coach records it, From the coach, the recap door) and a house-league
 * team (Your player by first name and division; NO "From the coach" card — house-league coaches post no updates in the
 * product). The rows under the schedule (Your calendar, Your sign-up, the privacy and connected lines) are the server's,
 * passed as `children`.
 *
 * Owner ruling #2: chronological, NO sections. Games and practices interleave; completed games carry their score, upcoming
 * ones carry time and place. Everything the tier boundary excludes is excluded by the DTO, not by this component — there is
 * no player data in `FamilyScheduleEntry` to accidentally render.
 *
 * The initial scroll is done here rather than with a URL fragment so it happens once, on mount, without putting an anchor in
 * the address bar the family would then share.
 */

function placeLabel(entry: FamilyScheduleEntry): string {
  return [entry.location, entry.fieldNumber].filter(Boolean).join(' · ');
}

/** The warm consumer token set's rendering of a result tone. The public page maps the same tone to the dark public tokens —
 *  the LABELS are shared, the palettes are not. */
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

/** The recap door (Chunk D 3.2). Two honest states and no third: it is here, or it is written when the coach closes the
 *  season. Never "coming soon", never a disabled button. Rep only. */
export type FamilyRecapDoor =
  | { href: string; comingAfter?: never }
  | { comingAfter: string; href?: never };

/** A house-league child on the team: first name and division, nothing else (drawing 3.2). */
export interface LeaguePlayerLine { firstName: string; division: string | null }

function RecapDoor({ firstName, recap }: { firstName: string; recap: FamilyRecapDoor }) {
  return (
    <div className={styles.recapDoor}>
      {recap.href ? (
        <>
          <span className={styles.recapDoorText}>
            {possessive(firstName)} season recap is ready — attendance, what the coach worked on, awards, and a keepsake card.
          </span>
          <Link className={styles.recapDoorLink} href={recap.href}>Read it →</Link>
        </>
      ) : (
        <span className={styles.recapDoorText}>
          {possessive(firstName)} season recap is written when the coach closes the {recap.comingAfter} season. It stays here to keep.
        </span>
      )}
    </div>
  );
}

export default function FamilyTeamClient({ teamName, metaLine, backHref, joined, guardian, leaguePlayers, recap, entries, children }: {
  teamName: string;
  /** "12–6–2", "2027", "House League 2027". */
  metaLine: string | null;
  /** "← Your family", for a parent with more than one team. */
  backHref: string | null;
  /** The one-time "You've joined" note (`?joined=1`): the account's children on this team. */
  joined: string[] | null;
  /** Rep: present only for a verified guardian tied to a player (the tier boundary is in the DATA). */
  guardian?: GuardianPayload | null;
  /** House league: the account's own children on the team. */
  leaguePlayers?: LeaguePlayerLine[] | null;
  /** Rep only, resolved server-side through the shared recap gate. */
  recap?: FamilyRecapDoor | null;
  entries: FamilyScheduleEntry[] | null;
  children?: React.ReactNode;
}) {
  const nextUpRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 'auto' rather than 'smooth': the list should already BE at the right place when the family looks at it, not animate
    // there while they read the wrong rows.
    nextUpRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, []);

  const players = leaguePlayers ?? [];

  return (
    <>
      {backHref && <Link href={backHref} className={styles.backLink}>{W.team.backToFamily}</Link>}
      <div className={styles.teamHead}>
        <h1 className={styles.teamName}>{teamName}</h1>
        {metaLine && <span className={styles.teamMeta}>{metaLine}</span>}
      </div>

      {joined && joined.length > 0 && (
        <div className={styles.joinedNote} role="status">
          <h2>{W.team.joinedTitle(joined)}</h2>
          <p>{W.team.joinedBody(joined)}</p>
        </div>
      )}

      {/* Their own child first — it is why a parent opened the page. */}
      {guardian?.player && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{W.team.yourPlayer}</h2>
          <div className={styles.playerBand}>
            <span className={styles.playerMark} aria-hidden>{guardian.player.playerFirstName.charAt(0).toUpperCase()}</span>
            <div className={styles.rowMain}>
              <div className={styles.playerName}>
                {guardian.player.playerFirstName}
                {guardian.player.playerNumber ? ` · #${guardian.player.playerNumber}` : ''}
              </div>
              <div className={styles.rowSub}>
                {[guardian.player.primaryPosition, guardian.player.relationship].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          {recap && <RecapDoor firstName={guardian.player.playerFirstName} recap={recap} />}
        </div>
      )}

      {players.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{players.length > 1 ? W.team.yourPlayers : W.team.yourPlayer}</h2>
          {players.map((p, i) => (
            <div key={`${p.firstName}-${i}`}>
              {i > 0 && <div className={styles.divider} />}
              <div className={styles.playerBand}>
                <span className={styles.playerMark} aria-hidden>{p.firstName.charAt(0).toUpperCase()}</span>
                <div className={styles.rowMain}>
                  <div className={styles.playerName}>{p.firstName}</div>
                  {p.division && <div className={styles.rowSub}>{p.division}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {guardian && guardian.announcements.length > 0 && (
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

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{W.team.schedule}</h2>
        {entries === null ? (
          <p className={styles.empty}>{W.team.hiddenBody}</p>
        ) : entries.length === 0 ? (
          <p className={styles.empty}>{W.team.emptySchedule}</p>
        ) : (
          entries.map((entry, index) => {
            const completed = isScheduleEntryCompleted(entry);
            const cancelled = entry.status === 'cancelled';
            const body = (
              <div className={styles.rowMain}>
                <div className={`${styles.rowTitle} ${cancelled ? styles.rowCancelled : ''}`}>
                  {scheduleRowTitle(entry, teamName)}
                </div>
                <div className={styles.rowSub}>
                  {[scheduleDayLabel(entry.startsAt), completed ? null : scheduleTimeLabel(entry.startsAt), placeLabel(entry)]
                    .filter(Boolean)
                    .join(' · ')}
                  {cancelled && ` · ${W.team.cancelled}`}
                </div>
              </div>
            );

            if (entry.isNextUp) {
              const directions = directionsHref(entry.locationAddress);
              return (
                <div key={entry.id} ref={nextUpRef} className={styles.upNext}>
                  <div className={styles.upNextLabel}>{W.family.upNext}</div>
                  <div className={styles.row}>
                    {body}
                    {directions && (
                      <a className={styles.rowLink} href={directions} target="_blank" rel="noopener noreferrer">
                        {W.team.directions}
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
                  <ScoreCell entry={entry} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {children}
    </>
  );
}
