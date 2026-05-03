import type { OrgPlan } from './types';

export interface PlanConfig {
  label: string;
  monthlyPrice: number;
  tournamentLimit: number;
  seatLimit: number;
  priceId?: string;
}

export const PLAN_CONFIG: Record<OrgPlan, PlanConfig> = {
  starter: {
    label: 'Starter',
    monthlyPrice: 0,
    tournamentLimit: 1,
    seatLimit: 1,
  },
  pro: {
    label: 'Pro',
    monthlyPrice: 29,
    tournamentLimit: 5,
    seatLimit: 5,
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  elite: {
    label: 'Elite',
    monthlyPrice: 79,
    tournamentLimit: 9999,
    seatLimit: 9999,
    priceId: process.env.STRIPE_PRICE_ELITE_MONTHLY,
  },
};
