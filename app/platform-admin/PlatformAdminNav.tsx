'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, Users, ScrollText, Terminal, HelpCircle, LogOut, ArchiveRestore, Mail, SlidersHorizontal } from 'lucide-react';
import { signOut } from '@/lib/auth';
import styles from './platform-admin.module.css';

const BASE_NAV = [
  { href: '/platform-admin',              label: 'Overview',       Icon: LayoutDashboard },
  { href: '/platform-admin/orgs',         label: 'Organizations',  Icon: Building2       },
  { href: '/platform-admin/plans-pricing', label: 'Plans & Pricing', Icon: SlidersHorizontal },
  { href: '/platform-admin/early-access', label: 'Early Access',   Icon: Mail            },
  { href: '/platform-admin/retention',    label: 'Retention',      Icon: ArchiveRestore  },
  { href: '/platform-admin/users',        label: 'Users',          Icon: Users           },
  { href: '/platform-admin/audit',        label: 'Audit Log',      Icon: ScrollText      },
  { href: '/platform-admin/help',         label: 'Help',           Icon: HelpCircle      },
];

export default function PlatformAdminNav({ sessionEmail }: { sessionEmail: string }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/platform-admin/login');
    router.refresh();
  }

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
            target={label === 'Help' ? '_blank' : undefined}
            rel={label === 'Help' ? 'noopener noreferrer' : undefined}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <div className={styles.sessionLabel}>ACTIVE SESSION</div>
        <div className={styles.sessionEmail}>{sessionEmail}</div>
        <button className={styles.signOutBtn} onClick={handleSignOut}>
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

