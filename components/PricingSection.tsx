'use client';

import { useState } from 'react';
import Link from 'next/link';
import EarlyAccessModalTrigger from './EarlyAccessModalTrigger';
import {
  PLAN_CONFIG, formatPriceAmount, formatAnnualSavings, gatedPlanTag, GATED_PLAN_INTEREST_LINE, interestButtonLabel,
  isPlanOpen, anyProgramPlanOpen, PLAN_AVAILABILITY_LINE_ANYONE,
} from '@/lib/plan-config';
import { planTrialLine } from '@/lib/plan-trial-line';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';
import { parseStartPricing, withStartPricing } from '@/lib/start-door';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import type { OrgPlan } from '@/lib/types';
import kit from './marketing/MarketingKit.module.css';
import styles from './PricingSection.module.css';
import PlanTermsLine from '@/components/legal/PlanTermsLine';

type Billing = 'monthly' | 'annual';

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
  features: string[];
  cta: string;
  ctaHref: string;
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
  /** The plan says its trial in the one sentence (W1, W4, Ask 7): the note is built per render from the length
   *  checkout will use (`trialDays` prop), in BOTH billing views (W7), and absent when that length is 0. */
  saysTrial?: boolean;
  /** A quiet line under the button (W5: Club · Association's custom-quote line). */
  quietLine?: string;
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
    freeNote: 'No long-term contract — cancel any time',
    trialNote: 'No long-term contract — cancel any time',
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
    cta: 'Start now',
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
    // League Plus says its trial in the one sentence, with its own length (BUSINESS_DECISIONS 2026-11-18, Ask 7). Checkout
    // takes a payment method, so the old "No credit card required" line contradicted it (the free League that earned it is gone).
    freeNote: '',
    trialNote: '',
    saysTrial: true,
    features: [
      'Everything in Tournament Plus',
      'Public organization page',
      'House league — registration, divisions, seasons, and standings',
      'League-scoped communications',
      'Advanced member roles and permissions',
    ],
    cta: 'Start your League Plus trial',
    // Its own door (On-sale pages S2, G6 — `START_PATH_FOR_PLAN`): rendered as a link only while League Plus is on sale.
    ctaHref: '/start/league',
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
    // The Club trial takes a payment method at checkout (BUSINESS_DECISIONS.md 2026-09-25; T1 2026-11-16) — the one
    // sentence billing and checkout also use. It read "No credit card required" until then, which checkout contradicted.
    freeNote: '',
    trialNote: '',
    saysTrial: true,
    features: [
      'Everything in League Plus',
      // Says only what ships (BUSINESS_DECISIONS 2026-10-19): no invoicing until it exists. Bank reconciliation returned
      // after the BC9 walks passed 2026-11-07 (BANK_RECONCILIATION_PLAN R-c); it ships with the Bank tab's promote.
      'Accounting — club ledger, budget vs. actual, and costs split across teams, with coach reminders',
      'Bank reconciliation — check each statement against your books and find what’s missing',
      'Rep teams — tryouts, rosters, player documents, and season history',
      'Premium Coaches Portal for every coach on up to 15 teams, or up to 30 on Club · Association — no per-team fee',
      'Unlimited house league teams',
    ],
    cta: 'Start your Club trial',
    // Its own door (On-sale pages S2, G6 — `START_PATH_FOR_PLAN`): rendered as a link only while Club is on sale.
    ctaHref: '/start/club',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    // W4 (on-sale pages S3): Club's upper band as its own card. Full name always; never "Large". Same modules as Club; it
    // differs by team count and price only. Only the /pricing bands and the home grid render it (`marketingLayout`); the
    // in-product chooser is S4's (`IN_PRODUCT_PLANS`).
    key: 'club_large',
    name: 'Club · Association',
    tagline: 'The full Club platform for organizations with 16 to 30 teams.',
    monthlyPrice: formatPriceAmount(PLAN_CONFIG.club_large.monthlyPrice),
    annualPrice: formatPriceAmount(PLAN_CONFIG.club_large.annualPrice),
    annualTotal: `${formatPriceAmount(PLAN_CONFIG.club_large.annualPrice)} CAD / year`,
    annualSavings: `${formatAnnualSavings('club_large')}`,
    currency: 'CAD',
    period: '/mo',
    freeNote: '',
    trialNote: '',
    saysTrial: true,
    features: [
      'Everything in Club',
      // The limit counts the teams given a Premium Coaches Portal, never a team label (BUSINESS_DECISIONS 2026-11-19), so
      // W4's "every team type counted the same" is said as Club's own line says it (house league teams are unlimited).
      'Premium Coaches Portal for every coach on 16 to 30 teams — no per-team fee',
      'Start here, or move up from Club when you pass 15 teams',
    ],
    cta: 'Start your Club · Association trial',
    ctaHref: '/start/club',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
    // W5 (owner ask 2): a quote above the top band, never "talk to us" and never the interest form.
    quietLine: `More than 30 teams? Email ${FIELDLOGICHQ_CONTACT_EMAIL} for a custom quote.`,
  },
];

/** The in-product chooser (onboarding's change-plan window) keeps its four cards: buying Club · Association from inside
 *  the product is S4's, with its own screens (plan S4). */
const IN_PRODUCT_PLANS = PLANS.filter(p => p.key !== 'club_large');

/** Club's team-band line (W3): it points at Club · Association only while that plan has no card of its own. */
const CLUB_PORTAL_LINE_ALONE = 'Premium Coaches Portal for every coach on up to 15 teams — no per-team fee';
const CLUB_PORTAL_LINE_WITH_POINTER = 'Premium Coaches Portal for every coach on up to 15 teams, or up to 30 on Club · Association — no per-team fee';

/**
 * The /pricing plan grid in three audience bands (W58, Ask 21 as amended 2026-11-19; on-sale pages S3). A band shows only
 * its open plans; a closed plan stays in the strip. The league-and-club band labels say what a club runs, not a rank (League
 * Plus and Club are peers). The coaches band is the Premium Coaches Portal only: the free portal is reached through a
 * tournament's registration, not from this page (BUSINESS_DECISIONS 2026-11-19).
 */
const BANDS: Array<{ id: string; heading: string; line: string; keys: OrgPlan[]; labels?: Partial<Record<OrgPlan, string>> }> = [
  {
    id: 'tournament-plans',
    heading: 'Running a tournament',
    line: 'One event or a full calendar. Tournament is free; Tournament Plus adds public registration.',
    keys: ['tournament', 'tournament_plus'],
  },
  {
    id: 'league-club-plans',
    heading: 'Running a league or a club',
    line: 'League Plus is for a house league. Club is for a club that also runs rep teams, and it includes house league. Pick by what your board runs; you don’t need one before the other.',
    keys: ['league', 'club', 'club_large'],
    labels: {
      league: 'A house league',
      club: 'A club with rep teams · up to 15 teams',
      club_large: 'A club with 16 to 30 teams',
    },
  },
  {
    id: 'coach-plans',
    heading: 'Coaching one team',
    // The drawing's line opened "Every coach starts free."; the free portal is not sold here (2026-11-19), so the band
    // keeps only its second half.
    line: 'The Premium Coaches Portal is for the head coach running a competitive team’s whole season.',
    keys: ['team'],
  },
];

/** The League Plus card's first line in its band (W58): League Plus includes everything in Tournament Plus. */
const LEAGUE_BAND_LEAD = 'Running a tournament too? It’s in your plan.';

/**
 * The Premium Coaches Portal card — rendered ONLY in `marketingLayout` (the "live products lead"
 * ruling, 2026-08-08). It is a personal coach product, not an org tier, so:
 *   • it is NOT in `RENDERED_PLAN_KEYS` — an org operator's `currentPlan` can never be `team`;
 *   • its CTA always goes to the coach start flow — the org-operator `ctaHrefFor`/`ctaLabel`
 *     overrides (billing deep-links) deliberately do not apply to it, in every viewer state.
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
  cta: 'Start now',
  ctaHref: '/coaches/start?source=pricing',
  initialPlanInterest: ['coaches_portal'],
  initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
};

/**
 * The quiet "Not ready?" line under a paid live card's CTA — for the pricing page's skeptic, who
 * wants to see the product before paying. Text weight below the CTA, so the buying path loses
 * nothing. Marketing layout only. It pointed at the live demos until they were retired (owner
 * ruling 2026-11-25); it now points at each product's walkthrough, the self-serve proof that
 * remains (`/marketing`, 2026-11-25: never a free try of the live product).
 */
const WALKTHROUGH_LINKS: Partial<Record<OrgPlan, { href: string; label: string }>> = {
  tournament_plus: { href: '/for-tournament-organizers/walkthrough', label: 'See the 90-second walkthrough first' },
  team: { href: '/for-coaches/walkthrough', label: 'See the 90-second walkthrough first' },
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
 * and never an org's current plan). `club_large` (Club · Association) has its own card since on-sale
 * pages S3 (W4), on the marketing pages only; the in-product chooser keeps four cards until S4.
 *
 * Exported because a caller marking "the viewer's current plan" has to test membership of THIS
 * list, not of PLAN_CONFIG: a real, valid plan that no card here can match silently produced a
 * `currentPlan` that never matched anything — the platform's highest-paying tier went with no
 * "Current plan" badge at all until it had a card (/review, 2026-08-01).
 */
export const RENDERED_PLAN_KEYS: readonly OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club', 'club_large'];

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
   * The "live products lead" layout (owner-ratified 2026-08-08), for the marketing surfaces only:
   * plans whose gate is CLOSED collapse from full cards into one compact coming-soon strip below
   * the grid, and the Premium Coaches Portal joins the grid as a real card while its checkout is
   * open. In-app callers (onboarding wizard, billing) omit this and are unchanged. The split is
   * gate-driven, so the day a gate opens the plan is promoted to a full card without a deploy —
   * whoever opens a gate owns making that plan's destination page live in the same unit of work.
   */
  marketingLayout?: boolean;
  /**
   * /pricing only (W58, on-sale pages S3): once League Plus, Club or Club · Association is open, the cards sit in three
   * audience bands instead of one grid. While all three are closed the page keeps the one grid it had (S1's closed state).
   */
  bands?: boolean;
  /**
   * GST/HST Stage 2 Part 4 (T4): a quiet "plus applicable taxes" line under each price the buyer will be charged (not a
   * free or gated price). Every caller turns it on (onboarding, the home page, /pricing — /marketing ruled
   * the public copy 2026-11-05); the default stays off so a new caller opts in on purpose.
   */
  plusTax?: boolean;
  /**
   * The trial length checkout will use per plan (Ask 9 / `/billing` Q6): the server's `getPlanConfigOverrides()` — a
   * platform admin can override `trial_days`. A public visitor is a new customer, so this is the length their checkout
   * starts (a returning customer's checkout gives none, and says so on the plan step). Absent → the code value.
   */
  trialDays?: Partial<Record<OrgPlan, number>>;
}

export default function PricingSection({ gatingMap, onChoosePlan, currentPlan, planLoading, disabledPlans, ctaLabel, ctaHrefFor, initialBilling = 'monthly', order, featuredPlan, marketingLayout = false, bands = false, plusTax = false, trialDays }: PricingSectionProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);

  const sourcePlans = marketingLayout ? PLANS : IN_PRODUCT_PLANS;
  const orderedPlans = order
    ? [...sourcePlans].sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        return (ia === -1 ? sourcePlans.length : ia) - (ib === -1 ? sourcePlans.length : ib);
      })
    : sourcePlans;

  // Marketing layout: cards = live org plans + the coaches card when its checkout is open;
  // strip = whatever is still gated (including the coaches card if its gate ever re-closes). Club · Association never
  // joins the strip: Club's strip line names both bands, as it did before the card existed (S1's closed state).
  const teamGated = gatingMap.team ?? true;
  const stripPlans = marketingLayout
    ? [...orderedPlans.filter(p => (gatingMap[p.key] ?? false) && p.key !== 'club_large'), ...(teamGated ? [TEAM_PLAN] : [])]
    : [];
  const cardPlans = marketingLayout
    ? [...orderedPlans.filter(p => !(gatingMap[p.key] ?? false)), ...(teamGated ? [] : [TEAM_PLAN])]
    : orderedPlans;
  const banded = marketingLayout && bands && anyProgramPlanOpen(gatingMap);
  const clubLargeOpen = marketingLayout && isPlanOpen(gatingMap, 'club_large');

  function getSignupHref(plan: Plan) {
    // The coaches card owns its own destination (the coach start flow takes no plan/billing params). Every other plan
    // rides to its own door with the pick (The first look, Ask 6: every plan button keeps its plan) — the free
    // Tournament too, with no billing (G4, 2026-10-20), so the plan step opens on it.
    if (plan.key === 'team') return plan.ctaHref;
    return withStartPricing(plan.ctaHref, parseStartPricing(plan.key, billing));
  }

  /** The one trial sentence with the length checkout will use, or null where that length is 0 (no "0-day trial"). */
  function trialLineFor(plan: Plan): string | null {
    if (!plan.saysTrial) return null;
    const days = trialDays?.[plan.key] ?? PLAN_CONFIG[plan.key].trialDays;
    return days > 0 ? planTrialLine(days) : null;
  }

  function featuresFor(plan: Plan): string[] {
    if (plan.key !== 'club' || !clubLargeOpen) return plan.features;
    // W3: Club · Association has its own card beside Club, so Club's line no longer points at it.
    return plan.features.map(f => (f === CLUB_PORTAL_LINE_WITH_POINTER ? CLUB_PORTAL_LINE_ALONE : f));
  }

  // The plan this view leads with carries its ONE lime button and the 2px olive edge. Club leads the marketing pages once
  // it is on sale (Ask 32 B, ruled 2026-11-18; never the words "Most popular"); until then Tournament Plus does. The
  // onboarding chooser names its own via `featuredPlan`.
  const leadPlan = featuredPlan ?? (marketingLayout ? (isPlanOpen(gatingMap, 'club') ? 'club' : 'tournament_plus') : undefined);
  // The strip's button names the plans it covers ("Express interest in League Plus or Club"), never a bare "Express interest"
  // beside a card that is also one (label list row 4).
  const stripLabel = stripPlans.length > 0 && stripPlans.every(p => p.key === 'league' || p.key === 'club')
    ? interestButtonLabel(stripPlans.map(p => p.key))
    : interestButtonLabel();
  // §20 (3) under the cards: some card's own button starts a paid plan at a price shown (the current plan and an included
  // one carry none). Only the onboarding chooser posts; the marketing cards are links.
  const paidChoices = !onChoosePlan ? [] : cardPlans.filter(plan => !(gatingMap[plan.key] ?? false)
    && currentPlan !== plan.key && !(disabledPlans?.includes(plan.key) ?? false) && PLAN_CONFIG[plan.key].monthlyPrice > 0);

  function gridClass(count: number, extra = ''): string {
    return `${styles.pricingGrid} ${count === 3 ? styles.pricingGridThree : ''} ${count === 2 ? styles.pricingGridTwo : ''} ${count === 1 ? styles.pricingGridOne : ''} ${extra}`;
  }

  function renderCard(plan: Plan, bandLabel?: string, inBand = false, badgeRowEmpty = false) {
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
    const trialLine = isGated ? null : trialLineFor(plan);
    // W7: a plan that says its trial says it in BOTH views; the annual view adds its savings line above it.
    const displayNote = isGated
      ? GATED_PLAN_INTEREST_LINE
      : (isAnnual ? (plan.annualSavings ?? plan.trialNote) : (trialLine ?? plan.freeNote));
    const extraTrialNote = !isGated && isAnnual && trialLine ? trialLine : null;
    // A button that names a trial needs the trial (`/accounting` 2026-11-20): an override of 0 days says "Start Club".
    const defaultCta = plan.saysTrial && !trialLine ? `Start ${plan.name}` : plan.cta;
    // The one lime button: the lead plan's, unless the viewer is already on it (then it is a quiet door).
    const primary = isFeatured && !isCurrent && !isIncluded;
    const pill = isGated ? gatedPlanTag(plan.key) : isCurrent ? 'Current plan' : null;

    return (
      <div key={plan.key} className={`${styles.planCard} ${isFeatured ? styles.planCardFeatured : ''} ${inBand && plan.key === 'team' ? styles.planCardWide : ''}`}>
        {/* Band 1: header. The first line holds the card's small label (the league-and-club band's "what a club runs")
            and its status pill — on the right when there is a label (the one place for the pill, owner 2026-11-19). The
            line is always chip-high, so a card with neither still starts its name level with the cards beside it. */}
        <div>
          <div className={`${styles.planBadgeRow} ${bandLabel ? styles.planBadgeRowLabelled : ''} ${badgeRowEmpty ? styles.planBadgeRowNone : ''}`}>
            {bandLabel && <span className={styles.planBandLabel}>{bandLabel}</span>}
            {pill && <span className={kit.tag}>{pill}</span>}
          </div>
          <p className={kit.title}>{plan.name}</p>
          <p className={`${kit.small} ${styles.planTagline}`}>{plan.tagline}</p>
          {inBand && plan.key === 'league' && !isGated && (
            <p className={`${kit.small} ${styles.planLead}`}>{LEAGUE_BAND_LEAD}</p>
          )}
        </div>

        {/* Band 2: price. */}
        <div className={styles.planPriceBlock}>
          <div className={styles.planPrice}>
            <span className={isGated ? kit.title : kit.price}>
              {displayPrice}
            </span>
            {!isGated && plan.currency && (
              <span className={kit.small}>{plan.currency}</span>
            )}
            {!isGated && (isAnnual || plan.period) && (
              <span className={kit.small}>{isAnnual ? '/year' : plan.period}</span>
            )}
          </div>
          {/* One line on every card while it is on, so the cards' price blocks stay level. */}
          {plusTax && <p className={`${kit.small} ${styles.planNote}`}>{!isGated && plan.currency ? BILLING_TAX_WORDS.plusTax : null}</p>}
          <p className={`${kit.small} ${styles.planNote}`}>{displayNote}</p>
          {extraTrialNote && <p className={`${kit.small} ${styles.planNote}`}>{extraTrialNote}</p>}
        </div>

        {/* Band 3: divider */}
        <hr className={styles.planDivider} />

        {/* Band 4: features */}
        <ul className={`${kit.ticks} ${styles.planFeatures}`}>
          {featuresFor(plan).map(f => (
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
            {interestButtonLabel()}
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
        {!isGated && plan.quietLine && (
          <p className={`${kit.small} ${styles.planDemoLine}`}>{plan.quietLine}</p>
        )}
        {marketingLayout && !isGated && !onChoosePlan && WALKTHROUGH_LINKS[plan.key] && (
          <p className={`${kit.small} ${styles.planDemoLine}`}>
            Not ready?{' '}
            <Link href={WALKTHROUGH_LINKS[plan.key]!.href} className={`${kit.link} ${styles.planDemoLink}`}>
              {WALKTHROUGH_LINKS[plan.key]!.label}
            </Link>
          </p>
        )}
        </div>
      </div>
    );
  }

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

      {banded ? (
        /* The three audience bands (W58). Each shows only its open plans; a band with none does not render. */
        <div className={styles.bands}>
          {BANDS.map(band => {
            const plans = cardPlans.filter(p => band.keys.includes(p.key));
            if (plans.length === 0) return null;
            return (
              <section key={band.id} id={band.id} className={styles.band} aria-labelledby={`${band.id}-heading`}>
                <div className={styles.bandHead}>
                  {/* Card-title size, so "Available now" stays the page's one display heading (Ask 34). */}
                  <h3 id={`${band.id}-heading`} className={kit.title}>{band.heading}</h3>
                  <p className={`${kit.small} ${styles.bandLine}`}>{band.line}</p>
                </div>
                <div className={gridClass(plans.length)}>
                  {plans.map(plan => renderCard(plan, band.labels?.[plan.key], true, !plans.some(p => band.labels?.[p.key] || currentPlan === p.key)))}
                </div>
                {band.keys.includes('team') && isPlanOpen(gatingMap, 'club') && (
                  <p className={`${kit.small} ${styles.bandFoot}`}>
                    If your club is on Club or Club · Association, <strong>every coach’s Premium Coaches Portal is
                    included.</strong>{' '}
                    <Link href="/for-clubs" className={`${kit.link} ${styles.planDemoLink}`}>See what Club includes</Link>
                  </p>
                )}
              </section>
            );
          })}
          {/* The availability line under the bands (Ask 15; /accounting, /legal), once a club or league can buy here. */}
          <p className={`${kit.small} ${styles.bandsAvailability}`}>{PLAN_AVAILABILITY_LINE_ANYONE}</p>
        </div>
      ) : (
        /* Plan cards */
        <div className={gridClass(cardPlans.length)}>
          {cardPlans.map(plan => renderCard(plan))}
        </div>
      )}
      {/* §20 (3) once under the cards, as under the billing table — only where the cards' own buttons start a paid plan
          (onboarding's chooser; the marketing pages' cards are links to sign-up, not purchases). Step 6.3, drawing tab 5. */}
      {/* "If your plan starts with a trial" when a paid card's plan has trial days (checkout decides — `/legal` 2026-11-09). */}
      {paidChoices.length > 0 && <PlanTermsLine trial={Math.max(...paidChoices.map(plan => PLAN_CONFIG[plan.key].trialDays))} />}

      {/* Marketing coming-soon strip — the gated plans, at footnote weight. Visible, priced, and
          capturing interest, but never peers of what's actually on sale. */}
      {marketingLayout && stripPlans.length > 0 && (
        <div className={`${kit.card} ${kit.cardFlat} ${styles.comingSoonStrip}`}>
          {/* Every closed plan wears the one tag since 2026-11-20 (League Plus joined Club's "Coming soon"), so the strip
              says it once and no name repeats it (W6 simplified with it, plan S3). */}
          <span className={kit.tag}>{gatedPlanTag(stripPlans[0].key)}</span>
          <p className={`${kit.small} ${styles.comingSoonStripBody}`}>
            {stripPlans.map((p, i) => (
              <span key={p.key}>
                {i > 0 && ' · '}
                <strong className={styles.comingSoonStripName}>{p.name}</strong>
                {' '}({p.monthlyPrice}/mo) — {GATED_STRIP_LINES[p.key] ?? p.tagline}
              </span>
            ))}
            {'. '}{GATED_PLAN_INTEREST_LINE}
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
