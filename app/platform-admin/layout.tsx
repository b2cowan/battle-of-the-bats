import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { canAccessBookkeeping } from '@/lib/bookkeeping-access';
import PlatformAdminNav from './PlatformAdminNav';
import PlatformVisitRecorder from './PlatformVisitRecorder';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
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
        {/* The console is dark in every setting, and the root default bar is the paper (S4 Part B), so it pins its own. */}
        <CoachThemeColor fixed="dark" />
        <PlatformVisitRecorder />
        {children}
      </main>
    );
  }

  return (
    /* Platform-admin is a RULED EXCEPTION to the nav grammar (top-nav audit §3): an internal
       console with a 220px sidebar and NO top bar, deliberately carrying no FieldLogicHQ
       wordmark door back into the customer-facing app. It is a different product for a
       different audience, not a fourth surface of the same one. Do not "unify" it into the
       operator strip family. */
    <div className={styles.shell}>
      <PlatformAdminNav sessionEmail={auth.user.email ?? ''} role={auth.role} canBookkeep={canAccessBookkeeping(auth)} />
      <main className={styles.main}>
        <CoachThemeColor fixed="dark" />
        <PlatformVisitRecorder />
        {children}
      </main>
    </div>
  );
}
