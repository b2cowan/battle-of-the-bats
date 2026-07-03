'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Users, UserCog, Calendar, ClipboardList, Megaphone, DollarSign, FileText, History, LayoutDashboard, HelpCircle, Settings, MessageSquare, Trophy, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { useChatUnread } from '@/lib/use-chat-unread';
import { teamWorkspaceDisplayName } from '@/lib/coaches-portal-routes';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import NotificationBell from '@/components/notifications/NotificationBell';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

// Grouped so the sidebar reads as clusters (Squad / Season / Communication / Admin) rather than a
// flat 11-item list. Overview stays ungrouped at the top. The Depth chart lives INSIDE Roster (a
// view toggle), so it's intentionally not a nav item.
const TEAM_NAV_GROUPS: { label?: string; items: { label: string; href: string; icon: typeof Users }[] }[] = [
  { items: [
    { label: 'Overview',    href: '',             icon: LayoutDashboard },
  ] },
  { label: 'Squad', items: [
    { label: 'Roster',      href: '/roster',      icon: Users },
    { label: 'Tryouts',     href: '/tryouts',     icon: ClipboardList },
  ] },
  { label: 'Season', items: [
    { label: 'Schedule',    href: '/schedule',    icon: Calendar },
    { label: 'Tournaments', href: '/tournaments', icon: Trophy },
  ] },
  { label: 'Communication', items: [
    { label: 'Chat',          href: '/chat',          icon: MessageSquare },
    { label: 'Announcements', href: '/announcements', icon: Megaphone },
  ] },
  { label: 'Admin', items: [
    { label: 'Accounting',  href: '/accounting',  icon: DollarSign },
    { label: 'Documents',   href: '/documents',   icon: FileText },
    { label: 'History',     href: '/history',     icon: History },
    { label: 'Staff',       href: '/staff',       icon: UserCog },
    { label: 'Settings',    href: '/settings',    icon: Settings },
  ] },
];

export default function CoachesSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { assignments } = useCoaches();
  const { currentOrg } = useOrg();
  const chatUnread = useChatUnread();

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  const teamMatch = pathname.match(/\/coaches\/teams\/([^/]+)/);
  const currentTeamId = teamMatch?.[1] ?? null;

  const currentAssignment = currentTeamId
    ? assignments.find(a => a.teamId === currentTeamId)
    : null;

  // Assistant Coaches: hide nav areas the current coach isn't cleared for. Head coaches have
  // full capabilities so nothing hides. Fail-open if caps are absent (server still enforces).
  const caps = currentAssignment?.capabilities;
  const navVisible = (label: string): boolean => {
    if (!caps) return true;
    switch (label) {
      case 'Roster':        return caps.roster !== 'off';
      case 'Schedule':      return caps.schedule;
      case 'Tryouts':       return caps.tryouts;
      // Phase 1: hidden unless the coach can send (no draft UI yet). Phase 2 (draft flow):
      // change this to always-visible or a `canDraftAnnouncements` cap so granted assistants can draft.
      case 'Announcements': return caps.announcementsSend;
      case 'Accounting':    return caps.money !== 'off';
      case 'History':       return caps.money !== 'off';
      case 'Documents':     return caps.documents !== 'off';
      case 'Staff':         return caps.isHeadCoach;
      default:              return true;
    }
  };

  const base = `/${orgSlug}/coaches`;
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';

  return (
    <nav className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarHeaderTop}>
          <p className={styles.sidebarPortalLabel}>Coaches Portal</p>
          {currentOrg?.id && (
            <div className="flex items-center gap-1 ml-auto">
              <NotificationBell orgId={currentOrg.id} />
            </div>
          )}
        </div>
        <p className={styles.sidebarOrgName}>
          {isTeamWorkspace ? teamWorkspaceDisplayName(currentOrg?.name) : (currentOrg?.name ?? orgSlug)}
        </p>
        {/* A standalone workspace IS the Coaches Portal — there's no separate org to go
            "back" to, so the link only appears for real orgs (league/club). */}
        {!isTeamWorkspace && (
          <Link href={`/${orgSlug}`} className={styles.sidebarBackLink}>
            <ArrowLeft size={12} />
            Back to {currentOrg?.name ?? 'org page'}
          </Link>
        )}
      </div>

      {/* Team list — a switcher, so it only earns its place with 2+ teams. With a single
          team (always the case for a standalone Premium workspace) the team name is already
          the sidebar label, so the list would just repeat it. */}
      {assignments.length > 1 && (
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
      )}

      {/* Team-scoped nav — only when inside a team */}
      {currentTeamId && currentAssignment && (
        <>
          <div className={styles.sidebarDivider} />
          <div className={styles.sidebarSection}>
            {/* With one team the header already names it, so this label would just repeat. */}
            {assignments.length > 1 && (
              <p className={styles.sidebarSectionLabel}>{currentAssignment.teamName}</p>
            )}
            {currentAssignment.coachRole === 'assistant_coach' && (
              <p className={styles.sidebarSectionLabel}>Assistant Coach</p>
            )}
            {TEAM_NAV_GROUPS.map((group, gi) => {
              const visibleItems = group.items.filter(({ label }) => navVisible(label));
              if (!visibleItems.length) return null;
              return (
                <Fragment key={gi}>
                  {group.label && <p className={styles.sidebarGroupLabel}>{group.label}</p>}
                  {visibleItems.map(({ label, href, icon: Icon }) => {
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
                        {label === 'Chat' && <ChatUnreadBadge count={chatUnread} />}
                      </Link>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </>
      )}
      <div className={styles.sidebarDivider} />
      <div className={styles.sidebarSection}>
        <Link
          href={`${base}/help`}
          className={`${styles.sidebarItem}${pathname === `${base}/help` ? ` ${styles.sidebarItemActive}` : ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <HelpCircle size={14} />
          Help
          <ReleaseDot />
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className={`${styles.sidebarItem} ${styles.sidebarLogout}`}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
