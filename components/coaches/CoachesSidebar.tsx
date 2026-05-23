'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Users, Calendar, DollarSign, FileText, History, LayoutDashboard, HelpCircle, Link2 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

const TEAM_NAV = [
  { label: 'Overview',    href: '',           icon: LayoutDashboard },
  { label: 'Roster',      href: '/roster',    icon: Users },
  { label: 'Schedule',    href: '/schedule',  icon: Calendar },
  { label: 'Accounting',  href: '/accounting',icon: DollarSign },
  { label: 'Documents',   href: '/documents', icon: FileText },
  { label: 'History',     href: '/history',   icon: History },
];

export default function CoachesSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const { assignments } = useCoaches();
  const { currentOrg } = useOrg();

  const teamMatch = pathname.match(/\/coaches\/teams\/([^/]+)/);
  const currentTeamId = teamMatch?.[1] ?? null;

  const currentAssignment = currentTeamId
    ? assignments.find(a => a.teamId === currentTeamId)
    : null;

  const base = `/${orgSlug}/coaches`;
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';

  return (
    <nav className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <p className={styles.sidebarPortalLabel}>Coaches Portal</p>
        <p className={styles.sidebarOrgName}>{currentOrg?.name ?? orgSlug}</p>
        <Link href={`/${orgSlug}`} className={styles.sidebarBackLink}>
          <ArrowLeft size={12} />
          Back to {currentOrg?.name ?? 'org page'}
        </Link>
      </div>

      {/* Team list */}
      <div className={styles.sidebarSection}>
        <p className={styles.sidebarSectionLabel}>My Teams</p>
        {assignments.map(a => (
          <Link
            key={a.teamId}
            href={`${base}/teams/${a.teamId}`}
            className={`${styles.sidebarItem}${currentTeamId === a.teamId ? ` ${styles.sidebarItemActive}` : ''}`}
          >
            {a.teamColor && (
              <span
                style={{ width: 10, height: 10, borderRadius: 2, background: a.teamColor, flexShrink: 0, marginTop: 2 }}
              />
            )}
            <span className={styles.sidebarTeamInfo}>
              <span>{a.teamName}</span>
              <span className={styles.sidebarTeamYear}>{a.programYearName}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Team-scoped nav — only when inside a team */}
      {currentTeamId && currentAssignment && (
        <>
          <div className={styles.sidebarDivider} />
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarSectionLabel}>{currentAssignment.teamName}</p>
            {TEAM_NAV.map(({ label, href, icon: Icon }) => {
              const fullHref = `${base}/teams/${currentTeamId}${href}`;
              const isActive = href === ''
                ? pathname === fullHref
                : pathname.startsWith(fullHref);
              return (
                <Link
                  key={label}
                  href={fullHref}
                  className={`${styles.sidebarItem}${isActive ? ` ${styles.sidebarItemActive}` : ''}`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </div>
        </>
      )}
      <div className={styles.sidebarDivider} />
      <div className={styles.sidebarSection}>
        {isTeamWorkspace && (
          <Link
            href={`${base}/link-org`}
            className={`${styles.sidebarItem}${pathname === `${base}/link-org` ? ` ${styles.sidebarItemActive}` : ''}`}
          >
            <Link2 size={14} />
            Link Organization
          </Link>
        )}
        <Link
          href={`${base}/help`}
          className={`${styles.sidebarItem}${pathname === `${base}/help` ? ` ${styles.sidebarItemActive}` : ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <HelpCircle size={14} />
          Help
        </Link>
      </div>
    </nav>
  );
}
