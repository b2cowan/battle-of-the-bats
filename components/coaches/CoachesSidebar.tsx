'use client';
import { Fragment, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, UserCog, Calendar, ClipboardList, NotebookPen, Megaphone, DollarSign, FileText, BarChart3, LayoutDashboard, HelpCircle, Settings, MessageSquare, Trophy, LogOut, ListOrdered, TrendingUp, Shield } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useCoaches, resolveLiveSeason, resolveClosedSeason } from '@/lib/coaches-context';
import { isCoachNavItemVisible, withClosedSeasonNav, SEASON_END_LABEL } from '@/lib/coach-nav-visibility';
import { useOrg } from '@/lib/org-context';
import { useChatUnread } from '@/lib/use-chat-unread';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

// Grouped so the sidebar reads as plain-language clusters (Squad / Season / Money / Communication /
// Team admin) rather than a flat build-order list. Overview stays ungrouped at the top. Lineups is a
// front door for the game-day builder (was menu-invisible). Tryouts / Tournaments are `conditional`:
// they sit in their group only once the team uses them, otherwise they drop to an "Explore" group.
// The Depth chart lives INSIDE Roster (a view toggle), so it's intentionally not a nav item. Hrefs
// keep their existing routes (/accounting, /history) — only the labels change.
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE TEAM NAV — six groups, fixed, always in the same place (owner-approved 2026-08-15, plan
 * Phase 4). `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §2 holds the reasoning; this is the rule:
 *
 *   > Order groups by HOW OFTEN A COACH OPENS THEM. Hot at the top, cold at the bottom.
 *   > Nothing is conditional.
 *
 * The sidebar had never had a stated ordering principle. Groups described what the DATA WAS ABOUT
 * — "Squad" is people, "Season" is time — but a coach on a Tuesday night is not thinking "people",
 * they are thinking "practice is in two hours". Roster is a September job; Tryouts is an August
 * job; Schedule and practice plans are a Tuesday job. Once heat is the rule, where each thing goes
 * stops being a matter of taste.
 *
 * ⚠ NO ITEM IS RENAMED AND NO ROUTE MOVES, in this change or any future one made casually.
 * `isCoachNavItemVisible` is keyed by DISPLAY LABEL, so renaming an item silently drops it through
 * to `default: return true` and hands an ungranted assistant the door. **Group headings are free;
 * item labels are not.** ("Squad" → "Team" below is a HEADING, which is why it is allowed.)
 *
 * ⚠ BOTH NAVS MOVE TOGETHER. `CoachesBottomNav`'s More sheet mirrors this grouping and this order.
 * Changing one and not the other leaves the two navs telling different stories — pinned by
 * `tests/unit/coach-nav-groups.test.ts`.
 *
 * ⚠ THE "EXPLORE" SHELF IS DELETED, NOT RENAMED (and with it the whole `conditional` mechanism).
 * Tryouts and Tournaments used to sit in their group only once `hasTryoutSignal` /
 * `hasTournamentHistory` was true, and otherwise dropped to a shelf labelled "Explore" — so the
 * sidebar REARRANGED ITSELF mid-season, moving items a coach had already learned the position of.
 * The word also collided with a real product concept (browsing public tournaments to enter,
 * `/discover`). Both surfaces already have empty states that teach what they are for, which is the
 * job the shelf was doing badly.
 *
 * Open and deliberately not decided: under a strict heat rule Chat probably outranks Money (daily
 * vs monthly). Money is left above Communication because it is the bigger product pillar. Flagged
 * for the owner, not assumed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
/**
 * ⚠ THE FIRST SLOT IS "WHERE YOU LAND", AND WHERE YOU LAND CHANGES (P2, 2026-08-16). A team whose
 * working season has finished shows **Season's End** here instead of Overview — the Overview is a
 * live-season dashboard (what's next, the one thing to do today) and has nothing to say about a
 * season that is over, which is why it already redirects there. One slot, one destination, no
 * second menu: this replaced a whole parallel `CLOSED_TEAM_NAV_ITEMS` set that reordered and
 * shortened the coach's nav the moment a season ended.
 */
const OVERVIEW_ITEM = { label: 'Overview', href: '', icon: LayoutDashboard };
const SEASON_END_ITEM = { label: SEASON_END_LABEL, href: '/season-end', icon: Trophy };

const TEAM_NAV_GROUPS: { label?: string; items: { label: string; href: string; icon: typeof Users }[] }[] = [
  { items: [OVERVIEW_ITEM] },
  /** Hottest: the week's work. "Season" is RETAINED as the heading — "Game day" was rejected once
   *  practice plans joined it, because practices are not game day, and keeping the existing word
   *  means a coach does not have to relearn a heading whose contents merely changed. */
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
    // Moved out of "Squad": a lineup is a thing you build for a GAME, on the calendar, not a fact
    // about the roster. It now sits beside the two surfaces it is built from.
    { label: 'Lineups',     href: '/lineups',     icon: ListOrdered },
    // Permanent, no longer conditional — see the Explore note above.
    { label: 'Tournaments', href: '/tournaments', icon: Trophy },
  ] },
  /** New group. Development and Insights are both "how are we doing?" surfaces read on a quiet
   *  evening — Development is closer to Insights than Schedule ever was. Attendance is INSIDE
   *  Insights as of Phase 3 rather than being an item here. */
  { label: 'Progress', items: [
    { label: 'Development', href: '/development', icon: TrendingUp },
    { label: 'Insights',    href: '/history',     icon: BarChart3 },
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
  /** Coldest of the real work: setting the season up. ⚠ TRYOUTS DOES NOT MOVE relative to Roster
   *  (owner ruling) — the two travel down together and keep their order, because they are both
   *  "set the season up" tools and one produces the other. The heading is "Team" rather than
   *  "Squad" only because the group no longer holds the game-day tools that made "Squad" mean
   *  "the playing side of things". */
  { label: 'Team', items: [
    { label: 'Roster',      href: '/roster',      icon: Users },
    { label: 'Tryouts',     href: '/tryouts',     icon: ClipboardList },
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
  const { assignments, closedAssignments } = useCoaches();
  const { userRole } = useOrg();
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

  // The team's LIVE season, and — when it has none — its newest closed one. ONE resolution rule,
  // shared with the bottom nav, the masthead and every page (lib/coach-season-view.ts), so no
  // surface can drift on which season it is describing.
  //
  // ⚠ **A CLOSED SEASON IS ONE PAGE** (owner ruling 2026-08-18). The nav a coach between seasons
  // sees is that page and nothing else — not the whole menu with read-only screens behind it, which
  // is what the twenty-nine deleted finished-season branches existed to explain.
  const liveSeason = resolveLiveSeason(assignments, currentTeamId);
  const closedSeason = resolveClosedSeason(assignments, closedAssignments, currentTeamId);
  const workingSeason = liveSeason ?? closedSeason;
  const seasonFinished = !liveSeason && !!closedSeason;

  // Assistant Coaches: hide nav areas the current coach isn't cleared for. The gate is shared with
  // the mobile bottom nav (lib/coach-nav-visibility.ts) so it's one source of truth. Head coaches
  // have full capabilities so nothing hides; fail-open if caps are absent (server still enforces).
  const caps = workingSeason?.capabilities;
  const navVisible = (label: string): boolean => isCoachNavItemVisible(caps, label);

  const base = `/${orgSlug}/coaches`;

  // ⚠ The `navSignals` / `itemState` pair that used to live here is GONE with the Explore shelf
  // (2026-08-15, plan Phase 4). An item is visible or it is not; nothing relocates itself based on
  // what the team has and hasn't done yet. The assignment row's tournament-history signal followed
  // it out of `lib/db.ts` on 2026-08-16, taking three queries off every coach load with it.
  type NavItem = { label: string; href: string; icon: typeof Users };
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
      {/* ⚠ THE SIDEBAR HEADER IS DELETED (owner-approved mockup 2026-08-17, logged in
          memory/design_decisions.md): "Coaches Portal" and the NotificationBell moved up into
          CoachTopStrip, and the org name is gone from the rail entirely — the masthead eyebrow
          already names the club on every team page, so the rail printed it twice within two
          inches. The rail owns navigation; the strip owns identity. */}

      {/* Team switcher — a DROPDOWN, matching the admin shell's tournament switcher (owner
          call, Batch 3 QA 2026-07-29; replaces the old row list). Only earns its place with
          2+ entries, and is the rail's FIRST element — no "My Teams" label (a dropdown showing
          a team name is self-describing; the accessible name stays on the control). Closed-season
          teams sit in a "No live season" group and open on their read-only Season's End. */}
      {assignments.length + closedAssignments.length > 1 && (
        <div className={styles.sidebarSection}>
          <select
            id="coach-team-select"
            aria-label="Switch team"
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
              // "No live season", not "Season complete": these are TEAMS, and the word describes
              // where the team is — the coach still has it, and every record in it still opens.
              <optgroup label="No live season">
                {closedAssignments.map(a => (
                  <option key={a.teamId} value={a.teamId}>{a.teamName} · {a.programYearName}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      {/* ⚠ THE SEASON SWITCHER STOOD HERE and is deleted (P2, 2026-08-16, Design A). A coach reads
          the season their team is on; there is no control anywhere that points the portal at a
          different one. Looking back is Season's End, Season Wrapped and the compare list at the
          bottom of Insights → "How are we doing?" — three destinations, not a mode. */}

      {/* Team-scoped nav — ONE menu, one order, in every season state. When the working season
          has finished the first slot becomes Season's End and the rest stay exactly where the
          coach learned them; records render read-only and the live instruments say so themselves.
          (The parallel closed-season menu that used to replace all of this is deleted.) */}
      {currentTeamId && workingSeason && (
        <>
          {/* The divider separates the switcher from the nav — with one team there is no
              switcher, and the nav starts at the very top of the rail with nothing above it. */}
          {assignments.length + closedAssignments.length > 1 && <div className={styles.sidebarDivider} />}
          <div className={styles.sidebarSection}>
            {/* No team-name heading — with one team the header names it, and with several
                the switcher dropdown above already shows the current team. */}
            {workingSeason.coachRole === 'assistant_coach' && (
              <p className={styles.sidebarSectionLabel}>Assistant Coach</p>
            )}
            {/* ⚠ A group renders only when the coach can see something in it, so an assistant's
                sidebar is shorter — but every item they DO have is always in the same place. That
                is the whole win of deleting the Explore shelf: position is a function of the
                coach's grants, never of what the team has got round to doing yet. */}
            {TEAM_NAV_GROUPS.map((group, gi) => {
              // The landing slot swaps with the season's state — ONE rule, shared with the bottom
              // nav (lib/coach-nav-visibility.ts), because these two navs must not drift.
              const items = withClosedSeasonNav(group.items, seasonFinished, SEASON_END_ITEM)
                .filter(item => navVisible(item.label));
              if (!items.length) return null;
              return (
                <Fragment key={gi}>
                  {group.label && <p className={styles.sidebarGroupLabel}>{group.label}</p>}
                  {items.map(renderNavItem)}
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
