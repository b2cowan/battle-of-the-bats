'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Sparkles, Compass, X } from 'lucide-react';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import styles from './CoachOverviewInvite.module.css';

/**
 * The Variant-A discovery nudge on the team Overview (chosen via the nav-rebuild preview).
 * A quiet, dismissible invitation to turn on the persisted-roster wedge. Dismissing it does NOT
 * erase discovery — it DEGRADES to a single faint line ("Team tools available — explore →"), and
 * the rail's always-present "Explore" link still exists. Dismiss state is per-team, per-nudge in
 * localStorage (v1) so it survives reloads but re-surfaces for new earned moments later.
 *
 * Hidden entirely once the wedge feature (roster) is already activated — there's nothing to invite.
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
  const storageKey = `fl_coach_nudge_dismissed:${basicTeamId}:${nudge}`;

  // useSyncExternalStore reads the localStorage dismiss flag hydration-safely: the server
  // snapshot is always `false` (show the invite), and the client subscribes to `storage`
  // events so a dismiss in another tab also collapses this one. No effect, no mismatch.
  const dismissed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('storage', onChange);
      return () => window.removeEventListener('storage', onChange);
    },
    () => {
      try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
    },
    () => false, // server snapshot — never dismissed during SSR
  );

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
      // useSyncExternalStore doesn't see same-tab writes (the `storage` event is cross-tab
      // only), so nudge React to re-read by dispatching a synthetic storage event.
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
    } catch { /* ignore */ }
  }

  // Already activated → nothing to invite or rediscover here.
  if (rosterActivated) return null;

  if (dismissed) {
    return (
      <Link href={`${coachTeamPath(basicTeamId)}/explore`} className={styles.faintLine}>
        <Compass size={13} aria-hidden />
        Team tools available — explore what your free portal can do →
      </Link>
    );
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
