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
import { hasCapability, type Capability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { isTournamentTier } from '@/lib/billing-urls';
import { useCurrentOrgCoachAccess, coachDoorFor } from '@/lib/use-current-org-coach-access';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { kitPrograms, kitOrgLinks, activeKitSection } from '@/lib/admin-kit-nav';
import { kitTournamentGroups } from './kit-tournament-groups';

export function useAdminKitNav() {
  const pathname = usePathname();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { currentTournament } = useTournament();
  const isSandbox = useIsSandbox();
  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug}/admin`;
  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';

  // Today's rail's `canUseModule`, verbatim: the role holds the capability AND the plan carries the
  // module. (Club Stage 1 names this pair `canOpenModule`; the kit moves onto it when that lands.)
  const canUse = (capability: Capability): boolean => Boolean(
    currentOrg && userRole
      && hasCapability(userRole, userCapabilities ?? null, capability)
      && hasModuleEntitlement(currentOrg, capability),
  );

  const programs = kitPrograms({ base, canUse });
  // Today's rail's `hasOnlyTournamentWorkspace`, verbatim: someone whose whole admin is tournaments.
  // ⚠ Club Stage 1 (ruling D8) moves the rail's copy onto the PLAN (`isTournamentOnlyWorkspace`) —
  // this line must move with it in that commit, or a club's staff member reads as tournament-only
  // here and not there.
  const tournamentOnly = canUse('module_tournaments') && !canUse('module_public_site')
    && !canUse('module_accounting') && !canUse('module_house_league') && !canUse('module_rep_teams');
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
  // The person's own Coaches Portal door — the rail's foot and the More sheet's "You" both show it.
  const coachDoor = coachDoorFor(useCurrentOrgCoachAccess(currentOrg?.slug, !isCanceled), currentOrg?.slug);

  return {
    pathname,
    orgSlug,
    base,
    isCanceled,
    canUse,
    programs,
    tournamentOnly,
    orgLinks,
    coachDoor,
    tournamentGroups: kitTournamentGroups({ status: currentTournament?.status, isSandbox, role: userRole }),
    section: activeKitSection(pathname, base),
    onTournaments: pathname.startsWith(`${base}/tournaments`),
  };
}
