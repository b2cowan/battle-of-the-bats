/**
 * lib/admin-kit-nav.ts — THE CLUB'S NAVIGATION, ONCE, for the admin's kit frame (Admin Design
 * Continuity slice 1). The desktop rail (`AdminKitRail`), the phone bar and its More menu
 * (`AdminKitBottomNav`) and each place's tab row (Club Tier Stage 13i: `repTeamsTabs`, `teamTabs`, `seasonTabs`, `orgTabs`)
 * all read the programs, their pages and the Organization links from here, so they cannot tell different
 * stories — the coaches portal learned that with its two navs (`coach-nav-groups.test.ts`), and
 * `tests/unit/admin-kit-nav.test.ts` pins the same thing here.
 *
 * ⚠ WHAT IS DRAWN, AND WHAT IS NOT YET. Built to the ratified Club Stage 1 specimens 3–4 (club hub
 * v8): one rail that is always populated, Overview pinned at the top — and, since Club Tier Stage 13i
 * (2026-11-06), places only: a place's pages are its tab row, never rows under it (`clubPlaceGroups`).
 * Club Stage 1's screens session added the three things the foundation held for it: the PLAN-AWARE ORDER (`clubProgramOrder`, fed through `kitPrograms`' `order`, with the quiet
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
  MapPin, FileText, ScrollText, ChartGantt, FileCheck, Shield, Users2,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@/lib/roles';
import type { OrgPlan } from '@/lib/types';
import type { TournamentPhase } from './tournament-phase';
import { canOpenClubSchedules } from './club-schedule-gate';
import { getBillingHref } from './billing-urls';
import { hasBillingAccess } from './roles';
import { membersLabel } from './member-access';
import type { OrgRole } from './types';
import { PLAN_BILLING_TITLE } from './plan-billing-title';
import { seasonPageHref, seasonPagesFor, type SeasonPageKey } from './house-league-season';
import type { HouseLeagueAccess } from './house-league-access';
import { LEAGUE_TIME_WORDS } from './league-time';

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
  /** Its pages, in the order its tab row lists them (13i: never rows in the sidebar). The first IS `href`. */
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

/** Is this key a program's (rather than Organization's, or a page's)? */
export function isAdminProgramKey(key: string): key is AdminProgramKey {
  return (INTERIM_PROGRAM_ORDER as readonly string[]).includes(key);
}

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
          // Exact: a team is a place of its own (13i A3), with its own tab row — Teams is not lit inside it.
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
      // ⚖ ONE PAGE WITH TABS (Club Tier Stage 3a, Ask 2 option B, owner 2026-09-30 — the rule 13i gave every place).
      // Overview · Budget · Teams · Ledger · Bank · Allocations · Payment requests · Budget vs. Actual: the tab row on the
      // page is how a treasurer moves between them. The tabs' own list is `accountingTabs` below.
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
        // No `also` (Stage 13 fix-now 8): a season is a place of its own (13i A4), its tab row lights its page. There is
        // no page at /house-league/seasons itself.
        pages: [{ key: 'hl-seasons', label: 'Seasons', href: h, exact: true }],
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
 * ⚖ THE ONE EXCEPTION TO N10 (Club Tier Stage 13a, Ask 8 = A, owner 2026-11-06): for a person whose ONLY program is house
 * league — the league admin and the registrar by default, decided by what they can OPEN, never by the role's name — house
 * league counts as run for the nav's shape, so it leads the rail and takes the phone bar's third slot before the club has a
 * season. It is their whole job; "Also on your plan" or the More sheet hid it on a brand-new club (F-L1-2, F-R1-3). Everyone
 * who can open anything else (the owner, an admin, the treasurer) keeps the club's own shape, unchanged. The club's shape
 * itself (`useClubBrief().shape`) stays a fact about the ORG: the Members role guide reads it as one.
 */
export function personClubShape(shape: ClubShape, canUse: (capability: Capability) => boolean): ClubShape {
  const only = personOnlyProgram(canUse);
  if (only === 'house-league' && !shape.runsHouseLeague) return { ...shape, runsHouseLeague: true };
  // ⚖ E15 (navigation Phase 1, owner 2026-11-09): the tournament director is house league's twin — Tournaments is their
  // whole job, so it counts as hosted from day one and stays a row (and a phone-bar slot) rather than a foot door.
  if (only === 'tournaments' && !shape.hostsTournaments) return { ...shape, hostsTournaments: true };
  return shape;
}

/** The one program this person can open, or null when they can open none or several — decided by what they can OPEN,
 *  never by the role's name (Ask 8, E15). */
export function personOnlyProgram(canUse: (capability: Capability) => boolean): AdminProgramKey | null {
  const opens = LEAD_ORDER.filter(key => canUse(PROGRAM_CAPABILITY[key]));
  return opens.length === 1 ? opens[0] : null;
}

/**
 * ⚖ E4 (navigation Phase 1, owner 2026-11-09): Tournaments is a PORTAL door, not a place — a row that swaps the whole
 * sidebar sits in the sidebar's foot (and the phone's More → You), beside the Coaches Portal. So once the club hosts a
 * tournament it leaves the lead (the Programs group AND the phone bar's and tiles' fill, N10) and `door` is true. Two
 * keep it where it was: the tournament director (`tournamentsIsRow`, E15 — it leads as a row, as house league does for a
 * registrar), and a club with no current tournament (it is not in the lead: it stays the quiet "Also on your plan" row).
 */
export function clubTournamentsDoor(
  order: { lead: AdminProgramKey[]; also: AdminProgramKey[] },
  tournamentsIsRow: boolean,
): { lead: AdminProgramKey[]; also: AdminProgramKey[]; door: boolean } {
  if (tournamentsIsRow || !order.lead.includes('tournaments')) return { ...order, door: false };
  return { lead: order.lead.filter(key => key !== 'tournaments'), also: order.also, door: true };
}

/**
 * ⚖ THE OTHER PORTALS (N4, navigation Phase 1, E4): the doors the sidebar's foot and the phone's More → You list, in one
 * order — Club · Tournaments · Coaches Portal — less the portal you are in. Club: inside a club's tournament (it replaced the
 * "Club overview" row). Tournaments: in the club, once it hosts one (`clubTournamentsDoor`; never the director's, whose row
 * it is) and only for someone who can open it. A tournament-only organization has no club to go back to; a cancelled club
 * has no rail or bar at all. The Coaches Portal door is the person's own (`coachDoorFor`).
 */
export function kitPortalDoors({ base, onTournaments, tournamentOnly, isCanceled, tournamentsDoor, canUse, coachDoor }: {
  base: string;
  onTournaments: boolean;
  tournamentOnly: boolean;
  isCanceled: boolean;
  /** `clubTournamentsDoor(...).door`: the club hosts a tournament and this person is not its director. */
  tournamentsDoor: boolean;
  canUse: (capability: Capability) => boolean;
  coachDoor: { show: boolean; href: string };
}): KitLink[] {
  const club = !isCanceled && !tournamentOnly;
  const doors: (KitLink | null)[] = [
    club && onTournaments ? { key: 'club', label: 'Club', href: base, icon: Shield } : null,
    club && !onTournaments && tournamentsDoor && canUse('module_tournaments')
      ? { key: 'tournaments', label: 'Tournaments', href: `${base}/tournaments`, icon: Trophy } : null,
    coachDoor.show ? { key: 'coaches-portal', label: 'Coaches Portal', href: coachDoor.href, icon: Users2 } : null,
  ];
  return doors.filter((d): d is KitLink => d !== null);
}

/**
 * The amber waiting count's text, one rule for the club admin kit's pills (Stage 13a, B2): the real number up to 99, then
 * "99+". It used to stop at "9+", which hid the number a registrar works from. The rail, the phone bar's program tabs, the
 * Overview's program cards and a season's Registrations all wear it. NOT the chat, notification or coaches-portal badges.
 */
export function kitCountText(n: number): string {
  return n > 99 ? '99+' : String(n);
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
/** The Calendar's one gate, asked by its rail row (`kitCalendarLink`) and by the header that names it (`opensCalendar`). */
export function canOpenCalendar({ canUse, tournamentTier }: {
  canUse: (capability: Capability) => boolean;
  tournamentTier: boolean;
}): boolean {
  return !tournamentTier && (canUse('module_rep_teams') || canUse('module_house_league') || canUse('module_tournaments'));
}

export function kitCalendarLink({ base, canUse, isCanceled, tournamentTier }: {
  base: string;
  canUse: (capability: Capability) => boolean;
  isCanceled: boolean;
  tournamentTier: boolean;
}): KitLink | null {
  if (isCanceled) return null;
  return canOpenCalendar({ canUse, tournamentTier }) ? { key: 'calendar', label: 'Calendar', href: `${base}/calendar`, exact: true, icon: CalendarClock } : null;
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

/**
 * ⚖ THE CLUB'S PERMITS ARE A PLACE (Club Tier Stage 13c — Ask 1 A, C1 = A, owner 2026-11-08; staff = A the same day):
 * "Permits", DIRECTLY UNDER Calendar and above Schedules in the rail, unheaded like its neighbours, and on a phone the More
 * sheet's lone row above its groups. Out of Organization › Venue library, whose Venues | Permits switch is gone. It shows
 * to everyone who could open the permit list before (the permits route refuses only a coach; a volunteer never reaches the
 * admin): the owner, an admin, a league admin, a registrar, a treasurer, and a club's staff — nobody loses the list. Its
 * glyph is a document with a check (N5: `MapPin` stays Venue library's, `FileText` PDF settings'). On a plan carrying the
 * Venue library only (permits ride it, Ask 4), never cancelled, never a Tournament plan. Not inside a tournament (the rail's
 * rule for Calendar and Schedules).
 */
export function kitPermitsLink({ base, role, isCanceled, tournamentTier, hasVenueLibrary }: {
  base: string;
  role: string | null | undefined;
  isCanceled: boolean;
  tournamentTier: boolean;
  hasVenueLibrary: boolean;
}): KitLink | null {
  if (isCanceled || tournamentTier || !hasVenueLibrary) return null;
  if (!role || role === 'coach' || role === 'official') return null;
  return { key: 'permits', label: 'Permits', href: `${base}/permits`, icon: FileCheck };
}

/** Organization's icon (its sidebar row and its More sheet row share it). */
export const ORGANIZATION_ICON: LucideIcon = Building2;

/** Plan & billing lives beside Help on every admin plan, including a suspended account's comeback path. The demo
 *  sandboxes hide every billing entry point (lib/sandbox-curation.ts): a comped demo org's billing answers nothing. */
export function kitBillingLink({ orgSlug, planId, accountKind, role, capabilities, isSandbox = false }: {
  orgSlug: string; planId: OrgPlan | null | undefined; role: OrgRole | null | undefined;
  accountKind?: string | null;
  capabilities: Record<string, boolean> | null; isSandbox?: boolean;
}): KitLink | null {
  return !isSandbox && hasBillingAccess(role, capabilities)
    ? { key: 'org/billing', label: PLAN_BILLING_TITLE, href: getBillingHref({ slug: orgSlug, planId, accountKind }), icon: CreditCard }
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
  isTeamWorkspace = false,
}: {
  base: string;
  role: string | null | undefined;
  isCanceled: boolean;
  canSeeMembers: boolean;
  hasVenueLibrary: boolean;
  isTeamWorkspace?: boolean;
}): KitLink[] {
  const o = `${base}/org`;
  const ownerOrAdmin = role === 'owner' || role === 'admin';
  const links: (KitLink | false)[] = [
    // A member card (N5, 2026-10-17): `Users2` is the Coaches Portal door's, and both sit on the phone's More sheet.
    !isCanceled && canSeeMembers && { key: 'org/members', label: membersLabel(isTeamWorkspace), href: `${o}/members`, icon: IdCard },
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

/**
 * Is this door the page on screen, when the other doors on the same menu are counted? A door whose page lives UNDER
 * another door's address (Plan & billing under Settings & access on the tournament tiers; Audit log under Members) lit
 * both rows on a plain prefix match. The parent steps aside while a more specific door is the page on screen; the
 * parent's own pages still light it.
 */
export function isKitLinkActiveAmong(pathname: string, link: KitLink, others: readonly (KitLink | null | undefined)[]): boolean {
  if (!isKitLinkActive(pathname, link)) return false;
  return !others.some(o => o && o.href !== link.href && o.href.startsWith(`${link.href}/`) && isKitLinkActive(pathname, o));
}

/** Which program (or Organization) the page on screen belongs to, by its address alone. */
export function activeKitSection(pathname: string, base: string): AdminProgramKey | 'org' | null {
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : '';
  const first = rest.split('/')[0];
  if (first === 'org') return 'org';
  return isAdminProgramKey(first) ? first : null;
}

/**
 * The guide for where you are, opened in a new tab: any tournament page → the tournaments guide, a program's or
 * Organization's pages → theirs, everything else → the admin help home. ONE answer for its two homes (E16, navigation
 * Phase 1): the desktop account menu's Help row, and the phone More sheet's foot (and the demo sandbox's sidebar foot,
 * which keeps Help because the sandbox hides the account menu).
 */
export function adminHelpHref(pathname: string, base: string): string {
  if (pathname.startsWith(`${base}/tournaments`)) return `${base}/help/tournaments`;
  const section = activeKitSection(pathname, base);
  return section === 'house-league' || section === 'rep-teams' || section === 'accounting' || section === 'org'
    ? `${base}/help/${section}`
    : `${base}/help`;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚖ PLACES IN THE SIDEBAR (Club Tier Stage 13i Session B, Asks 1, 2 and 5 = A, Ask 4 = B, owner 2026-11-06; NAV_STANDARD
 * N2, N3, N7, N11). The club sidebar lists PLACES only and never grows: nothing renders under a row, no row carries a
 * chevron, and one row is lit — the place you are in, at any depth. A place's pages are its tab row (above).
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚖ THE SIDEBAR'S TWO HEADINGS (Ask 5 = A): Programs (Rep teams, House league, Tournaments) and Club (Accounting, Families,
 * Public site, then Organization). ⚠ A map BESIDE `LEAD_ORDER`, never a reordered `LEAD_ORDER`: the phone bar and tiles
 * fill from the programs' own order (N10). Inside each group a program keeps `LEAD_ORDER`'s place. Tournaments sits in
 * Programs only for the tournament director (E15); for everyone else a hosted tournament is a foot door
 * (`clubTournamentsDoor`), and an unhosted one the "Also on your plan" row.
 */
const PLACE_GROUP: Record<AdminProgramKey, 'programs' | 'club'> = {
  'rep-teams': 'programs',
  'house-league': 'programs',
  tournaments: 'programs',
  accounting: 'club',
  families: 'club',
  'public-site': 'club',
};

export type ClubPlaceGroupKey = 'programs' | 'also' | 'club';
export type ClubPlaceGroup<T> = { key: ClubPlaceGroupKey; heading: string; places: T[] };

/**
 * The club body's places, grouped — the sidebar's and the More sheet's one list (N7: the sheet lists the sidebar's places,
 * under the sidebar's names, in the sidebar's order). Programs, then "Also on your plan" (what the plan carries that the club
 * does not run yet, as today), then Club with Organization last. A group with no place is not returned.
 */
export function clubPlaceGroups<T extends { key: string }>({ programs, alsoOnPlan, organization }: {
  programs: readonly T[];
  alsoOnPlan: readonly T[];
  organization: T | null;
}): ClubPlaceGroup<T>[] {
  const of = (group: 'programs' | 'club') => programs.filter(p => PLACE_GROUP[p.key as AdminProgramKey] === group);
  const groups: ClubPlaceGroup<T>[] = [
    { key: 'programs', heading: 'Programs', places: of('programs') },
    { key: 'also', heading: 'Also on your plan', places: [...alsoOnPlan] },
    { key: 'club', heading: 'Club', places: [...of('club'), ...(organization ? [organization] : [])] },
  ];
  return groups.filter(g => g.places.length > 0);
}

/**
 * ⚖ Every group with at least one row wears its heading — over one row or many — and a group with no rows wears nothing
 * (owner, 2026-11-09, replacing N2 of 13i, which left a blank line over a lone row: the same height as the word, so it saved
 * nothing, and it read as inconsistent beside "Also on your plan" over a lone Tournaments).
 */
export function placeGroupHeading(group: ClubPlaceGroup<unknown>): string | null {
  return group.places.length > 0 ? group.heading : null;
}

/**
 * ⚖ THE CLUB MORE SHEET'S GROUPS (N7, 13i B5): the sidebar's places, under the sidebar's names, in its order, less the doors
 * the phone bar and its tiles already show (`clubPhoneNav`, unchanged) — so every place is reached once on a phone. A place's
 * pages are never sheet rows: Organization is one row, its pages are its tabs.
 */
export function clubSheetGroups<T extends { key: string }>(
  groups: readonly ClubPlaceGroup<T>[],
  phone: { tabs: readonly { key: string }[]; tiles: readonly { key: string }[] | null },
): ClubPlaceGroup<T>[] {
  const taken = new Set([...phone.tabs, ...(phone.tiles ?? [])].map(d => d.key));
  return groups
    .map(g => ({ ...g, places: g.places.filter(p => !taken.has(p.key)) }))
    .filter(g => g.places.length > 0);
}

/** Organization as a place: its one row (the sidebar and the More sheet), for a club that has Organization tabs to show
 *  (a cancelled club has none: `kitOrgLinks`). Its pages are its tabs (`orgTabs`); `/org` goes to the first one held. */
export function kitOrgPlace({ base, orgLinks, tournamentOnly }: {
  base: string; orgLinks: readonly KitLink[]; tournamentOnly: boolean;
}): KitLink | null {
  return !tournamentOnly && orgLinks.length > 0
    ? { key: 'org', label: 'Organization', href: `${base}/org`, icon: ORGANIZATION_ICON }
    : null;
}

/**
 * ⚖ ONE LIT ROW (13i B1): the club place the page on screen is in, at any depth — Rep teams on a team's Roster, House league
 * on a season's Registrations, Organization on Audit log or The board. ⚠ Plan & billing lives under `/org` but is no
 * Organization tab (Ask 4 = B): on its page the FOOT row is the lit one, so no place is. Overview, Calendar and Schedules
 * light on their own addresses (`isKitLinkActive`), none of which is under a place.
 */
export function litClubPlace(pathname: string, base: string, billingLink: KitLink | null): AdminProgramKey | 'org' | null {
  if (billingLink && isKitLinkActive(pathname, billingLink)) return null;
  return activeKitSection(pathname, base);
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
export type AccountingTabId = 'overview' | 'teams' | 'ledger' | 'bank' | 'allocations' | 'payment-requests' | 'budget' | 'budget-vs-actual' | 'payouts';

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
    // ⚖ BANK RIGHT AFTER THE LEDGER (Bank reconciliation B8, ruled 2026-11-04): the statement is checked against the book,
    // so the two sit together. For everyone who reads Accounting, ALWAYS — unlike Payouts it is where a club starts.
    { id: 'bank' as const, label: 'Bank', href: `${a}/bank` },
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

/**
 * A CHILD'S PAGE (Club Tier Stage 14 S5, drawings tab 5): a page of its own under Families, two segments down — so it is
 * no tab (`familiesTabFor` answers null) and the Families frame draws no title or tab row over it; the page wears its own
 * header, back to the household it was opened from (`from`) or to Families.
 */
export function familiesChildHref(base: string, childId: string, fromPersonId?: string | null): string {
  return `${base}/families/children/${encodeURIComponent(childId)}${fromPersonId ? `?from=${encodeURIComponent(fromPersonId)}` : ''}`;
}
export function isFamiliesChildPage(pathname: string, base: string): boolean {
  return /^[^/]+$/.test(pathname.startsWith(`${base}/families/children/`) ? pathname.slice(`${base}/families/children/`.length) : '');
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚖ PAGES ON THE PAGE (Club Tier Stage 13i, Asks 1 and 3 = A, owner 2026-11-06; drawing tab 6, N11). Every club place
 * with more than one page shows them as THE shared tab row (`HubTabBar`) under its title, as Accounting and Families
 * already do. The lists below are the one statement of each place's tabs: the place's layout draws them (the More sheet
 * lists the place once, never its tabs — N7). A tab a person cannot open is not in the list; a list of one draws no row (the
 * component's own rule). Each tab lights on its OWN address only (`litTab`, no `views`): an address under a place that is
 * no tab is a RECORD page one level down (a team's History, Rename team addresses, a club schedule read from a season —
 * owner 2026-11-06, the 2026-09-30 rule kept): it keeps its own back arrow and the place draws no tab row over it.
 * ⚰ The Organization hub's tiles (`orgHubDoors`) retired with this: `/org` goes to the first tab the person holds.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

/** A place's tab, as the shared tab row draws it. */
export type PlaceTab = { id: string; label: string; href: string };

/** Which tab of a place a path is, or null for an address that is no tab (a record page, or a place inside it). */
export function placeTabFor(tabs: readonly PlaceTab[], pathname: string): string | null {
  return litTab(tabs, pathname);
}

/** Rep teams' six tabs: the program's own pages, in their order (Teams · Assistant coaches · Document templates · Shared
 *  library · Past seasons · Bring in a coach's team). A team under Teams is its own place (`teamTabs`). */
export function repTeamsTabs(base: string): PlaceTab[] {
  return programDef('rep-teams', base).pages.map(p => ({ id: p.key, label: p.label, href: p.href }));
}

/** A rep team's five tabs (moved here from the rail, 13i A1): Team page · Roster · Schedule · Tryouts · Coaches. */
export function teamTabs(teamPath: string): PlaceTab[] {
  return [
    { id: 'team', label: 'Team page', href: teamPath },
    { id: 'roster', label: 'Roster', href: `${teamPath}/roster` },
    { id: 'schedule', label: 'Schedule', href: `${teamPath}/schedule` },
    { id: 'tryouts', label: 'Tryouts', href: `${teamPath}/tryouts` },
    { id: 'coaches', label: 'Coaches', href: `${teamPath}/coaches` },
  ];
}

/** A house-league season's tabs: the pages this person can open (`seasonPagesFor`, the one season gate), in its order. */
export function seasonTabs(seasonPath: string, access: Pick<HouseLeagueAccess, 'read' | 'readMoney' | 'email'>): (PlaceTab & { key: SeasonPageKey })[] {
  return seasonPagesFor(access).map(p => ({ id: p.key, key: p.key, label: p.label, href: seasonPageHref(seasonPath, p.segment) }));
}

/** Every page a season has — to ask "is this address a tab at all?" before anyone's access is known. */
const EVERY_SEASON_PAGE = { read: true, readMoney: true, email: true } as const;

/**
 * ⚖ THE PLACE AN ADDRESS IS IN, FROM THE ADDRESS ALONE (Admin header bar Phase 2, owner option 4, 2026-11-07; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`, "No flash of the wrong name"). The admin's pinned bar names the place
 * you are in and pins its tab row; the place's frame hands it the live parts (the season's name, its switcher and chip,
 * the waiting counts). The bar is drawn ABOVE the frame, so on the server's first paint it has not heard from the frame
 * yet — it asks this, and draws the same placeholder the frame would (the name "Season" until the season loads), so the
 * club's name never shows and swaps. The frame asks this too, so the bar and the frame cannot disagree about whether an
 * address is a place, which tab it is, or who may open it — every gate is in ONE object (`ClubPlaceAccess`), which the bar
 * and every frame build the same way (`useClubPlaceAt`, `components/admin/AdminBarPlace.tsx`).
 * The seven places: Rep teams, a team, a season, Accounting, Families, Organization, Permits (13c).
 * ⚠ Every place added here is a place the bar titles, so its frame must hand the bar its parts (`PlaceFrame`'s `place`).
 *
 * ⚖ PHASE 3 (round 5, owner 2026-11-08, Q1–Q6 as recommended): THE SCREENS WITH NO PLACE OF THEIR OWN name themselves too.
 * A screen with a fixed name (Calendar, Schedules, Notifications, House league's Seasons, the Public site, Plan & billing) is
 * a NAMED SCREEN: a title, no tabs, nothing to hand off. A RECORD PAGE one level down (a schedule, a team's History, one past
 * season, a club schedule read from a season, Rename team URLs, a child's page) is one too, with its way back; the address
 * gives a placeholder ("Schedule", "Child") and the page hands over its live name, facts and chip (`useHandNamedPlace`).
 * Each carries ITS PAGE'S OWN REFUSAL RULE in `ClubPlaceAccess`: someone the page refuses keeps the club's name over the
 * refusal (Q5), and the page keeps its paper heading wherever this answers null (`TabPageHeader`). Not here: Club setup (Q1,
 * keeps its heading), a team's account in Accounting (a view of Teams, 2026-10-16), the org-wide tournament screens (they
 * name the organization, Q6: `isTournamentOrgScreen`).
 */
export type ClubPlaceAt = {
  /** Which place, and which one of them (`season:{id}`): the frame's hand-off counts only for the same key. */
  key: string;
  /** The place's name, or its placeholder until the frame's data names it. */
  title: string;
  /** The way up, named by where it goes. */
  back?: { href: string; label: string };
  /** The phone's small line: the section a place sits in ("House league"). Desktop has no small line (round 4, D1/D3). */
  facts: readonly string[];
  /** A RECORD's own fact ("Born Mar 14, 2015", a past season's team): on BOTH widths — quiet words beside the name in the
   *  desktop strip, the way a tournament's dates sit (round 5, Q4), and on the phone's small line. */
  detail?: string;
  tabs: readonly PlaceTab[];
  activeId: string;
  /** Names the tab row for a screen reader. */
  ariaLabel: string;
};

/** Who may open which place — every gate `clubPlaceAt` asks, in one object. */
export type ClubPlaceAccess = {
  /** The rail's one gate, capability AND plan (`useOrg().canOpen`): Rep teams and a team, Accounting, Families. */
  canUse: (capability: Capability) => boolean;
  /** The season gate's answer for the member (`useHouseLeagueAccess(null)`), or null before it is known. */
  seasonAccess: Pick<HouseLeagueAccess, 'read' | 'readMoney' | 'email'> | null;
  /** This person's Organization tabs (`orgTabs`), or null where Organization is no place (a one-team workspace). */
  orgTabs: readonly PlaceTab[] | null;
  /** Accounting's club ↔ team loop tabs: the plan carries Rep teams (the Accounting layout's `runsRepTeams`). */
  runsRepTeams: boolean;
  /** Accounting's Payouts tab: the club has connected payouts (`clubHasPayouts`, read by the admin layout's server). */
  hasPayouts: boolean;
  /** The Families layout's gate (`canOpenFamilies`): the module, and never a member limited to some team groups. */
  opensFamilies: boolean;
  /** The Permits place (Club Tier 13c, C1): `kitPermitsLink`'s gate answered — the rail row and the bar agree. Absent = no. */
  opensPermits?: boolean;
  /* Phase 3's named screens, each its page's own refusal rule (absent = no, so the screen keeps the club's name): */
  /** Calendar: not a Tournament-tier org, and at least one of its programs is this person's (`calendarPrograms`, the API's). */
  opensCalendar?: boolean;
  /** Schedules and a schedule: the plan carries the scheduler AND an owner or admin (`canOpenClubSchedules`, the API's). */
  opensSchedules?: boolean;
  /** The Public site: the plan carries the site AND the capability (the page's `noSite` card and its "not yours"). */
  opensPublicSite?: boolean;
  /** Plan & billing: the owner (BillingKit's "not yours"; the route sends a team workspace away). */
  opensBilling?: boolean;
};

/** One of Phase 3's screens: a name and, for a record, its way back — no tab row (round 5). */
const namedScreen = (key: string, title: string, more: Partial<ClubPlaceAt> = {}): ClubPlaceAt =>
  ({ key, title, facts: [], tabs: [], activeId: '', ariaLabel: title, ...more });

/** Is this address the place's own, or under it (never a sibling that merely starts with the same letters)? */
const isAtOrUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** A place with no way up and no small line beyond the club: its name says what its tab row is. */
const flatPlace = (key: string, title: string, tabs: readonly PlaceTab[], activeId: string | null): ClubPlaceAt | null =>
  activeId ? { key, title, facts: [], tabs, activeId, ariaLabel: title } : null;

export function clubPlaceAt(pathname: string, base: string, {
  canUse, seasonAccess, orgTabs, runsRepTeams, hasPayouts, opensFamilies, opensPermits = false,
  opensCalendar = false, opensSchedules = false, opensPublicSite = false, opensBilling = false,
}: ClubPlaceAccess): ClubPlaceAt | null {
  // Permits (Club Tier 13c, C1 = A): a one-page place — the bar names it, and one tab draws no row.
  const permits = `${base}/permits`;
  if (isAtOrUnder(pathname, permits)) {
    return opensPermits ? flatPlace('permits', 'Permits', [{ id: 'permits', label: 'Permits', href: permits }], 'permits') : null;
  }
  // ── Phase 3's named screens (round 5): one address each, the page's own gate. ──
  if (pathname === `${base}/calendar`) return opensCalendar ? namedScreen('calendar', 'Calendar') : null;
  if (pathname === `${base}/notifications`) return namedScreen('notifications', 'Notifications');
  if (pathname === `${base}/public-site`) return opensPublicSite ? namedScreen('public-site', 'Public site') : null;
  if (pathname === `${base}/org/billing`) return opensBilling ? namedScreen('billing', PLAN_BILLING_TITLE) : null;
  const schedules = `${base}/schedules`;
  if (isAtOrUnder(pathname, schedules)) {
    if (!opensSchedules) return null;
    if (pathname === schedules) return namedScreen('schedules', 'Schedules');
    const scheduleId = pathname.slice(schedules.length + 1);
    // A schedule: the record, "← Schedules"; its name and state chip come from the page (`useHandNamedPlace`).
    return /^[^/]+$/.test(scheduleId)
      ? namedScreen(`schedule:${scheduleId}`, 'Schedule', { back: { href: schedules, label: 'Schedules' } })
      : null;
  }
  // A team is a place of its own inside Rep teams (its five tabs, "← Teams"), so it is asked before Rep teams. Rep teams'
  // own gate (its layout's): someone who cannot open Rep teams sees the refusal there, under the club's name.
  const teams = `${base}/rep-teams/teams/`;
  if (pathname.startsWith(teams)) {
    const teamId = pathname.slice(teams.length).split('/')[0];
    if (!teamId || !canUse(PROGRAM_CAPABILITY['rep-teams'])) return null;
    const teamPath = `${teams}${teamId}`;
    const tabs = teamTabs(teamPath);
    const tab = placeTabFor(tabs, pathname);
    // The team's History and one past season are record pages (A8): no tab row, their own way back. The team's name comes
    // from the page; until it does, "Team" (the team place's own placeholder) and, on the phone's line, "Rep teams".
    if (!tab) {
      const rest = pathname.slice(teamPath.length);
      if (rest === '/history') {
        return namedScreen(`team-history:${teamId}`, 'History', { back: { href: teamPath, label: 'Team' }, facts: ['Rep teams'] });
      }
      const year = /^\/history\/([^/]+)$/.exec(rest)?.[1];
      return year
        ? namedScreen(`team-year:${year}`, 'Season', { back: { href: `${teamPath}/history`, label: 'History' }, facts: ['Rep teams'] })
        : null;
    }
    return {
      key: `team:${teamId}`,
      title: 'Team',
      back: { href: `${base}/rep-teams`, label: 'Teams' },
      // No group on this line: on a phone "Rep teams · group" plus the chip measured too long (the drawing), and the desktop
      // has no small line at all since round 4 (D3, 2026-11-08) — the group stays in Team details.
      facts: ['Rep teams'],
      tabs,
      activeId: tab,
      ariaLabel: 'Team pages',
    };
  }
  if (isAtOrUnder(pathname, `${base}/rep-teams`)) {
    if (!canUse(PROGRAM_CAPABILITY['rep-teams'])) return null;
    // Rename team URLs (A9): a page of Rep teams that is no tab, with "← Rep teams" (its only way back was the eyebrow).
    if (pathname === `${base}/rep-teams/rename-slugs`) {
      return namedScreen('rep-rename-slugs', 'Rename team URLs', { back: { href: `${base}/rep-teams`, label: 'Rep teams' } });
    }
    const tabs = repTeamsTabs(base);
    return flatPlace('rep-teams', 'Rep teams', tabs, placeTabFor(tabs, pathname));
  }
  const league = `${base}/house-league`;
  if (pathname.startsWith(`${league}/seasons/`)) {
    // In the season when ANY of its pages is this person's — the season gate's own answer, not the program's
    // capability: a treasurer holds no House league yet reads a season's Money through the club's Accounting
    // (`readMoney = opens || holdsBooks`), and keeps the season's name and its way back (/review, 2026-11-07).
    if (!seasonAccess || !(seasonAccess.read || seasonAccess.readMoney || seasonAccess.email)) return null;
    const seasonId = pathname.slice(`${league}/seasons/`.length).split('/')[0];
    if (!seasonId) return null;
    const seasonPath = `${league}/seasons/${seasonId}`;
    // The club's schedule read from a season: a record page under the season's Schedule tab (the season frame steps aside
    // for it), back to "House league's time"; its own gate is the house league's read (the page's `hasAccess`).
    const clubSchedule = /^\/club-schedule\/([^/]+)$/.exec(pathname.slice(seasonPath.length))?.[1];
    if (clubSchedule) {
      return seasonAccess.read
        ? namedScreen(`club-schedule:${clubSchedule}`, 'Schedule', {
          back: { href: `${seasonPath}/schedule?time=1`, label: LEAGUE_TIME_WORDS.club.back },
          facts: [LEAGUE_TIME_WORDS.club.eyebrow],
        })
        : null;
    }
    const tab = placeTabFor(seasonTabs(seasonPath, EVERY_SEASON_PAGE), pathname);
    if (!tab) return null;
    return {
      key: `season:${seasonId}`,
      title: 'Season',
      back: { href: league, label: 'Seasons' },
      facts: ['House league'],
      // The pages this person can open (`seasonPagesFor`, the one season gate). Before the member is known the whole
      // place is null (above), never a place with no tabs.
      tabs: seasonTabs(seasonPath, seasonAccess),
      activeId: tab,
      ariaLabel: 'Season pages',
    };
  }
  // House league's Seasons list (round 5, Q2): its page's gate is the house league's read (`NotYours page="houseLeague"`).
  if (pathname === league) return seasonAccess?.read ? namedScreen('hl-seasons', 'Seasons', { facts: ['House league'] }) : null;
  if (isAtOrUnder(pathname, `${base}/accounting`)) {
    // The Accounting layout's gate (`canOpenModule`, capability AND plan): someone refused sees the refusal, not the tabs.
    // No fiscal year in the bar (A6): the Year pill in each tab's toolbar keeps it.
    if (!canUse(PROGRAM_CAPABILITY.accounting)) return null;
    // An address that is no tab (no page, or the loop's addresses on a club with no rep teams) renders alone.
    const tabs = accountingTabs(base, { runsRepTeams, hasPayouts });
    return flatPlace('accounting', 'Accounting', tabs, placeTabFor(tabs, pathname));
  }
  if (isAtOrUnder(pathname, `${base}/families`)) {
    // Its layout's gate: someone refused (incl. a member limited to some team groups) sees the refusal under the club's name.
    if (!opensFamilies) return null;
    // A child's page (Stage 14 S5) is a record page (A8): "← Families" from the address; the page hands over the child's
    // name, the household it was opened from (`?from=`, data, not the address), the date of birth and the season chip.
    if (isFamiliesChildPage(pathname, base)) {
      const childId = pathname.slice(`${base}/families/children/`.length);
      return namedScreen(`child:${childId}`, 'Child', { back: { href: `${base}/families`, label: 'Families' } });
    }
    // A family's address lights Families (a record OVER the tab, `views`); any other address under it lights Families too.
    // The name is the place's own (the frame hands it on unchanged): `FAMILY_LIST_WORDS.title`, spelled here so the nav
    // module does not load the Families word book for one word.
    const tabs = familiesTabs(base);
    return flatPlace('families', 'Families', tabs, placeTabFor(tabs, pathname) ?? 'families');
  }
  if (pathname.startsWith(`${base}/org/`) && orgTabs) {
    // Only the person's own tabs: Plan & billing (`/org/billing`) is no tab (13i Ask 4 = B), nor is a page they cannot
    // open — each renders alone with its own header. One tab draws no row (the bar's rule).
    return flatPlace('org', 'Organization', orgTabs, placeTabFor(orgTabs, pathname));
  }
  return null;
}

/**
 * ⚖ A10 + ROUND 5 Q6 (owner 2026-11-07 / 2026-11-08): THE ORG-WIDE TOURNAMENT SCREENS NAME THE ORGANIZATION, in a club and a
 * tournament-only organization alike, never the event the tournament context happened to pick. Event pages name the event.
 * Listed one by one, because `settings/` is not all the organization's: Event settings (`settings/event`), the event's own
 * Notifications (`settings/notifications`, "mute this tournament") and `settings/registration-fields` (a redirect into Event
 * settings) are the EVENT's. The list, archives, the Settings & access hub, Members, Plan & billing, Payouts, PDF settings
 * are the organization's.
 */
const TOURNAMENT_ORG_SCREENS = ['manage', 'archives', 'settings/members', 'settings/subscription', 'settings/payouts', 'settings/pdf'] as const;
export function isTournamentOrgScreen(pathname: string, base: string): boolean {
  const t = `${base}/tournaments`;
  return pathname === `${t}/settings` || TOURNAMENT_ORG_SCREENS.some(s => isAtOrUnder(pathname, `${t}/${s}`));
}

/** The Organization tab a person without Members reads in its place: who runs the club, names and roles only (13a R1). */
export const ORG_BOARD_TAB_LABEL = 'The board';

/**
 * Organization's tabs (13i Ask 3 = A, Ask 4 = B): the person's `kitOrgLinks` in their order and nothing else — Plan &
 * billing stays a foot row, Tournaments a program, the Coaches Portal a foot door. ⚖ THE BOARD (owner 2026-11-06, 13i
 * Session A): a person with no Members tab (anyone but the owner on a club, once Members is not theirs) reads "The board"
 * in Members' place, so 13a's R1 ("who runs the board, names only") keeps the home the retired hub gave it.
 */
export function orgTabs({ base, orgLinks, showsBoard }: { base: string; orgLinks: readonly KitLink[]; showsBoard: boolean }): PlaceTab[] {
  const tabs = orgLinks.map(l => ({ id: l.key, label: l.label, href: l.href }));
  return showsBoard ? [{ id: 'org/board', label: ORG_BOARD_TAB_LABEL, href: `${base}/org/board` }, ...tabs] : tabs;
}

/** Does this person read "The board" tab? Not the owner (Members is always theirs), not a one-team workspace (its staff
 *  page is its own), and only when Members is not among their tabs. */
export function showsOrgBoard({ role, orgLinks, isTeamWorkspace }: { role: string | null | undefined; orgLinks: readonly KitLink[]; isTeamWorkspace: boolean }): boolean {
  return !!role && role !== 'owner' && !isTeamWorkspace && !orgLinks.some(l => l.key === 'org/members');
}
