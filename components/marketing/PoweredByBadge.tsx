'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { buildTournamentAcquisitionHref, trackTournamentAcquisition } from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type PoweredByBadgeProps = {
  orgSlug: string;
  tournamentSlug: string;
  offsetForBanner?: boolean;
};

export default function PoweredByBadge({ orgSlug, tournamentSlug, offsetForBanner = false }: PoweredByBadgeProps) {
  const pathname = usePathname();
  // The server only knows the banner is *eligible*; whether it actually shows is
  // client state (localStorage dismissal + per-flow suppression). Track it here so
  // the badge never keeps a phantom "banner above me" offset, floating mid-page
  // (conversion sweep 2026-07-14, Journey F finding 2). Deferred read via
  // setTimeout(0) — the same hydration-safe idiom the banner itself uses.
  const hiddenForFlow = pathname?.endsWith('/register') || pathname?.includes('/official');
  const bannerEligible = offsetForBanner && !hiddenForFlow;
  const [bannerDismissed, setBannerDismissed] = useState(true);
  useEffect(() => {
    if (!bannerEligible) return;
    const dismissKey = `flhq-acq-dismiss-public_tournament_banner-${orgSlug}-${tournamentSlug}`;
    const timer = window.setTimeout(() => {
      setBannerDismissed(localStorage.getItem(dismissKey) === '1');
    }, 0);
    const onDismiss = () => setBannerDismissed(true);
    window.addEventListener('flhq-acq-banner-dismissed', onDismiss);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('flhq-acq-banner-dismissed', onDismiss);
    };
  }, [bannerEligible, orgSlug, tournamentSlug]);
  const bannerVisible = bannerEligible && !bannerDismissed;

  const href = buildTournamentAcquisitionHref({
    source: 'public_powered_by_badge',
    orgSlug,
    tournamentSlug,
    surface: 'public_home',
  });

  useEffect(() => {
    const key = `flhq-acq-view-public_powered_by_badge-${orgSlug}-${tournamentSlug}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    trackTournamentAcquisition({
      eventType: 'tournament_plus_acquisition_cta_viewed',
      acquisitionSource: 'public_powered_by_badge',
      surface: 'public_home',
      orgSlug,
      tournamentSlug,
      currentPath: window.location.pathname,
      ctaHref: href,
    });
  }, [href, orgSlug, tournamentSlug]);

  return (
    <aside
      className={`${styles.poweredBy} ${bannerVisible ? styles.poweredByWithBanner : ''}`}
      aria-label="Tournament platform attribution"
    >
      <span>Powered by FieldLogicHQ</span>
      <Link
        href={href}
        onClick={() => trackTournamentAcquisition({
          eventType: 'tournament_plus_acquisition_cta_clicked',
          acquisitionSource: 'public_powered_by_badge',
          surface: 'public_home',
          orgSlug,
          tournamentSlug,
          currentPath: window.location.pathname,
          ctaHref: href,
        })}
      >
        Run your own tournament
      </Link>
    </aside>
  );
}
