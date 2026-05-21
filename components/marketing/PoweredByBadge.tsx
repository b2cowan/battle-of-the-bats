'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buildTournamentAcquisitionHref, trackTournamentAcquisition } from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type PoweredByBadgeProps = {
  orgSlug: string;
  tournamentSlug: string;
  offsetForBanner?: boolean;
};

export default function PoweredByBadge({ orgSlug, tournamentSlug, offsetForBanner = false }: PoweredByBadgeProps) {
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
      className={`${styles.poweredBy} ${offsetForBanner ? styles.poweredByWithBanner : ''}`}
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
