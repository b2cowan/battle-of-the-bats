import { supabaseAdmin } from './supabase-admin';
import type { Organization, SubscriptionStatus } from './types';

/**
 * Timed entitlement grants (H8 — Scenario B + A1).
 *
 * Grants live in `org_overrides` (extended in migration 109). They turn access on for a
 * window and **auto-revert at expiry** — revert is implicit: once a grant stops being
 * active, the effective entitlement falls back to the org's base plan/addons. No cron.
 *
 * This slice enforces two grant types:
 *   - `module_addon`        — union `target.addons` into the org's effective enabledAddons
 *   - `subscription_status` — force the org's effective subscriptionStatus for the window
 *
 * Deferred to a follow-up (needs an effective plan-rank threaded through hasPlanFeature):
 *   - `plan_tier`           — trial a higher tier's rank-gated features
 *   - `comp_period`         — billing-only; ignored for access (founding-season uses it)
 *
 * Enforcement is gated by the ENTITLEMENT_GRANTS_ENABLED env flag (default off) so this
 * can merge before the rollout is switched on.
 */

const GRANTS_ENABLED = process.env.ENTITLEMENT_GRANTS_ENABLED === 'true';

export type OverrideTarget = {
  addons?: string[];
  plan?: string;
  status?: string;
} | null;

export type ActiveOverrideRow = {
  type: string;
  value: string | null;
  target: OverrideTarget;
  starts_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

/** An override is active when it is not revoked, has started, and has not expired. */
export function isOverrideActive(
  row: Pick<ActiveOverrideRow, 'starts_at' | 'expires_at' | 'revoked_at'>,
  now: Date = new Date(),
): boolean {
  if (row.revoked_at) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.expires_at && new Date(row.expires_at) <= now) return false;
  return true;
}

type EffectiveInput = {
  subscriptionStatus: SubscriptionStatus;
  enabledAddons: string[];
};

/**
 * Pure: fold active overrides onto a base org's entitlements.
 * `overrides` should be ordered newest-first so the latest active status grant wins.
 */
export function computeEffectiveEntitlements(
  base: EffectiveInput,
  overrides: ActiveOverrideRow[],
  now: Date = new Date(),
): EffectiveInput {
  const active = overrides.filter(o => isOverrideActive(o, now));
  if (active.length === 0) return base;

  // module_addon grants → union into enabledAddons
  const addonSet = new Set(base.enabledAddons);
  for (const o of active) {
    if (o.type === 'module_addon' && o.target?.addons) {
      for (const addon of o.target.addons) addonSet.add(addon);
    }
  }

  // subscription_status grants → newest active wins (target.status, or legacy value column)
  let subscriptionStatus = base.subscriptionStatus;
  const statusGrant = active.find(o => o.type === 'subscription_status');
  if (statusGrant) {
    const next = statusGrant.target?.status ?? statusGrant.value;
    if (next === 'active' || next === 'trialing' || next === 'past_due' || next === 'canceled') {
      subscriptionStatus = next;
    }
  }

  return { subscriptionStatus, enabledAddons: [...addonSet] };
}

/**
 * Returns the org with active timed grants applied to its effective entitlements.
 * No-op (returns the same object) when the feature flag is off or the org has no grants.
 * Apply this wherever an Organization is built for entitlement gating.
 */
export async function applyEntitlementGrants(org: Organization): Promise<Organization> {
  if (!GRANTS_ENABLED) return org;

  const { data } = await supabaseAdmin
    .from('org_overrides')
    .select('type, value, target, starts_at, expires_at, revoked_at')
    .eq('org_id', org.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as ActiveOverrideRow[];
  if (rows.length === 0) return org;

  const effective = computeEffectiveEntitlements(
    { subscriptionStatus: org.subscriptionStatus, enabledAddons: org.enabledAddons },
    rows,
  );

  if (
    effective.subscriptionStatus === org.subscriptionStatus &&
    effective.enabledAddons.length === org.enabledAddons.length
  ) {
    return org;
  }

  return { ...org, subscriptionStatus: effective.subscriptionStatus, enabledAddons: effective.enabledAddons };
}
