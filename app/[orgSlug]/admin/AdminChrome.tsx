'use client';

import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import DevPlanSwitcher from '@/components/DevPlanSwitcher';
import { LiveLogicRail } from '@/components/live-logic/LiveLogicRail';
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

  return (
    <>
      <div className={`${styles.adminShell} ${isOnboarding ? styles.adminShellFocused : ''}`}>
        {!isOnboarding && <AdminSidebar />}
        <main className={`${styles.adminMain} ${isOnboarding ? styles.adminMainFocused : ''}`}>
          {children}
        </main>
      </div>
      {!isOnboarding && <AdminBottomNav />}
      {showDevTools && !isOnboarding && <DevPlanSwitcher />}
      {!isOnboarding && <LiveLogicRail />}
    </>
  );
}
