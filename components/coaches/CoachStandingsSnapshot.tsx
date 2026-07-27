import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import styles from './CoachTournamentRecord.module.css';

/** Ordinal for a pool position — 1st / 2nd / 3rd / 4th … (11th–13th are not -st/-nd/-rd). */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * B1.6 — "Where you stand", inside the Schedule zone (decision ◆H1, approved
 * 2026-07-27): standings are the outcome of the games listed directly above them,
 * so they belong to the same zone rather than a fifth one that would break the
 * A3 zone order and sit empty for most of the event.
 *
 * Deliberately a SNAPSHOT of the coach's own position, not a standings table — the
 * full table already exists on the public site and is one tap away. Renders nothing
 * until at least one game has been played (a 0–0–0 row tells a coach nothing), and
 * the caller gates it on the organizer not having hidden their public Standings page.
 */
export default function CoachStandingsSnapshot({
  rank,
  wins,
  losses,
  ties,
  runDiff,
  groupLabel,
  standingsHref,
  gamesRemaining,
}: {
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  /** Run/goal differential — sport-neutral label, see lib/sports.ts vocabulary. */
  runDiff: number | null;
  /** Pool or division name, e.g. "Pool A". */
  groupLabel: string | null;
  standingsHref: string | null;
  /** Scheduled (not yet played) games left for this team. */
  gamesRemaining: number;
}) {
  const played = wins + losses + ties;
  // Nothing to stand on yet — a 0–0–0 line is noise, not information.
  if (played === 0) return null;

  const record = ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;

  return (
    <div className={`card ${styles.standCard}`}>
      <div className={styles.standHead}>
        <p className={styles.standTitle}>
          <TrendingUp size={13} aria-hidden /> Where you stand
        </p>
        {standingsHref && (
          <Link href={standingsHref} className={styles.standLink}>
            Full standings
          </Link>
        )}
      </div>

      <div className={styles.standBody}>
        <span className={styles.standRank}>{ordinal(rank)}</span>
        <div className={styles.standFacts}>
          {/* Approved mockups: "2–1–0 in Pool A" — the field size is already implied by the
              ordinal and the full table is one tap away, so "· of N" was noise. */}
          <p className={styles.standRecord}>
            <strong>{record}</strong>
            {groupLabel ? ` in ${groupLabel}` : ''}
          </p>
          {runDiff != null && runDiff !== 0 && (
            <p className={styles.standDiff}>
              {runDiff > 0 ? `+${runDiff}` : runDiff} differential
            </p>
          )}
        </div>
      </div>

      {gamesRemaining > 0 && (
        <p className={styles.standNote}>
          {gamesRemaining === 1
            ? 'One more game still to play.'
            : `${gamesRemaining} more games still to play.`}
        </p>
      )}
    </div>
  );
}
