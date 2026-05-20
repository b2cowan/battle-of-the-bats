import type { OrgPlan } from './types';
import type { Capability } from './roles';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanConfig {
  label: string;
  monthlyPrice: number;
  annualPrice: number;
  // Max number of non-archived tournaments. Draft, active, and completed count.
  tournamentLimit: number;
  seatLimit: number;
  // When true, officials are excluded from the seat count and have no seat cap.
  officialsFreeSeats: boolean;
  // Trial length for paid subscriptions created through Stripe Checkout.
  trialDays: number;
  // Modules unlocked by this plan. All modules listed here are available without
  // a separate enabledAddons entry — entitlement is derived from plan tier alone.
  moduleEntitlements: Capability[];
  // 'early_access': plan is not open for self-serve checkout; shows early-access CTA.
  // 'live': plan is available for checkout.
  // To activate a plan, change this to 'live' — no other changes required.
  gatingStatus: 'live' | 'early_access';
}

const CORE_MODULES: Capability[] = [
  'module_tournaments',
  'module_communications',
  'module_members',
];

export const PLAN_CONFIG: Record<OrgPlan, PlanConfig> = {
  tournament: {
    label: 'Tournament',
    monthlyPrice: 0,
    annualPrice: 0,
    tournamentLimit: 1,
    seatLimit: 3,
    officialsFreeSeats: false,
    trialDays: 0,
    moduleEntitlements: CORE_MODULES,
    gatingStatus: 'live',
  },
  tournament_plus: {
    label: 'Tournament Plus',
    monthlyPrice: 39,
    annualPrice: 390,
    tournamentLimit: 3,
    seatLimit: 5,
    officialsFreeSeats: true,
    trialDays: 14,
    moduleEntitlements: CORE_MODULES,
    gatingStatus: 'live',
  },
  league: {
    label: 'League',
    monthlyPrice: 89,
    annualPrice: 890,
    tournamentLimit: 9999,
    seatLimit: 10,
    officialsFreeSeats: true,
    trialDays: 30,
    moduleEntitlements: [
      ...CORE_MODULES,
      'module_public_site',
      'module_house_league',
    ],
    gatingStatus: 'early_access',
  },
  club: {
    label: 'Club',
    monthlyPrice: 179,
    annualPrice: 1790,
    tournamentLimit: 9999,
    seatLimit: 9999,
    officialsFreeSeats: true,
    trialDays: 90,
    moduleEntitlements: [
      ...CORE_MODULES,
      'module_public_site',
      'module_house_league',
      'module_accounting',
      'module_rep_teams',
    ],
    gatingStatus: 'early_access',
  },
};

/**
 * Returns true when a plan's checkout should be blocked and an early-access CTA
 * shown instead. Respects NEXT_PUBLIC_PLAN_GATES:
 *   'live'     — all plans treated as live (use in .env.local to test checkout)
 *   'enforced' / absent — plan gatingStatus is authoritative
 */
export function isEffectivelyGated(planKey: OrgPlan): boolean {
  if (process.env.NEXT_PUBLIC_PLAN_GATES === 'live') return false;
  return PLAN_CONFIG[planKey]?.gatingStatus === 'early_access';
}

export function getEffectiveTournamentLimit(
  planId: OrgPlan,
  storedLimit?: number | null
): number {
  const configuredLimit = PLAN_CONFIG[planId]?.tournamentLimit ?? 1;

  if (configuredLimit < 9999) {
    return Math.min(storedLimit ?? configuredLimit, configuredLimit);
  }

  return storedLimit ?? configuredLimit;
}

export function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === 'annual' ? 'annual' : 'monthly';
}

