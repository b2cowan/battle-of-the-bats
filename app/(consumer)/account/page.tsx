import type { Metadata } from 'next';
import Link from 'next/link';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
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
          <>
            <Link href="/home" className={`${styles.cta} ${styles.blockBtn}`}>Open your workspaces →</Link>
            <Link href="/discover" className={`${styles.ctaGhost} ${styles.blockBtn}`}>Browse tournaments</Link>
          </>
        ) : (
          <>
            <Link href="/auth/login" className={`${styles.cta} ${styles.blockBtn}`}>Sign in</Link>
            <Link href="/auth/signup" className={`${styles.ctaGhost} ${styles.blockBtn}`}>Create free account</Link>
          </>
        )}
      </div>

      {/* Quiet organizer note, pinned to the bottom of the viewport. */}
      <p className={`${styles.note} ${styles.pinBottom}`}>
        You don&rsquo;t need an account to follow teams and get live scores — following works on this
        device right away. An account is for organizers, coaches, and staff who run events.{' '}
        <Link href="/start" className={styles.noteLink}>Run a tournament →</Link>
      </p>
    </div>
  );
}
