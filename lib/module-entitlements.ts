import { PLAN_CONFIG } from './plan-config';
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
  const plan = PLAN_CONFIG[org.planId];
  if (plan.moduleEntitlements.includes(cap)) return true;
  return org.enabledAddons.includes(cap);
}
