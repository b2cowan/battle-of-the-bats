import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import PlatformAdminNav from './PlatformAdminNav';
import styles from './platform-admin.module.css';

export const metadata: Metadata = { title: 'Platform Admin — FieldLogicHQ' };

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getPlatformAuthContext();
  if (!user) {
    redirect('/auth/login?next=/platform-admin');
  }

  return (
    <div className={styles.shell}>
      <PlatformAdminNav sessionEmail={user.email} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
