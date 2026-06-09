import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import styles from '../start.module.css';

export const metadata: Metadata = {
  title: 'Explore Club — FieldLogicHQ',
};

/**
 * /start/club — consultative only. Club has no self-serve free path in this rollout;
 * we capture interest and route to a guided conversation. Thin wrapper over the
 * existing Club express-interest capture.
 */
export default async function StartClubPage() {
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
            <Building2 size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Explore Club</h1>
          <p className={styles.sub}>Club — let&apos;s talk</p>
        </header>

        <p className={styles.lead}>
          Club brings everything together for multi-team organizations — house league, rep teams,
          accounting, org-wide financials, and Coaches Portal accounts. We set up Club with you
          directly. Tell us about your organization and we&apos;ll reach out to plan a guided setup.
        </p>

        <div className={styles.actions}>
          <EarlyAccessModalTrigger
            className={styles.ctaPrimary}
            initialPlanInterest={['club']}
            initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
          >
            Talk to us about Club
          </EarlyAccessModalTrigger>
          <Link href="/for-clubs" className={styles.ctaSecondary}>
            See what Club includes →
          </Link>
        </div>

        <footer className={styles.footer}>
          <Link href="/start" className={styles.footerLink}>← Back to all options</Link>
        </footer>
      </div>
    </div>
  );
}
