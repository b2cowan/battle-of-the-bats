import type { Metadata } from 'next';
import Link from 'next/link';
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
  const signedIn = !!user?.email;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Account</h1>
        <p className={styles.subtitle}>
          {signedIn
            ? `Signed in as ${user!.email}`
            : 'Sign in to manage your organizations, teams, and season.'}
        </p>
      </div>

      {signedIn ? (
        <div className={styles.actions}>
          <Link href="/home" className={styles.cta}>Open your workspaces →</Link>
          <Link href="/discover" className={styles.ctaGhost}>Browse tournaments</Link>
        </div>
      ) : (
        <div className={styles.actions}>
          <Link href="/auth/login" className={styles.cta}>Sign in</Link>
          <Link href="/auth/signup" className={styles.ctaGhost}>Create free account</Link>
        </div>
      )}

      <p className={styles.note}>
        You don&rsquo;t need an account to follow teams and get live scores — following works on this
        device right away. An account is for organizers, coaches, and staff who run events.
      </p>
    </div>
  );
}
