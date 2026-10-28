'use client';
/**
 * components/public/FollowTournamentStrip.tsx — Phase 6 (F1)
 *
 * The event ACTION ROW that sits directly under the unified event header on the tournament HOME
 * tab only: Follow (leading) + Share (secondary), one row, one baseline. Share used to live in a
 * separate right-aligned row below the hero; on mobile the hero is hidden, so the two landed
 * back-to-back on opposite edges and read as a zig-zag (owner call 2026-07-29, Option A). The
 * desktop share row is unchanged and now hides ≤900px, so exactly one Share renders per width.
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
import SharePageButton from '@/components/public/SharePageButton';
import styles from './FollowTournamentStrip.module.css';

import { hideOnClubOwnHost } from '@/components/public/hideOnClubOwnHost';
interface Props {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  /** Path the Share partner sends (origin prepended by SharePageButton). */
  shareUrl: string;
}

function FollowTournamentStrip({ orgSlug, tournamentSlug, tournamentName, shareUrl }: Props) {
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
        {/* The quieter partner: same height, same baseline, its own type register so
            Follow stays the one branded thing in the row. */}
        <SharePageButton
          url={shareUrl}
          title={tournamentName}
          text="Live on FieldLogicHQ"
          className={styles.share}
        />
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
