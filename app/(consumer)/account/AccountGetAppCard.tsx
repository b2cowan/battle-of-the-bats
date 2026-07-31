'use client';
/**
 * "Get the app" QR card (Account tab · Desktop Public UX Phase 1, WI-11).
 *
 * The exact complement of AccountInstallRow. That row is the manual install trigger and shows
 * ONLY on a phone/tablet browser — which left the desktop case with no mention of the mobile
 * app at all (the PWA is deliberately invisible on desktop: coarse-pointer gate plus a
 * site-wide `beforeinstallprompt` suppression). This card fills that gap the only way that
 * doesn't touch any of that logic: a QR you point your phone at.
 *
 * Nothing here changes install-prompt behaviour. It is a static image and a line of copy.
 *
 * Shown when the install row is NOT (i.e. on desktop, and inside the already-installed app on
 * desktop), so the two never appear together and a phone user is never told to scan a code with
 * the phone they are already holding.
 */
import { useEffect, useState } from 'react';
import { isInstallEligibleBrowser } from '@/lib/device';
import GetAppQr from '@/components/shared/GetAppQr';
import styles from './account.module.css';

export default function AccountGetAppCard() {
  // Mirrors AccountInstallRow's one-shot device sync. Starts false so SSR (device-agnostic)
  // renders nothing and there is no hydration flash in either direction.
  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot sync of a client-only device capability on mount, same pattern as AccountInstallRow
    setShowCard(!isInstallEligibleBrowser());
  }, []);
  if (!showCard) return null;

  return (
    <div className={styles.getAppCard}>
      <GetAppQr size={92} />
    </div>
  );
}
