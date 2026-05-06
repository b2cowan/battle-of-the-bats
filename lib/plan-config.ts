import type { OrgPlan } from './types';

export interface PlanConfig {
  label: string;
  monthlyPrice: number;
  // Max number of simultaneously ACTIVE tournaments. Completed/archived do not count.
  tournamentLimit: number;
  seatLimit: number;
  // When true, officials are excluded from the seat count and have no seat cap.
  officialsFreeSeats: boolean;
  priceId?: string;
}

export const PLAN_CONFIG: Record<OrgPlan, PlanConfig> = {
  starter: {
    label: 'Starter',
    monthlyPrice: 0,
    tournamentLimit: 1,
    seatLimit: 1,
    officialsFreeSeats: false,
  },
  pro: {
    label: 'Pro',
    monthlyPrice: 39,
    tournamentLimit: 2,
    seatLimit: 5,
    officialsFreeSeats: true,
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  elite: {
    label: 'Elite',
    monthlyPrice: 99,
    tournamentLimit: 9999,
    seatLimit: 9999,
    officialsFreeSeats: true,
    priceId: process.env.STRIPE_PRICE_ELITE_MONTHLY,
  },
};
