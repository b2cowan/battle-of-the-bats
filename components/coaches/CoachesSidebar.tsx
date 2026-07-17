'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Users, UserCog, Calendar, ClipboardList, Megaphone, DollarSign, FileText, BarChart3, LayoutDashboard, HelpCircle, Settings, MessageSquare, Trophy, LogOut, ListOrdered, TrendingUp } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useCoaches } from '@/lib/coaches-context';
import { isCoachNavItemVisible } from '@/lib/coach-nav-visibility';
import { useOrg } from '@/lib/org-context';
import { useChatUnread } from '@/lib/use-chat-unread';
import { teamWorkspaceDisplayName } from '@/lib/coaches-portal-routes';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import NotificationBell from '@/components/notifications/NotificationBell';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

// Grouped so the sidebar reads as plain-language clusters (Squad / Season / Money / Communication /
// Team admin) rather than a flat build-order list. Overview stays ungrouped at the top. Lineups is a
// front door for the game-day builder (was menu-invisible). Tryouts / Tournaments are `conditional`:
// they sit in their group only once the team uses them, otherwise they drop to an "Explore" group.
// The Depth chart lives INSIDE Roster (a view toggle), so it's intentionally not a nav item. Hrefs
// keep their existing routes (/accounting, /history) — only the labels change.
const TEAM_NAV_GROUPS: { label?: string; items: { label: string; href: string; icon: typeof Users; conditional?: 'tryouts' | 'tournaments' }[] }[] = [
  { items: [
    { label: 'Overview',    href: '',             icon: LayoutDashboard },
  ] },
  { label: 'Squad', items: [
    { label: 'Roster',      href: '/roster',      icon: Users },
    { label: 'Lineups',     href: '/lineups',     icon: ListOrdered },
    // Primary (not Explore) by design decision 2026-07-17 — a growth pillar whose
    // evaluation-sessions job exists before any usage signal could accrue.
    { label: 'Development', href: '/development', icon: TrendingUp },
    { label: 'Tryouts',     href: '/tryouts',     icon: ClipboardList, conditional: 'tryouts' },
  ] },
  { label: 'Season', items: [
    { label: 'Schedule',    href: '/schedule',    icon: Calendar },
    { label: 'Insights',    href: '/history',     icon: BarChart3 },
    { label: 'Tournaments', href: '/tournaments', icon: Trophy, conditional: 'tournaments' },
  ] },
  { label: 'Money', items: [
    { label: 'Money',       href: '/accounting',  icon: DollarSign },
  ] },
  { label: 'Communication', items: [
    { label: 'Chat',          href: '/chat',          icon: MessageSquare },
    { label: 'Announcements', href: '/announcements', icon: Megaphone },
  ] },
  { label: 'Team admin', items: [
    { label: 'Staff',         href: '/staff',       icon: UserCog },
    { label: 'Documents',     href: '/documents',   icon: FileText },
    { label: 'Settings',      href: '/settings',    icon: Settings },
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

  // Assistant Coaches: hide nav areas the current coach isn't cleared for. The gate is shared with
  // the mobile bottom nav (lib/coach-nav-visibility.ts) so it's one source of truth. Head coaches
  // have full capabilities so nothing hides; fail-open if caps are absent (server still enforces).
  const caps = currentAssignment?.capabilities;
  const navVisible = (label: string): boolean => isCoachNavItemVisible(caps, label);

  const base = `/${orgSlug}/coaches`;
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';

  // "In use yet?" signals decide whether a conditional item sits in its group or drops to Explore.
  const navSignals = {
    tryouts: !!currentAssignment?.hasTryoutSignal,
    tournaments: !!currentAssignment?.hasTournamentHistory,
  };
  type NavItem = { label: string; href: string; icon: typeof Users; conditional?: 'tryouts' | 'tournaments' };
  const itemState = (item: NavItem): 'primary' | 'explore' | 'hidden' => {
    if (!navVisible(item.label)) return 'hidden';                       // capability gate wins
    if (item.conditional && !navSignals[item.conditional]) return 'explore';
    return 'primary';
  };
  const renderNavItem = ({ label, href, icon: Icon }: NavItem) => {
    const fullHref = `${base}/teams/${currentTeamId}${href}`;
    const isActive = href === '' ? pathname === fullHref : pathname.startsWith(fullHref);
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
  };

  return (
    <nav className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarHeaderTop}>
          <p className={styles.sidebarPortalLabel}>Coaches Portal</p>
          {currentOrg?.id && (
            <div className="flex items-center gap-1 ml-auto">
              <NotificationBell
                orgId={currentOrg.id}
                settingsHref={`/account/notifications?focus=coach-${currentOrg.slug ?? orgSlug}`}
                seeAllHref={`/${currentOrg.slug}/coaches/notifications`}
              />
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
              const primaryItems = group.items.filter(item => itemState(item) === 'primary');
              if (!primaryItems.length) return null;
              return (
                <Fragment key={gi}>
                  {group.label && <p className={styles.sidebarGroupLabel}>{group.label}</p>}
                  {primaryItems.map(renderNavItem)}
                </Fragment>
              );
            })}
            {/* Explore — optional areas not in use yet, kept rediscoverable. Tryouts / Tournaments
                surface here until the team uses them, then graduate into their group above. */}
            {(() => {
              const exploreItems = TEAM_NAV_GROUPS.flatMap(g => g.items).filter(item => itemState(item) === 'explore');
              if (!exploreItems.length) return null;
              return (
                <Fragment>
                  <p className={styles.sidebarGroupLabel}>Explore</p>
                  {exploreItems.map(renderNavItem)}
                </Fragment>
              );
            })()}
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
