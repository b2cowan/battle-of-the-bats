import { PLAN_CONFIG } from './plan-config';
import { freeFloorModules } from './free-floor';
import { isOrgBillingSuspended } from './org-billing-access';
import type { Capability } from './roles';
import type { Organization } from './types';

/**
 * Two-axis entitlement check for reserved modules.
 * Axis 1: is the cap in the org's base plan?
 * Axis 2: is the cap in the org's purchased add-ons?
 *
 * Usage in route handlers (both checks required for reserved modules):
 *   if (!hasCapability(ctx.role, ctx.capabilities, 'module_X')) return forbidden();
 *   if (!hasModuleEntitlement(ctx.org, 'module_X')) return forbidden();
 */
/**
 * The only fields entitlement answers actually depend on. Narrowed from `Organization` so a caller
 * holding a partial row — the Stage E.4 sitemap scan, which selects four columns for the whole
 * platform — can ask the question without inventing a full org object. Every existing caller
 * passing a complete `Organization` still satisfies this.
 */
export type EntitlementOrg = Pick<
  Organization,
  'planId' | 'subscriptionStatus' | 'enabledAddons' | 'freeFloor'
>;

export function hasModuleEntitlement(org: EntitlementOrg, cap: Capability): boolean {
  // ONE definition of "suspended", shared with the billing rail (lib/org-billing-access.ts).
  // This gate and the rail answer at different layers — the rail closes API routes, this also
  // drives client-side nav visibility, which the rail's throw never reaches — so both are needed.
  // But the PREDICATE must not be restated: if suspension ever grows a second condition, an
  // inline copy here would silently reopen exactly the gap the rail exists to close.
  if (isOrgBillingSuspended(org)) return false;

  const plan = PLAN_CONFIG[org.planId];
  if (plan.moduleEntitlements.includes(cap)) return true;
  // Free-floor profile (e.g. League Starter) grants module_house_league on top of the paid plan —
  // never module_public_site (the full org site stays a paid-League differentiator).
  if (freeFloorModules(org.freeFloor).includes(cap)) return true;
  return org.enabledAddons.includes(cap);
}

/**
 * What "is /{orgSlug} a real destination?" needs to know. Deliberately WIDER than
 * `EntitlementOrg`: the org's own "public page" switch is part of the answer (see below), but it
 * is NOT part of a module-entitlement question, so `hasModuleEntitlement` keeps the narrow shape
 * and its hundred-odd callers stay untouched.
 */
export type OrgHomeDestinationOrg = EntitlementOrg & Pick<Organization, 'isPublic'>;

/**
 * The ONE statement of "is /{orgSlug} a REAL destination?" (Nav Unification Stage B.2 —
 * binding rule). True when ALL of:
 *  • the org has its public page switched ON (`is_public`) — an admin-settings checkbox that
 *    `app/[orgSlug]/page.tsx` enforces with a 404; and
 *  • the org owns the public-site module (the page always renders) OR runs 2+ active tournaments
 *    (the page is a genuine event selector).
 * Otherwise the org page 404s, redirects straight into a lone event (a loop), or shows the
 * platform "hasn't set up their public site yet" placeholder — and nothing may link a visitor
 * there.
 *
 * The `isPublic` half moved INSIDE this predicate on 2026-08-01 (top-nav audit D1, owner ruling
 * R1). It had been re-stated by two of the three callers (sitemap + directory) and forgotten by
 * the third (the event chrome's org link), so an org with the toggle off served a 404 behind a
 * normal-looking crumb on every one of its event pages. Every present and future caller now
 * agrees by construction — which is what this function's name always claimed. Never re-state
 * either half at a call site.
 */
export function isOrgHomeRealDestination(org: OrgHomeDestinationOrg, activeTournamentCount: number): boolean {
  if (!org.isPublic) return false;
  return hasModuleEntitlement(org, 'module_public_site') || activeTournamentCount >= 2;
}

/**
 * The predicate ABOVE answers the question; this answers it *including fetching what it needs* —
 * returning the href to link, or null for "render no door".
 *
 * Why this exists as well: the rule has two halves, and the second half is "should the count query
 * run at all?". Every caller was hand-copying that half (skip the count when the org isn't public,
 * or when it owns the public-site module and the count therefore cannot change the answer) — which
 * is precisely the shape that produced finding D1 in the first place: two callers re-stating a rule
 * and a third forgetting it. Sharing only the boolean would have left that half unshared.
 *
 * Returns a PROMISE deliberately: the tournament layout — the highest-traffic public layout — kicks
 * this off at the top of its render and awaits it at the bottom, so the head-count overlaps the
 * banner/CTA queries instead of adding a serial round trip. Callers with nothing to overlap (the
 * coaches wall) just await it inline.
 */
export async function resolveOrgHomeHref(
  org: OrgHomeDestinationOrg & { id: string; slug: string },
): Promise<string | null> {
  // Both short-circuits below decide the answer WITHOUT the count, so no query is issued for them.
  if (!org.isPublic) return null;
  if (hasModuleEntitlement(org, 'module_public_site')) return `/${org.slug}`;
  const { countActiveTournamentsByOrg } = await import('./db');
  return isOrgHomeRealDestination(org, await countActiveTournamentsByOrg(org.id)) ? `/${org.slug}` : null;
}
