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
import { kitPrograms, kitOrgLinks, kitBillingLink, activeKitSection, clubProgramOrder, kitCalendarLink, kitSchedulesLink } from '@/lib/admin-kit-nav';
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
  // The club calendar (Club Tier 6b): under Overview in the rail, the More sheet's first row — one gate for both.
  const calendarLink = kitCalendarLink({ base, canUse, isCanceled, tournamentTier: isTournamentTier(currentOrg?.planId) });
  // The club scheduler (Club Tier 11a): directly under Calendar in both navs — one gate for both.
  const schedulesLink = kitSchedulesLink({
    base, canUse, isCanceled, role: userRole, planId: currentOrg?.planId,
  });
  const billingLink = kitBillingLink({ orgSlug, planId: currentOrg?.planId, accountKind: currentOrg?.accountKind, role: userRole, capabilities: userCapabilities, isSandbox });
  // The person's own Coaches Portal door — the rail's foot and the More sheet's "You" both show it.
  const coachDoor = coachDoorFor(useCurrentOrgCoachAccess(currentOrg?.slug, !isCanceled), currentOrg?.slug,
    isStandaloneCoachOwner(currentOrg, userRole, userCapabilities));
  // The tournament's groups as this person sees them, every row's address resolved ONCE: an event page, or a door outside
  // the event (Accounting, the club's book read for this event — the lone row's gate and address, kept).
  const tournamentGroups = kitTournamentGroups({
    status: currentTournament?.status, isSandbox, role: userRole, planId: currentOrg?.planId,
    accountingHref: canUse('module_accounting')
      ? (currentTournament ? `${base}/accounting?tournamentId=${currentTournament.id}` : `${base}/accounting`)
      : null,
  }).map(g => ({ ...g, items: g.items.map(i => ({ ...i, href: i.href ?? `${base}/tournaments/${i.key}` })) }));
  // Is the Public site program a row this nav draws (a club, not cancelled)? Then a separate door to the live site would be
  // the same idea twice (N4: "Public site" once per screen). The sidebar's foot and the phone's More both read this.
  const siteInNav = !tournamentOnly && !isCanceled && [...programs, ...alsoOnPlan].some(p => p.key === 'public-site');

  const section = activeKitSection(pathname, base);
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
    orgLinks,
    billingLink,
    calendarLink,
    schedulesLink,
    coachDoor,
    tournamentGroups,
    siteInNav,
    section,
    onTournaments,
  };
}
