'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import AdminEventHeader from '@/components/admin/AdminEventHeader';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import { CancellationGuard } from '@/components/admin/CancellationGuard';
import { getBillingHref } from '@/lib/billing-urls';
import { LiveLogicRail } from '@/components/live-logic/LiveLogicRail';
import EnablePushBanner from '@/components/notifications/EnablePushBanner';
import { AdminDensityProvider } from '@/lib/admin-density';
import { AdminWorklistProvider } from '@/lib/admin-worklist';
import AdminTitleManager from './AdminTitleManager';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import styles from './admin.module.css';

export default function AdminChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  // All hooks must be called unconditionally — before any early return.
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  // Focused shells (onboarding / help / tournament-preview) render no sidebar or bottom nav, so no
  // bell or badge consumes the notification count there. Compute this up front to gate the hook below.
  const isOnboarding = pathname.endsWith('/admin/onboarding');
  const isTournamentPreview = pathname.includes('/admin/tournaments/preview/');
  const isHelp = pathname.includes('/admin/help');
  const isFocusedAdmin = isOnboarding || isHelp;
  const isFocused = isFocusedAdmin || isTournamentPreview;

  // Own the unread notification count ONCE for the whole admin shell — the desktop sidebar bell and
  // the mobile More-tab badge both read it, so a single fetch + Realtime channel serves both (both are
  // always mounted; CSS just hides one per breakpoint). Skip it on focused shells that render no
  // consumer, so we never hold a Realtime channel open with nothing reading it.
  const notif = useNotificationUnread(!isFocused ? currentOrg?.id : null);

  // Cancelled-account redirect guard.
  // useOrg() provides the subscription status synchronously (from initialOrg set in the layout),
  // and usePathname() provides the current path on both server and client, so both agree on this
  // output — no hydration mismatch, no content flash, no loop.
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const billingPath = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : null;
  if (isCanceled && billingPath && !pathname.startsWith(billingPath)) {
    return <CancellationGuard />;
  }
  const shellClassName = isTournamentPreview
    ? styles.adminPreviewShell
    : `${styles.adminShell} ${isFocusedAdmin ? styles.adminShellFocused : ''}`;
  const mainClassName = isTournamentPreview
    ? styles.adminPreviewMain
    : `${styles.adminMain} ${isFocusedAdmin ? styles.adminMainFocused : ''}`;

  return (
    <AdminDensityProvider>
      <AdminWorklistProvider>
      <CancellationGuard />
      <AdminTitleManager />
      <FeedbackRequestIdProvider />
      <div className={shellClassName}>
        {!isFocused && <AdminSidebar notifCount={notif.count} onNotifCountChange={notif.setCount} />}
        <main className={mainClassName}>
          {isFocused ? (
            children
          ) : (
            <>
              {/* The Flip: one persistent shell header (event/org identity + status + pill), desktop
                  and mobile. Sticky; collapses on scroll. Supersedes the old mobile top bar + the
                  floating desktop pill. */}
              <AdminEventHeader />
              <div className={styles.mainPad}>
                <EnablePushBanner />
                {children}
              </div>
            </>
          )}
        </main>
      </div>
      {!isFocused && <AdminBottomNav notifUnread={notif.count} />}
      {!isFocused && <LiveLogicRail />}
      </AdminWorklistProvider>
    </AdminDensityProvider>
  );
}
