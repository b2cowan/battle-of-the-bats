/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * lib/coach-team-nav.ts — THE COACH TEAM NAV, ONCE (navigation Phase 4, owner 2026-11-11). The Premium sidebar draws it,
 * the phone's More sheet is it minus the bar's tabs, the strip names the page from it (`coachDeskTitleAt`), and the
 * tests import it — it was a module-local literal in `CoachesSidebar` that the guards read back as source text.
 *
 * THE TEAM NAV — six groups, fixed, always in the same place (owner-approved 2026-08-15, plan Phase 4).
 * `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §2 holds the reasoning; this is the rule:
 *
 *   > Order groups by HOW OFTEN A COACH OPENS THEM. Hot at the top, cold at the bottom.
 *   > Nothing is conditional.
 *
 * Groups described what the DATA WAS ABOUT before — "Squad" is people, "Season" is time — but a coach on a Tuesday night
 * is not thinking "people", they are thinking "practice is in two hours". Roster is a September job; Tryouts is an August
 * job; Schedule and practice plans are a Tuesday job. Once heat is the rule, where each thing goes stops being taste.
 *
 * ⚠ NO ITEM IS RENAMED AND NO ROUTE MOVES, in this change or any future one made casually. `isCoachNavItemVisible` is
 * keyed by DISPLAY LABEL, so renaming an item silently drops it through to `default: return true` and hands an ungranted
 * assistant the door. **Group headings are free; item labels are not.** The headings are also the tour's eyebrows
 * (CoachPortalTour.tsx) — when one changes here, both follow.
 *
 * ⚠ THE "EXPLORE" SHELF IS DELETED, NOT RENAMED (and with it the whole `conditional` mechanism): the sidebar used to
 * REARRANGE ITSELF mid-season. Both surfaces already have empty states that teach what they are for.
 *
 * ⚖ NOTHING FOLDS (navigation Phase 4, E14, owner 2026-11-09): the headings are labels over rows that are always there;
 * the list scrolls between the pinned team cell and the foot. The folding groups, their stored choice and their
 * closed-heading counts retired with it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  Users, UserCog, Calendar, ClipboardList, NotebookPen, Mail, DollarSign, FileText, BarChart3, LayoutGrid, Archive,
  Settings, MessageSquare, Trophy, ListOrdered, TrendingUp,
} from 'lucide-react';
import { OVERVIEW_LABEL, SEASON_END_LABEL, isCoachNavItemVisible, withClosedSeasonNav } from './coach-nav-visibility';
import type { CoachCapabilities } from './coach-capabilities';
import { playerDevelopmentHref, returnLabel, safeReturnPath, skillsAndGoalsHref } from './development-address';
import { insightsSectionHref } from './coach-insights-links';
import { practicePlansHref } from './practice-plans-address';
import { lineupsHref } from './lineups-address';

export type CoachNavItem = { label: string; href: string; icon: typeof Users };
export type CoachNavGroup = { label?: string; items: CoachNavItem[] };

/**
 * ⚠ THE FIRST SLOT IS "WHERE YOU LAND", AND WHERE YOU LAND CHANGES (P2, 2026-08-16). A team with no live season shows
 * **Season's End** here instead of Overview, and nothing else (`withClosedSeasonNav`). ⚖ The nav standard's icons (N5,
 * owner 2026-10-17): Overview is the club's Overview grid, and Season's End an archive box.
 */
export const OVERVIEW_ITEM: CoachNavItem = { label: OVERVIEW_LABEL, href: '', icon: LayoutGrid };
export const SEASON_END_ITEM: CoachNavItem = { label: SEASON_END_LABEL, href: '/season-end', icon: Archive };

export const TEAM_NAV_GROUPS: CoachNavGroup[] = [
  { items: [OVERVIEW_ITEM] },
  /** Hottest: the week's work. "Season" is RETAINED as the heading — "Game day" was rejected once practice plans joined
   *  it, because practices are not game day. Practice plans sit directly under Schedule (owner-approved 2026-08-15);
   *  NotebookPen, because Tryouts owns ClipboardList. A lineup is built for a GAME, so it sits beside the two surfaces it is
   *  built from. Tournaments is permanent, no longer conditional. */
  { label: 'Season', items: [
    { label: 'Schedule',    href: '/schedule',    icon: Calendar },
    { label: 'Practice plans', href: '/practice',  icon: NotebookPen },
    { label: 'Lineups',     href: '/lineups',     icon: ListOrdered },
    { label: 'Tournaments', href: '/tournaments', icon: Trophy },
  ] },
  /** "How are we doing?" surfaces read on a quiet evening. ⚠ "Development" → "Skills & goals" (owner ruling 5,
   *  2026-08-18): the route is unchanged; the capability gate has a case for the new name AND keeps the old one. */
  { label: 'Progress', items: [
    { label: 'Skills & goals', href: '/development', icon: TrendingUp },
    { label: 'Insights',       href: '/history',     icon: BarChart3 },
  ] },
  { label: 'Money', items: [
    { label: 'Money',       href: '/accounting',  icon: DollarSign },
  ] },
  /** The two doors name their AUDIENCE (Chunk B): Chat is the two-way conversation with the coach's own staff; Email
   *  families is a one-way email to every family on the roster. The envelope is email to many (N5). */
  { label: 'Communication', items: [
    { label: 'Chat',           href: '/chat',          icon: MessageSquare },
    { label: 'Email families', href: '/announcements', icon: Mail },
  ] },
  /** Coldest of the real work: setting the season up. ⚠ TRYOUTS DOES NOT MOVE relative to Roster (owner ruling); "Team
   *  admin" merged into this group (Phase 5b, owner-approved 2026-08-18) — nothing moved. */
  { label: 'Team', items: [
    { label: 'Roster',        href: '/roster',      icon: Users },
    { label: 'Tryouts',       href: '/tryouts',     icon: ClipboardList },
    { label: 'Staff',         href: '/staff',       icon: UserCog },
    { label: 'Documents',     href: '/documents',   icon: FileText },
    { label: 'Settings',      href: '/settings',    icon: Settings },
  ] },
];

/**
 * The groups the sidebar draws for this coach and this season — ONE answer for the sidebar's rows and the strip's name.
 * ⚠ A team with no live season has ONE door (CLAUDE.md, binding): `withClosedSeasonNav` leaves its landing group holding
 * Season's End and every other group empty. ⚠ A group a coach can see nothing in renders no heading at all. The gate is
 * keyed by LABEL (`isCoachNavItemVisible`); fail-open when the capabilities are absent (every route enforces its own).
 */
export function coachNavGroupsFor(caps: CoachCapabilities | undefined, seasonFinished: boolean): CoachNavGroup[] {
  return TEAM_NAV_GROUPS
    .map(g => ({ label: g.label, items: withClosedSeasonNav(g.items, seasonFinished, SEASON_END_ITEM).filter(i => isCoachNavItemVisible(caps, i.label)) }))
    .filter(g => g.items.length > 0);
}

/**
 * ⚖ THE PHONE'S MORE SHEET IS THIS LIST MINUS THE BAR'S TABS (the one legal divergence — a consequence of the bar, not a
 * second opinion about grouping). Overview, Schedule, Chat and Roster are the bar's primaries (`CoachesBottomNav`'s
 * `TEAM_TABS`), so they do not repeat: "Team" holds only Tryouts and Staff onward, "Communication" only Email families.
 * While chat is paused the bar's Practices tab takes Chat's place and Practice plans STAYS here (the bar's keys keep it off
 * More's lit state). It was a hand-kept copy in the bottom nav, pinned equal by a test; one list cannot tell two stories.
 */
export const PHONE_PRIMARY_HREFS: ReadonlySet<string> = new Set(['', '/schedule', '/chat', '/roster']);
export type CoachMoreItem = { key: string; icon: typeof Users; label: string };
export const COACH_MORE_SECTIONS: { header: string; items: CoachMoreItem[] }[] = TEAM_NAV_GROUPS.flatMap(g => {
  const items = g.items.filter(i => !PHONE_PRIMARY_HREFS.has(i.href)).map(i => ({ key: i.href, icon: i.icon, label: i.label }));
  return g.label && items.length ? [{ header: g.label, items }] : [];
});

/** Every item the nav can draw, the landing slot's two first. */
export const COACH_NAV_ITEMS: CoachNavItem[] = [SEASON_END_ITEM, ...TEAM_NAV_GROUPS.flatMap(g => g.items)];

/** What the strip says over the page (navigation Phase 4): the page's name, or — one level down — the way back. */
export type CoachDeskTitle =
  | { kind: 'name'; name: string }
  | { kind: 'back'; href: string; label: string }
  | null;

type Params = { get(name: string): string | null };

/**
 * ⚖ ONE LEVEL DOWN, THE STRIP CARRIES THE WAY BACK (C4, owner 2026-11-11): the arrow and where it goes, in today's words,
 * from ONE table. ⚖ AMENDED THE SAME DAY: the record's name and chips ALSO live in the strip now (the club's record pages
 * do) — but they are not in this table: a drill-in loads its record after the page opens, so the address cannot know them.
 * The page's header portals them into the strip once it has them (`recordSlot`, CoachDeskTitle); the address supplies only
 * where back goes. A drill-in that was opened FROM somewhere (`?return=`, the lineup builder's and the player page's doors)
 * goes back there, named as the page names it today (`returnLabel`). Null when the address is not one level down.
 */
export function coachDrillBack(pathname: string, params: Params, teamBase: string): { href: string; label: string } | null {
  if (!pathname.startsWith(`${teamBase}/`)) return null;
  const seg = pathname.slice(teamBase.length + 1).split('/').filter(Boolean);
  const [a, b, c, d] = seg;
  const returnTo = safeReturnPath(params.get('return'), teamBase);
  const returned = (fallback: { href: string; label: string }) => {
    const label = returnLabel(returnTo, teamBase);
    return returnTo && label ? { href: returnTo, label } : fallback;
  };
  if (a === 'history' && b === 'opponents' && c && seg.length === 3) return { href: insightsSectionHref(teamBase, 'scouting'), label: 'All opponents' };
  if (a === 'history' && b === 'development' && c === 'practices' && d && seg.length === 4) {
    if (params.get('from') === 'season-end') {
      const year = params.get('year');
      return { href: `${teamBase}/season-end${year ? `?year=${encodeURIComponent(year)}` : ''}`, label: SEASON_END_LABEL };
    }
    return { href: insightsSectionHref(teamBase, 'development'), label: 'Practice review' };
  }
  if (a === 'roster' && b && c === 'development' && d === 'handout' && seg.length === 4) {
    // The one way back that names a person today (the player): the strip says "Player" (C4).
    return returnTo ? { href: returnTo, label: returnLabel(returnTo, teamBase) ?? 'Player' }
      : { href: playerDevelopmentHref(teamBase, b, { view: 'goals' }), label: 'Player' };
  }
  if (a === 'roster' && b && seg.length === 2) return returned({ href: `${teamBase}/roster`, label: 'Roster' });
  if (a === 'lineups' && b === 'templates' && c && seg.length === 3) return { href: lineupsHref(teamBase, 'templates'), label: 'Templates' };
  if (a === 'lineups' && b && b !== 'templates' && seg.length === 2) return returned({ href: `${teamBase}/lineups`, label: 'All lineups' });
  if (a === 'practice' && b === 'templates' && c && seg.length === 3) return { href: practicePlansHref(teamBase, 'templates'), label: 'Templates' };
  if (a === 'practice' && b === 'circuits' && c && seg.length === 3) return { href: practicePlansHref(teamBase, 'circuits'), label: 'Circuits' };
  if (a === 'practice' && b && b !== 'templates' && b !== 'circuits' && seg.length === 2) return { href: `${teamBase}/practice`, label: 'Practice plans' };
  if (a === 'development' && b === 'sessions' && c && seg.length === 3) return { href: skillsAndGoalsHref(teamBase, 'sessions'), label: 'Skills & goals' };
  if (a === 'tournaments' && b && seg.length === 2) return { href: `${teamBase}/tournaments`, label: 'Tournaments' };
  if (a === 'tryouts' && b === 'history' && seg.length === 2) return { href: `${teamBase}/tryouts`, label: 'Tryouts' };
  // ⚖ The game page (the bench console) is one level down from the Schedule (navigation Phase 5, F7, owner 2026-11-12): back
  // to this game on the schedule, as the console's own arrow went (it was removed with this entry: one way back per screen).
  if (a === 'game' && b && seg.length === 2) return { href: `${teamBase}/schedule?event=${encodeURIComponent(b)}`, label: 'Schedule' };
  return null;
}

/**
 * ⚖ THE STRIP NAMES THE PAGE (navigation Phase 4, E6, C8; the tournament's `deskTitleAt`): one level down, the way back
 * (`coachDrillBack`); otherwise the sidebar's lit row, in the sidebar's words ("Staff", "Settings" — the lit row and the
 * strip say one thing); null where no row is lit (the page keeps its own title). `rows` are the rows the sidebar draws for
 * this coach and this season. ⚖ The closed-season page is the one exception (C8): the strip names the SEASON
 * (`seasonName`, `mastheadSeasonLabel` from the coach's team list, so the first paint has it — never "Season's End" then
 * a year).
 */
export function coachDeskTitleAt(
  pathname: string, params: Params, teamBase: string, rows: readonly CoachNavItem[], seasonName: string | null,
): CoachDeskTitle {
  const back = coachDrillBack(pathname, params, teamBase);
  if (back) return { kind: 'back', ...back };
  const lit = rows.find(r => isCoachNavItemLit(pathname, teamBase, r.href));
  if (!lit) return null;
  return { kind: 'name', name: lit.label === SEASON_END_LABEL ? seasonName ?? lit.label : lit.label };
}

/** Whether an item is the page the coach is on: Overview is the team's address itself, every other row its section at
 *  any depth (`roster/{player}` lights Roster). ONE rule — the sidebar's lit row and the strip's name both read it. */
export function isCoachNavItemLit(pathname: string, teamBase: string, href: string): boolean {
  const full = `${teamBase}${href}`;
  if (href === '') return pathname === full || pathname === `${full}/`;
  return pathname === full || pathname.startsWith(`${full}/`);
}

/**
 * ⚖ THE BAND IS RESERVED BY THE ADDRESS (navigation Phase 4b, R1, owner 2026-11-11). On a computer a coach page that has a
 * tab bar keeps it pinned in a band directly under the strip (the club's own pattern, standard §3 item 4). The five rooms
 * that have tab bars — Money, Insights, Skills & goals, Lineups, Practice plans — answer on the ROOM's address alone (their
 * tabs are `?section=`, never another path), so the shell can hold the band's 45px open before the page has loaded and its
 * tabs arrive into room already made: a tabbed route never shifts when its tabs show up (the club's Phase 0 lesson, "no flash").
 * ⚠ Every other address is false: the drill-ins (`practice/{plan}`, `lineups/{game}` …) have no tabs, and the player page
 * keeps its tabs in the page (they dock under the strip once scrolled past — HubTabBar's `sticky`, not the band).
 */
const BAND_ROOMS = new Set(['accounting', 'history', 'development', 'lineups', 'practice']);
export function coachBandAt(pathname: string, teamBase: string): boolean {
  if (!pathname.startsWith(`${teamBase}/`)) return false;
  const seg = pathname.slice(teamBase.length + 1).split('/').filter(Boolean);
  return seg.length === 1 && BAND_ROOMS.has(seg[0]);
}
