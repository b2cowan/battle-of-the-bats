import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { findSuspendedMembershipOrg, getUserAccessContexts } from '@/lib/user-contexts';
import SignOutButton from './SignOutButton';
import styles from '../auth.module.css';

export const dynamic = 'force-dynamic';

/**
 * Suspended-account explanation page (J10-019). A suspended member authenticates fine but resolves
 * to zero ACTIVE contexts, so the destination resolver routes them here instead of looping them
 * through login forever (or dumping them into org-creation). Shows the org name, what to do, and a
 * sign-out — the only action available to them.
 *
 * Server component: resolves the org server-side (no flash). Guards both ways — an unauthenticated
 * visitor goes to login; a user who actually HAS active access (reached this URL by accident) goes
 * to their workspace.
 */
export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/auth/login');

  // If the user has any active workspace, they're not locked out — don't show a suspended wall.
  const contexts = await getUserAccessContexts({ id: user.id, email: user.email });
  if (contexts.length > 0) redirect('/home');

  const suspended = await findSuspendedMembershipOrg(user.id);
  // No suspended membership either → nothing to explain here; route to the normal front door.
  if (!suspended) redirect('/start');

  const orgName = suspended.name?.trim() || 'your organization';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h1 className={styles.title}>Account suspended</h1>
          <p className={styles.sub}>
            Your access to <strong>{orgName}</strong> has been suspended.
          </p>
        </div>

        <p className={styles.footerText} style={{ textAlign: 'center', margin: '0.5rem 0 1.25rem' }}>
          You can&apos;t sign in to this workspace right now. Please contact an administrator at{' '}
          <strong>{orgName}</strong> to restore your access.
        </p>

        <SignOutButton />

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Signed in as {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}
