import { isFreeFloorLeague } from './free-floor';
import { planCarriesModule, type EntitlementOrg } from './module-entitlements';
import { NOT_YOURS_PAGES, type NotYoursPage } from './not-yours-words';
import type { OrgRole } from './types';

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
