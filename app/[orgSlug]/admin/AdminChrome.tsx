'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { CancellationGuard } from '@/components/admin/CancellationGuard';
import { getBillingHref } from '@/lib/billing-urls';
import { LiveLogicRail } from '@/components/live-logic/LiveLogicRail';
import AdminMobileTopBar from '@/components/admin/AdminMobileTopBar';
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

  // Cancelled-account redirect guard.
  // useOrg() provides the subscription status synchronously (from initialOrg set in the layout),
  // and usePathname() provides the current path on both server and client, so both agree on this
  // output — no hydration mismatch, no content flash, no loop.
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const billingPath = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : null;
  if (isCanceled && billingPath && !pathname.startsWith(billingPath)) {
    return <CancellationGuard />;
  }

  const isOnboarding = pathname.endsWith('/admin/onboarding');
  const isTournamentPreview = pathname.includes('/admin/tournaments/preview/');
  const isHelp = pathname.includes('/admin/help');
  const isFocusedAdmin = isOnboarding || isHelp;
  const isFocused = isFocusedAdmin || isTournamentPreview;
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
      {/* Mobile-only top app-bar — tournament + live status + notification bell +
          one-tap switcher. The sidebar (incl. its bell) is hidden <900px. */}
      {!isFocused && <AdminMobileTopBar />}
      <div className={shellClassName}>
        {!isFocused && <AdminSidebar />}
        <main className={mainClassName}>
          {!isFocused && <EnablePushBanner />}
          {children}
        </main>
      </div>
      {!isFocused && <AdminBottomNav />}
      {!isFocused && <LiveLogicRail />}
      </AdminWorklistProvider>
    </AdminDensityProvider>
  );
}
