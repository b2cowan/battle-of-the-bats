'use client';
/**
 * "Install app" settings row (Account tab, Unified Home Phase 5).
 *
 * Reuses the shared InstallAppPrompt — already mounted in the consumer layout — via the
 * `flhq:show-install` window event. That prompt owns the platform split: Android one-tap
 * Install, iOS "Share → Add to Home Screen" instructions, and a generic browser-menu fallback.
 * This row is just the manual trigger.
 *
 * Gated on `isInstallEligibleBrowser()` (the ONE canonical install-eligibility rule): shows only
 * in a phone/tablet browser, and hides on desktop and inside the already-installed app — so an
 * installed or desktop user never sees a dead row. Renders nothing until the client effect runs
 * (SSR is anon/device-agnostic), so there's no hydration flash.
 */
import { useEffect, useState } from 'react';
import { Download, ChevronRight } from 'lucide-react';
import { isInstallEligibleBrowser } from '@/lib/device';
import styles from './account.module.css';

export default function AccountInstallRow() {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot sync of a client-only device capability on mount (SSR can't know install-eligibility); same pattern as InstallAppPrompt / WhatsNewIntro
    setEligible(isInstallEligibleBrowser());
  }, []);
  if (!eligible) return null;

  return (
    <button
      type="button"
      className={styles.row}
      onClick={() => window.dispatchEvent(new Event('flhq:show-install'))}
    >
      <span className={styles.rowIcon}><Download size={19} aria-hidden /></span>
      <span className={styles.rowLabel}>Install app</span>
      <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
    </button>
  );
}
