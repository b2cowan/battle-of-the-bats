import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy, ChevronRight, HelpCircle } from 'lucide-react';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess } from '@/lib/user-contexts';
import AccountFeedbackRow from '@/components/consumer/AccountFeedbackRow';
import { SUPPORT_MAILTO } from '../support';
import styles from '../account.module.css';

// Coach-gated rows — dynamic, never indexed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Help & support',
  robots: { index: false, follow: false },
};

/**
 * Help section (Desktop Phase 2). The support rows from the stacked Account page, on
 * their own rail section: Help & support for everyone, plus the coach utilities for
 * accounts that coach (same gate and the same per-request access-context cache as the
 * stacked page). Reuses the settings-row vocabulary unchanged.
 */
export default async function AccountHelpPage() {
  const user = await getAuthUserCached();

  let isCoach = false;
  if (user?.email) {
    const contexts = await getUserAccessContextsCached(user.id, user.email).catch(() => []);
    isCoach = hasCoachAccess(contexts);
  }

  return (
    <div className={styles.sectionPane}>
      <h2 className={styles.paneHeading}>Help</h2>
      <div className={`${styles.rows} ${styles.rowsFlush}`}>
        <a href={SUPPORT_MAILTO} className={styles.row}>
          <span className={styles.rowIcon}><LifeBuoy size={19} aria-hidden /></span>
          <span className={styles.rowLabel}>Help &amp; support</span>
          <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
        </a>
        {isCoach && (
          <>
            <Link href="/coaches/help" className={styles.row}>
              <span className={styles.rowIcon}><HelpCircle size={19} aria-hidden /></span>
              <span className={styles.rowLabel}>Coaches Portal help</span>
              <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
            </Link>
            <AccountFeedbackRow />
          </>
        )}
      </div>
    </div>
  );
}
