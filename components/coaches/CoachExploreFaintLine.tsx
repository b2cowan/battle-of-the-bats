import Link from 'next/link';
import { Compass } from 'lucide-react';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import styles from './CoachExploreFaintLine.module.css';

/**
 * What dismissal LEAVES BEHIND on the free team Overview — a single faint line back to Explore.
 * Shared by the discovery invite and the first-run setup panel: neither erases discovery when
 * dismissed, and both must degrade to the same one thing (two hand-rolled faint lines would drift).
 *
 * Note the thread is never cut: Explore is also a permanent tab, so this line is reassurance,
 * not the only way back.
 */
export default function CoachExploreFaintLine({
  basicTeamId,
  children = 'Team tools available — explore what your free portal can do →',
}: {
  basicTeamId: string;
  /** Override the line's wording when the surface that collapsed had a different promise. */
  children?: React.ReactNode;
}) {
  return (
    <Link href={`${coachTeamPath(basicTeamId)}/explore`} className={styles.faintLine}>
      <Compass size={13} aria-hidden />
      {children}
    </Link>
  );
}
