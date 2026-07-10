'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, Users, ScrollText, Terminal, HelpCircle, LogOut, ArchiveRestore, Mail, Send, SlidersHorizontal, Search, ListChecks, ClipboardCheck, FileText, Eye, AlertTriangle, MessageSquare } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { canViewPlatformArea, isPlatformAreaReadOnly, type PlatformArea } from '@/lib/platform-areas';
import type { PlatformRole } from '@/lib/platform-auth';
import styles from './platform-admin.module.css';

type NavItem = { href: string; label: string; Icon: typeof LayoutDashboard; area: PlatformArea; newWindow?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Command Center',
    items: [
      { href: '/platform-admin', label: 'Overview', Icon: LayoutDashboard, area: 'overview' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/platform-admin/orgs', label: 'Organizations', Icon: Building2, area: 'organizations' },
      { href: '/platform-admin/customer-users', label: 'Customer Users', Icon: Search, area: 'customer_users' },
      { href: '/platform-admin/retention', label: 'Retention', Icon: ArchiveRestore, area: 'retention' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/platform-admin/early-access', label: 'Early Access', Icon: Mail, area: 'early_access' },
      { href: '/platform-admin/email', label: 'Email Campaigns', Icon: Send, area: 'email' },
    ],
  },
  {
    label: 'Billing & Product',
    items: [
      { href: '/platform-admin/change-requests', label: 'Approval Queue', Icon: ClipboardCheck, area: 'change_requests' },
      { href: '/platform-admin/plans-pricing', label: 'Plans & Pricing', Icon: SlidersHorizontal, area: 'plans_pricing' },
      { href: '/platform-admin/bulk-operations', label: 'Bulk Operations', Icon: ListChecks, area: 'bulk_operations' },
      { href: '/platform-admin/email-templates', label: 'Email Templates', Icon: FileText, area: 'email_templates' },
    ],
  },
  {
    label: 'Support & Diagnostics',
    items: [
      { href: '/platform-admin/observability', label: 'Observability', Icon: AlertTriangle, area: 'observability' },
      { href: '/platform-admin/feedback', label: 'Feedback', Icon: MessageSquare, area: 'feedback' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/platform-admin/users', label: 'Platform Users', Icon: Users, area: 'platform_users' },
      { href: '/platform-admin/audit', label: 'Audit Log', Icon: ScrollText, area: 'audit' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/platform-admin/help', label: 'Help', Icon: HelpCircle, area: 'help', newWindow: true },
    ],
  },
];

export default function PlatformAdminNav({ sessionEmail, role }: { sessionEmail: string; role: PlatformRole }) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/platform-admin/login');
    router.refresh();
  }

  const navGroups: NavGroup[] = BASE_NAV_GROUPS.map(group => ({
    ...group,
    items: group.label === 'System' && process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'
      ? [...group.items, { href: '/platform-admin/dev-tools', label: 'Dev Tools', Icon: Terminal, area: 'dev_tools' as PlatformArea }]
      : group.items,
  }))
    // Drop areas this role cannot view, then drop any group left empty.
    .map(group => ({ ...group, items: group.items.filter(item => canViewPlatformArea(role, item.area)) }))
    .filter(group => group.items.length > 0);

  function isActive(href: string) {
    if (href === '/platform-admin') return pathname === '/platform-admin';
    // Match on a path boundary so a shorter route isn't also flagged active on a sibling
    // (e.g. `/platform-admin/email` must NOT light up on `/platform-admin/email-templates`).
    return pathname === href || pathname.startsWith(href + '/');
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
            {group.items.map(({ href, label, Icon, area, newWindow }) => {
              const viewOnly = isPlatformAreaReadOnly(role, area);
              return (
                <Link
                  key={href}
                  href={href}
                  target={newWindow ? '_blank' : undefined}
                  rel={newWindow ? 'noopener noreferrer' : undefined}
                  className={`${styles.navLink} ${isActive(href) ? styles.navLinkActive : ''}`}
                  title={viewOnly ? 'View-only for your role' : undefined}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                  {viewOnly && (
                    <span className={styles.navViewOnly} aria-label="View-only for your role">
                      <Eye size={11} />
                    </span>
                  )}
                </Link>
              );
            })}
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
