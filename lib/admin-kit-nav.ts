/**
 * lib/admin-kit-nav.ts — THE CLUB'S NAVIGATION, ONCE, for the admin's kit frame (Admin Design
 * Continuity slice 1). The desktop rail (`AdminKitRail`), the phone bar and its More menu
 * (`AdminKitBottomNav`) and the phone's "In <program>" row (`AdminKitProgramRow`) all read the
 * programs, their pages and the Organization links from here, so the three cannot tell different
 * stories — the coaches portal learned that with its two navs (`coach-nav-groups.test.ts`), and
 * `tests/unit/admin-kit-nav.test.ts` pins the same thing here.
 *
 * ⚠ WHAT IS DRAWN, AND WHAT IS NOT YET. Built to the ratified Club Stage 1 specimens 3–4 (club hub
 * v8): one rail that is always populated, programs as groups, the program you are in open, Overview
 * pinned at the top. Club Stage 1's screens session added the three things the foundation held for
 * it: the PLAN-AWARE ORDER (`clubProgramOrder`, fed through `kitPrograms`' `order`, with the quiet
 * "Also on your plan" group), the AUDIT LOG row (its page works again, A04), and the per-program
 * waiting counts (the morning brief's, `useClubBrief`). ONE drawn row is still held: NOTIFICATIONS —
 * the org path redirects to account settings, whose club card lacks the club's programs (specimen 12
 * is not built yet), and a door to a page that does not do its job is the "404 wearing a politer
 * face" the portal forbids.
 *
 * ⚠ EVERY GATE IS THE OLD FRAME'S GATE. Each row carries exactly the condition the old console rail,
 * phone bar and org hub applied (the rail and bar were deleted in Admin Design Continuity Part B,
 * 2026-09-29; this file is now the only statement of those gates) — a restyle must not widen or
 * narrow who sees a door.
 * The ROWS are the drawing's, which is a different thing: ruling B12 gives Budget, Budget vs. Actual,
 * Payment requests, Assistant coaches and Shared library a rail row where today they are only tiles
 * on their program's first screen. Each of those pages checks the same capability as its program,
 * and the tiles show to everyone who can open it — so the rows reach the same people, sooner
 * (/review, slice 1). A page that asks MORE than its program before it gets a row gets that
 * condition on its row too.
 */
import {
  Users, DollarSign, Contact, Globe, CalendarDays, CalendarClock, Trophy, Building2, IdCard, CreditCard, Settings,
  MapPin, FileText, ScrollText, ChartGantt,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@/lib/roles';
import type { OrgPlan } from '@/lib/types';
import type { TournamentPhase } from './tournament-phase';
import { canOpenClubSchedules } from './club-schedule-gate';
import { getBillingHref } from './billing-urls';
import { hasBillingAccess } from './roles';
import type { OrgRole } from './types';
import { PLAN_BILLING_TITLE } from './plan-billing-title';

export type AdminProgramKey =
  | 'rep-teams'
  | 'accounting'
  | 'families'
  | 'public-site'
  | 'house-league'
  | 'tournaments';

/**
 * One door. `exact` = lit only on its own path (a program's index), else on any sub-path; `also` =
 * the drill-ins that live under a different path but belong to this door (a team page is inside
 * Teams, a ledger inside Ledgers), so the rail never goes dark on a page it can reach.
 */
export type KitLink = {
  key: string; label: string; href: string; exact?: boolean; also?: readonly string[];
  /** Drawn on the phone More menu's rows; the rail's indented page rows carry none (as drawn). */
  icon?: LucideIcon;
};

export type KitProgram = {
  key: AdminProgramKey;
  label: string;
  icon: LucideIcon;
  /** The program's first screen — where its rail row, its phone tab and its More row go. */
  href: string;
  /** Its pages, in the order the rail lists them. The first IS `href`. */
  pages: KitLink[];
};

/**
 * Every program key, in the drawn club's order — the order a caller gets when it passes none (the
 * frame always passes `clubProgramOrder`'s, below), and the list `activeKitSection` recognises.
 * Nothing here should grow a second ordering rule: "what the club runs" is `clubProgramOrder`.
 */
export const INTERIM_PROGRAM_ORDER: readonly AdminProgramKey[] = [
  'rep-teams',
  'accounting',
  'families',
  'public-site',
  'house-league',
  'tournaments',
];

/** The role capability + plan module each program needs (the same pair the hub tile checks). */
export const PROGRAM_CAPABILITY: Record<AdminProgramKey, Capability> = {
  'rep-teams': 'module_rep_teams',
  accounting: 'module_accounting',
  families: 'module_families',
  'public-site': 'module_public_site',
  'house-league': 'module_house_league',
  tournaments: 'module_tournaments',
};

function programDef(key: AdminProgramKey, base: string): Omit<KitProgram, 'key'> {
  switch (key) {
    case 'rep-teams': {
      const r = `${base}/rep-teams`;
      return {
        // Sentence case, like every other nav label (Ask A4, 2026-10-17; `check:spelling` holds it).
        label: 'Rep teams', icon: Users, href: r,
        pages: [
          // Exact: inside a team, the rail's TEAM block carries the active row (Club Tier Stage 2,
          // specimen 2 — "Team page" lit, "Teams" not), and its back arrow leads up to this one.
          { key: 'rt-teams', label: 'Teams', href: r, exact: true },
          // ⚖ Cost allocation and Payment requests MOVED to Accounting (Club Tier Stage 3a, Ask 2): the
          // treasurer's program holds the treasurer's work, and their old addresses forward there.
          { key: 'rt-assistant-coaches', label: 'Assistant coaches', href: `${r}/assistant-coaches` },
          { key: 'rt-docs', label: 'Document templates', href: `${r}/documents` },
          { key: 'rt-shared-library', label: 'Shared library', href: `${r}/shared-library` },
          { key: 'rt-past', label: 'Past seasons', href: `${r}/past` },
          // Club Tier Stage 2, specimen 9: moved here from Organization ("Coaches Portal links"), beside
          // the teams it adds to. The name is /marketing's to rule on (drawn; `BRING_IN_PAGE_TITLE`).
          { key: 'rt-bring-in', label: 'Bring in a coach’s team', href: `${r}/bring-in`, also: [`${base}/org/coaches-portal-links`] },
        ],
      };
    }
    case 'accounting': {
      // ⚖ ONE ROW THAT NEVER OPENS (Club Tier Stage 3a, Ask 2 option B, owner 2026-09-30). Accounting is
      // one page with tabs — Overview · Budget · Teams · Ledger · Allocations · Payment requests · Budget vs.
      // Actual — so the rail lists no pages under it (and the phone's "In Accounting" row has nothing to
      // name): the tab row on the page is how a treasurer moves between them. The tabs' own list is
      // `accountingTabs` below; the rail row carries the waiting count while you are inside it too.
      const a = `${base}/accounting`;
      return { label: 'Accounting', icon: DollarSign, href: a, pages: [] };
    }
    case 'families': {
      // ⚖ ONE ROW THAT NEVER OPENS (Club Tier Stage 5b, Ask 14 — the 2026-09-30 rule that made Accounting one page): the
      // family list and the duplicate queue are two views of the club's people, so Families is one page with three tabs
      // (`familiesTabs` below). The row lists no pages and carries the Duplicates tab's waiting count.
      return { label: 'Families', icon: Contact, href: `${base}/families`, pages: [] };
    }
    case 'public-site': {
      const p = `${base}/public-site`;
      return {
        label: 'Public site', icon: Globe, href: p,
        pages: [{ key: 'public-site', label: 'Site editor', href: p, exact: true }],
      };
    }
    case 'house-league': {
      const h = `${base}/house-league`;
      // ⚠ NO "Past seasons" ROW. Today's rail links `/house-league/past`, and there is no such page —
      // it 404s (found by `admin-kit-nav.test.ts`'s dead-door check, 2026-09-25). A restyle does not
      // carry a dead door forward; the legacy link is written down as a defect, not fixed here.
      return {
        label: 'House league', icon: CalendarDays, href: h,
        pages: [{ key: 'hl-seasons', label: 'Seasons', href: h, exact: true, also: [`${h}/seasons`] }],
      };
    }
    case 'tournaments': {
      const t = `${base}/tournaments`;
      return { label: 'Tournaments', icon: Trophy, href: t, pages: [] };
    }
  }
}

/**
 * What the club RUNS — the two facts the plan alone cannot answer (Club Tier Stage 1). A plan can
 * carry house league and tournaments without the club running either; the hub, the rail and the
 * phone bar all put what it runs first, so they read the same two facts (`useClubBrief`).
 */
export type ClubShape = { runsHouseLeague: boolean; hostsTournaments: boolean };

/**
 * ⚖ THE PLAN-AWARE ORDER (Club Tier Stage 1, ratified specimens 1, 3 and 4): the programs the club
 * runs lead, most central first, and tournaments come last — a rep club is not a tournament club.
 * House league and tournaments stay OUT of the lead until the club has one; until then they are the
 * quiet "Also on your plan" group (one line each on the hub, one quiet row each in the rail — never
 * a tile, never a banner; this replaces the "first tournament setup" banner, G01).
 *
 * The order comes from the plan and the club's own records, never from the member's permissions
 * (A01, ruling D8): `kitPrograms` filters each list by what the person can open afterwards.
 */
const LEAD_ORDER: readonly AdminProgramKey[] = [
  'rep-teams', 'house-league', 'accounting', 'families', 'public-site', 'tournaments',
];

export function clubProgramOrder(shape: ClubShape): { lead: AdminProgramKey[]; also: AdminProgramKey[] } {
  const isRun = (key: AdminProgramKey) =>
    key === 'house-league' ? shape.runsHouseLeague : key === 'tournaments' ? shape.hostsTournaments : true;
  return {
    lead: LEAD_ORDER.filter(isRun),
    also: LEAD_ORDER.filter(key => !isRun(key)),
  };
}

/**
 * The programs this person can open, in order. `canUse` is the caller's role-capability + plan-
 * module check (`hasCapability && hasModuleEntitlement`) — the hub tile's predicate, unchanged.
 */
export function kitPrograms({
  base,
  canUse,
  order = INTERIM_PROGRAM_ORDER,
}: {
  base: string;
  canUse: (capability: Capability) => boolean;
  /** Club Stage 1's plan-aware order, when it exists. */
  order?: readonly AdminProgramKey[];
}): KitProgram[] {
  return order
    .filter(key => canUse(PROGRAM_CAPABILITY[key]))
    .map(key => ({ key, ...programDef(key, base) }));
}

/**
 * ⚖ THE CLUB CALENDAR'S DOOR (Club Tier Stage 6b, Ask 7 — design log 2026-10-09 (1)): "Calendar", directly under Overview
 * in the rail and the FIRST row of the phone's More sheet. It spans every program, so it belongs to no program's group.
 * Its glyph is a calendar with a clock, because House league's rail glyph is already the plain calendar. It shows to
 * whoever can open at least one program whose schedule it reads (rep teams, house league, tournaments — `canUse` is the
 * same role + plan pair the page's route asks, `calendarPrograms`), and never on a Tournament plan (no club side) or a
 * cancelled one. Each reader sees only the programs they can open; the page says so by what it shows.
 */
export function kitCalendarLink({ base, canUse, isCanceled, tournamentTier }: {
  base: string;
  canUse: (capability: Capability) => boolean;
  isCanceled: boolean;
  tournamentTier: boolean;
}): KitLink | null {
  if (isCanceled || tournamentTier) return null;
  const reads = canUse('module_rep_teams') || canUse('module_house_league') || canUse('module_tournaments');
  return reads ? { key: 'calendar', label: 'Calendar', href: `${base}/calendar`, exact: true, icon: CalendarClock } : null;
}

/**
 * ⚖ THE CLUB SCHEDULER'S DOOR (Club Tier Stage 11a — plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md §5.3; hub Stages 10 + 11,
 * specimen 4): "Schedules", DIRECTLY UNDER Calendar in the rail and the More sheet — Calendar reads what is booked,
 * Schedules is where the club hands its time out (two jobs, two rows: the 2026-09-30 rule). Its glyph is a timeline of
 * booked slots (the nav standard's N5, 2026-10-17: the clipboard it first wore is Tryouts' in the coaches portal).
 * It shows only where the route answers (`resolveScheduler`, through the one rule `canOpenClubSchedules`):
 * the club's OWNER or an ADMIN, a plan carrying `club_scheduler` (League Plus and both Club bands), never cancelled — and ONLY where there is something to schedule:
 * the rep teams program this person can open (`canUse('module_rep_teams')`), or house league (Stage 11b: the club gives
 * house league its time here, so a League Plus club with no rep teams has Schedules too). With neither the row is ABSENT
 * — an entry point that can't serve is the 404's politer face.
 */
export function kitSchedulesLink({ base, canUse, isCanceled, role, planId }: {
  base: string;
  canUse: (capability: Capability) => boolean;
  isCanceled: boolean;
  role: string | null | undefined;
  planId: OrgPlan | null | undefined;
}): KitLink | null {
  if (isCanceled || !canOpenClubSchedules({ planId, role })) return null;
  return canUse('module_rep_teams') || canUse('module_house_league') ? { key: 'schedules', label: 'Schedules', href: `${base}/schedules`, icon: ChartGantt } : null;
}

/** The Organization group's icon (the rail row and the More section share it). */
export const ORGANIZATION_ICON: LucideIcon = Building2;

/** Plan & billing lives beside Help on every admin plan, including a suspended account's comeback path. The demo
 *  sandboxes hide every billing entry point (lib/sandbox-curation.ts): a comped demo org's billing answers nothing. */
export function kitBillingLink({ orgSlug, planId, role, capabilities, isSandbox = false }: {
  orgSlug: string; planId: OrgPlan | null | undefined; role: OrgRole | null | undefined;
  capabilities: Record<string, boolean> | null; isSandbox?: boolean;
}): KitLink | null {
  return !isSandbox && hasBillingAccess(role, capabilities)
    ? { key: 'org/billing', label: PLAN_BILLING_TITLE, href: getBillingHref(orgSlug, planId), icon: CreditCard }
    : null;
}

/**
 * The Organization group — the old console rail's org mode + the org hub's PDF settings tile, each
 * with the gate it had there. ⚠ "Plan & billing", not "Subscription": the rail said one thing and the
 * page's own tab another; the ratified drawing settles it on the page's name (one spelling).
 */
export function kitOrgLinks({
  base,
  role,
  isCanceled,
  canSeeMembers,
  hasVenueLibrary,
}: {
  base: string;
  role: string | null | undefined;
  isCanceled: boolean;
  canSeeMembers: boolean;
  hasVenueLibrary: boolean;
}): KitLink[] {
  const o = `${base}/org`;
  const ownerOrAdmin = role === 'owner' || role === 'admin';
  const links: (KitLink | false)[] = [
    // A member card (N5, 2026-10-17): `Users2` is the Coaches Portal door's, and both sit on the phone's More sheet.
    !isCanceled && canSeeMembers && { key: 'org/members', label: 'Members', href: `${o}/members`, icon: IdCard },
    // H08 (Club Tier Stage 1): the audit log gets its rail row now that its page works (A04, fixed
    // Stage 0; redrawn Stage 1 specimen 11). Owner-only, as the page and its route are.
    !isCanceled && role === 'owner' && { key: 'org/audit', label: 'Audit log', href: `${o}/members/audit`, icon: ScrollText },
    !isCanceled && role === 'owner' && { key: 'org/settings', label: 'Settings', href: `${o}/settings`, exact: true, icon: Settings },
    !isCanceled && hasVenueLibrary && { key: 'org/venues', label: 'Venue library', href: `${o}/venues`, icon: MapPin },
    !isCanceled && ownerOrAdmin && { key: 'org/pdf', label: 'PDF settings', href: `${o}/settings/pdf`, icon: FileText },
  ];
  return links.filter((l): l is KitLink => Boolean(l));
}

/* ⚰ The owner's LOCKED ROWS on the rail and the phone's More sheet (Club Stage 1 specimens 2–3,
   J10-016) — retired 2026-10-01 (owner): the nav lists only doors the person can open, as it already
   did for every program and page, and as the coaches portal does. The question a locked row answered
   ("is this missing, or just not mine?") is asked once, so it is answered once — on the club hub's
   Organization section, which keeps Plan & billing and Settings as locked rows for a non-owner. Do
   not bring them back to the nav: three of an admin's five Organization rows were permanently dead. */

/** Is this door the page on screen? */
export function isKitLinkActive(pathname: string, link: KitLink): boolean {
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (link.also?.some(under)) return true;
  return link.exact ? pathname === link.href : under(link.href);
}

/** Which program (or the Organization group) the page on screen belongs to — the group that opens. */
export function activeKitSection(pathname: string, base: string): AdminProgramKey | 'org' | null {
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : '';
  const first = rest.split('/')[0];
  if (first === 'org') return 'org';
  const keys: readonly string[] = INTERIM_PROGRAM_ORDER;
  return keys.includes(first) ? (first as AdminProgramKey) : null;
}

/* ⚰ KIT_TOURNAMENT_LABELS / kitTournamentLabel (the map from the old console rail's Title Case to the kit's
   sentence case) retired with admin type sweep Stage 5 (2026-10-20): `admin-nav-config.ts` holds the
   sentence-case words itself. */

/**
 * ⚖ THE TOURNAMENT PHONE BAR FOLLOWS THE EVENT'S PHASE (owner, 2026-10-16 — hub 5zEgCokKRD5KfBsHRmwqFx, A1–A4 as
 * recommended, game day and draft ruled). The bar read the STATUS, so a launched event months before its first game
 * led with Results and Check-in under a header that said "Open". It now reads the phase the header shows:
 *
 *   Draft                          Dashboard · Teams · Schedule · Site
 *   Open                           Dashboard · Teams · Schedule · Chat
 *   Game day, Completed, Archived  Dashboard · Results · Schedule · Chat (Check-in in More)
 *
 * DASHBOARD IS PINNED TO THE LEFT CORNER IN EVERY PHASE (owner: the draft dashboard holds the checklist, and every
 * setup step is a link from it, so Setup went to More). Schedule keeps the third slot. The keys are the tournament
 * nav's; the bar relabels Public site "Site" and Communications "Messages" where the plan has no Chat.
 */
export function tournamentBarKeys(phase: TournamentPhase): readonly string[] {
  if (phase === 'draft') return ['dashboard', 'registrations', 'schedule', 'branding'];
  if (phase === 'open') return ['dashboard', 'registrations', 'schedule', 'chat'];
  return ['dashboard', 'results', 'schedule', 'chat'];
}

/**
 * ⚖ ACCOUNTING'S TABS (Club Tier Stage 3a, Ask 2 option B) — the one list the Accounting page's tab row,
 * the hub's program line and the help read, so none of them names a tab the page does not have.
 * Teams, Allocations and Payment requests are the club ↔ team loop: they exist only where the club runs rep
 * teams (`canOpenRepMoney`'s org half). Each tab is a real address (`HubTabBar` tabs are links).
 * ⚖ BUDGET IS SECOND, TEAMS THIRD (owner, 2026-10-18 — tab consistency across portals): the coach's Money row and
 * this one read ONE shape, Overview · Budget · <the portal's own> · Ledger · <the club-and-team loop> · Budget vs.
 * Actual, so a person who works both meets the same row. The plan opens the year and its report closes it. Teams
 * keeps its place at the front for the reason it was moved there (the tab a treasurer opens most, Club Accounting ·
 * Teams Ask 1, 2026-10-16) — one step further along, not to the back. The coach row's order is the
 * one that did not move.
 */
export type AccountingTabId = 'overview' | 'teams' | 'ledger' | 'allocations' | 'payment-requests' | 'budget' | 'budget-vs-actual' | 'payouts';

/** `hasPayouts`: the club has connected payouts at some time (Club Tier 12d-2, words §3.1 and §7 question 6: the Payouts
 *  tab is hidden for a club that never connected). Optional: a reader that doesn't know never names the tab. */
export type AccountingTabOpts = { runsRepTeams: boolean; hasPayouts?: boolean };

/** `views`: the tab also lights one level under its address — its records are views OF the tab (a team's account inside
 *  Teams), each naming itself; every other tab lights on its own address only. */
export type AccountingTab = { id: AccountingTabId; label: string; href: string; views?: true };

export function accountingTabs(base: string, opts: AccountingTabOpts): AccountingTab[] {
  const a = `${base}/accounting`;
  return [
    { id: 'overview' as const, label: 'Overview', href: a },
    { id: 'budget' as const, label: 'Budget', href: `${a}/budget` },
    ...(opts.runsRepTeams ? [{ id: 'teams' as const, label: 'Teams', href: `${a}/teams`, views: true as const }] : []),
    { id: 'ledger' as const, label: 'Ledger', href: `${a}/ledger` },
    ...(opts.runsRepTeams ? [
      { id: 'allocations' as const, label: 'Allocations', href: `${a}/allocations` },
      { id: 'payment-requests' as const, label: 'Payment requests', href: `${a}/payment-requests` },
    ] : []),
    { id: 'budget-vs-actual' as const, label: 'Budget vs. Actual', href: `${a}/budget-vs-actual` },
    // ⚖ LAST in the row, for everyone who reads Accounting (12d-2, ask 5): the treasurer matches a Stripe payout to the
    // bank statement here, needing neither Stripe nor the owner.
    ...(opts.hasPayouts ? [{ id: 'payouts' as const, label: 'Payouts', href: `${a}/payouts` }] : []),
  ];
}

/**
 * Which Accounting tab a path is, or null for an address that is no tab. Each tab lights on its OWN address only
 * (Budget never lights on Budget vs. Actual); a tab with `views` lights one segment under it too — a team's account is a
 * VIEW of the Teams tab, as a book is a view of the Ledger (Club Accounting · Teams, Ask 2 — the 2026-09-30 "page one
 * level down" rule retired in Accounting with its last page). One segment only: deeper is no page. Read against the
 * club's OWN tab list: where the club runs no rep teams, the loop's addresses are no tab (a tab row with nothing lit is
 * the frame lying about where you are).
 */
export function accountingTabFor(pathname: string, base: string, opts: AccountingTabOpts): AccountingTabId | null {
  return litTab(accountingTabs(base, opts), pathname);
}

/** A program page's tab, as a tab row lights it: a tab on its OWN address first, then a tab with `views` one segment
 *  under its address (deeper is no page). The one rule for every program that is one page with tabs. */
type ProgramTab<Id extends string> = { id: Id; href: string; views?: true };
function litTab<Id extends string>(tabs: readonly ProgramTab<Id>[], pathname: string): Id | null {
  const oneUnder = (href: string) => pathname.startsWith(`${href}/`) && /^[^/]+$/.test(pathname.slice(href.length + 1));
  return (tabs.find(t => t.href === pathname) ?? tabs.find(t => t.views && oneUnder(t.href)))?.id ?? null;
}

/**
 * ⚖ FAMILIES' TABS (Club Tier Stage 5b, Ask 14): Families (the book and its questions) · Duplicates (the queue, its
 * waiting count the amber pill) · Emails (Stage 7c, Ask 7 A: every email the club sent from Families). A family is a
 * record OVER the Families tab, at `/families/{personId}` — so that tab lights one segment under its address too
 * (`views`), and Duplicates' and Emails' own addresses win first.
 */
export type FamiliesTabId = 'families' | 'duplicates' | 'emails';
export type FamiliesTab = { id: FamiliesTabId; label: string; href: string; views?: true };

export function familiesTabs(base: string): FamiliesTab[] {
  const f = `${base}/families`;
  return [
    { id: 'families', label: 'Families', href: f, views: true },
    { id: 'duplicates', label: 'Duplicates', href: `${f}/duplicates` },
    { id: 'emails', label: 'Emails', href: `${f}/emails` },
  ];
}

export function familiesTabFor(pathname: string, base: string): FamiliesTabId | null {
  return litTab(familiesTabs(base), pathname);
}
