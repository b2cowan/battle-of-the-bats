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
import { paidDoorPick, parseStartPricing, readStartDoor } from '@/lib/start-door';
import { startStepViewer } from '@/lib/start-door-server';
import { isPaidDoorOpen, paidDoorRedirect } from '@/lib/start-plan-server';
import StartPaidDoorForm from '../StartPaidDoorForm';

/** The tab says what the page is for in each state (open: the door; closed: the interest page, as S1 left it). */
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await isPaidDoorOpen('club')) ? 'Start a club' : 'Explore Club' };
}

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

/**
 * /start/club — Start a club (On-sale pages S2), read from the live gate on every visit.
 *  - OPEN (Club or Club · Association on sale): signed out → step 1, the account, with the pricing page's pick; signed in
 *    → step 2, the club's name, unless a gate sends them elsewhere first (`paidDoorRedirect`: staff; an owner of a real
 *    organization to that organization's plan step or Plan & billing; a live invitation to Home; a Premium coach to their
 *    own portal's "Start your club", trap D). Step 3 is the plan step in the club's own setup.
 *  - CLOSED (W50, ruled 2026-11-18): the canon closed sentence and the interest door, as S1 left it.
 */
export default async function StartClubPage({ searchParams }: {
  searchParams: Promise<{ confirmed?: Param; plan?: Param; billing?: Param }>;
}) {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  if (await isPaidDoorOpen('club')) {
    const sp = await searchParams;
    const linkPick = paidDoorPick('club', parseStartPricing(first(sp.plan), first(sp.billing)));
    if (!user?.email) return <StartPaidDoorForm door="club" viewer={null} pricing={linkPick} />;
    const elsewhere = await paidDoorRedirect({ id: user.id, email: user.email }, 'club');
    if (elsewhere) redirect(elsewhere);
    // The newer choice — the one in the address — wins over the one remembered at sign-up (as Run a tournament).
    const remembered = readStartDoor(user.user_metadata);
    const pricing = linkPick ?? (remembered?.door === 'club' ? remembered.pricing ?? null : null);
    return <StartPaidDoorForm door="club" viewer={await startStepViewer(user)} confirmed={first(sp.confirmed) === '1'} pricing={pricing} />;
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
