'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useClubBase, usePublicPathname } from '@/lib/use-public-pathname';
import {
  ACQUISITION_BANNER_DISMISSED_EVENT,
  acquisitionBannerDismissKey,
  buildTournamentAcquisitionHref,
  isAcquisitionHiddenOnPath,
  trackTournamentAcquisition,
} from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type PoweredByBadgeProps = {
  orgSlug: string;
  tournamentSlug: string;
  /** This visitor is offered the banner, so the badge waits until it is closed. */
  yieldToBanner?: boolean;
};

export default function PoweredByBadge({ orgSlug, tournamentSlug, yieldToBanner = false }: PoweredByBadgeProps) {
  const pathname = usePublicPathname();
  // Same page rule as the banner: the badge is absent on the registration form and the
  // score-entry screens, where it floated over the form's fields and submit button (2026-10-16).
  const hiddenForFlow = isAcquisitionHiddenOnPath(pathname);
  // One card at a time (owner 2026-11-26): the banner first, this badge once it is closed. The banner is never
  // on a club's own web address (hideOnClubOwnHost), so there the badge has nothing to wait for.
  const onClubOwnHost = useClubBase()?.ownHost === true;
  const waitsForBanner = yieldToBanner && !onClubOwnHost;
  // The server only knows the banner is *eligible*; whether it was closed is client state (localStorage),
  // so a waiting badge stays off the page until that is read. Deferred via setTimeout(0) — the same
  // hydration-safe idiom the banner itself uses. Held as the key, so one event's answer never serves another.
  const dismissKey = acquisitionBannerDismissKey(orgSlug, tournamentSlug);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!waitsForBanner) return;
    const timer = window.setTimeout(() => {
      try {
        if (localStorage.getItem(dismissKey) === '1') setClosedKey(dismissKey);
      } catch {
        setClosedKey(dismissKey); // no storage: the banner cannot show either
      }
    }, 0);
    const onDismiss = () => setClosedKey(dismissKey);
    window.addEventListener(ACQUISITION_BANNER_DISMISSED_EVENT, onDismiss);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(ACQUISITION_BANNER_DISMISSED_EVENT, onDismiss);
    };
  }, [waitsForBanner, dismissKey]);
  const visible = !hiddenForFlow && (!waitsForBanner || closedKey === dismissKey);

  const href = buildTournamentAcquisitionHref({
    source: 'public_powered_by_badge',
    orgSlug,
    tournamentSlug,
    surface: 'public_home',
  });

  useEffect(() => {
    // A badge that is not on screen is not a view — and must not use up the session's one
    // view either, or landing on the register form first would hide every later impression.
    if (!visible) return;
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
  }, [visible, href, orgSlug, tournamentSlug]);

  if (!visible) return null;

  return (
    <aside
      className={styles.poweredBy}
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
