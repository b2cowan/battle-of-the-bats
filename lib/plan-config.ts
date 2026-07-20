import type { OrgPlan } from './types';
import type { Capability } from './roles';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanConfig {
  label: string;
  monthlyPrice: number;
  annualPrice: number;
  // Max number of non-archived tournaments. Draft, active, and completed count.
  tournamentLimit: number;
  // Max number of non-archived rep teams an org may run (the Club capacity band).
  // 9999 = effectively unlimited / not capped by this mechanism. Only enforced for
  // plans that include module_rep_teams (Club bands). Per-org overrides live on
  // organizations.team_limit (mirrors tournament_limit) — see getEffectiveTeamLimit.
  teamLimit: number;
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
    teamLimit: 9999,
    seatLimit: 3,
    // Officials/scorekeepers (the score-entry-only 'official' role) are exempt from the
    // free-tier seat count — ratified 2026-06-22 (BUSINESS_DECISIONS.md). The 3-seat cap
    // applies to admin/staff only; multi-field events shouldn't be taxed for scorekeepers.
    officialsFreeSeats: true,
    trialDays: 0,
    moduleEntitlements: CORE_MODULES,
    gatingStatus: 'live',
  },
  team: {
    label: 'Coaches Portal',
    monthlyPrice: 29,
    annualPrice: 290,
    tournamentLimit: 1,
    teamLimit: 9999,
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
    teamLimit: 9999,
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
    teamLimit: 9999,
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
    // Repriced 2026-06-22 (Club Repackaging): $179→$219 / $1,790→$2,190. Lower capacity band.
    monthlyPrice: 219,
    annualPrice: 2190,
    tournamentLimit: 9999,
    // Lower band: up to 15 teams (all team types count equally). Whole coaching staff
    // included up to this cap — the old "$19/team beyond 3" meter is retired.
    teamLimit: 15,
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
  club_large: {
    // Upper Club capacity band — public name "Club · Association" (working name pending
    // final /marketing sign-off). Internal key is club_large; never surface "Club Large"
    // in customer copy. Identical modules to club; differs only by teamLimit + price.
    // Above 30 teams = custom quote (platform-admin sets organizations.team_limit).
    label: 'Club · Association',
    monthlyPrice: 379,
    annualPrice: 3790,
    tournamentLimit: 9999,
    teamLimit: 30,
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

/**
 * Effective rep-team cap for an org. The per-org `organizations.team_limit` override
 * (when set) WINS outright — it exists to RAISE the band for "custom above 30" Club ·
 * Association deals (platform-admin sets e.g. 40). This differs intentionally from
 * getEffectiveTournamentLimit, where the stored value only narrows a finite plan cap.
 * A null/undefined stored limit falls back to the plan band default (club=15, club_large=30,
 * others=9999 ≈ unlimited). 9999 is treated as "uncapped".
 */
export function getEffectiveTeamLimit(
  planId: OrgPlan,
  storedLimit?: number | null
): number {
  const planDefault = PLAN_CONFIG[planId]?.teamLimit ?? 9999;
  // The per-org override only RAISES the band (for "custom above 30" deals) — it never
  // lowers a club below the capacity it pays for. A stored value below the plan default
  // (e.g. an operator typo) is ignored.
  if (storedLimit != null && storedLimit > 0) return Math.max(storedLimit, planDefault);
  return planDefault;
}

export function normalizeBillingCycle(value: unknown): BillingCycle {
  return value === 'annual' ? 'annual' : 'monthly';
}

// ─── Founding season campaign ─────────────────────────────────────────────────

/**
 * ISO end timestamp for the founding-season free Tournament Plus promotion.
 * Overridable via the NEXT_PUBLIC_FOUNDING_SEASON_END env var (set in Amplify) so the
 * date can change without a code PR. A platform-admin-editable setting is the eventual home.
 *
 * ⚠ Operational caveat (2026-07-20): comp_period rows are WRITTEN with this value at
 * signup/org-create, and the founding-season status + email-audience queries MATCH on it.
 * Changing the override mid-promotion therefore silently drops rows written under the old
 * date from founding-season recognition and marketing audiences — if the date ever moves,
 * backfill existing comp_period.expires_at rows in the same change.
 */
export const FOUNDING_SEASON_END =
  process.env.NEXT_PUBLIC_FOUNDING_SEASON_END ?? '2027-01-01T00:00:00.000Z';
const FOUNDING_SEASON_END_MS = new Date(FOUNDING_SEASON_END).getTime();

/** Returns true while the global founding-season promotion is still active. */
export function isFoundingSeasonActive(): boolean {
  return Date.now() < FOUNDING_SEASON_END_MS;
}

/**
 * True when a comp_period override expiry marks a founding-season comp.
 * Compares the calendar date only: Postgres timestamptz formatting
 * ('2027-01-01 00:00:00+00') differs from the ISO constant, so full-string
 * equality would silently fail. Lives here so that fragility is documented
 * once, next to the constant it guards.
 */
export function isFoundingSeasonCompExpiry(expiresAt: string): boolean {
  return expiresAt.startsWith(FOUNDING_SEASON_END.slice(0, 10));
}

/**
 * Plans that participate in the Founding Season $0 promo (BUSINESS_DECISIONS 2026-07-20 D1):
 * Tournament Plus and the Premium Coaches Portal. The promo is a discount, not a repricing — the
 * list price stays the visible anchor.
 */
const FOUNDING_SEASON_PLAN_KEYS: readonly OrgPlan[] = ['tournament_plus', 'team'];

/**
 * True when `planKey` is on the Founding Season promo AND the promo window is still open. Replaces
 * the scattered `planKey === 'tournament_plus' && isFoundingSeasonActive()` checks so the promo
 * uniformly covers the Premium Coaches Portal (`team`) too.
 */
export function isFoundingSeasonPromoActive(planKey: string): boolean {
  return isFoundingSeasonActive() && (FOUNDING_SEASON_PLAN_KEYS as readonly string[]).includes(planKey);
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

