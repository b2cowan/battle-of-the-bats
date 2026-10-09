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
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { isTournamentTier } from '@/lib/billing-urls';
import { useCurrentOrgCoachAccess, coachDoorFor } from '@/lib/use-current-org-coach-access';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { kitPrograms, kitOrgLinks, activeKitSection, clubProgramOrder, kitCalendarLink } from '@/lib/admin-kit-nav';
import { kitTournamentGroups } from './kit-tournament-groups';
import { useClubBrief } from './club/ClubBriefProvider';

export function useAdminKitNav() {
  const pathname = usePathname();
  const { currentOrg, userRole, userCapabilities, canOpen } = useOrg();
  const { currentTournament } = useTournament();
  const isSandbox = useIsSandbox();
  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug}/admin`;
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';

  // The role holds the capability AND the plan carries the module — `canOpen`, the ONE gate every
  // route asks (Club Stage 1, lib/member-access.ts), so the rail can never offer a door the server
  // refuses.
  const canUse = canOpen;

  // ⚖ The plan-aware order (Club Tier Stage 1): what the club RUNS leads, what the plan merely
  // carries is the quiet "Also on your plan" group. Read from the morning brief's `shape`, which the
  // hub reads too — so the rail, the phone bar and the hub list the programs in one order.
  const club = useClubBrief();
  const order = clubProgramOrder(club.shape);
  const programs = kitPrograms({ base, canUse, order: order.lead });
  const alsoOnPlan = kitPrograms({ base, canUse, order: order.also });
  // ⚖ D8 (Club Stage 1): "tournament-only" is a fact about the PLAN, never the person — the same
  // helper the hub, today's sidebar and the post-login resolver call, so a club's staff member is
  // not tournament-only here while being a club member there.
  const tournamentOnly = canUse('module_tournaments') && !!currentOrg && isTournamentOnlyWorkspace(currentOrg);
  const canSeeMembers = Boolean(userRole)
    && (userRole === 'owner' || hasCapability(userRole!, userCapabilities, 'module_members'))
    && canUse('module_members');
  // ⚠ A Tournament-plan organization has NO /admin/org at all (its layout redirects every page of
  // it), so it gets no Organization rows — today's rail hides that section for it too.
  const orgLinks = isTournamentTier(currentOrg?.planId) ? [] : kitOrgLinks({
    base,
    role: userRole,
    isCanceled,
    canSeeMembers,
    hasVenueLibrary: hasOrgVenueLibrary(currentOrg?.planId),
  });
  // The club calendar (Club Tier 6b): under Overview in the rail, the More sheet's first row — one gate for both.
  const calendarLink = kitCalendarLink({ base, canUse, isCanceled, tournamentTier: isTournamentTier(currentOrg?.planId) });
  // The person's own Coaches Portal door — the rail's foot and the More sheet's "You" both show it.
  const coachDoor = coachDoorFor(useCurrentOrgCoachAccess(currentOrg?.slug, !isCanceled), currentOrg?.slug);

  return {
    pathname,
    orgSlug,
    base,
    isCanceled,
    canUse,
    programs,
    alsoOnPlan,
    brief: club.brief,
    tournamentOnly,
    orgLinks,
    calendarLink,
    coachDoor,
    tournamentGroups: kitTournamentGroups({ status: currentTournament?.status, isSandbox, role: userRole }),
    section: activeKitSection(pathname, base),
    onTournaments: pathname.startsWith(`${base}/tournaments`),
  };
}
