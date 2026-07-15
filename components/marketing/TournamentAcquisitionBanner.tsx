'use client';

import Link from 'next/link';
import { ClipboardList, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { readFollowedTeam } from '@/lib/follow';
import { buildTeamWorkspaceAcquisitionHref, buildTournamentAcquisitionHref, trackTournamentAcquisition } from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type TournamentAcquisitionBannerProps = {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
};

type BannerVariant = 'coach' | 'organizer';

// C6a: one audience per impression. The old single banner spoke to coaches in the
// headline and organizers in the CTA at the same time. Variant pick (documented
// heuristic, client-only — the SW offline-caches this page's HTML as anonymous
// content, so identity can never be server-rendered here):
//   1. The device follows a team in THIS tournament → team-affiliated visitor
//      (parent/coach) → coach-framed.
//   2. Otherwise alternate per impression via a device-wide rotor key, so an
//      anonymous returning visitor sees both pitches over time.
const VARIANT_ROTOR_KEY = 'flhq-acq-banner-variant';

export default function TournamentAcquisitionBanner({
  orgSlug,
  tournamentSlug,
  tournamentName,
}: TournamentAcquisitionBannerProps) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);
  const [variant, setVariant] = useState<BannerVariant | null>(null);
  const dismissKey = `flhq-acq-dismiss-public_tournament_banner-${orgSlug}-${tournamentSlug}`;
  const hiddenForFlow = pathname?.endsWith('/register') || pathname?.includes('/official');
  const organizerHref = useMemo(() => buildTournamentAcquisitionHref({
    source: 'public_tournament_banner',
    orgSlug,
    tournamentSlug,
    surface: 'public_home',
  }), [orgSlug, tournamentSlug]);
  const teamHref = useMemo(() => buildTeamWorkspaceAcquisitionHref({
    source: 'public_tournament_banner',
    orgSlug,
    tournamentSlug,
    surface: 'public_home',
  }), [orgSlug, tournamentSlug]);

  useEffect(() => {
    // Deferred a tick so SSR/CSR never mismatch (both render the dismissed=true null).
    // Timer is cleared on dep change/unmount so a stale tournament's pick can't land
    // after an SPA navigation (and dev StrictMode doesn't double-advance the rotor).
    const timer = window.setTimeout(() => {
      const isDismissed = localStorage.getItem(dismissKey) === '1';
      setDismissed(isDismissed);
      if (isDismissed) return;
      let picked: BannerVariant = 'coach';
      try {
        if (readFollowedTeam(orgSlug, tournamentSlug)) {
          picked = 'coach';
        } else {
          picked = localStorage.getItem(VARIANT_ROTOR_KEY) === 'coach' ? 'organizer' : 'coach';
        }
        localStorage.setItem(VARIANT_ROTOR_KEY, picked);
      } catch { /* storage unavailable → coach default */ }
      setVariant(picked);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dismissKey, orgSlug, tournamentSlug]);

  const activeHref = variant === 'organizer' ? organizerHref : teamHref;

  useEffect(() => {
    if (dismissed || hiddenForFlow || !variant) return;
    const key = `flhq-acq-view-public_tournament_banner-${orgSlug}-${tournamentSlug}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    trackTournamentAcquisition({
      eventType: 'tournament_plus_acquisition_cta_viewed',
      acquisitionSource: 'public_tournament_banner',
      surface: 'public_home',
      orgSlug,
      tournamentSlug,
      currentPath: window.location.pathname,
      ctaHref: activeHref,
    });
  }, [dismissed, hiddenForFlow, variant, activeHref, orgSlug, tournamentSlug]);

  if (dismissed || hiddenForFlow || !variant) return null;

  const isCoach = variant === 'coach';

  return (
    <aside
      className={isCoach ? styles.banner : `${styles.banner} ${styles.bannerOrganizer}`}
      aria-label={isCoach ? 'Set up your team on FieldLogicHQ' : 'Run your own event on FieldLogicHQ'}
    >
      <div className={isCoach ? styles.bannerIcon : `${styles.bannerIcon} ${styles.bannerIconBlue}`}>
        {isCoach ? <Trophy size={18} /> : <ClipboardList size={18} />}
      </div>
      <div className={styles.bannerBody}>
        {isCoach ? (
          <>
            <strong>Keep this team organized after {tournamentName}</strong>
            <span>Roster, schedule &amp; fees in a free team home.</span>
          </>
        ) : (
          <>
            <strong>Run your own event on FieldLogicHQ</strong>
            <span>Free to start · live scores &amp; brackets like this one.</span>
          </>
        )}
      </div>
      <Link
        href={activeHref}
        className={isCoach ? styles.bannerCta : styles.bannerCtaGhostBlue}
        onClick={() => trackTournamentAcquisition({
          eventType: 'tournament_plus_acquisition_cta_clicked',
          acquisitionSource: 'public_tournament_banner',
          surface: 'public_home',
          orgSlug,
          tournamentSlug,
          currentPath: window.location.pathname,
          ctaHref: activeHref,
        })}
      >
        {isCoach ? 'Set up your team — free' : 'Run an event — free'}
      </Link>
      <button
        type="button"
        className={styles.dismissBtn}
        onClick={() => {
          localStorage.setItem(dismissKey, '1');
          setDismissed(true);
          // Same-page listeners (the Powered-by badge's offset) react immediately.
          window.dispatchEvent(new Event('flhq-acq-banner-dismissed'));
        }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
