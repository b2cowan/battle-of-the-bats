import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/api-auth';
import { TournamentProvider } from '@/lib/tournament-context';
import { OrgProvider } from '@/lib/org-context';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import styles from './admin.module.css';

export default async function AdminLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  const authCtx = await getAuthContext();
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/admin`);
  }

  // Authenticated user belongs to a different org — send them to their own admin
  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/admin`);
  }

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
