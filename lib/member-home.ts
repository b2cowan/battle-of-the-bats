import { isFreeFloorLeague } from './free-floor';
import { planCarriesModule, type EntitlementOrg } from './module-entitlements';
import { NOT_YOURS_PAGES, type NotYoursPage } from './not-yours-words';
import { canOpenModule } from './member-access';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import type { OrgRole } from './types';
import { volunteerHome } from './volunteer-jobs';

/**
 * WHERE A CLUB MEMBER'S HOME IS — the one rule (Club Tier Stage 13a, A1). Sign-in lands a person here
 * (`getDestinationForMembership`, lib/user-contexts.ts) and the "not yours" screen's door goes back here, so the two can
 * never disagree: "Back to Accounting" for the treasurer, "Back to House league" for the league admin and the registrar.
 * ⚠ Two known gaps: sign-in keeps its own copy of the free League Starter branch (lib/user-contexts.ts, and the onboarding
 * page), which also sends the OWNER to the league while this door sends the owner to the Overview; and the door skips a
 * home that is the very page just refused (a treasurer whose Accounting was switched off goes to the Overview, not to a
 * button that opens the same refusal). Recorded for the owner.
 *
 * Client-safe. The sign-in resolver keeps its own branches BEFORE this one (a volunteer's job, a team workspace, a
 * tournament-only workspace, the owner's setup checklist); a person reading the club's admin screens is past all of them.
 */

type Home = { href: string; label: string };
/** A program home also says which "not yours" page it is, so the door can tell when it would open the refused page. */
type ProgramHome = Home & { page: 'accounting' | 'houseLeague' };

/** A role that runs ONE program starts in it (Stage 1 specimen 6, J10-011), when the plan carries it; else null. */
function programHome(slug: string, role: OrgRole | string | null, org: EntitlementOrg): ProgramHome | null {
  if (role === 'treasurer' && planCarriesModule(org, 'module_accounting')) {
    return { href: `/${slug}/admin/accounting`, label: NOT_YOURS_PAGES.accounting.title, page: 'accounting' };
  }
  if ((role === 'league_admin' || role === 'league_registrar') && planCarriesModule(org, 'module_house_league')) {
    return { href: `/${slug}/admin/house-league`, label: NOT_YOURS_PAGES.houseLeague.title, page: 'houseLeague' };
  }
  return null;
}

/** The address of that program home (sign-in lands there); null when the role has none. */
export function programHomePath(slug: string, role: OrgRole | string | null, org: EntitlementOrg): string | null {
  return programHome(slug, role, org)?.href ?? null;
}

/**
 * The door home on the "not yours" screen: where it goes and what it says. `refused` is the page being refused: a home
 * that would open that same page (a role's program whose access was switched off) is skipped for the Overview, which
 * every member can open.
 */
export function memberHome(slug: string, role: OrgRole | string | null, org: EntitlementOrg, refused?: NotYoursPage): Home {
  // The free League Starter floor sends its house-league operator to the league, as sign-in does.
  const home: ProgramHome | null = isFreeFloorLeague(org) && role !== 'owner'
    ? { href: `/${slug}/admin/house-league`, label: NOT_YOURS_PAGES.houseLeague.title, page: 'houseLeague' }
    : programHome(slug, role, org);
  if (!home || home.page === refused) return { href: `/${slug}/admin`, label: 'Overview' };
  return { href: home.href, label: home.label };
}

/**
 * THE COACHES PORTAL'S WAY BACK TO THE CLUB ADMIN (Club Tier Stage 13, F-XR-2) — decided by the admin's own admission rule,
 * not a second role list. `/{org}/admin` admits every accepted member except a volunteer (`official`), whom its layout sends
 * to their job (`volunteerHome`, the rule `app/[orgSlug]/admin/layout.tsx` asks first). So the door is offered to everyone
 * the admin admits, and it lands on THAT person's home (`memberHome`: the treasurer's Accounting, the league admin's and
 * registrar's House league, everyone else's Overview), never the owner's.
 *
 * Two deliberate narrowings (owner, 2026-11-07): a team workspace has no club admin to go back to, and a member whose only
 * club role is `coach` is admitted but sees an empty Overview, so a door there would be a dead end.
 * Null = no door. Client-safe; the sidebar and the phone More sheet both read it.
 */
export function adminDoorHome(
  slug: string,
  role: OrgRole | string | null | undefined,
  org: (EntitlementOrg & { accountKind?: string | null }) | null | undefined,
  capabilities?: Record<string, boolean> | null,
): Home | null {
  if (!role || !org || !slug) return null;
  if (isTeamWorkspaceOrg(org)) return null;
  if (volunteerHome(slug, role, null) !== null) return null;
  if (role === 'coach') return null;
  const home = memberHome(slug, role, org);
  // A program home the PERSON cannot open (the owner switched it off for them on Members) would answer with the "not yours"
  // screen, so the door takes them to the Overview instead — the gate every program screen asks (`canOpenModule`).
  const module = home.href.endsWith('/admin/accounting') ? 'module_accounting'
    : home.href.endsWith('/admin/house-league') ? 'module_house_league' : null;
  if (module && !canOpenModule({ role: role as OrgRole, capabilities: capabilities ?? null }, org, module)) {
    return { href: `/${slug}/admin`, label: 'Overview' };
  }
  return home;
}
