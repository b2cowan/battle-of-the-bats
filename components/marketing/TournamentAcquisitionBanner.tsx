'use client';

import Link from 'next/link';
import { Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { buildTournamentAcquisitionHref, trackTournamentAcquisition } from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type TournamentAcquisitionBannerProps = {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
};

export default function TournamentAcquisitionBanner({
  orgSlug,
  tournamentSlug,
  tournamentName,
}: TournamentAcquisitionBannerProps) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);
  const dismissKey = `flhq-acq-dismiss-public_tournament_banner-${orgSlug}-${tournamentSlug}`;
  const hiddenForFlow = pathname?.endsWith('/register') || pathname?.includes('/official');
  const href = useMemo(() => buildTournamentAcquisitionHref({
    source: 'public_tournament_banner',
    orgSlug,
    tournamentSlug,
    surface: 'public_home',
  }), [orgSlug, tournamentSlug]);

  useEffect(() => {
    window.setTimeout(() => {
      setDismissed(localStorage.getItem(dismissKey) === '1');
    }, 0);
  }, [dismissKey]);

  useEffect(() => {
    if (dismissed || hiddenForFlow) return;
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
      ctaHref: href,
    });
  }, [dismissed, hiddenForFlow, href, orgSlug, tournamentSlug]);

  if (dismissed || hiddenForFlow) return null;

  return (
    <aside className={styles.banner} aria-label="Run your own tournament">
      <div className={styles.bannerIcon}>
        <Trophy size={18} />
      </div>
      <div className={styles.bannerBody}>
        <strong>Run a tournament like {tournamentName}</strong>
        <span>Start free, then add registration control, branding, and automation when your event grows.</span>
      </div>
      <Link
        href={href}
        className={styles.bannerCta}
        onClick={() => trackTournamentAcquisition({
          eventType: 'tournament_plus_acquisition_cta_clicked',
          acquisitionSource: 'public_tournament_banner',
          surface: 'public_home',
          orgSlug,
          tournamentSlug,
          currentPath: window.location.pathname,
          ctaHref: href,
        })}
      >
        See plans
      </Link>
      <button
        type="button"
        className={styles.dismissBtn}
        onClick={() => {
          localStorage.setItem(dismissKey, '1');
          setDismissed(true);
        }}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </aside>
  );
}
