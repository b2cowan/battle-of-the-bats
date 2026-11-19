import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { getAuthUserCached } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { startStepViewer } from '@/lib/start-door-server';
import StartPaidDoorForm from '../StartPaidDoorForm';
import { paidDoorPick, parseStartPricing, readStartDoor } from '@/lib/start-door';
import { isPaidDoorOpen, paidDoorRedirect } from '@/lib/start-plan-server';
import styles from '../start.module.css';
import { gatedPlanTag, gatedPlanSentence, interestButtonLabel, GATED_PLAN_INTEREST_LINE } from '@/lib/plan-config';

export const metadata: Metadata = {
  title: 'Start a league season — FieldLogicHQ',
};

/**
 * /start/league — Start a league season, read from the live gate on every visit.
 *  - LEAGUE PLUS ON SALE (On-sale pages S2) → the League Plus start (StartPaidDoorForm): account, the league's name,
 *    then the one-card League Plus plan step, billing address and Stripe. Signed-in gates as Start a club
 *    (`paidDoorRedirect`), without the coach one: a coach's league is a separate organization, and no team moves.
 *  - else → the express-interest page (W54). There is no free League (owner ruling 2026-11-19, BUSINESS_DECISIONS.md):
 *    the free League starter, its flag and its 1 season / 1 division / 8 teams caps are gone.
 */
export default async function StartLeaguePage({ searchParams }: { searchParams: Promise<{ confirmed?: string | string[]; plan?: string | string[]; billing?: string | string[] }> }) {
  // Back from the verification link: the flag.
  const sp = await searchParams;
  const confirmed = (Array.isArray(sp.confirmed) ? sp.confirmed[0] : sp.confirmed) === '1';
  const user = await getAuthUserCached();
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  if (await isPaidDoorOpen('league')) {
    const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
    const linkPick = paidDoorPick('league', parseStartPricing(first(sp.plan), first(sp.billing)));
    if (!user?.email) return <StartPaidDoorForm door="league_plus" viewer={null} pricing={linkPick} />;
    const elsewhere = await paidDoorRedirect({ id: user.id, email: user.email }, 'league');
    if (elsewhere) redirect(elsewhere);
    const remembered = readStartDoor(user.user_metadata);
    const pricing = linkPick ?? (remembered?.door === 'league' ? remembered.pricing ?? null : null);
    return <StartPaidDoorForm door="league_plus" viewer={await startStepViewer(user)} confirmed={confirmed} pricing={pricing} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrap}>
            <CalendarDays size={21} strokeWidth={1.8} aria-hidden />
          </div>
          <h1 className={styles.title}>Start a league season</h1>
          {/* W54 closed (ruled 2026-11-18): this page sells League Plus, so it says "League Plus", never a bare
              "League", with the canon sentence and the interest line. */}
          <p className={styles.sub}>League Plus — {gatedPlanTag('league').toLowerCase()}</p>
        </header>

        <p className={styles.lead}>
          League Plus runs your full house league season — registration, draft, scheduling, standings,
          and parent communications in one dashboard. {gatedPlanSentence('league')} {GATED_PLAN_INTEREST_LINE}
        </p>

        <div className={styles.actions}>
          <EarlyAccessModalTrigger
            className={styles.ctaPrimary}
            initialPlanInterest={['league']}
            initialFeaturesInterested={['house_league', 'registration', 'public_site']}
          >
            {interestButtonLabel(['league'])}
          </EarlyAccessModalTrigger>
          <Link href="/for-leagues" className={styles.ctaSecondary}>
            See how League Plus works →
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
