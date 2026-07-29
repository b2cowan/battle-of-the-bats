import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { getAuthDestination } from '@/lib/auth-destination';
import StartLeagueForm from './StartLeagueForm';
import styles from '../start.module.css';

export const metadata: Metadata = {
  title: 'Start a league season — FieldLogicHQ',
};

/**
 * /start/league — the Free League Starter on-ramp.
 *  - LEAGUE_STARTER_BETA on  → a real create path (StartLeagueForm) → the house-league
 *    onboarding wizard. The free floor caps at 1 season / 1 division / 8 teams.
 *  - LEAGUE_STARTER_BETA off → the express-interest waitlist (self-serve not live yet).
 * Unlisted capped beta: not linked from marketing until caps + first-value data are proven
 * (the /start picker also reflects the flag).
 */
export default async function StartLeaguePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  if (process.env.LEAGUE_STARTER_BETA === 'true') {
    // Single-org by default: a signed-in user who already belongs to a REAL org can't self-serve a
    // second via the league path. A user's own Coaches Portal doesn't count (exemption-aware helper),
    // so a portal-owning coach can still create their first league. Mirrors /start/tournament.
    if (user?.id && (await userBelongsToOtherRealOrg(user.id))) {
      redirect(await getAuthDestination());
    }

    // A pending invite means they already have somewhere to go — send them to Home's pending-invite
    // card instead of creating a stray league that would then block the accept. Mirrors
    // /start/tournament; the API enforces the same rule for anyone who bypasses this page.
    if (user?.id) {
      const { count: pendingInvites } = await supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'invited');
      if ((pendingInvites ?? 0) > 0) {
        redirect('/discover');
      }
    }

    return <StartLeagueForm isLoggedIn={Boolean(user?.email)} email={user?.email ?? null} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <CalendarDays size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Start a league season</h1>
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
