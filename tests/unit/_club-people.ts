/**
 * The five club people the nav is drawn for (Club Tier Stage 13i: owner, admin, league admin, registrar, treasurer), on a
 * Club plan that carries every program, read through the SAME calls `useAdminKitNav` makes — so a guard sees what the
 * sidebar, the phone bar and the More sheet draw, without a browser. Role defaults only (no stored overrides).
 */
import { hasCapability, type Capability } from '../../lib/roles.ts';
import type { OrgRole } from '../../lib/types.ts';
import {
  clubPlaceGroups, clubProgramOrder, clubTournamentsDoor, kitPortalDoors, kitCalendarLink, kitCommunicationsLink, kitOrgLinks, kitOrgPlace, kitPermitsLink, kitPrograms,
  kitSchedulesLink, kitSponsorshipsLink, personClubShape, personOnlyProgram, showsOrgBoard, type ClubShape, type KitLink,
} from '../../lib/admin-kit-nav.ts';
import { clubPhoneNav } from '../../lib/nav-tiles.ts';
import { opensCommunications } from '../../lib/club-communications-place.ts';
import { opensSponsorships } from '../../lib/club-sponsorships-place.ts';
import { seatOf } from '../../lib/club-group-email-rules.ts';
import { canReadVenueLibrary } from '../../lib/venue-library.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';

export const CLUB_BASE = '/demo-club/admin';
/** The Club plan the people are drawn on (every program carried). */
const CLUB_ORG = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [] } as unknown as EntitlementOrg;

export const CLUB_PEOPLE: readonly (readonly [name: string, role: OrgRole])[] = [
  ['owner', 'owner'], ['admin', 'admin'], ['league admin', 'league_admin'], ['registrar', 'league_registrar'], ['treasurer', 'treasurer'],
];

export const RUNS_BOTH: ClubShape = { runsHouseLeague: true, hostsTournaments: true };
export const RUNS_NEITHER: ClubShape = { runsHouseLeague: false, hostsTournaments: false };

/** One person's club nav, as the hook builds it. `extra`: stored capability overrides (a league admin given Accounting). */
export function clubNavFor(role: OrgRole, shape: ClubShape, extra: Record<string, boolean> | null = null) {
  const canUse = (c: Capability) => hasCapability(role, extra, c);
  // The hook's own line (navigation Phase 1, E4 + E15): a hosted Tournaments leaves the lead for the foot's door, except
  // for the tournament director.
  const order = clubTournamentsDoor(clubProgramOrder(personClubShape(shape, canUse)), personOnlyProgram(canUse) === 'tournaments');
  // The foot's doors at the club (not inside a tournament), through the hook's own rule; no Coaches Portal here.
  const portalDoors = kitPortalDoors({
    base: CLUB_BASE, onTournaments: false, tournamentOnly: false, isCanceled: false, tournamentsDoor: order.door, canUse,
    coachDoor: { show: false, href: '' },
  });
  const tournamentsDoor = portalDoors.some(d => d.key === 'tournaments');
  const programs = kitPrograms({ base: CLUB_BASE, canUse, order: order.lead });
  const alsoOnPlan = kitPrograms({ base: CLUB_BASE, canUse, order: order.also });
  const calendar = kitCalendarLink({ base: CLUB_BASE, canUse, isCanceled: false, tournamentTier: false });
  const schedules = kitSchedulesLink({ base: CLUB_BASE, canUse, isCanceled: false, role, planId: 'club' });
  // Who reads the Venue library and permits (Board Ready trust close-out 2): the hook's own answer, on this Club plan.
  const readsLibrary = canReadVenueLibrary({ role, capabilities: extra }, CLUB_ORG);
  const permits = kitPermitsLink({ base: CLUB_BASE, readsLibrary, isCanceled: false, tournamentTier: false, hasVenueLibrary: true });
  const orgLinks = kitOrgLinks({
    base: CLUB_BASE, role, isCanceled: false,
    canSeeMembers: role === 'owner' || hasCapability(role, extra, 'module_members'),
    hasVenueLibrary: readsLibrary,
  });
  const orgPlace = kitOrgPlace({ base: CLUB_BASE, orgLinks, tournamentOnly: false, showsBoard: showsOrgBoard({ role, orgLinks, isTeamWorkspace: false }) });
  // Communications (Club Communications Stage 1): the hook's own rule, on this Club plan (it carries Families and house league).
  const communications = kitCommunicationsLink({
    base: CLUB_BASE, isCanceled: false, tournamentTier: false,
    opens: opensCommunications({
      role, switchOn: canUse('module_communications'), teamLimited: false, tournamentOnly: false, planFamilies: true,
      runsLeague: canUse('module_house_league'), holdsBook: canUse('module_families'),
      seat: seatOf({
        role, switchOn: canUse('module_communications'), teamLimited: false, tournamentOnly: false, planRep: true, planLeague: true,
        leagueModule: canUse('module_house_league'),
      }),
    }),
  });
  // Sponsorships (Board Ready Stage 6): the hook's own rule, on this Club plan (it carries Sponsorships).
  const sponsorships = kitSponsorshipsLink({
    base: CLUB_BASE, isCanceled: false, tournamentTier: false,
    opens: opensSponsorships({ role, capabilities: extra, limited: false }, CLUB_ORG),
  });
  const groups = clubPlaceGroups<KitLink>({ programs, alsoOnPlan, organization: orgPlace, communications, sponsorships });
  // The sidebar's rows, top to bottom: Overview, Calendar, Permits, Schedules (each unheaded — 13c C1), then every group's places.
  const sidebarRows = ['overview', ...(calendar ? ['calendar'] : []), ...(permits ? ['permits'] : []), ...(schedules ? ['schedules'] : []), ...groups.flatMap(g => g.places.map(p => p.key))];
  const phone = clubPhoneNav<KitLink>({ calendar, schedules, programs, alsoOnPlan });
  return { programs, alsoOnPlan, orgLinks, orgPlace, groups, sidebarRows, phone, permits, tournamentsDoor, communications, sponsorships };
}
