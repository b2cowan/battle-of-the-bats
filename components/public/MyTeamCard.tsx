'use client';
/**
 * components/public/MyTeamCard.tsx
 * Shared "My Team" (followed-team) at-a-glance card for the public tournament fan
 * surfaces. ONE component, two responsive layouts:
 *   - `strip` — the horizontal bar used on the Schedule (mobile) + Standings pages.
 *   - `rail`  — the vertical card used in the Schedule desktop right rail.
 *
 * Unified from the old Schedule `.scorebugBar`/`.railCard` and the Standings
 * `MyTeamStandingsStrip` so the two pages can no longer drift (see
 * memory/design_decisions.md 2026-07-03). Purely presentational: each page computes
 * the data (record, rank, opponent, live/next/final state) and passes it in; live
 * realtime updates stay in the parent. Identity area links to the team page; any
 * unfollow control is the filled-star toggle (never a bare ✕, per 2026-06-25).
 */
import Link from 'next/link';
import { Star, ChevronRight } from 'lucide-react';
import RollingNumber from '@/components/public/RollingNumber';
import { teamAvatarHue, teamInitials } from '@/lib/team-color';
import styles from './MyTeamCard.module.css';

/** The single most-relevant status shown in the card's right-hand block. */
export type MyTeamCardStatus =
  | { kind: 'live'; myScore: number | null | undefined; oppScore: number | null | undefined }
  | { kind: 'next'; dateLabel: string | null; timeLabel: string }
  | { kind: 'final'; myScore: number; oppScore: number }
  | { kind: 'none' };

interface Props {
  layout: 'strip' | 'rail';
  teamName: string;
  teamHref: string;
  /** e.g. "0-0-0" */
  recordLabel: string;
  /** e.g. "5th · U13" (scope label already folded in) — null hides the rank. */
  rankLabel: string | null;
  opponentName: string | null;
  status: MyTeamCardStatus;
  /** Strip only: hide at ≥641px (Schedule, where the desktop rail takes over). */
  hideOnDesktop?: boolean;
}

export default function MyTeamCard({
  layout,
  teamName,
  teamHref,
  recordLabel,
  rankLabel,
  opponentName,
  status,
  hideOnDesktop,
}: Props) {
  const avatarStyle = { background: `hsl(${teamAvatarHue(teamName)}, 58%, 38%)` };
  const initials = teamInitials(teamName);
  const identityLabel = `${teamName} — view team page`;

  if (layout === 'rail') {
    return (
      <div className={styles.railCard}>
        <div className={styles.railHeader}>
          <Link href={teamHref} className={styles.railLink} aria-label={identityLabel}>
            <div className={styles.railAvatar} style={avatarStyle} aria-hidden="true">{initials}</div>
            <div className={styles.railInfo}>
              <div className={styles.railName}>
                <Star size={11} fill="currentColor" className={styles.railStar} aria-hidden="true" />
                <span className={styles.railNameText}>{teamName}</span>
                <ChevronRight size={12} className={styles.go} aria-hidden="true" />
              </div>
              <div className={styles.railMeta}>
                <span>{recordLabel}</span>
                {rankLabel && (<><span>·</span><span>{rankLabel}</span></>)}
              </div>
            </div>
          </Link>
          <div className={styles.railScoreArea}>
            {status.kind === 'live' ? (
              <>
                <span className={styles.railLive}><span className={styles.liveDot} />LIVE</span>
                <div className={styles.railScoreNum}>
                  <RollingNumber value={status.myScore} />
                  <span className={styles.railScoreDash}>-</span>
                  <RollingNumber value={status.oppScore} />
                </div>
              </>
            ) : status.kind === 'next' ? (
              <>
                <div className={styles.railNextUp}>NEXT UP</div>
                {status.dateLabel && <div className={styles.railNextDate}>{status.dateLabel}</div>}
                <div className={styles.railNextTime}>{status.timeLabel}</div>
              </>
            ) : status.kind === 'final' ? (
              <>
                <div className={styles.railNextUp}>FINAL</div>
                <div className={styles.railScoreNum}>{status.myScore}<span className={styles.railScoreDash}>-</span>{status.oppScore}</div>
              </>
            ) : null}
          </div>
        </div>
        {opponentName && (
          <div className={styles.railBody}>
            <div className={styles.railOpp}>vs {opponentName}</div>
          </div>
        )}
      </div>
    );
  }

  // strip
  return (
    <div className={`${styles.strip}${hideOnDesktop ? ` ${styles.hideOnDesktop}` : ''}`}>
      <Link href={teamHref} className={styles.stripLink} aria-label={identityLabel}>
        <div className={styles.stripAvatar} style={avatarStyle} aria-hidden="true">{initials}</div>
        <div className={styles.body}>
          <div className={styles.name}>
            <span className={styles.nameText}>{teamName}</span>
            <ChevronRight size={13} className={styles.go} aria-hidden="true" />
          </div>
          <div className={styles.meta}>
            <span>{recordLabel}</span>
            {rankLabel && (<><span className={styles.dot}>·</span><span>{rankLabel}</span></>)}
          </div>
          {opponentName && <div className={styles.opp}>vs {opponentName}</div>}
        </div>
        <div className={styles.right}>
          {status.kind === 'live' ? (
            <>
              <span className={styles.live}><span className={styles.liveDot} />LIVE</span>
              <div className={styles.score}>
                <RollingNumber value={status.myScore} />
                <span className={styles.scoreDash}>-</span>
                <RollingNumber value={status.oppScore} />
              </div>
            </>
          ) : status.kind === 'next' ? (
            <>
              <div className={styles.nextUp}>NEXT UP</div>
              {status.dateLabel && <div className={styles.nextDate}>{status.dateLabel}</div>}
              <div className={styles.nextTime}>{status.timeLabel}</div>
            </>
          ) : status.kind === 'final' ? (
            <>
              <div className={styles.nextUp}>FINAL</div>
              <div className={styles.score}>{status.myScore}<span className={styles.scoreDash}>-</span>{status.oppScore}</div>
            </>
          ) : null}
        </div>
      </Link>
    </div>
  );
}
