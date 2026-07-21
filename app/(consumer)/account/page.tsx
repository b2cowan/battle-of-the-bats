import type { Metadata } from 'next';
import Link from 'next/link';
import { User, Bell, LifeBuoy, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';
import AccountSignOutButton from '@/components/consumer/AccountSignOutButton';
import AppearanceCard from '@/components/consumer/AppearanceCard';
import warm from '@/components/consumer/warmTheme.module.css';
import AccountInstallRow from './AccountInstallRow';
import styles from './account.module.css';

// Reflects sign-in state — dynamic and not for indexing.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

// Consumer support has no dedicated help page (all Help lives in the admin/coach portals),
// so the row opens a pre-addressed email — the right home for installed-app users who never
// see the marketing site. Owner call 2026-07-20.
const SUPPORT_MAILTO = 'mailto:hello@fieldlogichq.ca?subject=FieldLogicHQ%20support';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  const signedIn = !!email;

  return (
    <div className={`${warm.warmTab} ${styles.accountFill}`}>
      <div className={styles.page}>
        <h1 className={styles.title}>Account</h1>

        {/* Identity block — the one thing this screen exists to show, given real weight. */}
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden>
            {signedIn ? email!.charAt(0).toUpperCase() : <User size={22} />}
          </span>
          <span className={styles.identityMeta}>
            <span className={styles.identityLabel}>{signedIn ? 'Signed in' : 'Not signed in'}</span>
            <span className={`${styles.identityValue}${signedIn ? '' : ` ${styles.dim}`}`}>
              {signedIn ? email : 'Sign in to keep your teams, workspaces, and alerts on every device'}
            </span>
          </span>
        </div>

        <AppearanceCard signedIn={signedIn} />

        {signedIn ? (
          <>
            {/* Settings rows (§3g). "Your FieldLogicHQ →" is gone — Home carries the
                workspaces list now. Legal (Terms/Privacy) is intentionally omitted: no
                platform legal pages exist yet (owner call 2026-07-20 to omit rather than
                link a 404); add the row here once those documents ship — installed-PWA
                users have no other path to them. */}
            <div className={styles.rows}>
              <Link href="/account/notifications" className={styles.row}>
                <span className={styles.rowIcon}><Bell size={19} aria-hidden /></span>
                <span className={styles.rowLabel}>Notification settings</span>
                <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
              </Link>

              <AccountInstallRow />

              <a href={SUPPORT_MAILTO} className={styles.row}>
                <span className={styles.rowIcon}><LifeBuoy size={19} aria-hidden /></span>
                <span className={styles.rowLabel}>Help &amp; support</span>
                <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
              </a>

              <AccountSignOutButton />
            </div>

            {/* Quiet organizer door, pinned to the bottom of the viewport. */}
            <p className={styles.pinNote}>
              Run your own event?{' '}
              <Link href="/start" className={styles.pinLink}>Start a tournament →</Link>
            </p>
          </>
        ) : (
          <>
            <div className={styles.ctaStack}>
              <Link href="/auth/login" className={styles.ctaPrimary}>Sign in</Link>
              <Link href="/auth/signup?account=1&next=/discover" className={styles.ctaGhost}>Create free account</Link>
            </div>
            {/* Quiet pinned notes: device-vs-account, plus the organizer door. The door is
                deliberately a text link, not a third button — it leads into org creation, a
                far heavier commitment than the account CTA above, and the signed-out surface
                follows the same quiet-organizer-door principle as the signed-in note (§3g). */}
            <p className={styles.pinNote}>
              Following works on this device without an account — sign in to keep your teams on every
              device you use.
              <br />
              Run your own event?{' '}
              <Link href="/start" className={styles.pinLink}>Start a tournament →</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
