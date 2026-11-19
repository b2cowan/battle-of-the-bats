import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import styles from '../start.module.css';
import { getSignedInUser } from '@/lib/two-step-session';
import { gatedPlanTag, gatedPlanSentence, interestButtonLabel, GATED_PLAN_INTEREST_LINE } from '@/lib/plan-config';

export const metadata: Metadata = {
  title: 'Explore Club — FieldLogicHQ',
};

/**
 * /start/club while Club is closed (W50, ruled 2026-11-18): the canon closed sentence and the interest door. The
 * consultative "we set up Club with you" page is gone — the 2026-11-18 open-launch ruling struck exactly that line.
 * The real Club start (account → club name → plan) replaces this page when Club is open: S2 of the on-sale pages.
 */
export default async function StartClubPage() {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.container} ${styles.containerNarrow}`}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <Building2 size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Explore Club</h1>
          <p className={styles.sub}>Club — {gatedPlanTag('club').toLowerCase()}</p>
        </header>

        <p className={styles.lead}>
          Club brings everything together for multi-team organizations — house league, rep teams,
          accounting, and a Premium Coaches Portal for your whole coaching staff.{' '}
          {gatedPlanSentence('club')} {GATED_PLAN_INTEREST_LINE}
        </p>

        <div className={styles.actions}>
          <EarlyAccessModalTrigger
            className={styles.ctaPrimary}
            initialPlanInterest={['club']}
            initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
          >
            {interestButtonLabel(['club'])}
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
