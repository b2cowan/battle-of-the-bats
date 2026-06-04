import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import PlatformAdminNav from './PlatformAdminNav';
import PlatformVisitRecorder from './PlatformVisitRecorder';
import styles from './platform-admin.module.css';

export const metadata: Metadata = { title: 'Platform Admin — FieldLogicHQ' };

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname    = headersList.get('x-pathname') ?? '';

  // Login page renders without the sidebar shell — no auth check needed here
  // since middleware already gates everything else
  if (pathname === '/platform-admin/login') {
    return <>{children}</>;
  }

  const auth = await getPlatformAdminContext();
  if (!auth) {
    redirect('/platform-admin/login?next=/platform-admin');
  }

  if (pathname.startsWith('/platform-admin/help')) {
    return (
      <main className={`${styles.main} ${styles.helpMain}`}>
        <PlatformVisitRecorder />
        {children}
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <PlatformAdminNav sessionEmail={auth.user.email ?? ''} role={auth.role} />
      <main className={styles.main}>
        <PlatformVisitRecorder />
        {children}
      </main>
    </div>
  );
}
