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
  team: {
    label: 'Coaches Portal',
    monthlyPrice: 29,
    annualPrice: 290,
    tournamentLimit: 1,
    seatLimit: 3,
    officialsFreeSeats: false,
    trialDays: 0,
    // Team gets free-tier tournament tooling. Rep-team access is intentionally
    // team-scoped through team_entitlements, not org-wide module_rep_teams.
    moduleEntitlements: CORE_MODULES,
    gatingStatus: 'early_access',
  },
  tournament_plus: {
    label: 'Tournament Plus',
    monthlyPrice: 39,
    annualPrice: 390,
    tournamentLimit: 9999,
    seatLimit: 9999,
    officialsFreeSeats: true,
    trialDays: 14,
    moduleEntitlements: CORE_MODULES,
    gatingStatus: 'live',
  },
  league: {
    label: 'League Plus',
    monthlyPrice: 89,
    annualPrice: 890,
    tournamentLimit: 9999,
    seatLimit: 9999,
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

// ─── Founding season campaign ─────────────────────────────────────────────────

/**
 * ISO end timestamp for the founding-season free Tournament Plus promotion.
 * Overridable via the NEXT_PUBLIC_FOUNDING_SEASON_END env var (set in Amplify) so the
 * date can change without a code PR. A platform-admin-editable setting is the eventual home.
 */
export const FOUNDING_SEASON_END =
  process.env.NEXT_PUBLIC_FOUNDING_SEASON_END ?? '2027-01-01T00:00:00.000Z';
const FOUNDING_SEASON_END_MS = new Date(FOUNDING_SEASON_END).getTime();

/** Returns true while the global founding-season promotion is still active. */
export function isFoundingSeasonActive(): boolean {
  return Date.now() < FOUNDING_SEASON_END_MS;
}

// ─── Price display helpers ────────────────────────────────────────────────────

function commaSeparate(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a price amount as a dollar string. Returns "Free" for 0.
 * Use this everywhere a plan price is displayed — never hardcode dollar amounts.
 * Examples: formatPriceAmount(39) → "$39",  formatPriceAmount(1790) → "$1,790"
 */
export function formatPriceAmount(amount: number): string {
  if (amount === 0) return 'Free';
  return `$${commaSeparate(amount)}`;
}

/**
 * Returns the annual savings label for a plan, e.g. "Save $78 — 2 months free".
 * Returns null for free plans or when savings ≤ 0.
 */
export function formatAnnualSavings(planKey: OrgPlan): string | null {
  const plan = PLAN_CONFIG[planKey];
  if (plan.monthlyPrice === 0) return null;
  const savings = plan.monthlyPrice * 12 - plan.annualPrice;
  if (savings <= 0) return null;
  return `Save $${commaSeparate(savings)} — 2 months free`;
}

