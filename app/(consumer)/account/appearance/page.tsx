import type { Metadata } from 'next';
import { getAuthUserCached } from '@/lib/supabase-server';
import AppearanceCard from '@/components/consumer/AppearanceCard';
import styles from '../account.module.css';

// Reflects sign-in state (saved-theme write-through) — dynamic, never indexed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Appearance',
  robots: { index: false, follow: false },
};

/**
 * Appearance section (Desktop Phase 2). On desktop this is the rail's Appearance pane;
 * visited directly on a phone it renders as a plain stacked page (nothing links here
 * below 1024px — the Account stack keeps its inline AppearanceCard).
 */
export default async function AccountAppearancePage() {
  const user = await getAuthUserCached();

  return (
    <div className={styles.sectionPane}>
      <h2 className={styles.paneHeading}>Appearance</h2>
      <AppearanceCard signedIn={!!user?.email} />
    </div>
  );
}
