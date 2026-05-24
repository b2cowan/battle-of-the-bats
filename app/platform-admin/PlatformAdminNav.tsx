'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, Users, ScrollText, Terminal, HelpCircle, LogOut, ArchiveRestore, Mail, SlidersHorizontal, Search, ListChecks, ClipboardCheck, FileText } from 'lucide-react';
import { signOut } from '@/lib/auth';
import styles from './platform-admin.module.css';

const BASE_NAV_GROUPS = [
  {
    label: 'Command Center',
    items: [
      { href: '/platform-admin', label: 'Overview', Icon: LayoutDashboard },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/platform-admin/orgs', label: 'Organizations', Icon: Building2 },
      { href: '/platform-admin/customer-users', label: 'Customer Users', Icon: Search },
      { href: '/platform-admin/retention', label: 'Retention', Icon: ArchiveRestore },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/platform-admin/early-access', label: 'Early Access', Icon: Mail },
    ],
  },
  {
    label: 'Billing & Product',
    items: [
      { href: '/platform-admin/change-requests', label: 'Change Requests', Icon: ClipboardCheck },
      { href: '/platform-admin/plans-pricing', label: 'Plans & Pricing', Icon: SlidersHorizontal },
      { href: '/platform-admin/bulk-operations', label: 'Bulk Operations', Icon: ListChecks },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/platform-admin/users', label: 'Platform Users', Icon: Users },
      { href: '/platform-admin/audit', label: 'Audit Log', Icon: ScrollText },
      { href: '/platform-admin/email-templates', label: 'Email Templates', Icon: FileText },
      { href: '/platform-admin/help', label: 'Help', Icon: HelpCircle, newWindow: true },
    ],
  },
];

export default function PlatformAdminNav({ sessionEmail }: { sessionEmail: string }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/platform-admin/login');
    router.refresh();
  }

  const navGroups = BASE_NAV_GROUPS.map(group => ({
    ...group,
    items: group.label === 'System' && process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'
      ? [...group.items, { href: '/platform-admin/dev-tools', label: 'Dev Tools', Icon: Terminal }]
      : group.items,
  }));

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
        {navGroups.map(group => (
          <div key={group.label} className={styles.navGroup}>
            <div className={styles.navGroupLabel}>{group.label}</div>
            {group.items.map(({ href, label, Icon, newWindow }) => (
              <Link
                key={href}
                href={href}
                target={newWindow ? '_blank' : undefined}
                rel={newWindow ? 'noopener noreferrer' : undefined}
                className={`${styles.navLink} ${isActive(href) ? styles.navLinkActive : ''}`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
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

