'use client';

import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import CoachExploreFaintLine from './CoachExploreFaintLine';
import { useCoachNudgeDismiss } from './useCoachNudgeDismiss';
import styles from './CoachOverviewInvite.module.css';

/**
 * The Variant-A discovery nudge on the team Overview (chosen via the nav-rebuild preview).
 * A quiet, dismissible invitation to turn on the persisted-roster wedge. Dismissing it does NOT
 * erase discovery — it DEGRADES to a single faint line (CoachExploreFaintLine, shared with the
 * setup panel), and the rail's always-present "Explore" link still exists. Dismiss state is
 * per-team, per-nudge in localStorage (useCoachNudgeDismiss) so it survives reloads but
 * re-surfaces for new earned moments later.
 *
 * Hidden entirely once the wedge feature (roster) is already activated — there's nothing to invite.
 * Also suppressed by the Overview while the setup panel leads (its step 1 owns this invitation).
 */
export default function CoachOverviewInvite({
  basicTeamId,
  nudge = 'persisted_roster',
  rosterActivated,
}: {
  basicTeamId: string;
  /** Nudge id — keys the per-trigger dismiss so a NEW earned moment can re-surface later. */
  nudge?: string;
  /** When the wedge feature is already on, suppress the invite (nothing to offer). */
  rosterActivated: boolean;
}) {
  const { dismissed, dismiss } = useCoachNudgeDismiss(basicTeamId, nudge);

  // Already activated → nothing to invite or rediscover here.
  if (rosterActivated) return null;

  if (dismissed) {
    return <CoachExploreFaintLine basicTeamId={basicTeamId} />;
  }

  return (
    <div className={styles.invite} role="status">
      <Sparkles size={15} aria-hidden className={styles.inviteIcon} />
      <span className={styles.inviteText}>
        Reuse your roster next time? Your free Coaches Portal can keep your team list and reuse
        it for future tournaments.{' '}
        <Link href={`${coachTeamPath(basicTeamId)}/explore`} className={styles.inviteLink}>Set it up →</Link>
      </span>
      <button type="button" className={styles.inviteDismiss} onClick={dismiss} aria-label="Dismiss">
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
