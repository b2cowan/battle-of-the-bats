import Link from 'next/link';
import { Users2 } from 'lucide-react';
import styles from './CoachTournamentRecord.module.css';

/**
 * B1.5 — "Meet the field", the Schedule zone's PRE-EVENT state (decision ◆I1,
 * approved 2026-07-27).
 *
 * Before the organizer publishes, that zone was a near-empty "not published yet"
 * message for the longest stretch of a coach's wait — often weeks. This fills it
 * with the one thing they're actually curious about, then steps aside the moment
 * real games exist.
 *
 * Counts come from the accepted-teams list the record page already loads (no new
 * query — just `division_id` added to the existing select). The caller gates this
 * on the organizer not having hidden their public Teams page: the portal must
 * never surface something the organizer deliberately switched off.
 */
export default function CoachMeetTheField({
  totalTeams,
  divisionTeams,
  divisionName,
  sampleNames,
  teamsHref,
}: {
  totalTeams: number;
  /** Accepted teams in the coach's own division, including their own team. */
  divisionTeams: number;
  divisionName: string | null;
  /** A few other teams' names — never the coach's own. */
  sampleNames: string[];
  /** Public Teams page; null when the tournament isn't publicly linkable yet. */
  teamsHref: string | null;
}) {
  // One accepted team is just the coach's own — "1 team in" reads as an empty room.
  if (totalTeams < 2) return null;

  const shown = sampleNames.slice(0, 4);
  const rest = Math.max(0, sampleNames.length - shown.length);

  return (
    <div className={`card ${styles.fieldCard}`}>
      <div className={styles.fieldHead}>
        <p className={styles.fieldTitle}>
          <Users2 size={13} aria-hidden /> Who&apos;s coming
        </p>
        {teamsHref && (
          <Link href={teamsHref} className={styles.fieldLink}>
            See all
          </Link>
        )}
      </div>

      <p className={styles.fieldCount}>
        <strong>{totalTeams} teams in</strong>
        {divisionTeams > 1 && (
          <>
            {' · '}
            {divisionTeams} in {divisionName ? <>your {divisionName} division</> : 'your division'}
          </>
        )}
      </p>

      {shown.length > 0 && (
        <div className={styles.fieldChips}>
          {shown.map(name => (
            <span key={name} className={styles.fieldChip}>{name}</span>
          ))}
          {rest > 0 && <span className={styles.fieldChipMore}>+{rest}</span>}
        </div>
      )}
    </div>
  );
}
