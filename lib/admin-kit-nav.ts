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
 * pinned at the top. Three things in those drawings are NOT built here, deliberately:
 *   · the PLAN-AWARE ORDER ("what the club runs", and the quiet "Also on your plan" group) — Club
 *     Stage 1 computes it and feeds it through `kitPrograms`' `order`; until then the order is the interim
 *     constant below;
 *   · the Organization group's AUDIT LOG and NOTIFICATIONS rows — both open screens Stage 1 builds
 *     (the audit log fails today, A04; the org notifications path redirects to account settings),
 *     and a door to a page that does not work is the "404 wearing a politer face" the portal forbids;
 *   · the per-program waiting counts on the rail and the bar (the morning brief's figures, Stage 1).
 *
 * ⚠ EVERY GATE IS TODAY'S GATE. Each row carries exactly the condition `AdminSidebar` /
 * `AdminBottomNav` / the org hub apply today — a restyle must not widen or narrow who sees a door.
 * The ROWS are the drawing's, which is a different thing: ruling B12 gives Budget, Budget vs. Actual,
 * Payment requests, Assistant coaches and Shared library a rail row where today they are only tiles
 * on their program's first screen. Each of those pages checks the same capability as its program,
 * and the tiles show to everyone who can open it — so the rows reach the same people, sooner
 * (/review, slice 1). A page that asks MORE than its program before it gets a row gets that
 * condition on its row too.
 */
import {
  Users, DollarSign, Contact, Globe, CalendarDays, Trophy, Building2, Users2, CreditCard, Settings,
  MapPin, FileText, Link2,
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
 * ⚠ THE INTERIM ORDER — the drawn club's order, with house league and tournaments last because the
 * drawn club runs neither. Club Stage 1 replaces this with "what the club runs" (plan-aware, fed to
 * the rail and the bar together); nothing here should grow a second ordering rule in the meantime.
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
          { key: 'rt-teams', label: 'Teams', href: r, exact: true, also: [`${r}/teams`] },
          { key: 'rt-allocations', label: 'Cost allocation', href: `${r}/allocations` },
          { key: 'rt-payment-requests', label: 'Payment requests', href: `${r}/payment-requests` },
          { key: 'rt-assistant-coaches', label: 'Assistant coaches', href: `${r}/assistant-coaches` },
          { key: 'rt-docs', label: 'Document templates', href: `${r}/documents` },
          { key: 'rt-shared-library', label: 'Shared library', href: `${r}/shared-library` },
          { key: 'rt-past', label: 'Past seasons', href: `${r}/past` },
        ],
      };
    }
    case 'accounting': {
      const a = `${base}/accounting`;
      return {
        label: 'Accounting', icon: DollarSign, href: a,
        pages: [
          { key: 'accounting', label: 'Ledgers', href: a, exact: true, also: [`${a}/ledger`] },
          { key: 'acct-budget', label: 'Budget', href: `${a}/budget` },
          { key: 'acct-bva', label: 'Budget vs. Actual', href: `${a}/budget-vs-actual` },
        ],
      };
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
 * The Organization group — `AdminSidebar`'s org mode + the org hub's PDF settings tile, each with
 * the gate it has today. ⚠ "Plan & billing", not "Subscription": the rail said one thing and the
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
    role === 'owner' && { key: 'org/billing', label: 'Plan & billing', href: `${o}/billing`, icon: CreditCard },
    !isCanceled && role === 'owner' && { key: 'org/settings', label: 'Settings', href: `${o}/settings`, exact: true, icon: Settings },
    !isCanceled && hasVenueLibrary && { key: 'org/venues', label: 'Venue library', href: `${o}/venues`, icon: MapPin },
    !isCanceled && ownerOrAdmin && { key: 'org/pdf', label: 'PDF settings', href: `${o}/settings/pdf`, icon: FileText },
    !isCanceled && ownerOrAdmin && {
      key: 'org/coaches-portal-links', label: 'Coaches Portal links', href: `${o}/coaches-portal-links`, icon: Link2,
    },
  ];
  return links.filter((l): l is KitLink => Boolean(l));
}

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
 * only the capitals move. `admin-nav-config.ts` keeps today's labels for the legacy rail, which
 * renders them unchanged while the switch is off. Anything not listed is already in sentence case.
 */
const KIT_TOURNAMENT_LABELS: Readonly<Record<string, string>> = {
  'Staff Kit': 'Staff kit',
  'Event Settings': 'Event settings',
  'Venues & Facilities': 'Venues & facilities',
  'Rules & Resources': 'Rules & resources',
  'Public Site': 'Public site',
  'Data Tools': 'Data tools',
  'Settings & Access': 'Settings & access',
  'Past Tournaments': 'Past tournaments',
};

export function kitTournamentLabel(label: string): string {
  return KIT_TOURNAMENT_LABELS[label] ?? label;
}
