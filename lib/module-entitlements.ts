import { PLAN_CONFIG } from './plan-config';
import { freeFloorModules } from './free-floor';
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
export function hasModuleEntitlement(org: Organization, cap: Capability): boolean {
  if (org.subscriptionStatus === 'canceled') return false;

  const plan = PLAN_CONFIG[org.planId];
  if (plan.moduleEntitlements.includes(cap)) return true;
  // Free-floor profile (e.g. League Starter) grants module_house_league on top of the paid plan —
  // never module_public_site (the full org site stays a paid-League differentiator).
  if (freeFloorModules(org.freeFloor).includes(cap)) return true;
  return org.enabledAddons.includes(cap);
}
