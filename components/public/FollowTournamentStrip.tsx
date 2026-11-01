'use client';
/**
 * components/public/FollowTournamentStrip.tsx — Phase 6 (F1)
 *
 * The event ACTION ROW that sits directly under the unified event header on the tournament HOME
 * tab only: the Follow pill. Share used to sit beside it; it was removed (owner call 2026-11-01) —
 * the only public-tournament shares left are the header icon and the single game page's.
 *
 * One tap follows the WHOLE event (not a team) — instantly, no account (free-first business
 * decision). States:
 * ghost-star "Follow this tournament" → a dimmed saving beat → ink-on-lime "★ Following"
 * (standard pillOn). Tap again unfollows.
 *
 * The follow itself (device first, account mirror, the one nudge) is lib/hooks/useTournamentFollowToggle.ts, shared
 * with the frame Overview's app-only line.
 *
 * Signed-out fans get ONE quiet, dismissible nudge under the strip after following (sync + alerts
 * pitch) — never a wall. Renders in the event's branded dark/light (on-event affordance).
 */
import { Star, X } from 'lucide-react';
import { useTournamentFollowToggle } from '@/lib/hooks/useTournamentFollowToggle';
import styles from './FollowTournamentStrip.module.css';

import { hideOnClubOwnHost } from '@/components/public/hideOnClubOwnHost';
interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
}

function FollowTournamentStrip({ orgSlug, tournamentSlug, tournamentName }: Props) {
  const { following, saving, showNudge, toggle, dismissNudge } = useTournamentFollowToggle(orgSlug, tournamentSlug, tournamentName);

  const returnPath = (() => {
    try { return window.location.pathname + window.location.search; } catch { return `/${orgSlug}/${tournamentSlug}`; }
  })();

  return (
    <div className={styles.wrap}>
      <div className={styles.strip}>
        <button
          type="button"
          className={`${styles.pill} ${following ? styles.pillOn : ''} ${saving ? styles.saving : ''}`}
          aria-pressed={following}
          onClick={toggle}
        >
          <Star size={14} strokeWidth={2.2} fill={following ? 'currentColor' : 'none'} aria-hidden />
          {following ? 'Following' : 'Follow this tournament'}
        </button>
      </div>

      {showNudge && (
        <div className={styles.nudge} role="status">
          <span className={styles.nudgeText}>
            Following on this device ·{' '}
            <a className={styles.nudgeLink} href={`/auth/login?next=${encodeURIComponent(returnPath)}`}>Sign in</a>{' '}
            and it goes with you — every device, plus score alerts.
          </span>
          <button type="button" className={styles.nudgeClose} onClick={dismissNudge} aria-label="Dismiss">
            <X size={14} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

// A club's own web address has no signed-in visitors (host-only cookies): this piece is absent there (Club Tier Stage 4e).
export default hideOnClubOwnHost(FollowTournamentStrip);
