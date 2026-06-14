import { getOrganizationBySlug } from './db';
import { hasModuleEntitlement } from './module-entitlements';
import type { Organization } from './types';

/**
 * The single gate for every PUBLIC house-league surface — the league index, all of
 * its sub-pages (season / schedule / standings / register / status), and the public
 * register + status-lookup APIs.
 *
 * Mirrors the league index's own check: the org must exist, be public, not be
 * canceled, and carry the house-league module. Returns the org, or null when any
 * gate fails — page callers `notFound()`, API callers return a 404. Centralizing it
 * here is the fix for audit J3-068, where the sub-pages and register API only checked
 * that the org+season existed, leaking a private/canceled org's league data by direct
 * URL and accepting registrations to downgraded orgs.
 */
export async function resolvePublicLeagueContext(orgSlug: string): Promise<Organization | null> {
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !org.isPublic) return null;
  if (org.subscriptionStatus === 'canceled') return null;
  if (!hasModuleEntitlement(org, 'module_house_league')) return null;
  return org;
}
