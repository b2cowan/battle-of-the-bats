'use client';

import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import { CancellationGuard } from '@/components/admin/CancellationGuard';
import { LiveLogicRail } from '@/components/live-logic/LiveLogicRail';
import AdminTitleManager from './AdminTitleManager';
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
  const billingPath = currentOrg?.slug ? `/${currentOrg.slug}/admin/org/billing` : null;
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
    <>
      <CancellationGuard />
      <AdminTitleManager />
      <div className={shellClassName}>
        {!isFocused && <AdminSidebar />}
        <main className={mainClassName}>
          {children}
        </main>
      </div>
      {!isFocused && <AdminBottomNav />}
      {!isFocused && <LiveLogicRail />}
    </>
  );
}
