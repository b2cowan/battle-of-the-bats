'use client';
import Link from 'next/link';
import { useCoaches, resolveClosedAssignment } from '@/lib/coaches-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The "you can't open this here" state for a coach page gated on a LIVE assignment — with the
 * between-seasons truth built in (M1, 2026-08-16).
 *
 * Before this existed, a dozen live-instrument pages each hand-rolled the same block and every
 * one told a coach whose season had just ended "You are not assigned to this team" — false, and
 * exactly the sentence a between-seasons head coach reads while wondering if they lost their
 * team. One component, one decision: a member with only a finished season gets the true sentence
 * and the door that actually works (Season's End); everyone else gets the honest not-assigned.
 *
 * ⚠ Deliberately NOT an access gate — it renders words, decides nothing, and must stay behind
 * the caller's own `!assignment` check. Live-instrument pages stay live-instrument pages; the
 * only thing this changes is which true sentence is on the wall.
 */
export default function CoachNotOnTeam({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const { assignments, closedAssignments } = useCoaches();
  const closed = resolveClosedAssignment(assignments, closedAssignments, teamId);

  if (closed) {
    return (
      <div className={styles.notAssigned}>
        <h2>This season has finished</h2>
        <p>
          This screen is part of running a live season, and it comes back when the next one
          starts. The finished season&apos;s story is kept in{' '}
          <Link href={`/${orgSlug}/coaches/teams/${teamId}/season-end`}>Season&apos;s End</Link>.
        </p>
      </div>
    );
  }
  return (
    <div className={styles.notAssigned}>
      <h2>Team not found</h2>
      <p>You are not assigned to this team.</p>
    </div>
  );
}
