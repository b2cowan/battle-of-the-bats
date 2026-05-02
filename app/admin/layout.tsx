import { TournamentProvider } from '@/lib/tournament-context';
import { OrgProvider } from '@/lib/org-context';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import styles from './admin.module.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <TournamentProvider>
        <div className={styles.adminShell}>
          <AdminSidebar />
          <main className={styles.adminMain}>
            {children}
          </main>
        </div>
        <AdminBottomNav />
      </TournamentProvider>
    </OrgProvider>
  );
}
