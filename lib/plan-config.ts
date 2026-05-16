import type { OrgPlan } from './types';
import type { Capability } from './roles';

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
  priceId?: string;
  // Modules unlocked by this plan. All modules listed here are available without
  // a separate enabledAddons entry — entitlement is derived from plan tier alone.
  moduleEntitlements: Capability[];
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
  },
  tournament_plus: {
    label: 'Tournament Plus',
    monthlyPrice: 39,
    annualPrice: 390,
    tournamentLimit: 3,
    seatLimit: 5,
    officialsFreeSeats: true,
    trialDays: 14,
    priceId: process.env.STRIPE_PRICE_TOURNAMENT_PLUS_MONTHLY,
    moduleEntitlements: CORE_MODULES,
  },
  league: {
    label: 'League',
    monthlyPrice: 89,
    annualPrice: 890,
    tournamentLimit: 9999,
    seatLimit: 10,
    officialsFreeSeats: true,
    trialDays: 30,
    priceId: process.env.STRIPE_PRICE_LEAGUE_MONTHLY,
    moduleEntitlements: [
      ...CORE_MODULES,
      'module_public_site',
      'module_house_league',
    ],
  },
  club: {
    label: 'Club',
    monthlyPrice: 179,
    annualPrice: 1790,
    tournamentLimit: 9999,
    seatLimit: 9999,
    officialsFreeSeats: true,
    trialDays: 90,
    priceId: process.env.STRIPE_PRICE_CLUB_MONTHLY,
    moduleEntitlements: [
      ...CORE_MODULES,
      'module_public_site',
      'module_house_league',
      'module_accounting',
      'module_rep_teams',
    ],
  },
};

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
