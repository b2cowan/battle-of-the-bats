import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, Users, ScrollText } from 'lucide-react';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import styles from './platform-admin.module.css';

export const metadata: Metadata = { title: 'Platform Admin — FieldLogicHQ' };

const NAV = [
  { href: '/platform-admin',       label: 'Overview',       Icon: LayoutDashboard },
  { href: '/platform-admin/orgs',  label: 'Organizations',  Icon: Building2       },
  { href: '/platform-admin/users', label: 'Users',          Icon: Users           },
  { href: '/platform-admin/audit', label: 'Audit Log',      Icon: ScrollText      },
];

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
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.platformBadge}>PLATFORM ADMIN</div>
          <div className={styles.platformSub}>FieldLogicHQ</div>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={styles.navLink}>
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.sessionLabel}>ACTIVE SESSION</div>
          <div className={styles.sessionEmail}>{user.email}</div>
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
