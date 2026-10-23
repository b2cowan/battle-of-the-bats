'use client';

import { useState } from 'react';
import Link from 'next/link';
import EarlyAccessModalTrigger from './EarlyAccessModalTrigger';
import { PLAN_CONFIG, formatPriceAmount, formatAnnualSavings, showsFoundingZero, FOUNDING_SEASON_END_LABEL, clubTrialLine, gatedPlanTag, GATED_PLAN_INTEREST_LINE } from '@/lib/plan-config';
import { parseStartPricing, withStartPricing } from '@/lib/start-door';
import { SEE_IT_LIVE_PATH, SEE_IT_LIVE_COACHES_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';
import type { OrgPlan } from '@/lib/types';
import kit from './marketing/MarketingKit.module.css';
import styles from './PricingSection.module.css';

type Billing = 'monthly' | 'annual';

/** The words "Start free — no credit card required" carried before the button said only what happens (P4). */
const NO_CARD_LINE = 'No credit card required';

interface Plan {
  key: OrgPlan;
  name: string;
  tagline: string;
  monthlyPrice: string;
  annualPrice: string | null;
  annualTotal: string | null;
  annualSavings: string | null;
  currency: string | null;
  period: string;
  freeNote: string;
  trialNote: string;
  /** Shown under the price INSTEAD of freeNote while this plan's Founding Season promo is active
   *  (and the card's CTA falls back from plan.cta to "Start now" once it isn't) — so promo wording
   *  expires with the promo instead of waiting on a January runbook (/review 2026-08-08). */
  promoNote?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
}

const PLANS: Plan[] = [
  {
    key: 'tournament',
    name: 'Tournament',
    // The free plan is the invite-only event (the free tournament tier, built 2026-10-16). Every line on this card is a
    // FREE-plan claim: copy it from the Facts doc's free inclusion list, never from the Tournament Plus card.
    tagline: 'An invite-only event: you add the teams, build the schedule, and post live scores and results — free, with no time limit.',
    monthlyPrice: 'Free',
    annualPrice: null,
    annualTotal: null,
    annualSavings: null,
    currency: null,
    period: '',
    freeNote: 'No credit card required',
    trialNote: 'No credit card required',
    features: [
      'You add every team — each coach claims it from an email invitation',
      'Manual tournament scheduling',
      'Score entry and results',
      'Standings',
      'A public event site with live scores families can follow',
      'Venue management',
      'Public news posts',
      'Basic team/contact email',
      'Default FieldLogicHQ styling',
      '3 staff / admin seats',
      '1 tournament at a time',
    ],
    cta: 'Get started free',
    ctaHref: '/start/tournament',
  },
  {
    key: 'tournament_plus',
    name: 'Tournament Plus',
    // Registration, fees and payments lead Tournament Plus (free tournament tier R9, 2026-10-12).
    tagline: 'For events teams register for — public registration, payment tracking, check-in, and volunteers — plus automation, branding, reporting, and repeat-event tools.',
    monthlyPrice: formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice),
    annualPrice: formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice),
    annualTotal: `${formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)} CAD / year`,
    annualSavings: `${formatAnnualSavings('tournament_plus')}`,
    currency: 'CAD',
    period: '/mo',
    freeNote: 'No contracts — cancel anytime',
    trialNote: 'No contracts — cancel anytime',
    promoNote: `Normally ${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month · ${formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)}/year`,
    features: [
      'Everything in Tournament',
      'Public registration — teams register on your site, and you approve, waitlist, or decline',
      // "You record": the platform never takes the money (lib/plan-article-content.ts, the registration step).
      'Fees and payment tracking — you record what each team has paid',
      'Check-in on game day',
      'Unlimited tournament slots',
      'Round-robin and playoff generators',
      'Custom registration fields, file uploads, and waitlist promotion',
      'Registration exports — Excel, CSV, and PDF',
      'Post-tournament reporting',
      // Same words as the Tournament Plus article (lib/plan-article-content.ts, corrected 2026-08-20):
      // paying removes the Powered-by pill and the banner, never the quiet footer credit.
      'Full branding control — no acquisition banner, just a quiet “Built on FieldLogicHQ” footer credit',
      'Permanent sealed archives, tournament cloning, and targeted announcements',
      'Unlimited staff / admin seats · unlimited volunteers',
    ],
    cta: 'Start free',
    ctaHref: '/start/tournament',
  },
  {
    key: 'league',
    name: 'League Plus',
    tagline: 'House league seasons, registration, and a public site for your league.',
    monthlyPrice: formatPriceAmount(PLAN_CONFIG.league.monthlyPrice),
    annualPrice: formatPriceAmount(PLAN_CONFIG.league.annualPrice),
    annualTotal: `${formatPriceAmount(PLAN_CONFIG.league.annualPrice)} CAD / year`,
    annualSavings: `${formatAnnualSavings('league')}`,
    currency: 'CAD',
    period: '/mo',
    freeNote: 'No credit card required',
    trialNote: 'No credit card required',
    features: [
      'Everything in Tournament Plus',
      'Public organization page',
      'House league — registration, divisions, seasons, and standings',
      'League-scoped communications',
      'Advanced member roles and permissions',
    ],
    cta: 'Start free',
    ctaHref: '/start/tournament',
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    key: 'club',
    name: 'Club',
    tagline: 'The complete operating system for established clubs — tournaments, house league, rep teams, accounting, and coaching staff, all in one place.',
    monthlyPrice: formatPriceAmount(PLAN_CONFIG.club.monthlyPrice),
    annualPrice: formatPriceAmount(PLAN_CONFIG.club.annualPrice),
    annualTotal: `${formatPriceAmount(PLAN_CONFIG.club.annualPrice)} CAD / year`,
    annualSavings: `${formatAnnualSavings('club')}`,
    currency: 'CAD',
    period: '/mo',
    // The Club trial takes a card (BUSINESS_DECISIONS.md 2026-09-25) — the one sentence billing and
    // checkout also use. It read "No credit card required" until then, which checkout contradicted.
    freeNote: clubTrialLine(),
    trialNote: clubTrialLine(),
    features: [
      'Everything in League Plus',
      // Says only what ships (BUSINESS_DECISIONS 2026-10-19): no invoicing or reconciliation until each exists.
      'Accounting — club ledger, budget vs. actual, and costs split across teams, with coach reminders',
      'Rep teams — tryouts, rosters, player documents, and season history',
      'Premium Coaches Portal for your whole coaching staff — every team included, no per-team fee',
      'Up to 15 teams — or up to 30 on Club · Association',
    ],
    cta: 'Start your Club trial',
    ctaHref: '/start/tournament',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
];

/**
 * The Premium Coaches Portal card — rendered ONLY in `marketingLayout` (the "live products lead"
 * ruling, 2026-08-08). It is a personal coach product, not an org tier, so:
 *   • it is NOT in `RENDERED_PLAN_KEYS` — an org operator's `currentPlan` can never be `team`;
 *   • its CTA always goes to the coach start flow — the org-operator `ctaHrefFor`/`ctaLabel`
 *     overrides (billing deep-links) deliberately do not apply to it, in every viewer state.
 * Its promo wording lives in `promoNote`, so it expires with the promo automatically.
 */
const TEAM_PLAN: Plan = {
  key: 'team',
  name: 'Premium Coaches Portal',
  tagline: 'The operations HQ for one competitive team — standalone, no organization account needed. Included in Club when your organization joins.',
  monthlyPrice: formatPriceAmount(PLAN_CONFIG.team.monthlyPrice),
  annualPrice: formatPriceAmount(PLAN_CONFIG.team.annualPrice),
  annualTotal: `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)} CAD / year`,
  annualSavings: `${formatAnnualSavings('team')}`,
  currency: 'CAD',
  period: '/mo',
  freeNote: `or ${formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/season — save two months`,
  trialNote: `or ${formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/season — save two months`,
  promoNote: `Normally ${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/month · ${formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/year`,
  features: [
    'Full roster management with positions and season history',
    'Lineup builder with game-by-game history — exportable to PDF',
    'Schedule, attendance, and availability tracking',
    'Team budget, player dues, and payment tracking',
    'Document management — consent forms, medical notes, eligibility',
    // R9 (free tournament tier): the Premium portal says it includes one hosted tournament (invite-only, like free).
    'Host one tournament at a time — you invite the teams',
    'Works standalone — no organization account required',
  ],
  cta: 'Start free',
  ctaHref: '/coaches/start?source=pricing',
  initialPlanInterest: ['coaches_portal'],
  initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
};

/**
 * The quiet demo line under a paid live card's CTA (owner-ratified 2026-08-10) — for the pricing
 * page's skeptic, who won't start free because they suspect "free" hides a hollow product. Text
 * weight below the CTA, so the buying path loses nothing; product-specific wording here (unlike
 * the hero's shared label) because both doors share one screen. Marketing layout only, and only
 * while the doors are on.
 */
const DEMO_DOORS: Partial<Record<OrgPlan, { href: string; label: string }>> = {
  tournament_plus: { href: SEE_IT_LIVE_PATH, label: 'See a live tournament first' },
  team: { href: SEE_IT_LIVE_COACHES_PATH, label: "See a coach's season first" },
};

/** One-line descriptors for the marketing coming-soon strip — a gated plan's whole pitch there. */
const GATED_STRIP_LINES: Partial<Record<OrgPlan, string>> = {
  league: 'house league seasons — registration, draft, schedule, standings, and parent comms',
  club: 'the complete club operating system — rep teams, accounting, and your whole coaching staff’s portals',
  team: 'the standalone workspace for one competitive team',
};

/**
 * The plan keys this component actually RENDERS a card for — deliberately a subset of
 * `PLAN_CONFIG`, which also carries `team` (the Coaches Portal — a card only in `marketingLayout`,
 * and never an org's current plan) and `club_large` (Club · Association, a capacity band of Club
 * rather than its own card).
 *
 * Exported because a caller marking "the viewer's current plan" has to test membership of THIS
 * list, not of PLAN_CONFIG: `club_large` is a real, valid plan that no card here can match, so a
 * PLAN_CONFIG-based check silently produced a `currentPlan` that never matched anything — leaving
 * the platform's highest-paying tier with no "Current plan" badge at all (/review, 2026-08-01).
 */
export const RENDERED_PLAN_KEYS: readonly OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club'];

/**
 * A plan card's button (P4: says what happens, sentence case, no arrow). The kit's lime button is the view's ONE primary,
 * worn by the plan it leads with; every other card's is the white secondary. Both read only --home-* tokens, so the same
 * classes serve the always-warm marketing pages and the admin onboarding's chooser (which follows Warm / Dark).
 */
function ctaClass(primary: boolean): string {
  return `${kit.btn} ${kit.btnFull}${primary ? '' : ` ${kit.btnSecondary}`}`;
}

interface PricingSectionProps {
  gatingMap: Record<OrgPlan, boolean>;
  onChoosePlan?: (planKey: OrgPlan, billingCycle: Billing) => void;
  currentPlan?: OrgPlan;
  /** Whether the viewer's current plan is a RUNNING Founding Season comp — a per-account fact the
   *  caller may know (ViewerAwarePlans asks the billing status endpoint). `undefined` = unknown:
   *  the card falls back to the signup window. Only consulted for the `currentPlan` card. */
  currentPlanComped?: boolean;
  planLoading?: OrgPlan | null;
  disabledPlans?: OrgPlan[];
  ctaLabel?: (planKey: OrgPlan) => string | undefined;
  /** Overrides the CTA's DESTINATION on the link branch (the marketing pricing page), the way
   *  `ctaLabel` overrides its words. R4 (2026-08-01): a signed-in operator's cards point at
   *  their own billing screen instead of the sign-up funnel. Returning undefined keeps the
   *  sign-up href, which is what every prospect gets. Ignored when `onChoosePlan` is set —
   *  the in-app wizard uses buttons, not links. */
  ctaHrefFor?: (planKey: OrgPlan) => string | undefined;
  initialBilling?: Billing;
  /** Optional display order by plan key. Plans omitted here fall to the end in default order. */
  order?: OrgPlan[];
  /** Optional plan key to visually feature (highlighted border). */
  featuredPlan?: OrgPlan;
  /**
   * This organization still holds the Founding Season offer for the choice it is making, whatever the sign-up window
   * says — the plan step after the close, for an organization given the comp when it was made (owner 2026-10-19). The
   * caller asks the server (the same rule the checkout applies); the Tournament Plus card then reads as it does in the
   * window. Tournament Plus only: that is the one plan the checkout applies it to.
   */
  foundingOfferHeld?: boolean;
  /**
   * The "live products lead" layout (owner-ratified 2026-08-08), for the marketing surfaces only:
   * plans whose gate is CLOSED collapse from full cards into one compact coming-soon strip below
   * the grid, and the Premium Coaches Portal joins the grid as a real card while its checkout is
   * open. In-app callers (onboarding wizard, billing) omit this and are unchanged. The split is
   * gate-driven, so the day a gate opens the plan is promoted to a full card without a deploy —
   * whoever opens a gate owns making that plan's destination page live in the same unit of work.
   */
  marketingLayout?: boolean;
}

export default function PricingSection({ gatingMap, onChoosePlan, currentPlan, currentPlanComped, planLoading, disabledPlans, ctaLabel, ctaHrefFor, initialBilling = 'monthly', order, featuredPlan, foundingOfferHeld = false, marketingLayout = false }: PricingSectionProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);

  const orderedPlans = order
    ? [...PLANS].sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        return (ia === -1 ? PLANS.length : ia) - (ib === -1 ? PLANS.length : ib);
      })
    : PLANS;

  // Marketing layout: cards = live org plans + the coaches card when its checkout is open;
  // strip = whatever is still gated (including the coaches card if its gate ever re-closes).
  const teamGated = gatingMap.team ?? true;
  const stripPlans = marketingLayout
    ? [...orderedPlans.filter(p => gatingMap[p.key] ?? false), ...(teamGated ? [TEAM_PLAN] : [])]
    : [];
  const cardPlans = marketingLayout
    ? [...orderedPlans.filter(p => !(gatingMap[p.key] ?? false)), ...(teamGated ? [] : [TEAM_PLAN])]
    : orderedPlans;
  // NEXT_PUBLIC_ vars are inlined into the client bundle, so this works in a client component.
  const demoDoorsOpen = marketingLayout && sandboxDoorsVisible();

  function getSignupHref(plan: Plan) {
    // The coaches card owns its own destination (the coach start flow takes no plan/billing params). Every other plan
    // rides to Run a tournament's sign-up, which shows it as the plan chip (The first look, Ask 6: every plan button
    // keeps its plan) — the free Tournament too, with no billing (G4, 2026-10-20), so the plan step opens on it.
    if (plan.key === 'team') return plan.ctaHref;
    return withStartPricing(plan.ctaHref, parseStartPricing(plan.key, billing));
  }

  // The plan this view leads with carries its ONE lime button and the 2px olive edge. The marketing pages lead with
  // Tournament Plus (the plan the page leads with); the onboarding chooser names its own via `featuredPlan`.
  const leadPlan = featuredPlan ?? (marketingLayout ? 'tournament_plus' : undefined);
  // The strip's button names the plans it covers ("Express interest in League Plus or Club"), never a bare "Express interest"
  // beside a card that is also one (label list row 4).
  const stripLabel = stripPlans.length > 0 && stripPlans.every(p => p.key === 'league' || p.key === 'club')
    ? `Express interest in ${stripPlans.map(p => p.name).join(' or ')}`
    : 'Express interest';

  return (
    <>
      {/* Billing toggle */}
      <div className={styles.toggleWrap}>
        <div className={styles.togglePill} role="group" aria-label="Billing period">
          <button
            onClick={() => setBilling('monthly')}
            className={`${styles.toggleBtn} ${billing === 'monthly' ? styles.toggleActive : ''}`}
            aria-pressed={billing === 'monthly'}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`${styles.toggleBtn} ${billing === 'annual' ? styles.toggleActive : ''}`}
            aria-pressed={billing === 'annual'}
          >
            Annual
            {billing === 'monthly' && (
              <span className={styles.saveBadge}>2 months free</span>
            )}
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className={`${styles.pricingGrid} ${cardPlans.length === 3 ? styles.pricingGridThree : ''} ${cardPlans.length === 2 ? styles.pricingGridTwo : ''}`}>
        {cardPlans.map(plan => {
          const isGated = gatingMap[plan.key] ?? false;
          // The coaches card never takes the org-operator CTA overrides — a plan change for an
          // org happens on the org's billing screen, but the coach product isn't bought there.
          const takesOverrides = plan.key !== 'team';
          // Deliberately NOT gated on `onChoosePlan` any more (R4, 2026-08-01): the marketing
          // pricing page renders the LINK branch and still needs to mark the viewer's own tier.
          // Every caller that doesn't pass `currentPlan` is unaffected.
          const isCurrent = currentPlan === plan.key;
          const isIncluded = !!onChoosePlan && (disabledPlans?.includes(plan.key) ?? false);
          const isFeatured = !isGated && leadPlan === plan.key;
          const isAnnual = !isGated && billing === 'annual' && plan.annualPrice;
          const displayPrice = isGated ? gatedPlanTag(plan.key) : (isAnnual ? plan.annualPrice! : plan.monthlyPrice);
          // Promo wording only while the promo is actually running — afterwards the card falls
          // back to its permanent note and a truthful "Start now" CTA on its own, with no runbook.
          // For the viewer's OWN current plan the offer state is a per-account fact (is this
          // account's comp still running?), not the signup window — supplied by the caller when it
          // knows; the window is the fallback until it answers (/review 2026-09-07).
          const promoActive = !!plan.promoNote && (
            isCurrent && currentPlanComped !== undefined
              ? currentPlanComped
              : showsFoundingZero(plan.key, foundingOfferHeld)
          );
          const displayNote = isGated
            ? GATED_PLAN_INTEREST_LINE
            : promoActive
              ? plan.promoNote!
              : (isAnnual ? (plan.annualSavings ?? plan.trialNote) : plan.freeNote);
          const defaultCta = plan.promoNote && !promoActive ? 'Start now' : plan.cta;
          // "Start free" no longer carries "no credit card required" in its own words (label list row 14; the drawing's
          // split). Where the card's note under the price already says it, that stays the only copy; where the price block
          // shows another note (the Founding Season "Normally …" line), the same words the button used to carry sit under
          // it as fine print. No new words either way.
          const overrideLabel = onChoosePlan || takesOverrides ? ctaLabel?.(plan.key) : undefined;
          const finePrint = defaultCta === 'Start free' && !overrideLabel && !isGated && !isCurrent && !isIncluded && displayNote !== NO_CARD_LINE
            ? NO_CARD_LINE
            : null;
          // The one lime button: the lead plan's, unless the viewer is already on it (then it is a quiet door).
          const primary = isFeatured && !isCurrent && !isIncluded;

          return (
            <div key={plan.key} className={`${styles.planCard} ${isFeatured ? styles.planCardFeatured : ''}`}>
              {/* Band 1: header. The chip row is always chip-high, so a card with no chip still starts its name on the
                  same line as the cards beside it. */}
              <div>
                <div className={styles.planBadgeRow}>
                  {isGated && (
                    <span className={kit.tag}>{gatedPlanTag(plan.key)}</span>
                  )}
                  {/* The Founding Season chip (owner-approved 2026-09-07): the offer moved INTO the
                      price block below, so the header keeps only the program's name — the plan chip,
                      never a second box above the tagline. */}
                  {promoActive && !isCurrent && (
                    <span className={kit.chip}>Founding Season</span>
                  )}
                  {!isGated && isCurrent && (
                    <span className={kit.tag}>Current plan</span>
                  )}
                </div>
                <p className={kit.title}>{plan.name}</p>
                <p className={`${kit.small} ${styles.planTagline}`}>{plan.tagline}</p>
              </div>

              {/* Band 2: price. While the signup window is open the two promo cards show "$0
                  through <last free day>" with the list price kept beneath (every touchpoint
                  names the price waived) — "$0", not "Free", because the free Tournament card
                  beside them says "Free" with no end date and the permanent and the promotional
                  must stay distinguishable at a glance. */}
              <div className={styles.planPriceBlock}>
                <div className={styles.planPrice}>
                  {promoActive ? (
                    <>
                      <span className={kit.price}>$0</span>
                      <span className={kit.small}>through {FOUNDING_SEASON_END_LABEL}</span>
                    </>
                  ) : (
                    <>
                      <span className={isGated ? kit.title : kit.price}>
                        {displayPrice}
                      </span>
                      {!isGated && plan.currency && (
                        <span className={kit.small}>{plan.currency}</span>
                      )}
                      {!isGated && (isAnnual || plan.period) && (
                        <span className={kit.small}>{isAnnual ? '/year' : plan.period}</span>
                      )}
                    </>
                  )}
                </div>
                <p className={`${kit.small} ${styles.planNote}`}>{displayNote}</p>
              </div>

              {/* Band 3: divider */}
              <hr className={styles.planDivider} />

              {/* Band 4: features */}
              <ul className={`${kit.ticks} ${styles.planFeatures}`}>
                {plan.features.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              {/* Band 5: CTA — one wrapper so the subgrid row can also hold the fine print and the quiet demo line
                  on marketing surfaces without becoming a sixth band. */}
              <div className={styles.planCtaBand}>
              {isGated ? (
                <EarlyAccessModalTrigger
                  className={ctaClass(false)}
                  initialPlanInterest={plan.initialPlanInterest}
                  initialFeaturesInterested={plan.initialFeaturesInterested}
                >
                  Express interest
                </EarlyAccessModalTrigger>
              ) : onChoosePlan ? (
                <button
                  type="button"
                  className={`${ctaClass(primary)} ${(isCurrent || isIncluded) ? styles.ctaDisabled : ''}`}
                  onClick={() => onChoosePlan(plan.key, billing)}
                  disabled={isCurrent || isIncluded || planLoading !== null}
                >
                  {planLoading === plan.key
                    ? 'Loading...'
                    : isCurrent
                      ? 'Current plan'
                      : isIncluded
                        ? 'Included in plan'
                        : (ctaLabel?.(plan.key) ?? defaultCta)}
                </button>
              ) : (
                /* R4: the caller may override the destination and the words; `isCurrent` only
                   quiets the styling, because a card for the tier you are already on should not
                   compete with the one you might move to. One link, so href and label logic can
                   never drift between a "current" and a "not current" copy of it. */
                <Link
                  href={(takesOverrides ? ctaHrefFor?.(plan.key) : undefined) ?? getSignupHref(plan)}
                  className={`${ctaClass(primary)}${isCurrent ? ` ${styles.viewerCurrentCta}` : ''}`}
                >
                  {(takesOverrides ? ctaLabel?.(plan.key) : undefined) ?? defaultCta}
                </Link>
              )}
              {finePrint && (
                <p className={`${kit.small} ${styles.planFinePrint}`}>{finePrint}</p>
              )}
              {demoDoorsOpen && !isGated && !onChoosePlan && DEMO_DOORS[plan.key] && (
                <p className={`${kit.small} ${styles.planDemoLine}`}>
                  Not ready?{' '}
                  <Link href={DEMO_DOORS[plan.key]!.href} className={`${kit.link} ${styles.planDemoLink}`}>
                    {DEMO_DOORS[plan.key]!.label}
                  </Link>
                </p>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Marketing coming-soon strip — the gated plans, at footnote weight. Visible, priced, and
          capturing interest, but never peers of what's actually on sale. */}
      {marketingLayout && stripPlans.length > 0 && (
        <div className={`${kit.card} ${kit.cardFlat} ${styles.comingSoonStrip}`}>
          <span className={kit.tag}>Not open yet</span>
          <p className={`${kit.small} ${styles.comingSoonStripBody}`}>
            {stripPlans.map((p, i) => (
              <span key={p.key}>
                {i > 0 && ' · '}
                <strong className={styles.comingSoonStripName}>{p.name}</strong>
                {' '}({p.monthlyPrice}/mo) — {GATED_STRIP_LINES[p.key] ?? p.tagline}
              </span>
            ))}
            {'. '}Express interest to be notified when self-serve checkout opens.
          </p>
          <EarlyAccessModalTrigger
            className={`${kit.btn} ${kit.btnSecondary}`}
            initialPlanInterest={[...new Set(stripPlans.flatMap(p => p.initialPlanInterest ?? []))]}
            initialFeaturesInterested={[...new Set(stripPlans.flatMap(p => p.initialFeaturesInterested ?? []))]}
          >
            {stripLabel}
          </EarlyAccessModalTrigger>
        </div>
      )}
    </>
  );
}
