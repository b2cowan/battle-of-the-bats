import type { Metadata } from 'next';
import Link from 'next/link';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import AccountSignOutButton from '@/components/consumer/AccountSignOutButton';
import styles from '@/components/consumer/ConsumerPage.module.css';

// Reflects sign-in state — dynamic and not for indexing.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  const signedIn = !!email;

  return (
    <div className={styles.accountPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Account</h1>
      </div>

      {/* Identity block — the one thing this screen exists to show, given real weight. */}
      <div className={styles.identity}>
        <span className={styles.identityAvatar} aria-hidden>
          {signedIn ? email!.charAt(0).toUpperCase() : <User size={22} />}
        </span>
        <span className={styles.identityMeta}>
          <span className={styles.identityLabel}>{signedIn ? 'Signed in' : 'Not signed in'}</span>
          <span className={styles.identityValue}>
            {signedIn ? email : 'Sign in to manage your organizations, teams, and season'}
          </span>
        </span>
      </div>

      {/* Primary + secondary actions, full-width block buttons. */}
      <div className={styles.accountActions}>
        {signedIn ? (
          /* Account things ONLY (owner direction 2026-07-14): the tabs already carry
             Discover/Following, and Your FieldLogicHQ is the one door to every
             workspace (incl. the coaches hub) — no duplicate destination rows here. */
          <>
            <Link href="/home" className={`${styles.cta} ${styles.blockBtn}`}>Your FieldLogicHQ →</Link>
            <Link href="/account/notifications" className={`${styles.ctaGhost} ${styles.blockBtn}`}>Notification settings</Link>
            <AccountSignOutButton />
          </>
        ) : (
          <>
            <Link href="/auth/login" className={`${styles.cta} ${styles.blockBtn}`}>Sign in</Link>
            <Link href="/auth/signup?account=1&next=/discover" className={`${styles.ctaGhost} ${styles.blockBtn}`}>Create free account</Link>
          </>
        )}
      </div>

      {/* Quiet organizer note, pinned to the bottom of the viewport. */}
      <p className={`${styles.note} ${styles.pinBottom}`}>
        Following works on this device without an account — sign in to keep your teams on every
        device you use. Organizing an event?{' '}
        <Link href="/start" className={styles.noteLink}>Run a tournament →</Link>
      </p>
    </div>
  );
}
