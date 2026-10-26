import type { OrgPlan } from './types';
import type { Capability } from './roles';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanConfig {
  label: string;
  monthlyPrice: number;
  annualPrice: number;
  // Max number of tournaments held at once: Draft and Active events only — a finished (Completed) one holds no
  // slot (one at a time, A23, 2026-10-10; the rule's one home is lib/tournament-slot.ts). 9999 = unlimited.
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
    label: 'Premium Coaches Portal',
    monthlyPrice: 29,
    annualPrice: 290,
    tournamentLimit: 1,
    teamLimit: 9999,
    seatLimit: 3,
    // Extended to the portal 2026-08-10 (BUSINESS_DECISIONS.md) — parity with every other
    // tier; a standalone coach's tournament volunteers must not consume the 3 seats.
    officialsFreeSeats: true,
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
      // Families (mig 251/252): League is first-class — a household spanning house
      // league and a rep team is the area's whole premise (owner decision 2026-08-17).
      'module_families',
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
      'module_families',
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
      'module_families',
    ],
    gatingStatus: 'early_access',
  },
};

/**
 * The Club trial sentence — ONE sentence, verbatim, on the Club pricing card, the billing page and
 * checkout (BUSINESS_DECISIONS.md 2026-09-25, "The 90-day Club trial collects a card at checkout";
 * canon in PRICING_PAGE_COPY.md). Never reword it per surface: the defect it replaced was a pricing
 * card promising "No credit card required" while checkout asked for one.
 *
 * Pass the trial length checkout will actually use where you have it (`getPlanConfigOverride()`
 * — a platform admin can override `trial_days`); the default is the code value the public pricing
 * card reads. Show it only where a trial applies: a paying org moving to Club gets no second trial.
 * No "free" in it — Club carries no "free until" framing (2026-09-25, Club has no Founding offer).
 */
export function clubTrialLine(trialDays: number = PLAN_CONFIG.club.trialDays): string {
  return `${trialDays}-day trial — you add a card at checkout, and you're first charged when the trial ends.`;
}

/**
 * What a customer reads about a plan that is NOT open for sign-up — one tag and one sentence per plan,
 * on every surface (BUSINESS_DECISIONS.md 2026-09-28; canon in PRICING_PAGE_COPY.md). League Plus is
 * parked, so it carries no imminence: "Not open yet". Any other closed plan (Club is the one with a
 * release under way) keeps a date-free "Coming soon". Never "early access" — that programme was
 * withdrawn 2026-07-28. Show these only when the LIVE gate says the plan is closed
 * (`getPlanGatingMap()` on the server, `usePlanGating()` on the client) — never on a typed assumption.
 */
export function gatedPlanTag(planKey: OrgPlan): string {
  return planKey === 'league' ? 'Not open yet' : 'Coming soon';
}

/** The full sentence (a panel's closing line, a page's note). */
export function gatedPlanSentence(planKey: OrgPlan): string {
  return planKey === 'league'
    ? 'League Plus is built, but not open for sign-up.'
    : `${PLAN_CONFIG[planKey].label} is coming soon — it isn't open for sign-up yet.`;
}

/** The short line under a closed plan card's button. */
export function gatedPlanNote(planKey: OrgPlan): string {
  return planKey === 'league' ? 'Built, but not open for sign-up.' : 'Not open for sign-up yet.';
}

/** The line that replaces "Join early access for launch updates" beside an interest door. */
export const GATED_PLAN_INTEREST_LINE = "Tell us you're interested and we'll let you know when it opens.";

/**
 * The one sentence naming the closed programme plans together, read from the live gate: "Club is coming
 * soon, and League Plus is built but not open for sign-up." — or whichever half is still true, or `null`
 * when both are open (the sentence then disappears rather than going stale).
 */
export function closedProgramPlansSentence(gating: Partial<Record<OrgPlan, boolean>>): string | null {
  const parts = [
    gating.club && 'Club is coming soon',
    gating.league && 'League Plus is built but not open for sign-up',
  ].filter(Boolean) as string[];
  return parts.length ? `${parts.join(', and ')}.` : null;
}

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

/**
 * True for the free entry tier ('tournament'). The free/paid split drives public-presentation
 * rules — the free tier carries the Powered-by badge + acquisition banner, paid tiers carry the
 * quiet "Built on FieldLogicHQ" credit instead (BUSINESS_DECISIONS 2026-07-30). Both the
 * tournament layout and the org home page asked this question with their own raw string compare
 * against 'tournament'; two copies of one rule is one copy too many when they must agree about
 * which surfaces get which treatment.
 */
export function isFreePlan(planId: string | null | undefined): boolean {
  if (!planId || planId === 'tournament') return true;
  // Anything we don't recognise is treated as FREE, deliberately. `organizations.plan_id` has a
  // documented legacy value ('starter') that is not an OrgPlan key, and a null/absent id is
  // possible on old rows — an unknown plan must not be able to buy paid-tier presentation by
  // accident. The free branch is also the safe one to be wrong on: it shows the existing
  // acquisition badge rather than silently granting a paid-tier treatment.
  return !(planId in PLAN_CONFIG);
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
//
// TWO dates, separate for the first time (BUSINESS_DECISIONS 2026-09-07 — "Founding Season 2027"):
//
//   • FOUNDING_SEASON_SIGNUP_CLOSE — the last instant an account can JOIN the Founding Season
//     ("sign up by December 31, 2026"). Every OFFER surface (site bar, homepage panel, persona-page
//     copy, pricing strip, chooser tags) and every COMP-GRANTING path keys off this one, through
//     isFoundingSeasonSignupOpen() / isFoundingSeasonPromoActive(). On the day it passes the offer
//     surfaces vanish and the list price shows — there is no second promotion.
//   • FOUNDING_SEASON_END — the last instant the comp RUNS ("free through September 30, 2027").
//     Billing-state surfaces (the org billing banner, the card-saved note) and the comp rows key off
//     this one, through isFoundingSeasonActive().
//
// Before 2026-09-07 these were the same instant (2027-01-01), which is why one helper served both
// jobs. Reading the wrong one now is the drift to guard against: an offer surface on the END date
// would keep advertising a closed offer for nine months; a comp path on the END date would keep
// granting free seasons after the window shut.
//
// Both are ISO instants pinned to the END of the named day in Eastern time (the customer sentence
// never states a clock): 2026-12-31 23:59:59 EST = 2027-01-01T05:00Z; 2027-09-30 23:59:59 EDT =
// 2027-10-01T04:00Z. The customer-facing LABELS below are derived from the instants in
// America/Toronto, so the wording can never drift from the date it describes — pinned by
// tests/unit/founding-season-dates.test.ts.
//
// Each is overridable via an env var (set in Amplify) so a date can move without a code PR.
// ⚠ Operational caveat (2026-07-20, still true): comp_period rows are WRITTEN with
// FOUNDING_SEASON_END at signup/org-create, and the founding-season status + email-audience queries
// MATCH on it. Moving the END date therefore silently drops rows written under the old date from
// founding-season recognition and marketing audiences — backfill existing comp_period.expires_at
// (and the comped workspaces' / orgs' current_period_end) in the same change, as migration 279 did
// for the 2027-01-01 → 2027-10-01 move.

// Closed early, 2026-10-26 (owner — no coach had taken the offer; BUSINESS_DECISIONS 2026-10-26): the window
// ends at the end of October 25, 2026 EDT instead of December 31 (closed as of the ruling day, so dev walks see it shut). Every account already in keeps its comp
// through FOUNDING_SEASON_END exactly as sold — only the OFFER stops.
export const FOUNDING_SEASON_SIGNUP_CLOSE =
  process.env.NEXT_PUBLIC_FOUNDING_SEASON_SIGNUP_CLOSE ?? '2026-10-26T04:00:00.000Z';
/**
 * The deadline the comp HOLDERS were sold: "the free season is yours if you upgrade by December 31" (the Tournament Plus
 * upsell email, the window as it stood). Closing the offer early ends it for newcomers only. An organization already
 * holding the comp keeps Tournament Plus at $0 on any upgrade until this instant, exactly as sold
 * (`foundingSeasonOfferOnPlanChoice`, owner 2026-10-26). Fixed — it is the old close, not a date to move.
 */
export const FOUNDING_SEASON_HOLDER_UPGRADE_BY = '2027-01-01T05:00:00.000Z';
export const FOUNDING_SEASON_END =
  process.env.NEXT_PUBLIC_FOUNDING_SEASON_END ?? '2027-10-01T04:00:00.000Z';
/**
 * When the "add a payment method" ask opens on the org billing page — the summer card window
 * (plan: open June 1, nudge in August, final notice mid-September). Before this instant the billing
 * page states that no action is needed; nothing ever asks for a card during the signup window.
 */
export const FOUNDING_SEASON_CARD_WINDOW_OPEN =
  process.env.NEXT_PUBLIC_FOUNDING_SEASON_CARD_WINDOW_OPEN ?? '2027-06-01T04:00:00.000Z';

const FOUNDING_SEASON_SIGNUP_CLOSE_MS = new Date(FOUNDING_SEASON_SIGNUP_CLOSE).getTime();
const FOUNDING_SEASON_END_MS = new Date(FOUNDING_SEASON_END).getTime();
const FOUNDING_SEASON_CARD_WINDOW_OPEN_MS = new Date(FOUNDING_SEASON_CARD_WINDOW_OPEN).getTime();

/**
 * The named day an instant "ends on", in Eastern time — the instants above are pinned to the end
 * of a day, so the day the customer reads is the calendar day BEFORE the instant's UTC date.
 */
function endOfDayLabel(iso: string): string {
  return new Date(new Date(iso).getTime() - 1).toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto', month: 'long', day: 'numeric', year: 'numeric',
  });
}
/** The day the instant begins, in Eastern time ("nothing is charged before …"). */
function startOfDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** "December 31, 2026" — the sign-up deadline as the customer reads it. */
export const FOUNDING_SEASON_SIGNUP_CLOSE_LABEL = endOfDayLabel(FOUNDING_SEASON_SIGNUP_CLOSE);
/** "September 30, 2027" — the last free day as the customer reads it. */
export const FOUNDING_SEASON_END_LABEL = endOfDayLabel(FOUNDING_SEASON_END);
/** "October 1, 2027" — the first day anything could be charged. */
export const FOUNDING_SEASON_FIRST_CHARGE_LABEL = startOfDayLabel(FOUNDING_SEASON_END);
/** "2027" — the season the offer is named after (the year the comp ends in). */
export const FOUNDING_SEASON_YEAR_LABEL = FOUNDING_SEASON_END_LABEL.slice(-4);
/** "2028" — the season the customer chooses a plan for at the end. */
export const FOUNDING_SEASON_NEXT_YEAR_LABEL = String(Number(FOUNDING_SEASON_YEAR_LABEL) + 1);
/** "September 2027" — the month the plan choice happens (the comp's last month). */
const FOUNDING_SEASON_LAST_INSTANT = new Date(new Date(FOUNDING_SEASON_END).getTime() - 1);
export const FOUNDING_SEASON_DECISION_MONTH_LABEL = FOUNDING_SEASON_LAST_INSTANT
  .toLocaleDateString('en-CA', { timeZone: 'America/Toronto', month: 'long', year: 'numeric' });
/** "September" — that month alone, for a sentence that has already named its year (the Premium welcome, G1). */
export const FOUNDING_SEASON_DECISION_MONTH_NAME = FOUNDING_SEASON_LAST_INSTANT
  .toLocaleDateString('en-CA', { timeZone: 'America/Toronto', month: 'long' });

/**
 * The one sentence every offer surface repeats, verbatim (copy canon §1 rule 2,
 * FOUNDING_SEASON_2027_OFFER_COPY.md). `product` narrows it to one plan where a surface speaks for
 * one product only; every other word is kept.
 */
export function foundingSeasonOfferLine(product?: 'tournament_plus' | 'team'): string {
  return `${foundingSeasonOfferCore(product)}. No credit card.`;
}
/**
 * The offer sentence without its closing "No credit card." — for a surface that continues the
 * sentence itself ("… by December 31, 2026 — normally $39/month. No credit card.").
 */
export function foundingSeasonOfferCore(product?: 'tournament_plus' | 'team'): string {
  const who = product === 'tournament_plus'
    ? 'Tournament Plus is'
    : product === 'team'
      ? 'The Premium Coaches Portal is'
      : 'Tournament Plus and the Premium Coaches Portal are';
  return `${who} free through ${FOUNDING_SEASON_END_LABEL} when you sign up by ${FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}`;
}
/** The "after line" — what happens when the free season ends, stated once per surface. */
export const FOUNDING_SEASON_AFTER_LINE =
  `In ${FOUNDING_SEASON_DECISION_MONTH_LABEL} you'll choose a plan for your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} season. Nothing is charged before then, and there is nothing to cancel.`;

/** True while an account can still join the Founding Season (the OFFER window). */
export function isFoundingSeasonSignupOpen(): boolean {
  return Date.now() < FOUNDING_SEASON_SIGNUP_CLOSE_MS;
}

/** True while the Founding Season comp is still RUNNING (billing-state surfaces, not offers). */
export function isFoundingSeasonActive(): boolean {
  return Date.now() < FOUNDING_SEASON_END_MS;
}

/**
 * THE OFFER AT A CREATION — may an organization, a league or a Premium Coaches Portal made NOW get the Founding Season
 * comp? (Account-First Sign-up: A5 Decided 2026-10-18, edges (a) and (b) ratified by the owner 2026-10-19,
 * BUSINESS_DECISIONS.md.) While the sign-up window is open, yes, exactly as before. After it closes, only when the
 * ACCOUNT was made by the close AND this creation is the one its start sign-up came for — the account step and the
 * creation now fall on different days, and "free … when you sign up by December 31" has to hold for someone who signs
 * up on the 31st and names their organization on January 2. The end date is the same for everyone, so a late creation
 * gains nothing. Both inputs are server facts (the auth user's `created_at`, the locked start door on `app_metadata`)
 * — never `user_metadata`, which the account holder can edit. The one rule every creation path reads, through
 * `foundingSeasonOfferFor` (lib/founding-season.ts).
 */
export function isFoundingSeasonOpenFor(accountCreatedAt: string | null | undefined, cameToStart: boolean, now = Date.now()): boolean {
  if (now < FOUNDING_SEASON_SIGNUP_CLOSE_MS) return true;
  if (now >= FOUNDING_SEASON_END_MS || !cameToStart || !accountCreatedAt) return false;
  return Date.parse(accountCreatedAt) < FOUNDING_SEASON_SIGNUP_CLOSE_MS;
}

/** True during the summer card window: the comp is running and the "add a payment method" ask is open. */
export function isFoundingSeasonCardWindowOpen(): boolean {
  const now = Date.now();
  return now >= FOUNDING_SEASON_CARD_WINDOW_OPEN_MS && now < FOUNDING_SEASON_END_MS;
}

/**
 * The instant every Founding Season comp was written with BEFORE 2026-09-07 (the 2026 cohort's
 * original end). Migration 279 moves those rows to FOUNDING_SEASON_END, but it is data-only — no
 * drift gate can prove it ran on production — so recognition stays TOLERANT of the legacy instant:
 * a cohort account is a cohort account whether or not the backfill has reached its row yet. Without
 * this, the window between a code deploy and the backfill would drop every existing founding
 * organization out of its billing banner and every marketing audience (/review 2026-09-07).
 */
export const FOUNDING_SEASON_LEGACY_END = '2027-01-01T00:00:00.000Z';
/** Every expires_at instant that marks a Founding Season comp row — match with `.in()`. */
export const FOUNDING_SEASON_COMP_EXPIRIES: readonly string[] =
  FOUNDING_SEASON_END === FOUNDING_SEASON_LEGACY_END
    ? [FOUNDING_SEASON_END]
    : [FOUNDING_SEASON_END, FOUNDING_SEASON_LEGACY_END];

/**
 * True when a comp_period override expiry marks a founding-season comp — current OR legacy instant.
 * Compares the calendar date only: Postgres timestamptz formatting
 * ('2027-10-01 04:00:00+00') differs from the ISO constant, so full-string
 * equality would silently fail. Lives here so that fragility is documented
 * once, next to the constant it guards.
 */
export function isFoundingSeasonCompExpiry(expiresAt: string): boolean {
  return FOUNDING_SEASON_COMP_EXPIRIES.some(iso => expiresAt.startsWith(iso.slice(0, 10)));
}
/** True only for the CURRENT instant — a legacy row that still needs healing returns false. */
export function isFoundingSeasonCurrentExpiry(expiresAt: string): boolean {
  return expiresAt.startsWith(FOUNDING_SEASON_END.slice(0, 10));
}

/**
 * Does this plan's public event wear the FREE presentation — the Powered-by badge and the sign-up banner? The free plan,
 * and a Premium coach's hosted event too (R6 of the free tournament tier, 2026-10-12: the one named exception to the paid
 * pages' quiet credit). The CREDIT only: never a feature or the theme, which read their own plan checks.
 */
export function showsFreeCredit(planId: string | null | undefined): boolean {
  return isFreePlan(planId) || planId === 'team';
}

/**
 * A FOUNDING SEASON COMP STILL ON THE FREE PLAN — the lock lines' quiet "Free for you through …" (R10 and M9 of the free
 * tournament tier, 2026-10-12). Such an organization can pick Tournament Plus at no charge, so every Tournament Plus
 * lock says so: a second line under a lock line, once at the foot of a Tools menu. Never on a comped Premium coach
 * (`team`): no path flips a coach to Tournament Plus. `isFoundingSeason` is the status route's answer. Returns the last
 * free day as the customer reads it, or null. The ONE rule every lock reads (`useFoundingSeasonLock` on the client).
 */
export function foundingSeasonLockUntil(planId: string | null | undefined, isFoundingSeason: boolean): string | null {
  return isFoundingSeason && isFreePlan(planId) ? FOUNDING_SEASON_END_LABEL : null;
}

/**
 * Plans that participate in the Founding Season $0 promo (BUSINESS_DECISIONS 2026-07-20 D1):
 * Tournament Plus and the Premium Coaches Portal. The promo is a discount, not a repricing — the
 * list price stays the visible anchor.
 */
const FOUNDING_SEASON_PLAN_KEYS: readonly OrgPlan[] = ['tournament_plus', 'team'];

/**
 * True when `planKey` is on the Founding Season promo AND the SIGNUP window is still open — the
 * gate every offer surface and every comp-granting path reads. Replaces the scattered
 * `planKey === 'tournament_plus' && isFoundingSeasonActive()` checks so the promo uniformly covers
 * the Premium Coaches Portal (`team`) too.
 */
export function isFoundingSeasonPromoActive(planKey: string): boolean {
  return isFoundingSeasonSignupOpen() && (FOUNDING_SEASON_PLAN_KEYS as readonly string[]).includes(planKey);
}

/**
 * Does a plan card show the Founding Season $0? While the window is open, every promo plan does; after it closes, only
 * Tournament Plus, and only for an organization the server says still holds the offer on its first plan choice
 * (`foundingSeasonOfferOnPlanChoice`, the rule the checkout applies — owner 2026-10-19). ONE rule for every card that
 * prices a plan: the pricing cards and the plan step's two choices (The first look G5, 2026-10-20) both ask here.
 */
export function showsFoundingZero(planKey: string, foundingOfferHeld: boolean): boolean {
  return (foundingOfferHeld && planKey === 'tournament_plus') || isFoundingSeasonPromoActive(planKey);
}

/**
 * Is this plan ON the Founding Season promo, regardless of whether the window is still open?
 *
 * ⚠ The window half of `isFoundingSeasonPromoActive` is wrong for anything read AFTER the signup
 * window closes but while the comp still runs — which is the whole of 2027, and therefore the whole
 * of the summer ask. The next-season choice uses this to re-assert that an account is choosing a
 * plan the promo actually covers, so an account whose `plan_id` has drifted away from its comp
 * cannot widen its own menu.
 */
export function isFoundingSeasonPromoPlan(planKey: string): boolean {
  return (FOUNDING_SEASON_PLAN_KEYS as readonly string[]).includes(planKey);
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

/** A plan's price for one billing period, in the pricing page's own words: "$39/month", "$390/year". */
export function formatPlanPeriodPrice(planKey: OrgPlan, billing: 'monthly' | 'annual'): string {
  const plan = PLAN_CONFIG[planKey];
  return billing === 'annual' ? `${formatPriceAmount(plan.annualPrice)}/year` : `${formatPriceAmount(plan.monthlyPrice)}/month`;
}

/**
 * A plan picked on the pricing page, as the person reads it on the way in: "Tournament Plus, billed annually", or
 * "Tournament (free)" — a free plan never shows a billing period (The first look G4, 2026-10-20). Step 1 of Run a
 * tournament and the plan step both say it.
 */
export function pickedPlanLabel(planKey: OrgPlan, billing?: 'monthly' | 'annual'): string {
  const plan = PLAN_CONFIG[planKey];
  if (plan.monthlyPrice === 0) return `${plan.label} (free)`;
  return `${plan.label}, billed ${billing === 'annual' ? 'annually' : 'monthly'}`;
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


// ── Online payments (Club Tier Stage 12) ────────────────────────────────────────────────────────────────────────────────
/**
 * The all-in processing fee on a payment a club takes online — the ONE code home of the rates. The canonical record is the
 * facilitated-payments line in `docs/agents/strategy/PLAN_PRICING_FACTS.md` (Decided 2026-07-28); a unit test parses that
 * line and fails the build when these drift from it. Never type a rate anywhere else — screens print it with
 * `onlineFeeRateLabel()`, and the arithmetic is `onlineFee()` in `lib/online-payment-fee.ts`.
 *
 * Basis points and cents, so the arithmetic is exact: 350 bps = 3.5%. "All-in" means FieldLogicHQ pays Stripe's own
 * processing fee out of it (plan §0c). The same rates apply whoever pays the fee (A14). `bankDebit` is Stage 12c's.
 */
export const ONLINE_PAYMENT_RATES = {
  card:      { pctBps: 350, flatCents: 150 },
  bankDebit: { pctBps: 250, flatCents: 100 },
} as const;

export type OnlinePaymentRail = keyof typeof ONLINE_PAYMENT_RATES;

/** "3.5% + $1.50" — the rate as a customer reads it, printed from the constant above. */
export function onlineFeeRateLabel(rail: OnlinePaymentRail): string {
  const { pctBps, flatCents } = ONLINE_PAYMENT_RATES[rail];
  return `${pctBps / 100}% + $${(flatCents / 100).toFixed(2)}`;
}
