'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, ScrollText, Terminal } from 'lucide-react';
import styles from './platform-admin.module.css';

const BASE_NAV = [
  { href: '/platform-admin',       label: 'Overview',       Icon: LayoutDashboard },
  { href: '/platform-admin/orgs',  label: 'Organizations',  Icon: Building2       },
  { href: '/platform-admin/users', label: 'Users',          Icon: Users           },
  { href: '/platform-admin/audit', label: 'Audit Log',      Icon: ScrollText      },
];

export default function PlatformAdminNav({ sessionEmail }: { sessionEmail: string }) {
  const pathname = usePathname();

  const nav = [
    ...BASE_NAV,
    ...(process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'
      ? [{ href: '/platform-admin/dev-tools', label: 'Dev Tools', Icon: Terminal }]
      : []),
  ];

  function isActive(href: string) {
    if (href === '/platform-admin') return pathname === '/platform-admin';
    return pathname.startsWith(href);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.platformBadge}>PLATFORM ADMIN</div>
        <div className={styles.platformSub}>FieldLogicHQ</div>
      </div>
      <nav className={styles.nav}>
        {nav.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navLink} ${isActive(href) ? styles.navLinkActive : ''}`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <div className={styles.sessionLabel}>ACTIVE SESSION</div>
        <div className={styles.sessionEmail}>{sessionEmail}</div>
      </div>
    </aside>
  );
}
