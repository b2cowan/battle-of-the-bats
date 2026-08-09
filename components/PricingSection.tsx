'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import EarlyAccessModalTrigger from './EarlyAccessModalTrigger';
import { PLAN_CONFIG, formatPriceAmount, formatAnnualSavings, isFoundingSeasonPromoActive } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import styles from './PricingSection.module.css';

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
  /** Shown under the price INSTEAD of freeNote while this plan's Founding Season promo is active
   *  (and the card's CTA falls back from plan.cta to "Start now" once it isn't) — so promo wording
   *  expires with the promo instead of waiting on a January runbook (/review 2026-08-08). */
  promoNote?: string;
  features: string[];
  /** Short list used inside the onboarding wizard modal — 4–5 key differentiators only */
  compactFeatures: string[];
  cta: string;
  ctaHref: string;
  initialPlanInterest?: string[];
  initialFeaturesInterested?: string[];
}

const PLANS: Plan[] = [
  {
    key: 'tournament',
    name: 'Tournament',
    tagline: 'Start with one small tournament, basic registration, FieldLogicHQ styling, scores, and public results - free forever.',
    monthlyPrice: 'Free',
    annualPrice: null,
    annualTotal: null,
    annualSavings: null,
    currency: null,
    period: '',
    freeNote: 'No credit card required',
    trialNote: 'No credit card required',
    features: [
      'Manual tournament scheduling',
      'Basic standard team registration',
      'Waitlist management and team status tracking',
      'Score entry and results',
      'Standings',
      'Venue management',
      'Public news posts',
      'Basic team/contact email',
      'Default FieldLogicHQ styling',
      '3 staff / admin seats',
      '1 tournament slot',
    ],
    compactFeatures: [
      '1 tournament slot',
      'Manual scheduling & score entry',
      'Basic team registration',
      'Public results & standings',
      '3 staff / admin seats',
    ],
    cta: 'Get Started Free',
    ctaHref: '/auth/signup',
  },
  {
    key: 'tournament_plus',
    name: 'Tournament Plus',
    tagline: 'Run serious tournament operations with registration control, automation, branding, reporting, and repeat-event tools.',
    monthlyPrice: formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice),
    annualPrice: formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice),
    annualTotal: `${formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)} CAD / year`,
    annualSavings: `${formatAnnualSavings('tournament_plus')}`,
    currency: 'CAD',
    period: '/mo',
    freeNote: 'No contracts — cancel anytime',
    trialNote: 'No contracts — cancel anytime',
    promoNote: 'Free through Dec 31, 2026 · no credit card required',
    features: [
      'Everything in Tournament',
      'Unlimited tournament slots',
      'Automated schedule generation and playoff bracket builder',
      'Custom registration fields, file uploads, and waitlist promotion',
      'Registration exports — Excel, CSV, and PDF',
      'Advanced payment tracking and post-tournament reporting',
      'Full branding control — no FieldLogicHQ badge',
      'Permanent sealed archives, tournament cloning, and targeted announcements',
      'Unlimited staff / admin seats · unlimited officials',
    ],
    compactFeatures: [
      'Everything in Tournament',
      'Unlimited tournament slots',
      'Automated scheduling and bracket builder',
      'Full branding control',
      'Unlimited staff / admin seats · unlimited officials',
    ],
    cta: 'Start free — no credit card required',
    ctaHref: '/auth/signup',
  },
  {
    key: 'league',
    name: 'League Plus',
    tagline: 'A preview of house league, registration, and public-site tools currently being refined.',
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
      'House League — registration, divisions, seasons, and standings',
      'League-scoped communications',
      'Advanced member roles and permissions',
    ],
    compactFeatures: [
      'Everything in Tournament Plus',
      'House League — registration, divisions, and standings',
      'Public organization page',
      'Registration workflows',
      'Advanced member roles and permissions',
    ],
    cta: 'Start free — no credit card required',
    ctaHref: '/auth/signup',
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
    freeNote: 'No credit card required',
    trialNote: 'No credit card required',
    features: [
      'Everything in League Plus',
      'Accounting — org ledger, invoicing, expense tracking, and payment reconciliation',
      'Rep Teams — tryouts, rosters, player documents, and season history',
      'Premium Coaches Portal for your whole coaching staff — every team included, no per-team fee',
      'Up to 15 teams — or up to 30 on Club · Association',
    ],
    compactFeatures: [
      'Everything in League Plus',
      'Accounting — org ledger, invoicing & reconciliation',
      'Rep Teams — tryouts, rosters & documents',
      'Whole coaching staff included — no per-team fee',
    ],
    cta: 'Start free — no credit card required',
    ctaHref: '/auth/signup',
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
  promoNote: 'Free through Dec 31, 2026 · no credit card required',
  features: [
    'Full roster management with positions and season history',
    'Lineup builder with game-by-game history — exportable to PDF',
    'Schedule, attendance, and availability tracking',
    'Team budget, player dues, and payment tracking',
    'Document management — consent forms, medical notes, eligibility',
    'Works standalone — no organization account required',
  ],
  compactFeatures: [
    'Roster, lineups, and schedule',
    'Team budget and dues tracking',
    'Document management',
    'Works standalone — no org account',
  ],
  cta: 'Start free — no credit card required',
  ctaHref: '/coaches/start?source=pricing',
  initialPlanInterest: ['coaches_portal'],
  initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
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

const CTA_CLASS = 'block font-mono text-xs uppercase tracking-widest font-bold text-center bg-logic-lime text-pitch-black px-4 py-3 hover:bg-white transition-colors w-full border-0 cursor-pointer';

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
  /** Use condensed 5-item feature list and tighter spacing — for wizard/modal contexts */
  compact?: boolean;
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
}

export default function PricingSection({ gatingMap, onChoosePlan, currentPlan, planLoading, disabledPlans, ctaLabel, ctaHrefFor, initialBilling = 'monthly', compact = false, order, featuredPlan, marketingLayout = false }: PricingSectionProps) {
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

  function getSignupHref(plan: Plan) {
    // Tournament's CTA is plain sign-up; the coaches card owns its own destination (the coach
    // start flow takes no plan/billing params).
    if (plan.key === 'tournament' || plan.key === 'team') return plan.ctaHref;

    const params = new URLSearchParams({
      plan: plan.key,
      billing,
    });
    return `${plan.ctaHref}?${params.toString()}`;
  }

  return (
    <>
      {/* Billing toggle */}
      <div className={`${styles.toggleWrap} ${compact ? styles.toggleWrapCompact : ''}`}>
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
      <div className={`${styles.pricingGrid} ${compact ? styles.pricingGridCompact : ''} ${cardPlans.length === 3 ? styles.pricingGridThree : ''} ${cardPlans.length === 2 ? styles.pricingGridTwo : ''}`}>
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
          const isFeatured = !isGated && featuredPlan === plan.key;
          const isAnnual = !isGated && billing === 'annual' && plan.annualPrice;
          const displayPrice = isGated ? 'Coming soon' : (isAnnual ? plan.annualPrice! : plan.monthlyPrice);
          // Promo wording only while the promo is actually running — afterwards the card falls
          // back to its permanent note and a truthful "Start now" CTA on its own, with no runbook.
          const promoActive = !!plan.promoNote && isFoundingSeasonPromoActive(plan.key);
          const displayNote = isGated
            ? 'Join early access for launch updates'
            : (isAnnual ? (plan.annualSavings ?? plan.trialNote) : (promoActive ? plan.promoNote! : plan.freeNote));
          const defaultCta = plan.promoNote && !promoActive ? 'Start now' : plan.cta;

          return (
            <div key={plan.key} className={`${styles.planCard} ${isGated ? styles.planCardPending : ''} ${isCurrent ? styles.planCardCurrent : ''} ${isFeatured ? styles.planCardFeatured : ''}`}>
              {/* Band 1: header */}
              <div className={styles.planHeader}>
                <div className={styles.planHeaderTop}>
                  <p className={styles.planName}>{plan.name}</p>
                  {isGated && (
                    <span className={styles.statusBadge}>Coming soon</span>
                  )}
                  {!isGated && isCurrent && (
                    <span className={styles.currentBadge}>Current plan</span>
                  )}
                </div>
                {!isGated && isFoundingSeasonPromoActive(plan.key) && (
                  <div className={styles.foundingSeasonBadge}>
                    <span className={styles.foundingSeasonBadgeLabel}>⬡ Founding Season — Free until Jan 1, 2027</span>
                    <span className={styles.foundingSeasonBadgeSub}>Normally {formatPriceAmount(PLAN_CONFIG[plan.key].monthlyPrice)}/month</span>
                  </div>
                )}
                <p className={styles.planTagline}>{plan.tagline}</p>
              </div>

              {/* Band 2: price */}
              <div className={styles.planPriceBlock}>
                <div className={styles.planPrice}>
                  <span className={`${styles.planAmount} ${isGated ? styles.pendingAmount : ''}`}>
                    {displayPrice}
                  </span>
                  {!isGated && plan.currency && (
                    <span className={styles.planCurrency}>{plan.currency}</span>
                  )}
                  {!isGated && (isAnnual || plan.period) && (
                    <span className={styles.planPeriod}>{isAnnual ? '/year' : plan.period}</span>
                  )}
                </div>
                <p className={styles.planNote}>{displayNote}</p>
              </div>

              {/* Band 3: divider */}
              <hr className={styles.planDivider} />

              {/* Band 4: features */}
              <ul className={styles.planFeatures}>
                {(compact ? plan.compactFeatures : plan.features).map(f => (
                  <li key={f} className={styles.planRow}>
                    <Check size={13} className={styles.rowCheck} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* Band 5: CTA */}
              {isGated ? (
                <EarlyAccessModalTrigger
                  className={`${CTA_CLASS} ${styles.pendingCta}`}
                  initialPlanInterest={plan.initialPlanInterest}
                  initialFeaturesInterested={plan.initialFeaturesInterested}
                >
                  Express interest
                </EarlyAccessModalTrigger>
              ) : onChoosePlan ? (
                <button
                  type="button"
                  className={`${CTA_CLASS} ${(isCurrent || isIncluded) ? styles.ctaDisabled : ''}`}
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
                  className={`${CTA_CLASS}${isCurrent ? ` ${styles.viewerCurrentCta}` : ''}`}
                >
                  {(takesOverrides ? ctaLabel?.(plan.key) : undefined) ?? defaultCta}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Marketing coming-soon strip — the gated plans, at footnote weight. Visible, priced, and
          capturing interest, but never peers of what's actually on sale. */}
      {marketingLayout && stripPlans.length > 0 && (
        <div className={styles.comingSoonStrip}>
          <span className={styles.comingSoonStripLabel}>Coming soon</span>
          <span className={styles.comingSoonStripBody}>
            {stripPlans.map((p, i) => (
              <span key={p.key}>
                {i > 0 && ' · '}
                <strong className={styles.comingSoonStripName}>{p.name}</strong>
                {' '}({p.monthlyPrice}/mo) — {GATED_STRIP_LINES[p.key] ?? p.tagline}
              </span>
            ))}
            {'. '}Express interest to be notified when self-serve checkout opens.
          </span>
          <EarlyAccessModalTrigger
            className={styles.comingSoonStripCta}
            initialPlanInterest={[...new Set(stripPlans.flatMap(p => p.initialPlanInterest ?? []))]}
            initialFeaturesInterested={[...new Set(stripPlans.flatMap(p => p.initialFeaturesInterested ?? []))]}
          >
            Express interest →
          </EarlyAccessModalTrigger>
        </div>
      )}
    </>
  );
}
