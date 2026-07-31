import type { Metadata } from 'next';
import GetAppQr from '@/components/shared/GetAppQr';
import styles from '../account.module.css';

// Static content, but explicitly dynamic like its siblings — defense-in-depth so a future
// config change (PPR/cacheComponents) can't quietly make an /account/* route cacheable.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Get the app',
  robots: { index: false, follow: false },
};

/**
 * Get the app section (Desktop Phase 2) — the rail home of the WI-11 QR card. No device
 * gate here, unlike the stacked page's AccountGetAppCard: this route IS the get-the-app
 * destination, so it always shows the code (the footer yields its own QR on this route,
 * same exact-match dedup rule as /account itself — see Footer.tsx).
 */
export default function AccountGetTheAppPage() {
  return (
    <div className={styles.sectionPane}>
      <h2 className={styles.paneHeading}>Get the app</h2>
      <div className={styles.getAppCard}>
        <GetAppQr size={92} />
      </div>
    </div>
  );
}
