'use client';

import Link from 'next/link';
import { Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { trackTournamentAcquisition } from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type CoachTournamentAwarenessBannerProps = {
  orgSlug: string;
  isTeamWorkspace?: boolean;
};

type HasTournamentsResponse = {
  hasTournamentEntitlement: boolean;
  hasTournaments: boolean;
};

export default function CoachTournamentAwarenessBanner({ orgSlug, isTeamWorkspace = false }: CoachTournamentAwarenessBannerProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const dismissKey = `flhq-acq-dismiss-coach_portal_banner-${orgSlug}`;
  const href = useMemo(() => `/${orgSlug}/admin/org/tournaments?source=coach_portal_banner`, [orgSlug]);

  useEffect(() => {
    if (localStorage.getItem(dismissKey) === '1') return;
    let active = true;
    fetch('/api/admin/org/has-tournaments')
      .then(res => res.ok ? res.json() as Promise<HasTournamentsResponse> : null)
      .then(data => {
        if (!active || !data) return;
        const visible = data.hasTournamentEntitlement && !data.hasTournaments;
        setShouldShow(visible);
        if (visible) {
          trackTournamentAcquisition({
            eventType: 'tournament_plus_acquisition_cta_viewed',
            acquisitionSource: 'coach_portal_banner',
            surface: 'admin_upgrade_gate',
            orgSlug,
            currentPath: window.location.pathname,
            ctaHref: href,
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [dismissKey, href, orgSlug]);

  if (!shouldShow) return null;

  return (
    <aside className={styles.coachBanner} aria-label="Tournament setup suggestion">
      <div className={styles.bannerIcon}>
        <Trophy size={18} />
      </div>
      <div className={styles.bannerBody}>
        <strong>{isTeamWorkspace ? 'Your team can run local tournaments here too' : 'Your org can run tournaments here too'}</strong>
        <span>
          {isTeamWorkspace
            ? 'Set up a quick round robin or exhibition weekend from this Coaches Portal.'
            : 'Coaches often organize events. Start setup in the tournament admin area, or share this with your org owner.'}
        </span>
      </div>
      <Link
        href={href}
        className={styles.bannerCta}
        onClick={() => trackTournamentAcquisition({
          eventType: 'tournament_plus_acquisition_cta_clicked',
          acquisitionSource: 'coach_portal_banner',
          surface: 'admin_upgrade_gate',
          orgSlug,
          currentPath: window.location.pathname,
          ctaHref: href,
        })}
      >
        Open setup
      </Link>
      <button
        type="button"
        className={styles.dismissBtn}
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(dismissKey, '1');
          setShouldShow(false);
        }}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
