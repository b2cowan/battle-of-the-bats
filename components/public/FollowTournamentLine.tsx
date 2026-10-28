'use client';
/**
 * "Follow this tournament" on the frame Overview (Public tournament pages Stage 2 Part 2). Owner, 2026-10-28: following
 * lives in the installed app only, never in a browser (phone or desk); the Overview carries the tournament's follow and
 * nothing else (no follow-a-team line, no star in the band — a team is followed on its own page). So this line is drawn
 * only in the app's display mode, decided as the page first draws (`.appOnly`, the band's own `browserOnly` rule turned
 * round), and is absent on a club's own address (no signed-in visitors there).
 *
 * The follow itself is today's strip's (lib/hooks/useTournamentFollowToggle.ts): instant, on the device, mirrored to the
 * account; one quiet note after the first follow for a signed-out visitor.
 */
import { Star, X } from 'lucide-react';
import { useTournamentFollowToggle } from '@/lib/hooks/useTournamentFollowToggle';
import { usePublicPathname, useSignInHref } from '@/lib/use-public-pathname';
import { hideOnClubOwnHost } from './hideOnClubOwnHost';
import styles from './PublicParts.module.css';

function FollowTournamentLine({ orgSlug, tournamentSlug, tournamentName }: { orgSlug: string; tournamentSlug: string; tournamentName: string }) {
  const { following, saving, showNudge, toggle, dismissNudge } = useTournamentFollowToggle(orgSlug, tournamentSlug, tournamentName);
  const pathname = usePublicPathname();
  const signInHref = useSignInHref();
  return (
    <div className={`${styles.appOnly} ${styles.followCard}`}>
      <button type="button" className={styles.followLine} aria-pressed={following} onClick={toggle} data-saving={saving ? '' : undefined}>
        <span className={styles.followText}>
          <b>{following ? 'Following this tournament' : 'Follow this tournament'}</b>
          <span>Its games show on your Home and Scores.</span>
        </span>
        <span className={styles.followStar} aria-hidden>
          <Star size={22} strokeWidth={2} fill={following ? 'currentColor' : 'none'} />
        </span>
      </button>
      {showNudge && (
        <div className={styles.followNote} role="status">
          <span>Following on this device. <a href={signInHref(pathname)}>Sign in</a> to keep it on every device.</span>
          <button type="button" className={styles.followDismiss} onClick={dismissNudge} aria-label="Dismiss">
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export default hideOnClubOwnHost(FollowTournamentLine);
