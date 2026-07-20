import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getAuthDestination } from '@/lib/auth-destination';
import AddOrgForm from './AddOrgForm';
import styles from '../start.module.css';

export const metadata: Metadata = {
  title: 'Run a tournament — FieldLogicHQ',
};

/**
 * /start/tournament — the organizer on-ramp.
 *  - Signed OUT → a one-screen heads-up, then the tournament signup (creates the auth
 *    user + first org). Previously a silent redirect that dumped visitors into the
 *    heaviest form in the funnel unannounced (Founding Season coaches-free plan, P13).
 *  - Signed IN with NO org yet → create their first org (account-first / invited-then-no-invite).
 *  - Signed IN who ALREADY has an org → redirect home. Identity model is "single-org by default"
 *    (decision 2026-06-19): a second organization is reached only by a deliberate invite or a
 *    Coaches Portal purchase — never by self-serve spinning up another empty workspace here.
 */
export default async function StartTournamentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.iconWrap}>
              <Trophy size={21} strokeWidth={1.8} aria-hidden />
            </div>
            <h1 className={styles.title}>Run a tournament</h1>
            <p className={styles.sub}>Free — no credit card</p>
          </header>

          <p className={styles.lead}>
            Next step: create your free organizer account — your name, email, and your
            organization&apos;s name. That&apos;s the whole form. You&apos;ll land in your own
            dashboard with registration, schedule, brackets, and a public site ready to set up.
          </p>

          <div className={styles.actions}>
            <Link href="/auth/signup" className={styles.ctaPrimary}>
              Create your free account →
            </Link>
            <Link href="/auth/login" className={styles.ctaSecondary}>
              I already have an account
            </Link>
          </div>

          <footer className={styles.footer}>
            <Link href="/start" className={styles.footerLink}>← Back to all options</Link>
          </footer>
        </div>
      </div>
    );
  }
  if (await isPlatformAdminEmail(user.email)) {
    redirect('/platform-admin');
  }

  // Single-org by default: an existing member can't self-serve a second empty org. Only a
  // brand-new account with no active membership yet reaches the create-first-org form.
  const { count: activeMemberships } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');
  if ((activeMemberships ?? 0) > 0) {
    // Drop them into their existing workspace — getAuthDestination carries the
    // single-context fast-path the retired /home launchpad used to provide.
    redirect(await getAuthDestination());
  }

  // A pending invite means they already have somewhere to go — send them to Home's
  // pending-invite card instead of creating a stray org (Sign-up Invite Guard, Phase 3).
  const { count: pendingInvites } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'invited');
  if ((pendingInvites ?? 0) > 0) {
    redirect('/discover');
  }

  return <AddOrgForm />;
}
