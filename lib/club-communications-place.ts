/**
 * CLUB COMMUNICATIONS — WHO HAS THE PLACE, AND WHICH FAMILY WINDOW THEY USE (Stage 1, Session 2). PURE and client-safe:
 * the sidebar, the bar, the page's layout and every family route ask the same answers, so a hidden row never decides
 * anything a route would not.
 *
 * Rulings: direction 4 (sending no longer needs the Families book), Stage 1 asks 2, 3, 5, 13; legal §2c (the club door
 * admits the owner and admins ONLY — owner 2026-11-17: a staff member, league admin or registrar who holds the book loses
 * the club-wide send); owner 2026-11-17: a league seat keeps the place between seasons (the list stays, New email is
 * absent until a season is under way). Session 3 widened `opensCommunications` to the coach-only and board-only seats (`facts.seat`).
 *
 * The colleague half (coach and board mail) is `seatOf` in `club-group-email-rules.ts`; this file never decides it.
 */
import { canOpenModule } from './member-access';
import { hasModuleEntitlement, isTournamentOnlyWorkspace, type EntitlementOrg } from './module-entitlements';
import { seatOf, type Seat } from './club-group-email-rules';
import type { Capability } from './roles';
import type { OrgRole } from './types';
import { isUuid } from './utils';
import type { EmailLogFilter } from './families-emails-log';
import type { ColleagueKind } from './club-group-email-words';

export interface PlaceFacts {
  role: OrgRole;
  /** module_communications (ruling 11, ask 5): off = no place and no group email from any screen. */
  switchOn: boolean;
  /** Limited to some rep team groups: no place in Stage 1, as Families refuses them. */
  teamLimited: boolean;
  tournamentOnly: boolean;
  /** The plan carries Families (the club door's audiences are read from the Families book). */
  planFamilies: boolean;
  /** The person runs the house league here: the plan carries it AND they may open it (the season door's own rule). */
  runsLeague: boolean;
  /** The person may open the Families book (the grant and not team-limited): "Families from a list" and one-family rows. */
  holdsBook: boolean;
  /** The coach and board groups this person may write to (`seatOf`, the one answer the colleague routes ask too). */
  seat: Seat;
}

type FamilyDoor = 'club' | 'season' | null;

const LEAGUE_DESK: readonly OrgRole[] = ['owner', 'admin', 'league_admin', 'league_registrar'];

/** The person's group-email switch, as every door reads it: on, and not limited to some rep team groups. */
function emailSwitchOn(f: Pick<PlaceFacts, 'switchOn' | 'teamLimited' | 'tournamentOnly'>): boolean {
  return f.switchOn && !f.teamLimited && !f.tournamentOnly;
}

/** Which family window "To families" opens: the club's (owner, admin) or a season's own (a league seat, ask 2). */
export function familyDoor(f: PlaceFacts): FamilyDoor {
  if (!emailSwitchOn(f)) return null;
  if ((f.role === 'owner' || f.role === 'admin') && f.planFamilies) return 'club';
  if (LEAGUE_DESK.includes(f.role) && f.runsLeague) return 'season';
  return null;
}

/** May this person email a season's families from the season's own screens (its tab, Registrations, its owing list)? */
export function seasonDoorOpen(f: PlaceFacts): boolean {
  return emailSwitchOn(f) && LEAGUE_DESK.includes(f.role) && f.runsLeague;
}

/** The place is open to a seat that may write to families, to coaches or to the board (Session 3: the treasurer and a coach-only seat). */
export function opensCommunications(f: PlaceFacts): boolean {
  return familyDoor(f) !== null || f.seat.any;
}

/**
 * Which family emails the list may show this reader (legal §2c "what each seat may read"):
 *   · 'all'    — owner and admins: every family email; a one-family message only with the book (ask 13);
 *   · 'league' — a league seat: every email to a house-league season, every "Every family" email (no names, ask 4), and a
 *                one-family message only when it was sent from a season.
 */
export type FamilyReader = { scope: 'all'; oneFamily: boolean } | { scope: 'league' };
export function familyReader(f: PlaceFacts): FamilyReader | null {
  if (!emailSwitchOn(f)) return null;
  if (f.role === 'owner' || f.role === 'admin') return { scope: 'all', oneFamily: f.holdsBook };
  if (LEAGUE_DESK.includes(f.role) && f.runsLeague) return { scope: 'league' };
  return null;
}

/** The facts, from a member and their club — the one way the server and the browser build them. */
export function placeFacts(
  member: { role: OrgRole; capabilities: Record<string, boolean> | null; limited: boolean },
  org: EntitlementOrg,
): PlaceFacts {
  const can = (cap: Capability) => canOpenModule(member, org, cap);
  return {
    role: member.role,
    switchOn: can('module_communications'),
    teamLimited: member.limited,
    tournamentOnly: isTournamentOnlyWorkspace(org),
    planFamilies: hasModuleEntitlement(org, 'module_families'),
    runsLeague: can('module_house_league'),
    holdsBook: can('module_families') && !member.limited,
    seat: seatOf({
      role: member.role, switchOn: can('module_communications'), teamLimited: member.limited, tournamentOnly: isTournamentOnlyWorkspace(org),
      planRep: hasModuleEntitlement(org, 'module_rep_teams'), planLeague: hasModuleEntitlement(org, 'module_house_league'),
      leagueModule: can('module_house_league'),
    }),
  };
}

// ── Communications' Filter (owner 2026-11-20) ────────────────────────────────────────────────────────────────────────
/**
 * The Filter's ticks (owner 2026-11-20: the toolbar's one Filter button, not a form dropdown). Within a group the ticks
 * are OR; the two groups are AND, as every Filter in the product. An empty group narrows nothing. A season is a family
 * email's, so a season ticked leaves no coach or board email (they have none).
 */
export type CommsKind = 'families' | ColleagueKind;
export interface CommsFilter { kinds: readonly CommsKind[]; seasons: readonly string[] }
export const commsFilterOff = (f: CommsFilter) => f.kinds.length === 0 && f.seasons.length === 0;

const COMMS_KINDS: readonly CommsKind[] = ['families', 'coaches', 'board'];
/** More seasons than a club could have emailed is a malformed request, not a filter; the rest are dropped. */
const MAX_FILTER_SEASONS = 100;
/** The list's address → the ticks: `who=families,coaches,board&season=<id>,<id>`. An unknown word or a malformed id is dropped. */
export function commsFilterOf(params: URLSearchParams): CommsFilter {
  const list = (key: string) => (params.get(key) ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const kinds = COMMS_KINDS.filter(k => list('who').includes(k));
  const seasons = [...new Set(list('season').filter(isUuid))].slice(0, MAX_FILTER_SEASONS);
  return { kinds, seasons };
}

/** The family read under the Filter: absent when the kinds ticked leave families out. */
export function familyFilter(f: CommsFilter): EmailLogFilter | null {
  if (f.kinds.length > 0 && !f.kinds.includes('families')) return null;
  return f.seasons.length > 0 ? { seasonIds: f.seasons } : 'all';
}
/** The coach and board read under the Filter: absent when a season is ticked (theirs have none) or only families are. */
export function colleagueFilter(f: CommsFilter): ColleagueKind | 'all' | null {
  if (f.seasons.length > 0) return null;
  if (f.kinds.length === 0) return 'all';
  const picked = f.kinds.filter((k): k is ColleagueKind => k !== 'families');
  return picked.length > 1 ? 'all' : picked[0] ?? null;
}
