'use client';

import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import DevPlanSwitcher from '@/components/DevPlanSwitcher';
import { LiveLogicRail } from '@/components/live-logic/LiveLogicRail';
import AdminTitleManager from './AdminTitleManager';
import styles from './admin.module.css';

export default function AdminChrome({
  children,
  showDevTools,
}: {
  children: React.ReactNode;
  showDevTools: boolean;
}) {
  const pathname = usePathname();
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
      <AdminTitleManager />
      <div className={shellClassName}>
        {!isFocused && <AdminSidebar />}
        <main className={mainClassName}>
          {children}
        </main>
      </div>
      {!isFocused && <AdminBottomNav />}
      {showDevTools && !isFocused && <DevPlanSwitcher />}
      {!isFocused && <LiveLogicRail />}
    </>
  );
}
