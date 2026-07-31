import type { Metadata } from 'next';
import Link from 'next/link';
import { User, Bell, LifeBuoy, ChevronRight, HelpCircle } from 'lucide-react';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getUserAccessContextsCached, hasCoachAccess } from '@/lib/user-contexts';
import AccountSignOutButton from '@/components/consumer/AccountSignOutButton';
import AppearanceCard from '@/components/consumer/AppearanceCard';
import AccountFeedbackRow from '@/components/consumer/AccountFeedbackRow';
import AccountInstallRow from './AccountInstallRow';
import AccountGetAppCard from './AccountGetAppCard';
import { SUPPORT_MAILTO } from './support';
import styles from './account.module.css';

// Reflects sign-in state — dynamic and not for indexing.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getAuthUserCached();
  const email = user?.email ?? null;
  const signedIn = !!email;

  // A2 (2026-07-25): the free coach portal's "More" sheet retired — its account utilities
  // (Coaches Portal help, Send feedback) live HERE now, per consumer convention. Coach-gated
  // so pure fans never see coach rows; shares the per-request access-context cache with the
  // consumer layout.
  let isCoach = false;
  if (user?.email) {
    const contexts = await getUserAccessContextsCached(user.id, user.email).catch(() => []);
    isCoach = hasCoachAccess(contexts);
  }

  // Identity block — the one thing this screen exists to show, given real weight. Rendered
  // in BOTH presentations below (mobile stack + desktop Profile pane), so it's built once:
  // a future change (a role badge, say) can't silently diverge between the two.
  const identityBlock = (
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
  );

  // Two presentations, one route (Desktop Phase 2). The stacked page below is the phone/
  // tablet experience, byte-identical to what always shipped; the Profile pane renders only
  // inside the desktop settings shell (≥1024px, provided by ../account/layout.tsx — which
  // also owns the warm paper wrapper this file used to carry).
  return (
    <>
      <div className={styles.page}>
        <h1 className={styles.title}>Account</h1>
        {identityBlock}

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

              {isCoach && (
                <>
                  <Link href="/coaches/help" className={styles.row}>
                    <span className={styles.rowIcon}><HelpCircle size={19} aria-hidden /></span>
                    <span className={styles.rowLabel}>Coaches Portal help</span>
                    <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
                  </Link>
                  <AccountFeedbackRow />
                </>
              )}

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

        {/* WI-11 — the desktop half of "get the app", OUTSIDE the signed-in branch on purpose.
            A QR is not identity: a signed-out visitor browsing scores on a laptop is exactly who
            most needs to know the phone app exists. It also keeps the footer's suppression rule
            honest — the footer yields its own QR on this route because this card always owns it
            here, which is only true if the card doesn't depend on being signed in. Self-gates to
            desktop (the complement of the install row above), so the two are never both shown.
            Desktop-shell note: ≥1024px this whole stack is hidden — the Profile pane below
            mounts the same card so the route's exactly-one-QR guarantee holds there too. */}
        <AccountGetAppCard />
      </div>

      {/* Desktop Profile pane (≥1024px only): identity + the one session action, button-sized.
          Appearance / Get the app / Help & the coach rows live on their own rail sections. */}
      <div className={styles.profilePane}>
        {identityBlock}
        {signedIn ? (
          <AccountSignOutButton inline />
        ) : (
          <div className={styles.profileCtas}>
            <Link href="/auth/login" className={styles.ctaPrimary}>Sign in</Link>
            <Link href="/auth/signup?account=1&next=/discover" className={styles.ctaGhost}>Create free account</Link>
          </div>
        )}
        {/* The QR keeps its pre-Phase-2 guarantee — visible exactly ONCE on /account at
            desktop widths (/review 2026-07-31): the footer yields its copy here by exact
            pathname, and the stacked page's card is display:none ≥1024, so without this
            mount a desktop visitor saw NO QR at all. Same self-gating unit as the stack. */}
        <AccountGetAppCard />
      </div>
    </>
  );
}
