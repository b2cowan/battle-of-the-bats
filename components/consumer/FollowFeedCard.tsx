'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import RollingNumber from '@/components/public/RollingNumber';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { FollowFeedEntry } from '@/lib/follow-feed';
import styles from './ConsumerPage.module.css';

/** vs {opponent} / "no games yet" / recent-result sentence, per group.
 *  TODO: lib/follow-feed.ts followStatusText() is the shared compact vocabulary for
 *  feed entries (used by the switcher home) — if this card's wording changes, keep
 *  the two in step (or converge on the helper). */
function metaLine(entry: FollowFeedEntry): string | null {
  if (entry.group === 'none') return 'No games yet';
  if (entry.group === 'recent' && entry.myScore != null && entry.oppScore != null) {
    const opp = entry.opponentName ?? 'opponent';
    const verb = entry.myScore > entry.oppScore ? 'beat' : entry.myScore < entry.oppScore ? 'lost to' : 'tied';
    return `${entry.teamName} ${verb} ${opp} ${entry.myScore}–${entry.oppScore}`;
  }
  if (entry.opponentName) {
    return entry.group === 'upcoming' && entry.location
      ? `vs ${entry.opponentName} · ${entry.location}`
      : `vs ${entry.opponentName}`;
  }
  return null;
}

/**
 * One row in the Following feed — a followed team's single most-relevant game
 * state (live score, next game, or latest result). Reuses the consumer shell's
 * card visual language (avatar, live pill/dot) from FollowCardList. Deliberately
 * doesn't extend components/public/MyTeamCard (the single-tournament-page
 * equivalent) — that card's contract is built around within-tournament
 * division rank/record, which this cross-tournament, multi-org feed has no
 * equivalent of; a parallel, purpose-built status block is the better fit here.
 */
export default function FollowFeedCard({ entry }: { entry: FollowFeedEntry }) {
  const avatarStyle = { background: teamColor(entry.teamName, 58, 38) };
  const meta = metaLine(entry);

  return (
    <Link href={entry.href} className={styles.card}>
      <div className={styles.cardLogoFallback} style={avatarStyle} aria-hidden>
        {teamInitials(entry.teamName)}
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardName}>{entry.teamName}</span>
        {meta && <span className={styles.cardMeta}>{meta}</span>}
        <span className={styles.cardMeta}>{entry.tournamentName}</span>
      </div>
      <div className={styles.feedRight}>
        {entry.group === 'live' ? (
          <>
            <span className={styles.livePill}><span className={styles.liveDot} />Live</span>
            <div className={styles.feedScore}>
              <RollingNumber value={entry.myScore} />
              <span className={styles.feedScoreDash}>–</span>
              <RollingNumber value={entry.oppScore} />
            </div>
          </>
        ) : entry.group === 'upcoming' ? (
          <>
            {entry.dateLabel && <span className={styles.feedNextDate}>{entry.dateLabel}</span>}
            {entry.timeLabel && <span className={styles.feedNextTime}>{entry.timeLabel}</span>}
          </>
        ) : entry.group === 'recent' ? (
          <>
            <span className={styles.feedFinalTag}>{entry.isFinal ? 'Final' : 'Unofficial'}</span>
            <div className={styles.feedScore}>
              {entry.myScore}<span className={styles.feedScoreDash}>–</span>{entry.oppScore}
            </div>
          </>
        ) : (
          <ChevronRight size={16} className={styles.feedGoQuiet} aria-hidden />
        )}
      </div>
    </Link>
  );
}
