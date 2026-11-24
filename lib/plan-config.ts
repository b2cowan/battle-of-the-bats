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
  // 'early_access': plan is not open for self-serve checkout (pages show its closed words and the interest door).
  // 'live': plan is available for checkout.
  // ⚠ This is only the FALLBACK. The live answer is the `plan_gating` row (platform admin), read per request by
  // `getPlanGatingMap()`; this value is used only when that read fails. Opening a plan is the runbook's flip of the
  // row (docs/agents/ops/CLUB_GATE_FLIP_RUNBOOK.md); this value is brought into agreement afterwards so a failed read
  // never closes a plan that is on sale (on-sale pages S1, Ask 18). All four paid plans carry 'live' here since 2026-11-24, matching the live rows (Club, Club · Association and League Plus went on sale 2026-11-23).
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
    // Live on production since 2026-07-24 (the plan_gating row); this fallback now agrees (Ask 18, 2026-11-18).
    gatingStatus: 'live',
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
      // Board Ready Stage 6 (ask 12, owner 2026-11-22): the Sponsorships place rides League Plus and both Club bands.
      'module_sponsorships',
    ],
    gatingStatus: 'live',
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
      // Board Ready Stage 6 (ask 12, owner 2026-11-22): the Sponsorships place rides League Plus and both Club bands.
      'module_sponsorships',
    ],
    gatingStatus: 'live',
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
      // Board Ready Stage 6 (ask 12, owner 2026-11-22): the Sponsorships place rides League Plus and both Club bands.
      'module_sponsorships',
    ],
    gatingStatus: 'live',
  },
};

// The trial sentence (clubTrialLine / planTrialLine) lives in lib/plan-trial-line.ts: it needs the tax words, and this
// file stays import-free because the demo seed scripts load it with plain Node (on-sale pages S1, 2026-11-18).


/**
 * What a customer reads about a plan that is NOT open for sign-up — one tag and one sentence per plan,
 * on every surface (canon in PRICING_PAGE_COPY.md). Every closed plan wears a date-free "Coming soon": League Plus's
 * parked words ("Not open yet", "built, but not open for sign-up", 2026-09-28) ended when it was set to go on sale with
 * Club (BUSINESS_DECISIONS.md 2026-11-06; owner 2026-11-19, `/marketing`'s sentence 2026-11-20, on-sale pages S3).
 * Never "early access" — that programme was withdrawn 2026-07-28. Show these only when the LIVE gate says the plan is
 * closed (`getPlanGatingMap()` on the server, `usePlanGating()` on the client) — never on a typed assumption.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- one tag for every closed plan since 2026-11-20; callers still name the plan
export function gatedPlanTag(_planKey: OrgPlan): string {
  return 'Coming soon';
}

/** The full sentence (a panel's closing line, a page's note). */
export function gatedPlanSentence(planKey: OrgPlan): string {
  return `${planKey === 'team' ? 'The ' : ''}${PLAN_CONFIG[planKey].label} is coming soon — it isn't open for sign-up yet.`;
}

/** The short line under a closed plan card's button. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- as gatedPlanTag
export function gatedPlanNote(_planKey: OrgPlan): string {
  return 'Not open for sign-up yet.';
}

/**
 * The line beside an interest door. It promises no email: the interest form's updates box opens unticked and only a
 * tick is consent (owner ruling 2026-11-19, `/legal`'s sentence; the interest window's intro reads it too).
 */
export const GATED_PLAN_INTEREST_LINE = "Tell us you're interested. Tick the box on the form if you'd like an email when it opens.";

/**
 * The one sentence naming the closed programme plans together, read from the live gate: "Club and League Plus are
 * coming soon." — or "Club is coming soon." / "League Plus is coming soon." for whichever is still closed, or `null`
 * when both are open (the sentence then disappears rather than going stale). `/marketing` 2026-11-20.
 */
export function closedProgramPlansSentence(gating: Partial<Record<OrgPlan, boolean>>): string | null {
  const names = [gating.club && 'Club', gating.league && 'League Plus'].filter(Boolean) as string[];
  if (names.length === 0) return null;
  return names.length === 1 ? `${names[0]} is coming soon.` : `${names.join(' and ')} are coming soon.`;
}

// ─── The one answer to "is this plan open?", and the availability words (on-sale pages S1, 2026-11-18) ──────────
// Every public plan page (/pricing, /for-*, home, /start/*) reads availability through these, from the LIVE gate it
// got per request (`getPlanGatingMap()`), and types none of these words itself. Guarded by
// tests/unit/public-plan-availability-guard.test.ts: a page that re-spells the gate or types "Express interest",
// "Coming soon", "Not open yet" or "Available now" fails the build. A page re-spelling them is how /pricing, the
// Clubs page and home came to say different things about the same plan.

/**
 * "Is this plan open for sign-up right now?" — ⚠ the gating map's `true` means GATED. A plan missing from the map
 * reads as closed: a door that does not open is the worse failure than a door shown late.
 */
export function isPlanOpen(gating: Partial<Record<OrgPlan, boolean>>, plan: OrgPlan): boolean {
  return gating[plan] === false;
}

/** The heading/label a public page puts over the plans that are on sale. */
export const PLAN_AVAILABLE_NOW = 'Available now';

/**
 * Who can buy, said once (Ask 15, the ruled sentence in BUSINESS_DECISIONS.md; `/accounting`, `/legal`): step 1 of the
 * paid doors, under the /pricing bands, and under home's price rows. One spelling everywhere.
 */
export const PLAN_AVAILABILITY_WHO = 'Available to organizations in Canada, outside Québec for now.';
export const PLAN_AVAILABILITY_LINE = `${PLAN_AVAILABILITY_WHO} Prices are in Canadian dollars.`;
/**
 * The same line where an individual also buys (/pricing and home carry the Premium Coaches Portal, which a coach buys as
 * a person): "organizations" would be wrong there, and the Terms say organizations and individuals in Canada (`/legal`
 * 2026-11-20). The persona pages and the start doors keep the organizations sentence above.
 */
export const PLAN_AVAILABILITY_WHO_ANYONE = 'Available in Canada, outside Québec for now.';
export const PLAN_AVAILABILITY_LINE_ANYONE = `${PLAN_AVAILABILITY_WHO_ANYONE} Prices are in Canadian dollars.`;

const INTEREST_NAMES: Partial<Record<OrgPlan, string>> = {
  league: 'League Plus', club: 'Club', club_large: 'Club · Association', team: 'the Coaches Portal',
};

/** The interest door's button: "Express interest", or "Express interest in League Plus or Club". Closed plans only. */
export function interestButtonLabel(plans: OrgPlan[] = []): string {
  const names = plans.map(p => INTEREST_NAMES[p] ?? PLAN_CONFIG[p].label);
  return names.length ? `Express interest in ${names.join(' or ')}` : 'Express interest';
}

/**
 * The tag over a group of closed programme plans (the /pricing strip and its "what they cover" section; W6, Ask 3):
 * "Coming soon" while either is closed (both plans wear the one word since 2026-11-20, so the strip needs no per-plan
 * status); none closed → null (the group does not render).
 */
export function closedPlansGroupTag(gating: Partial<Record<OrgPlan, boolean>>): string | null {
  const closed = (['league', 'club'] as OrgPlan[]).filter(p => gating[p]);
  return closed.length === 0 ? null : gatedPlanTag(closed[0]);
}

/** The three plans that go on sale together at the flip (CLUB_GATE_FLIP_RUNBOOK.md), each with its own gate. */
export const PROGRAM_PLANS = ['league', 'club', 'club_large'] as const satisfies readonly OrgPlan[];

/**
 * "Are League Plus, Club and Club · Association all on sale?" — the one test the open-state layouts switch on (on-sale
 * pages S3): the /pricing picker's three doors, home's three doors and price rows. Any one closed → the closed layout,
 * with each open plan's own line still read from its gate, so a partial flip reads right.
 */
export function allProgramPlansOpen(gating: Partial<Record<OrgPlan, boolean>>): boolean {
  return PROGRAM_PLANS.every(p => isPlanOpen(gating, p));
}

/** "Is any of League Plus, Club or Club · Association on sale?" — the /pricing league-and-club band renders on this. */
export function anyProgramPlanOpen(gating: Partial<Record<OrgPlan, boolean>>): boolean {
  return PROGRAM_PLANS.some(p => isPlanOpen(gating, p));
}

const AVAILABLE_NAMES: Partial<Record<OrgPlan, string>> = {
  tournament: 'Tournament', tournament_plus: 'Tournament Plus', team: 'the Premium Coaches Portal',
};

/**
 * "Tournament, Tournament Plus, and the Premium Coaches Portal are available now." — built from the gate over the plans
 * a sentence names (each appears only while open), or null when none of them is. The caller names the plans; S1 keeps
 * the three that sell today, and the open state (S3) widens the list rather than typing a new sentence.
 */
export function availableNowSentence(gating: Partial<Record<OrgPlan, boolean>>, plans: OrgPlan[]): string | null {
  const names = plans.filter(p => isPlanOpen(gating, p)).map(p => AVAILABLE_NAMES[p] ?? PLAN_CONFIG[p].label);
  if (names.length === 0) return null;
  const list = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  const sentence = `${list} ${names.length === 1 ? 'is' : 'are'} available now.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
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

/**
 * Does this plan's public event wear the FREE presentation — the Powered-by badge and the sign-up banner? The free plan,
 * and a Premium coach's hosted event too (R6 of the free tournament tier, 2026-10-12: the one named exception to the paid
 * pages' quiet credit). The CREDIT only: never a feature or the theme, which read their own plan checks.
 */
export function showsFreeCredit(planId: string | null | undefined): boolean {
  return isFreePlan(planId) || planId === 'team';
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
 * Basis points and cents, so the arithmetic is exact: 350 bps = 3.5%. "All-in" is what the payer or the club sees: one
 * processing fee, Stripe's own cost inside it. Since Stripe-owned pricing (ruled 2026-11-17, rate design A) Stripe takes its
 * cost from the club's balance and FieldLogicHQ's application fee is the rest (`STRIPE_STANDARD_COST` below). The same
 * rates apply whoever pays the fee (A14). `bankDebit` is Stage 12c's.
 */
export const ONLINE_PAYMENT_RATES = {
  card:      { pctBps: 350, flatCents: 150 },
  bankDebit: { pctBps: 250, flatCents: 100 },
} as const;

export type OnlinePaymentRail = keyof typeof ONLINE_PAYMENT_RATES;

/**
 * STRIPE'S price, not ours: its standard Canadian cost for a domestic payment (stripe.com/en-ca/pricing, read 2026-11-17;
 * the Stripe-owned pricing probe charged exactly these, `.probe/sop/RESULTS.md`). Card 2.9% + $0.30; Canadian
 * pre-authorized debit 1% + $0.40, capped at $5.00. It is on the WHOLE charge, as Stripe charges it. Under rate design A
 * (`BUSINESS_DECISIONS.md` 2026-11-17 "Stripe-owned pricing…") our application fee is the processing fee less this, so
 * the family-facing rates above never move when Stripe's price does — only our margin does. Canonical record: the Facts
 * doc's facilitated-payments line, which a unit test holds these to. If Stripe changes its price, change both together;
 * a payment already opened keeps the application fee it stored (`online_payments.application_fee_amount`).
 */
export const STRIPE_STANDARD_COST: Record<OnlinePaymentRail, { pctBps: number; flatCents: number; capCents: number | null }> = {
  card:      { pctBps: 290, flatCents: 30, capCents: null },
  bankDebit: { pctBps: 100, flatCents: 40, capCents: 500 },
};

/** "3.5% + $1.50" — the rate as a customer reads it, printed from the constant above. */
export function onlineFeeRateLabel(rail: OnlinePaymentRail): string {
  const { pctBps, flatCents } = ONLINE_PAYMENT_RATES[rail];
  return `${pctBps / 100}% + $${(flatCents / 100).toFixed(2)}`;
}
