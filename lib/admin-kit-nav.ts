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
  Users, DollarSign, Contact, Globe, CalendarDays, Trophy, Building2, Users2, CreditCard, Settings,
  MapPin, FileText, ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@/lib/roles';

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
        label: 'Rep Teams', icon: Users, href: r,
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
      // one page with tabs — Overview · Ledger · Allocations · Payment requests · Budget · Budget vs.
      // Actual — so the rail lists no pages under it (and the phone's "In Accounting" row has nothing to
      // name): the tab row on the page is how a treasurer moves between them. The tabs' own list is
      // `accountingTabs` below; the rail row carries the waiting count while you are inside it too.
      const a = `${base}/accounting`;
      return { label: 'Accounting', icon: DollarSign, href: a, pages: [] };
    }
    case 'families': {
      const f = `${base}/families`;
      return {
        label: 'Families', icon: Contact, href: f,
        pages: [
          { key: 'families', label: 'Families', href: f, exact: true },
          { key: 'families-duplicates', label: 'Possible duplicates', href: `${f}/duplicates` },
        ],
      };
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

/** The Organization group's icon (the rail row and the More section share it). */
export const ORGANIZATION_ICON: LucideIcon = Building2;

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
    !isCanceled && canSeeMembers && { key: 'org/members', label: 'Members', href: `${o}/members`, icon: Users2 },
    // H08 (Club Tier Stage 1): the audit log gets its rail row now that its page works (A04, fixed
    // Stage 0; redrawn Stage 1 specimen 11). Owner-only, as the page and its route are.
    !isCanceled && role === 'owner' && { key: 'org/audit', label: 'Audit log', href: `${o}/members/audit`, icon: ScrollText },
    role === 'owner' && { key: 'org/billing', label: 'Plan & billing', href: `${o}/billing`, icon: CreditCard },
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

/**
 * The tournament rail's labels in the kit's case (ADC specimens 2 and 4 draw "Event settings",
 * "Venues & facilities", "Past tournaments" — the coaches portal's sentence case). The SAME words;
 * only the capitals move. `admin-nav-config.ts` still holds the old console rail's Title Case, which
 * that rail rendered; the rail went in Part B (2026-09-29), so the words can move into the config and
 * this map can go — owed to the tournaments' Part B pass. Anything not listed is already in sentence case.
 */
const KIT_TOURNAMENT_LABELS: Readonly<Record<string, string>> = {
  'Staff Kit': 'Staff kit',
  'Event Settings': 'Event settings',
  'Venues & Facilities': 'Venues & facilities',
  'Rules & Resources': 'Rules & resources',
  'Public Site': 'Public site',
  'Data Tools': 'Data tools',
  'Settings & Access': 'Settings & access',
};

export function kitTournamentLabel(label: string): string {
  return KIT_TOURNAMENT_LABELS[label] ?? label;
}

/**
 * ⚖ ACCOUNTING'S TABS (Club Tier Stage 3a, Ask 2 option B) — the one list the Accounting page's tab row,
 * the hub's program line and the help read, so none of them names a tab the page does not have.
 * Allocations and Payment requests are the club ↔ team loop: they exist only where the club runs rep
 * teams (`canOpenRepMoney`'s org half). Each tab is a real address (`HubTabBar` tabs are links).
 */
export type AccountingTabId = 'overview' | 'ledger' | 'allocations' | 'payment-requests' | 'budget' | 'budget-vs-actual';

export function accountingTabs(base: string, opts: { runsRepTeams: boolean }): { id: AccountingTabId; label: string; href: string }[] {
  const a = `${base}/accounting`;
  return [
    { id: 'overview' as const, label: 'Overview', href: a },
    { id: 'ledger' as const, label: 'Ledger', href: `${a}/ledger` },
    ...(opts.runsRepTeams ? [
      { id: 'allocations' as const, label: 'Allocations', href: `${a}/allocations` },
      { id: 'payment-requests' as const, label: 'Payment requests', href: `${a}/payment-requests` },
    ] : []),
    { id: 'budget' as const, label: 'Budget', href: `${a}/budget` },
    { id: 'budget-vs-actual' as const, label: 'Budget vs. Actual', href: `${a}/budget-vs-actual` },
  ];
}

/**
 * Which Accounting tab a path is, or null for a page one level down (an allocation, a team's account,
 * Payees, a budget line's allocation) — those carry a back arrow and no tab row. Read against the
 * club's OWN tab list: where the club runs no rep teams, the loop's two addresses are no tab (a tab
 * row with nothing lit is the frame lying about where you are).
 */
export function accountingTabFor(pathname: string, base: string, opts: { runsRepTeams: boolean }): AccountingTabId | null {
  return accountingTabs(base, opts).find(t => t.href === pathname)?.id ?? null;
}
