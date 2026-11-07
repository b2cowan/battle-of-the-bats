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
import { kitPrograms, kitOrgLinks, kitBillingLink, activeKitSection, clubProgramOrder, personClubShape, kitCalendarLink, kitSchedulesLink, kitOrgPlace, litClubPlace, clubPlaceGroups, type KitLink } from '@/lib/admin-kit-nav';
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
  const club = useClubBrief();
  const order = clubProgramOrder(personClubShape(club.shape, canUse));
  const programs = kitPrograms({ base, canUse, order: order.lead });
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

  const section = activeKitSection(pathname, base);
  // ⚖ 13i Session B: the club's places in their groups (Organization one place, its pages its tabs), built ONCE — the
  // sidebar and the More sheet read this list. None for a tournament-only organization (its flat Account list) or a
  // cancelled club. One club row is lit: the place you are in at any depth, none on Plan & billing's page (its foot row).
  const placeGroups = tournamentOnly || isCanceled ? [] : clubPlaceGroups<KitLink>({
    programs, alsoOnPlan, organization: kitOrgPlace({ base, orgLinks, tournamentOnly }),
  });
  const litPlace = litClubPlace(pathname, base, billingLink);
  const onTournaments = pathname.startsWith(`${base}/tournaments`);
  // The guide for where you are — the sidebar's foot and the phone's More sheet open the same one (N7: Help on every
  // sheet), in a new tab.
  const helpHref = onTournaments ? `${base}/help/tournaments`
    : section === 'house-league' ? `${base}/help/house-league`
    : section === 'rep-teams' ? `${base}/help/rep-teams`
    : section === 'accounting' ? `${base}/help/accounting`
    : section === 'org' ? `${base}/help/org`
    : `${base}/help`;

  return {
    pathname,
    orgSlug,
    base,
    helpHref,
    isSandbox,
    isCanceled,
    canUse,
    programs,
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
    schedulesLink,
    coachDoor,
    tournamentGroups,
    onTournaments,
  };
}
