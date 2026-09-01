'use client';
import { useState, useRef, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, MessageSquare, Trophy,
  Users, UserCog, Megaphone, DollarSign, FileText, BarChart3,
  MoreHorizontal, X, ChevronRight, LogOut, HelpCircle, Settings, ClipboardList, NotebookPen, ListOrdered, TrendingUp, Shield, Bell,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { isCoachNavItemVisible, withClosedSeasonNav, SEASON_END_LABEL } from '@/lib/coach-nav-visibility';
import { useChatUnread } from '@/lib/use-chat-unread';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import { useAnyOverlayOpen } from '@/lib/coaches-overlay';
import styles from './CoachesBottomNav.module.css';
import { useDismissable } from '@/lib/overlay-hooks';

// The four primary tabs (owner-picked 2026-06-29). Everything else lives in More.
//
// ⚠ THE FIRST TAB IS "WHERE YOU LAND", AND WHERE YOU LAND CHANGES (P2, 2026-08-16). On a team
// whose working season has finished it is Season's End rather than Overview — the same swap the
// sidebar makes in its first slot, for the same reason (an Overview describes a live season, and
// already redirects there). The parallel closed-season tab set and its `ARCHIVE_PRIMARY_LABELS`
// ordering are DELETED with the archive-as-a-place: one bar, one order, in every season state.
const OVERVIEW_TAB   = { key: '',            icon: LayoutDashboard, label: 'Overview' };
const SEASON_END_TAB = { key: '/season-end', icon: Trophy,          label: SEASON_END_LABEL };
const TEAM_TABS = [
  OVERVIEW_TAB,
  { key: '/schedule', icon: Calendar,        label: 'Schedule' },
  { key: '/chat',     icon: MessageSquare,   label: 'Chat'     },
  { key: '/roster',   icon: Users,           label: 'Roster'   },
];

/**
 * Remaining team sections — surfaced under More, each beneath a plain-language section header.
 *
 * ⚠ THIS MIRRORS `TEAM_NAV_GROUPS` IN `CoachesSidebar` — same six groups, same order, same
 * heat rule (hot at the top, cold at the bottom). **Read that file's header before changing
 * anything here**; it holds the reasoning, the label-vs-heading rule, and why the "Explore" shelf
 * and the whole `conditional` mechanism were deleted rather than renamed. Changing one nav and not
 * the other leaves the two telling different stories — pinned by
 * `tests/unit/coach-nav-groups.test.ts`.
 *
 * ⚠ The ORDER matches; the CONTENTS differ by exactly the phone's primary tabs. Overview,
 * Schedule, Roster and Chat are bottom-bar primaries (`TEAM_TABS`), so they do not repeat here —
 * which is why "Team" holds only Tryouts and "Communication" only Email families. That is the one
 * legal divergence, and it is a consequence of the bar, not a second opinion about grouping.
 *
 * Hrefs keep their existing routes (/accounting, /history); only the labels differ from the path.
 */
type MoreItem = { key: string; icon: typeof Users; label: string };
const MORE_SECTIONS: { header: string; items: MoreItem[] }[] = [
  { header: 'Season', items: [
    // ⚠ Attendance is in NEITHER nav now, live or archived. It left both live navs on 2026-08-15
    // (plan Phase 3) and left the archive menu on 2026-08-16 (archive rail Phase 2), once the
    // Insights hub became the archive's door and could carry it. It is a report whose parent is
    // that hub, in every season — reachable, just not listed. `CLOSED_SECTION_EXTRAS` in
    // lib/coach-nav-visibility.ts is what keeps the season switcher honouring that distinction.
    // Practice plans (2026-08-15) — the sidebar puts it directly under Schedule; Schedule is a
    // PRIMARY tab down here, so the hub leads its section instead.
    { key: '/practice',      icon: NotebookPen,   label: 'Practice plans' },
    { key: '/lineups',       icon: ListOrdered,   label: 'Lineups' },
    { key: '/tournaments',   icon: Trophy,        label: 'Tournaments' },
  ] },
  // ⚠ "Development" → "Skills & Goals" (owner ruling 5, 2026-08-18) — matching the sidebar, whose
  // note carries the reasoning. Route unchanged; the gate keeps the old label as a fallthrough.
  { header: 'Progress', items: [
    { key: '/development',   icon: TrendingUp,    label: 'Skills & Goals' },
    { key: '/history',       icon: BarChart3,     label: 'Insights' },
  ] },
  { header: 'Money', items: [
    { key: '/accounting',    icon: DollarSign,    label: 'Money' },
  ] },
  // Chunk B (P1 #1) — renamed to name its audience; see the sidebar's note for why Chat kept its
  // name. The route is unchanged, and the capability gate keeps the old label as a fallthrough.
  { header: 'Communication', items: [
    { key: '/announcements', icon: Megaphone,     label: 'Email families' },
  ] },
  // ⚠ **"TEAM ADMIN" IS MERGED INTO "TEAM"** (Phase 5b, owner-approved 2026-08-18) — matching the
  // sidebar, because the two navs are required to carry the same grouping and the guard test below
  // asserts them equal. The split asked a coach to know whether Staff was "the team" or
  // "administering the team". Nothing moved: these four were already consecutive and are in the
  // same order. ⚠ The sheet does NOT collapse — a coach opens it in order to find something, so
  // hiding rows behind a chevron here would be a second tap to reach the thing they came for.
  { header: 'Team', items: [
    { key: '/tryouts',       icon: ClipboardList, label: 'Tryouts' },
    { key: '/staff',         icon: UserCog,       label: 'Staff' },
    { key: '/documents',     icon: FileText,      label: 'Documents' },
    { key: '/settings',      icon: Settings,      label: 'Settings' },
  ] },
];
const ALL_MORE_KEYS = MORE_SECTIONS.flatMap(s => s.items.map(i => i.key));

/** Badge text for an unread count — the bar shows five of these (chat tab, More tab, the
 *  Notifications row, and both of their accessible names), and a "10" that renders where "9+"
 *  belongs is the kind of drift a repeated inline ternary invites. */
const badgeText = (n: number): string => (n > 9 ? '9+' : String(n));

export default function CoachesBottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg, userRole } = useOrg();
  const { assignments, closedAssignments } = useCoaches();
  const orgSlug  = currentOrg?.slug ?? '';
  const base     = `/${orgSlug}/coaches`;
  // The "Admin" door — only for a coach who also administers this org (seeded from the layout's
  // membership role; a coach-only user has no admin role, so no door). Review P3-4.
  const isOrgAdmin = userRole === 'owner' || userRole === 'admin';

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const chatUnread = useChatUnread();
  // Chunk B (P1 #4): until now the notification bell existed ONLY in the desktop sidebar, which is
  // display:none ≤900px — and the coach feed page had exactly ONE inbound link in the whole product,
  // inside that bell's panel. A phone-only coach could reach neither their notifications nor their
  // notification settings by any route. This mirrors the admin shell's shipped answer ("The Flip",
  // 2026-07-22): a row inside More that opens the FULL PAGE, with the count badging the More tab so
  // it is discoverable without opening the sheet.
  //
  // Deliberately the full page and not the bell's panel: the panel's phone rules anchor it at
  // `top: 48px + safe-area` to sit under the ADMIN top bar, and this portal has no top bar at any
  // width — it would hang below 48px of nothing.
  //
  // Not hoisted, deliberately. The sidebar bell and this bar are separated by CSS, NOT by React —
  // both components mount at every width, so on desktop two instances of this hook are live at
  // once. That is anticipated: the hook keys its Realtime channel off `useId` precisely so the
  // sidebar bell and the bottom nav can coexist in one tree without colliding, and `useChatUnread`
  // right above already double-mounts the same way. Hoisting would mean a client wrapper around a
  // server layout to own the count — real structure for one extra `limit=1` fetch on a breakpoint
  // where the bar is invisible. Revisit together with the chat count, never just this one.
  const { count: notifUnread } = useNotificationUnread(currentOrg?.id);
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

  // The team's LIVE season — ONE resolution rule with the sidebar, the masthead and every page
  // (lib/coach-season-view.ts).
  //
  // ⚠ **A CLOSED SEASON IS ONE PAGE** (owner ruling 2026-08-18). The bar no longer keeps every tab
  // between seasons with a read-only screen behind each: it becomes the single door to that page.
  const liveSeason = resolveLiveSeason(assignments, currentTeamId);
  const closedSeason = resolveClosedSeason(assignments, closedAssignments, currentTeamId);
  const workingSeason = liveSeason ?? closedSeason;
  const seasonFinished = !liveSeason && !!closedSeason;
  const caps = workingSeason?.capabilities;
  // Shared with the desktop sidebar (lib/coach-nav-visibility.ts) — one source of truth for gating.
  const navVisible = (label: string): boolean => isCoachNavItemVisible(caps, label);
  // ⚠ The `navSignals` / `moreItemState` pair that used to live here is GONE with the Explore
  // section (2026-08-15, plan Phase 4), in the same change as the sidebar's. An item is visible or
  // it is not; nothing relocates itself mid-season. See the sidebar for the full reasoning.

  const isOnTeamMore = teamBase
    ? ALL_MORE_KEYS.some(key => pathname.startsWith(`${teamBase}${key}`))
    : false;

  function tabIsActive(key: string): boolean {
    if (!teamBase) return false;
    return key === '' ? pathname === teamBase : pathname.startsWith(`${teamBase}${key}`);
  }

  useDismissable(moreOpen, moreRef, () => setMoreOpen(false)); // also gains Escape-to-close

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
      {/* The primary team tabs. Four while a season is live; ⚠ ONE once it has closed — the bar
          becomes the single door to that season's page, because a closed season IS one page and the
          other three tabs would open live instruments on a season that has ended (owner ruling
          2026-08-18). The More sheet below closes with it, in the same breath. */}
      {teamBase && withClosedSeasonNav(TEAM_TABS, seasonFinished, SEASON_END_TAB)
        .filter(({ label }) => navVisible(label))
        .map(({ key, icon: Icon, label }) => {
        const active = tabIsActive(key);
        const isChat = key === '/chat';
        return (
          <Link
            key={key || 'overview'}
            href={`${teamBase}${key}`}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            id={`coaches-mob-${label.toLowerCase()}`}
            aria-label={isChat && chatUnread > 0 ? `Chat, ${badgeText(chatUnread)} unread` : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {active && <span className={styles.activeDot} />}
              {isChat && chatUnread > 0 && (
                <span aria-hidden className={styles.tabCount}>
                  {badgeText(chatUnread)}
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
          aria-label={!moreOpen && notifUnread > 0 ? `More, ${badgeText(notifUnread)} unread notifications` : undefined}
        >
          <span className={styles.iconWrap}>
            {moreOpen
              ? <X size={22} strokeWidth={2} />
              : <MoreHorizontal size={22} strokeWidth={(moreOpen || isOnTeamMore) ? 2.5 : 1.8} />
            }
            {isOnTeamMore && !moreOpen && <span className={styles.activeDot} />}
            {/* What is waiting inside More bubbles up to the tab, so the coach never has to open the
                sheet to find out. Hidden while the sheet is open — the row itself is on screen. */}
            {!moreOpen && notifUnread > 0 && (
              <span aria-hidden className={styles.tabCount}>
                {badgeText(notifUnread)}
              </span>
            )}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <div className={styles.dropdown} role="menu">
            {/* Notifications — the mobile home for a feed that had no phone door at all (Chunk B,
                P1 #4). FIRST in the sheet, matching the admin shell's placement, and opening the
                full page rather than the desktop bell's panel (see the hook comment above). The
                page carries its own "Notification settings" link, so one row reaches both. */}
            {currentOrg?.id && (
              <>
                <Link
                  className={styles.dropItem}
                  href={`${base}/notifications`}
                  onClick={() => setMoreOpen(false)}
                  role="menuitem"
                  id="coaches-mob-notifications"
                >
                  <Bell size={17} />
                  <span>Notifications</span>
                  {notifUnread > 0 && (
                    <span className={styles.dropCount} aria-label={`${badgeText(notifUnread)} unread`}>
                      {badgeText(notifUnread)}
                    </span>
                  )}
                </Link>
                <div className={styles.dropDivider} />
              </>
            )}

            {/* Team switcher — only earns its place with 2+ entries (mirrors the tournament
                switcher). A team with no live season keeps its own quiet group and lands on
                Season's End, which is where its nav's first slot points too. */}
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
                    <div className={styles.dropSectionLabel}>No live season</div>
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

            {/* ⚠ The season switcher stood HERE and is deleted (P2, 2026-08-16, Design A) — with
                it, the parallel "Sections" list that replaced the coach's own menu once a season
                ended. One sheet, one order, in every season state. Looking back is Season's End,
                Season Wrapped and the compare list at the bottom of Insights. */}

            {teamBase && (() => {
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
              return (
                <>
                  {/* ⚠⚠ **THE SHEET CLOSES WITH THE SEASON, and this line is why the phone is not
                      half-converted** (found 2026-08-18 by another session reading this change
                      mid-flight, before it was committed). `withClosedSeasonNav` above filters
                      TEAM_TABS, so the BAR correctly became one door — and without this, the More
                      sheet still listed all eleven, every one of them a live instrument on a
                      season that has ended. Desktop would have shown one door and the phone
                      twelve.

                      ⚠ `coach-nav-groups.test.ts` cannot catch this: it compares the two navs'
                      LIVE-season label sets, which are identical either way. The closed-season
                      assertion beside it is what holds this. */}
                  {seasonFinished ? null : MORE_SECTIONS.map(section => {
                    const items = section.items.filter(i => navVisible(i.label));
                    if (!items.length) return null;
                    return (
                      <Fragment key={section.header}>
                        <div className={styles.dropSectionLabel}>{section.header}</div>
                        {items.map(renderMoreItem)}
                      </Fragment>
                    );
                  })}
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
                <span>Admin</span>
              </Link>
            )}
            <button
              className={`${styles.dropItem} ${styles.dropLogout}`}
              onClick={handleLogout}
              role="menuitem"
              id="coaches-mob-logout"
            >
              <LogOut size={17} />
              {/* "Sign out" (was "Logout"), unified 2026-09-01 with the strip menu and the
                  account page — one name for one action everywhere a customer reads it. */}
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
