'use client';
import { useState, useRef, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, CalendarCheck, MessageSquare, Trophy,
  Users, UserCog, Megaphone, DollarSign, FileText, BarChart3,
  MoreHorizontal, X, ChevronRight, LogOut, HelpCircle, Settings, ClipboardList, ListOrdered, TrendingUp, Shield,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useCoaches, resolveClosedAssignment } from '@/lib/coaches-context';
import { isCoachNavItemVisible, CLOSED_TEAM_NAV_ITEMS } from '@/lib/coach-nav-visibility';
import { useChatUnread } from '@/lib/use-chat-unread';
import { useAnyOverlayOpen } from '@/lib/coaches-overlay';
import styles from './CoachesBottomNav.module.css';

// The four primary tabs (owner-picked 2026-06-29). Everything else lives in More.
const TEAM_TABS = [
  { key: '',          icon: LayoutDashboard, label: 'Overview' },
  { key: '/schedule', icon: Calendar,        label: 'Schedule' },
  { key: '/chat',     icon: MessageSquare,   label: 'Chat'     },
  { key: '/roster',   icon: Users,           label: 'Roster'   },
];

// A CLOSED season's tabs (Batch 3, P0 #1): the shared door list lives in
// lib/coach-nav-visibility.ts (one source for both navs); icons resolve here.
const CLOSED_TAB_ICON: Record<string, typeof Users> = { "Season's End": Trophy, Insights: BarChart3 };
const CLOSED_TEAM_TABS = CLOSED_TEAM_NAV_ITEMS.map(item => ({
  key: item.href, icon: CLOSED_TAB_ICON[item.label] ?? Trophy, label: item.label,
}));

// Remaining team sections — surfaced under More, each beneath a plain-language section header that
// mirrors the desktop sidebar groups (design rule: every More item sits under a section header).
// `conditional` items (Tryouts / Tournaments) drop to an "Explore" section until the team uses them.
// Hrefs keep their existing routes (/accounting, /history); only the labels change.
type MoreItem = { key: string; icon: typeof Users; label: string; conditional?: 'tryouts' | 'tournaments' };
const MORE_SECTIONS: { header: string; items: MoreItem[] }[] = [
  { header: 'Squad', items: [
    // Batch 4: Attendance had no door in either nav. Placed ahead of Lineups to mirror the
    // sidebar's Roster → Attendance → Lineups order.
    { key: '/attendance',    icon: CalendarCheck, label: 'Attendance' },
    { key: '/lineups',       icon: ListOrdered,   label: 'Lineups' },
    { key: '/development',   icon: TrendingUp,    label: 'Development' },
    { key: '/tryouts',       icon: ClipboardList, label: 'Tryouts', conditional: 'tryouts' },
  ] },
  { header: 'Season', items: [
    { key: '/history',       icon: BarChart3,     label: 'Insights' },
    { key: '/tournaments',   icon: Trophy,        label: 'Tournaments', conditional: 'tournaments' },
  ] },
  { header: 'Money', items: [
    { key: '/accounting',    icon: DollarSign,    label: 'Money' },
  ] },
  { header: 'Communication', items: [
    { key: '/announcements', icon: Megaphone,     label: 'Announcements' },
  ] },
  { header: 'Team admin', items: [
    { key: '/staff',         icon: UserCog,       label: 'Staff' },
    { key: '/documents',     icon: FileText,      label: 'Documents' },
    { key: '/settings',      icon: Settings,      label: 'Settings' },
  ] },
];
const ALL_MORE_KEYS = MORE_SECTIONS.flatMap(s => s.items.map(i => i.key));

export default function CoachesBottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole } = useOrg();
  const { assignments, closedAssignments } = useCoaches();
  const orgSlug  = currentOrg?.slug ?? '';
  const base     = `/${orgSlug}/coaches`;
  // "Back to admin" — only for a coach who also administers this org (seeded from the layout's
  // membership role; a coach-only user has no admin role, so no door). Review P3-4.
  const isOrgAdmin = userRole === 'owner' || userRole === 'admin';

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const chatUnread = useChatUnread();
  // Safety net (Coach Portal Batch 1, D3): while any sheet/modal is open, the bar hides itself
  // (no layout shift — visibility, not display) so a mis-tap can never land on a nav tab
  // underneath a full-height mobile sheet, even for a modal the CSS sweep hasn't reached yet.
  const anyOverlayOpen = useAnyOverlayOpen();

  // The portal is team-scoped: use the team in the URL, otherwise default to the
  // coach's (only / first) team so the bar always points somewhere sensible. The
  // team switcher in More lets multi-team coaches change it.
  const teamMatch     = pathname.match(/\/coaches\/teams\/([^/]+)/);
  const urlTeamId     = teamMatch?.[1] ?? null;
  const currentTeamId = urlTeamId ?? assignments[0]?.teamId ?? closedAssignments[0]?.teamId ?? null;
  const teamBase      = currentTeamId ? `${base}/teams/${currentTeamId}` : null;

  // Assistant Coaches: hide nav areas the current coach isn't cleared for (head coaches see all).
  const currentAssignment = currentTeamId ? assignments.find(a => a.teamId === currentTeamId) : null;
  // Closed-season access (Batch 3, P0 #1): the bar collapses to the read-only door set.
  // Same shared predicate as the sidebar/Overview (lib/coaches-context.tsx).
  const currentClosed = resolveClosedAssignment(assignments, closedAssignments, currentTeamId);
  const caps = currentAssignment?.capabilities;
  // Shared with the desktop sidebar (lib/coach-nav-visibility.ts) — one source of truth for gating.
  const navVisible = (label: string): boolean => isCoachNavItemVisible(caps, label);
  // "In use yet?" signals decide whether a conditional item sits in its section or drops to Explore.
  const navSignals = {
    tryouts: !!currentAssignment?.hasTryoutSignal,
    tournaments: !!currentAssignment?.hasTournamentHistory,
  };
  const moreItemState = (item: MoreItem): 'primary' | 'explore' | 'hidden' => {
    if (!navVisible(item.label)) return 'hidden';
    if (item.conditional && !navSignals[item.conditional]) return 'explore';
    return 'primary';
  };

  const isOnTeamMore = teamBase && !currentClosed
    ? ALL_MORE_KEYS.some(key => pathname.startsWith(`${teamBase}${key}`))
    : false;

  function tabIsActive(key: string): boolean {
    if (!teamBase) return false;
    return key === '' ? pathname === teamBase : pathname.startsWith(`${teamBase}${key}`);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  async function handleLogout() {
    await signOut();
    router.push('/auth/login');
  }

  return (
    <nav
      className={`${styles.bottomNav}${anyOverlayOpen ? ` ${styles.navHidden}` : ''}`}
      aria-label="Coaches mobile navigation"
    >
      {/* Four primary team tabs (closed seasons: the two read-only doors) */}
      {teamBase && (currentClosed ? CLOSED_TEAM_TABS : TEAM_TABS.filter(({ label }) => navVisible(label))).map(({ key, icon: Icon, label }) => {
        const active = tabIsActive(key);
        const isChat = key === '/chat';
        return (
          <Link
            key={key || 'overview'}
            href={`${teamBase}${key}`}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            id={`coaches-mob-${label.toLowerCase()}`}
            aria-label={isChat && chatUnread > 0 ? `Chat, ${chatUnread > 9 ? '9+' : chatUnread} unread` : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {active && <span className={styles.activeDot} />}
              {isChat && chatUnread > 0 && (
                <span
                  aria-hidden
                  style={{ position: 'absolute', top: -2, right: 2, background: 'var(--logic-lime)', color: 'var(--pitch-black)', fontSize: '0.55rem', fontWeight: 800, borderRadius: 999, padding: '0 4px', minWidth: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}

      {/* More */}
      <div ref={moreRef} className={styles.moreWrap}>
        <button
          className={`${styles.tab} ${(moreOpen || isOnTeamMore) ? styles.active : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          id="coaches-mob-more"
          aria-haspopup="true"
          aria-expanded={moreOpen}
        >
          <span className={styles.iconWrap}>
            {moreOpen
              ? <X size={22} strokeWidth={2} />
              : <MoreHorizontal size={22} strokeWidth={(moreOpen || isOnTeamMore) ? 2.5 : 1.8} />
            }
            {isOnTeamMore && !moreOpen && <span className={styles.activeDot} />}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <div className={styles.dropdown} role="menu">
            {/* Team switcher — only earns its place with 2+ entries (mirrors the tournament
                switcher). Closed-season teams get a quiet group instead of vanishing. */}
            {assignments.length + closedAssignments.length > 1 && (
              <>
                <div className={styles.dropSectionLabel}>Your teams</div>
                {assignments.map(a => {
                  const active = currentTeamId === a.teamId;
                  return (
                    <Link
                      key={a.teamId}
                      href={`${base}/teams/${a.teamId}`}
                      className={`${styles.dropItem} ${active ? styles.dropActive : ''}`}
                      role="menuitem"
                    >
                      {a.teamColor && (
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: a.teamColor, flexShrink: 0 }} />
                      )}
                      <span>{a.teamName}</span>
                      <ChevronRight size={14} className={styles.dropChevron} />
                    </Link>
                  );
                })}
                {closedAssignments.length > 0 && (
                  <>
                    <div className={styles.dropSectionLabel}>Season complete</div>
                    {closedAssignments.map(a => (
                      <Link
                        key={a.teamId}
                        href={`${base}/teams/${a.teamId}/season-end`}
                        className={`${styles.dropItem} ${currentTeamId === a.teamId ? styles.dropActive : ''}`}
                        role="menuitem"
                      >
                        {a.teamColor && (
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: a.teamColor, flexShrink: 0, opacity: 0.7 }} />
                        )}
                        <span>{a.teamName}</span>
                        <ChevronRight size={14} className={styles.dropChevron} />
                      </Link>
                    ))}
                  </>
                )}
                <div className={styles.dropDivider} />
              </>
            )}

            {/* Remaining team sections — each under a plain-language header mirroring the
                sidebar. A closed season has no "more" sections — its two doors ARE the tabs. */}
            {teamBase && !currentClosed && (() => {
              const renderMoreItem = ({ key, icon: Icon, label }: MoreItem) => {
                const href   = `${teamBase}${key}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={key}
                    href={href}
                    className={`${styles.dropItem} ${active ? styles.dropActive : ''}`}
                    role="menuitem"
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    <ChevronRight size={14} className={styles.dropChevron} />
                  </Link>
                );
              };
              const exploreItems = MORE_SECTIONS.flatMap(s => s.items).filter(i => moreItemState(i) === 'explore');
              return (
                <>
                  {MORE_SECTIONS.map(section => {
                    const items = section.items.filter(i => moreItemState(i) === 'primary');
                    if (!items.length) return null;
                    return (
                      <Fragment key={section.header}>
                        <div className={styles.dropSectionLabel}>{section.header}</div>
                        {items.map(renderMoreItem)}
                      </Fragment>
                    );
                  })}
                  {exploreItems.length > 0 && (
                    <Fragment>
                      <div className={styles.dropSectionLabel}>Explore</div>
                      {exploreItems.map(renderMoreItem)}
                    </Fragment>
                  )}
                  <div className={styles.dropDivider} />
                </>
              );
            })()}

            <Link
              href={`${base}/help`}
              className={styles.dropItem}
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
            >
              <HelpCircle size={17} />
              <span>Help</span>
              <ChevronRight size={14} className={styles.dropChevron} />
            </Link>
            {isOrgAdmin && (
              <Link
                href={`/${orgSlug}/admin`}
                className={styles.dropItem}
                role="menuitem"
                id="coaches-mob-back-to-admin"
                onClick={() => setMoreOpen(false)}
              >
                <Shield size={17} />
                <span>Back to admin</span>
              </Link>
            )}
            <button
              className={`${styles.dropItem} ${styles.dropLogout}`}
              onClick={handleLogout}
              role="menuitem"
              id="coaches-mob-logout"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
