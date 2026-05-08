import type { OrgPlan } from './types';
import type { Capability } from './roles';

export interface PlanConfig {
  label: string;
  monthlyPrice: number;
  // Max number of simultaneously ACTIVE tournaments. Completed/archived do not count.
  tournamentLimit: number;
  seatLimit: number;
  // When true, officials are excluded from the seat count and have no seat cap.
  officialsFreeSeats: boolean;
  priceId?: string;
  // Modules included in this plan. Reserved add-on modules are not listed here;
  // they require an entry in org.enabledAddons (see lib/module-entitlements.ts).
  moduleEntitlements: Capability[];
}

const CORE_MODULES: Capability[] = [
  'module_tournaments',
  'module_communications',
  'module_members',
];

export const PLAN_CONFIG: Record<OrgPlan, PlanConfig> = {
  starter: {
    label: 'Starter',
    monthlyPrice: 0,
    tournamentLimit: 1,
    seatLimit: 1,
    officialsFreeSeats: false,
    moduleEntitlements: CORE_MODULES,
  },
  pro: {
    label: 'Pro',
    monthlyPrice: 39,
    tournamentLimit: 2,
    seatLimit: 5,
    officialsFreeSeats: true,
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    moduleEntitlements: CORE_MODULES,
  },
  elite: {
    label: 'Elite',
    monthlyPrice: 99,
    tournamentLimit: 9999,
    seatLimit: 9999,
    officialsFreeSeats: true,
    priceId: process.env.STRIPE_PRICE_ELITE_MONTHLY,
    moduleEntitlements: CORE_MODULES,
  },
};
