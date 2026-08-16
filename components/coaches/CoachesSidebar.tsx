'use client';
import { Fragment, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Users, UserCog, Calendar, CalendarCheck, ClipboardList, NotebookPen, Megaphone, DollarSign, FileText, BarChart3, LayoutDashboard, HelpCircle, Settings, MessageSquare, Trophy, LogOut, ListOrdered, TrendingUp, Shield } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useCoaches, resolveClosedAssignment, resolveSeasonView } from '@/lib/coaches-context';
import { resolveSeasonSwitchHref, seasonStatusLabel } from '@/lib/coach-season-view';
import { isCoachNavItemVisible, CLOSED_TEAM_NAV_ITEMS } from '@/lib/coach-nav-visibility';
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
    /**
     * ⚠ ATTENDANCE IS NOT A NAV ITEM (owner-approved 2026-08-15, plan Phase 3). No attendance is
     * ever recorded on the attendance page — marking a player present happens in the Schedule's
     * event panel, and that page's own hero card is a shortcut back to it. What is left is a
     * season table of fractions: a report, and it was already a report tile on Insights. It has
     * ONE parent now, which is what retires the wrong-half-the-time back link rather than
     * patching it.
     *
     * ⚠ IT REMAINS IN `CLOSED_TEAM_NAV_ITEMS`, and that is not an oversight. On a finished season
     * the archive nav points "Insights" at `/history/results`, NOT at the Insights hub — the hub
     * is live-season-only and `/history/results` carries no attendance door. Removing the archive
     * entry too would make a past season's attendance report unreachable, deleting an archive door
     * ruled in under D-F1. Live nav: gone. Archive nav: kept, deliberately.
     */
    { label: 'Lineups',     href: '/lineups',     icon: ListOrdered },
    // Primary (not Explore) by design decision 2026-07-17 — a growth pillar whose
    // evaluation-sessions job exists before any usage signal could accrue.
    { label: 'Development', href: '/development', icon: TrendingUp },
    { label: 'Tryouts',     href: '/tryouts',     icon: ClipboardList, conditional: 'tryouts' },
  ] },
  { label: 'Season', items: [
    { label: 'Schedule',    href: '/schedule',    icon: Calendar },
    // Directly under Schedule (owner-approved 2026-08-15): practice plans had no nav entry at all,
    // reachable only by opening the Schedule, finding the right practice and scrolling its panel —
    // while Lineups, built far less often, had a door, a hub and a readiness filter. ⚠ Deliberately
    // NOT in CLOSED_TEAM_NAV_ITEMS: plans are a live-season instrument, and this group only renders
    // for a live season, so the door is archive-invisible for free.
    // ⚠ NotebookPen, not ClipboardList — Tryouts already owns ClipboardList in this nav, and two
    // items sharing an icon is a worse read than the hub differing from its own drill-in page.
    { label: 'Practice plans', href: '/practice',  icon: NotebookPen },
    { label: 'Insights',    href: '/history',     icon: BarChart3 },
    { label: 'Tournaments', href: '/tournaments', icon: Trophy, conditional: 'tournaments' },
  ] },
  { label: 'Money', items: [
    { label: 'Money',       href: '/accounting',  icon: DollarSign },
  ] },
  // Chunk B (P1 #1): the two doors now name their AUDIENCE. "Chat" and "Announcements" sat adjacent
  // with nothing to tell them apart, and a coach had to open one and back out to find the one that
  // reaches parents. They are not two flavours of messaging — Chat is a two-way conversation with
  // the coach's own staff (all season) and, during an event, the organizer; this one is a one-way
  // EMAIL to every family on the roster. "Chat" is kept because it is the app-wide word for a
  // conversation (the consumer bottom bar uses it and the page heads itself "Your chats"), so
  // renaming it would fracture a platform vocabulary to fix a local problem.
  { label: 'Communication', items: [
    { label: 'Chat',           href: '/chat',          icon: MessageSquare },
    { label: 'Email families', href: '/announcements', icon: Megaphone },
  ] },
  { label: 'Team admin', items: [
    { label: 'Staff',         href: '/staff',       icon: UserCog },
    { label: 'Documents',     href: '/documents',   icon: FileText },
    { label: 'Settings',      href: '/settings',    icon: Settings },
  ] },
];

// A CLOSED season's nav (Batch 3, P0 #1): the shared door list lives in
// lib/coach-nav-visibility.ts (one source for both navs); icons resolve here.
const CLOSED_NAV_ICON: Record<string, typeof Users> = {
  "Season's End": Trophy, Roster: Users, Schedule: Calendar, Attendance: CalendarCheck,
  Lineups: ListOrdered, Money: DollarSign, Documents: FileText, Development: TrendingUp,
  Tryouts: ClipboardList, Insights: BarChart3, Staff: Shield,
};
const CLOSED_TEAM_NAV = CLOSED_TEAM_NAV_ITEMS.map(item => ({ ...item, icon: CLOSED_NAV_ICON[item.label] ?? Trophy }));

export default function CoachesSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { assignments, closedAssignments, seasons } = useCoaches();
  const { currentOrg, userRole } = useOrg();
  // The "Admin" door — only for a coach who also administers this org (seeded from the layout's
  // membership role; a coach-only user has no admin role, so no door). Review P3-4.
  const isOrgAdmin = userRole === 'owner' || userRole === 'admin';
  const chatUnread = useChatUnread();

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  const teamMatch = pathname.match(/\/coaches\/teams\/([^/]+)/);
  const currentTeamId = teamMatch?.[1] ?? null;

  // Remember the last team the coach was in (per org) — the /coaches entry point lands
  // there on the next visit (owner call, Batch 3 QA 2026-07-29). Best-effort only.
  useEffect(() => {
    if (!currentTeamId) return;
    try { localStorage.setItem(`flhq-coach-last-team:${orgSlug}`, currentTeamId); } catch { /* ignore */ }
  }, [currentTeamId, orgSlug]);

  const currentAssignment = currentTeamId
    ? assignments.find(a => a.teamId === currentTeamId)
    : null;
  // Closed-season access — ONE shared predicate (lib/coaches-context.tsx) with the nav,
  // Overview, and the read-only pages, so no surface can drift on what "closed" means.
  const currentClosed = resolveClosedAssignment(assignments, closedAssignments, currentTeamId);

  // Which SEASON is on screen (Chunk F). Read-only is a fact about the season, never the team:
  // a rolled-forward team is never itself "closed", but its 2025 is still a record.
  const seasonView = resolveSeasonView(seasons, currentTeamId, searchParams.get('year'));
  const inArchive = seasonView.isReadOnly;

  // Assistant Coaches: hide nav areas the current coach isn't cleared for. The gate is shared with
  // the mobile bottom nav (lib/coach-nav-visibility.ts) so it's one source of truth. Head coaches
  // have full capabilities so nothing hides; fail-open if caps are absent (server still enforces).
  //
  // ⚠ In an archive the grants come from THAT SEASON's assignment row (governing rule 1), not the
  // coach's current ones — an assistant promoted this year must not retroactively see 2025's money.
  const caps = inArchive
    ? seasonView.current?.capabilities
    : currentAssignment?.capabilities;
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
        // Carry the season across section links, so switching sections keeps the year:
        // Roster 2025 → Schedule 2025, never silently back to the live season.
        href={`${fullHref}${seasonView.query}`}
        className={`${styles.sidebarItem}${isActive ? ` ${styles.sidebarItemActive}` : ''}`}
      >
        <Icon size={14} />
        {label}
        {label === 'Chat' && <ChatUnreadBadge count={chatUnread} />}
      </Link>
    );
  };

  /** Move to another season, keeping the coach on the section they are already reading. */
  const switchSeason = (programYearId: string) => {
    const target = seasonView.options.find(s => s.programYearId === programYearId);
    if (!target || !currentTeamId) return;
    router.push(resolveSeasonSwitchHref(`${base}/teams/${currentTeamId}`, pathname, target));
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
        {/* The old "Back to {org}" link (→ the org's PUBLIC page) was removed here (owner
            call, Batch 3 QA 2026-07-29): the portal is a workspace, not a public sub-page —
            public surfaces are reached through the Flip doors, and admin-coaches keep their
            "Admin" door below. */}
      </div>

      {/* Team switcher — a DROPDOWN, matching the admin shell's tournament switcher (owner
          call, Batch 3 QA 2026-07-29; replaces the old row list). Only earns its place with
          2+ entries. Closed-season teams sit in a "Season complete" group and open on their
          read-only Season's End. */}
      {assignments.length + closedAssignments.length > 1 && (
        <div className={styles.sidebarSection}>
          <label className={styles.sidebarSectionLabel} htmlFor="coach-team-select">My Teams</label>
          <select
            id="coach-team-select"
            className={styles.teamSwitcherSelect}
            value={currentTeamId ?? ''}
            onChange={e => {
              const id = e.target.value;
              if (!id || id === currentTeamId) return;
              const isClosed = closedAssignments.some(a => a.teamId === id);
              router.push(`${base}/teams/${id}${isClosed ? '/season-end' : ''}`);
            }}
          >
            {!currentTeamId && <option value="">Choose a team…</option>}
            {assignments.map(a => (
              <option key={a.teamId} value={a.teamId}>{a.teamName}</option>
            ))}
            {closedAssignments.length > 0 && (
              // "No live season" not "Season complete" (Chunk F): these are TEAMS, and a group
              // beside the seasons switcher below saying "season" would read as the same thing.
              <optgroup label="No live season">
                {closedAssignments.map(a => (
                  <option key={a.teamId} value={a.teamId}>{a.teamName} · {a.programYearName}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* Season switcher (Chunk F, D-F3) — the same slot and shape as the admin shell's
          tournament switcher, one level down. Only earns its place with 2+ seasons, so a
          first-season coach never sees a control that does nothing. */}
      {currentTeamId && seasonView.hasChoice && (
        <div className={styles.sidebarSection}>
          <label className={styles.sidebarSectionLabel} htmlFor="coach-season-select">
            {inArchive ? 'Viewing archive' : 'Season'}
          </label>
          <select
            id="coach-season-select"
            className={`${styles.teamSwitcherSelect}${inArchive ? ` ${styles.seasonSwitcherArchive}` : ''}`}
            value={seasonView.current?.programYearId ?? ''}
            onChange={e => switchSeason(e.target.value)}
          >
            {seasonView.options.map(s => (
              <option key={s.programYearId} value={s.programYearId}>
                {s.programYearName} · {seasonStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ARCHIVE nav — the full record set for the season being viewed (Chunk F). Replaces
          Batch 3's two doors. Reached two ways: a team with no live season at all, or any team
          whose coach has switched back to a past year. */}
      {currentTeamId && (currentClosed || inArchive) && (
        <>
          <div className={styles.sidebarDivider} />
          <div className={styles.sidebarSection}>
            {/* No team-name heading — the switchers above already name team and season. */}
            {CLOSED_TEAM_NAV.filter(item => navVisible(item.label)).map(renderNavItem)}
          </div>
        </>
      )}

      {/* Team-scoped nav — only when inside a team, and only for the LIVE season. A
          rolled-forward team viewing 2025 has a live assignment but must show the archive
          door set above, not both. */}
      {currentTeamId && currentAssignment && !inArchive && (
        <>
          <div className={styles.sidebarDivider} />
          <div className={styles.sidebarSection}>
            {/* No team-name heading — with one team the header names it, and with several
                the switcher dropdown above already shows the current team. */}
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
        {isOrgAdmin && (
          <Link href={`/${orgSlug}/admin`} className={styles.sidebarItem}>
            <Shield size={14} />
            Admin
          </Link>
        )}
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
