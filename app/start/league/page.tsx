import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import styles from '../start.module.css';

export const metadata: Metadata = {
  title: 'Start a small league season — FieldLogicHQ',
};

/**
 * /start/league — thin wrapper over the existing League express-interest capture.
 * The free League Starter floor + server-side caps are a later phase; here we only
 * route the persona to express interest (League self-serve isn't live yet).
 */
export default async function StartLeaguePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <CalendarDays size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Start a small league season</h1>
          <p className={styles.sub}>League — coming soon</p>
        </header>

        <p className={styles.lead}>
          League runs your full house-league season — registration, draft, scheduling, standings,
          and parent communications in one dashboard. Self-serve checkout is opening soon. Express
          interest and we&apos;ll notify you the moment it&apos;s available for your organization.
        </p>

        <div className={styles.actions}>
          <EarlyAccessModalTrigger
            className={styles.ctaPrimary}
            initialPlanInterest={['league']}
            initialFeaturesInterested={['house_league', 'registration', 'public_site']}
          >
            Express interest in League
          </EarlyAccessModalTrigger>
          <Link href="/for-leagues" className={styles.ctaSecondary}>
            See how League works →
          </Link>
        </div>

        <footer className={styles.footer}>
          Running a tournament now?{' '}
          <Link href="/start/tournament" className={styles.footerLink}>Start free</Link>
          {' · '}
          <Link href="/start" className={styles.footerLink}>Back</Link>
        </footer>
      </div>
    </div>
  );
}
