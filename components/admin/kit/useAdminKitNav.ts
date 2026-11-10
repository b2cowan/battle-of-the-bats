'use client';
/**
 * useAdminKitNav — the one reading of "where am I, and what may I open" that the kit rail, the kit
 * phone bar and the phone's "In <program>" row share (Admin Design Continuity slice 1). The pure
 * shapes live in `lib/admin-kit-nav.ts` and `./kit-tournament-groups.ts`; this binds them to the
 * signed-in person, the org, the tournament and the page, ONCE, so the navs cannot disagree.
 */
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import { isStandaloneCoachOwner } from '@/lib/coach-billing-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { isTournamentTier } from '@/lib/billing-urls';
import { useCurrentOrgCoachAccess, coachDoorFor } from '@/lib/use-current-org-coach-access';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { kitPrograms, kitOrgLinks, kitBillingLink, adminHelpHref, clubProgramOrder, clubTournamentsDoor, kitPortalDoors, personClubShape, personOnlyProgram, kitCalendarLink, kitSchedulesLink, kitPermitsLink, kitOrgPlace, litClubPlace, clubPlaceGroups, orgTabs, showsOrgBoard, type KitLink } from '@/lib/admin-kit-nav';
import { kitTournamentGroups } from './kit-tournament-groups';
import { useClubBrief } from './club/ClubBriefProvider';

/**
 * The Organization links alone — what `useAdminKitNav` builds for the rail, without the rest of it. Organization's frame and
 * the `/org` door read this: they must not pay for the coach-access fetch and the program lists the full hook starts.
 */
export function useOrgLinks() {
  const { currentOrg, userRole, userCapabilities, canOpen } = useOrg();
  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug}/admin`;
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const canSeeMembers = Boolean(userRole)
    && (userRole === 'owner' || hasCapability(userRole!, userCapabilities, 'module_members'))
    && canOpen('module_members');
  // ⚠ A Tournament-plan organization has NO /admin/org at all (its layout redirects every page of
  // it), so it gets no Organization rows — today's rail hides that section for it too. A one-team
  // workspace on a tournament plan is the exception: it keeps /admin/org (staff and access).
  const isTeamWorkspace = isTeamWorkspaceOrg(currentOrg);
  const orgLinks = isTournamentTier(currentOrg?.planId) && !isTeamWorkspace ? [] : kitOrgLinks({
    base,
    role: userRole,
    isCanceled,
    canSeeMembers,
    hasVenueLibrary: hasOrgVenueLibrary(currentOrg?.planId),
    isTeamWorkspace,
  });
  return { orgSlug, base, isCanceled, isTeamWorkspace, orgLinks };
}

/** The person's Organization tabs — the pinned bar's, Organization's frame's and the `/org` door's one list. */
export function useOrgTabs() {
  const { userRole } = useOrg();
  const { base, orgLinks, isTeamWorkspace } = useOrgLinks();
  const tabs = orgTabs({
    base,
    orgLinks,
    showsBoard: showsOrgBoard({ role: userRole, orgLinks, isTeamWorkspace }),
  });
  return { tabs, isTeamWorkspace };
}

/** The Permits row (Club Tier 13c, C1) or null — the rail, the More sheet and the bar's place all read this one answer. */
export function usePermitsLink() {
  const { currentOrg, userRole } = useOrg();
  const { base, isCanceled } = useOrgLinks();
  return kitPermitsLink({
    base, role: userRole, isCanceled, tournamentTier: isTournamentTier(currentOrg?.planId), hasVenueLibrary: hasOrgVenueLibrary(currentOrg?.planId),
  });
}

export function useAdminKitNav() {
  const pathname = usePathname();
  const { currentOrg, userRole, userCapabilities, canOpen } = useOrg();
  const { currentTournament } = useTournament();
  const isSandbox = useIsSandbox();
  const { orgSlug, base, isCanceled, isTeamWorkspace, orgLinks } = useOrgLinks();

  // The role holds the capability AND the plan carries the module — `canOpen`, the ONE gate every
  // route asks (Club Stage 1, lib/member-access.ts), so the rail can never offer a door the server
  // refuses.
  const canUse = canOpen;

  // ⚖ The plan-aware order (Club Tier Stage 1): what the club RUNS leads, what the plan merely
  // carries is the quiet "Also on your plan" group. Read from the morning brief's `shape`, which the
  // hub reads too — so the rail, the phone bar and the hub list the programs in one order.
  // ⚖ Ask 8 (Stage 13a): a person whose only program is house league sees it lead from day one — the one exception to
  // N10, decided here ONCE so the rail, the phone bar and the Overview cannot disagree.
  // ⚖ E4 + E15 (navigation Phase 1, owner 2026-11-09): a hosted Tournaments leaves the lead for the foot's door — except
  // for the tournament director, whose whole job it is (it stays their row, as house league does for a registrar).
  const club = useClubBrief();
  const runOrder = clubProgramOrder(personClubShape(club.shape, canUse));
  const order = clubTournamentsDoor(runOrder, personOnlyProgram(canUse) === 'tournaments');
  // Two lists: the Overview's program cards list everything the club RUNS, Tournaments included (the rulings moved it out
  // of the sidebar and the phone, never off the club's front page); the sidebar's places and the phone's fill read `navPrograms`.
  const programs = kitPrograms({ base, canUse, order: runOrder.lead });
  const navPrograms = kitPrograms({ base, canUse, order: order.lead });
  const alsoOnPlan = kitPrograms({ base, canUse, order: order.also });
  // ⚖ D8 (Club Stage 1): "tournament-only" is a fact about the PLAN, never the person — the same
  // helper the hub, today's sidebar and the post-login resolver call, so a club's staff member is
  // not tournament-only here while being a club member there.
  const tournamentOnly = canUse('module_tournaments') && !!currentOrg && isTournamentOnlyWorkspace(currentOrg);
  // The club calendar (Club Tier 6b): under Overview in the rail, the More sheet's first row — one gate for both.
  const calendarLink = kitCalendarLink({ base, canUse, isCanceled, tournamentTier: isTournamentTier(currentOrg?.planId) });
  // The club scheduler (Club Tier 11a): directly under Calendar in both navs — one gate for both.
  const schedulesLink = kitSchedulesLink({
    base, canUse, isCanceled, role: userRole, planId: currentOrg?.planId,
  });
  // The club's permits (Club Tier 13c, C1): between Calendar and Schedules in the rail, the More sheet's lone row — one gate.
  const permitsLink = usePermitsLink();
  const billingLink = kitBillingLink({ orgSlug, planId: currentOrg?.planId, accountKind: currentOrg?.accountKind, role: userRole, capabilities: userCapabilities, isSandbox });
  // The person's own Coaches Portal door — the rail's foot and the More sheet's "You" both show it.
  const coachAccess = useCurrentOrgCoachAccess(currentOrg?.slug, !isCanceled);
  const coachDoor = coachDoorFor(coachAccess, currentOrg?.slug,
    isStandaloneCoachOwner(currentOrg, userRole, userCapabilities));
  // The tournament's groups as this person sees them, every row's address resolved ONCE. Every row is an event page:
  // the club's Accounting book is not one (owner 2026-10-30 — a tournament admin manages payments on Teams).
  const tournamentGroups = kitTournamentGroups({
    status: currentTournament?.status, isSandbox, role: userRole, planId: currentOrg?.planId,
  }).map(g => ({ ...g, items: g.items.map(i => ({ ...i, href: i.href ?? `${base}/tournaments/${i.key}` })) }));

  // ⚖ 13i Session B: the club's places in their groups (Organization one place, its pages its tabs), built ONCE — the
  // sidebar and the More sheet read this list. None for a tournament-only organization (its flat Account list) or a
  // cancelled club. One club row is lit: the place you are in at any depth, none on Plan & billing's page (its foot row).
  const placeGroups = tournamentOnly || isCanceled ? [] : clubPlaceGroups<KitLink>({
    programs: navPrograms, alsoOnPlan, organization: kitOrgPlace({ base, orgLinks, tournamentOnly }),
  });
  const litPlace = litClubPlace(pathname, base, billingLink);
  const onTournaments = pathname.startsWith(`${base}/tournaments`);
  // The guide for where you are, in a new tab — the phone's More sheet foot (N7) and the demo sandbox's sidebar foot; on a
  // desktop outside the sandbox it is the account menu's Help row (E16), which reads the same answer.
  const helpHref = adminHelpHref(pathname, base);
  // ⚖ THE OTHER PORTALS (E4, navigation Phase 1): one list, the rail's foot and the sheet's You read it.
  const portalDoors = kitPortalDoors({ base, onTournaments, tournamentOnly, isCanceled, tournamentsDoor: order.door, canUse, coachDoor });

  return {
    pathname,
    orgSlug,
    base,
    helpHref,
    isSandbox,
    isCanceled,
    canUse,
    programs,
    /** The sidebar's and the phone's programs: `programs` less a hosted Tournaments, which is a portal door (E4). */
    navPrograms,
    alsoOnPlan,
    brief: club.brief,
    tournamentOnly,
    /** A one-team workspace (Organization's frame leaves its staff page as it was — Club Tier Stage 13i, Ask 9). */
    isTeamWorkspace,
    orgLinks,
    placeGroups,
    litPlace,
    billingLink,
    calendarLink,
    permitsLink,
    /** The Permits row's amber count (13c Session B, C3 = A): "Outside the permit · N", the Overview card's own N. Owner and
     *  admin only — 0 for everyone else (the provider never asks for them). */
    permitsCount: club.outside?.count ?? 0,
    schedulesLink,
    coachDoor,
    portalDoors,
    tournamentGroups,
    onTournaments,
  };
}
