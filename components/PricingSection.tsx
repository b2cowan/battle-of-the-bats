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
    freeNote: 'Free through Dec 31, 2026 · no credit card required',
    trialNote: 'Free through Dec 31, 2026 · no credit card required',
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

const CTA_CLASS = 'block font-mono text-xs uppercase tracking-widest font-bold text-center bg-logic-lime text-pitch-black px-4 py-3 hover:bg-white transition-colors w-full border-0 cursor-pointer';

interface PricingSectionProps {
  gatingMap: Record<OrgPlan, boolean>;
  onChoosePlan?: (planKey: OrgPlan, billingCycle: Billing) => void;
  currentPlan?: OrgPlan;
  planLoading?: OrgPlan | null;
  disabledPlans?: OrgPlan[];
  ctaLabel?: (planKey: OrgPlan) => string | undefined;
  initialBilling?: Billing;
  /** Use condensed 5-item feature list and tighter spacing — for wizard/modal contexts */
  compact?: boolean;
  /** Optional display order by plan key. Plans omitted here fall to the end in default order. */
  order?: OrgPlan[];
  /** Optional plan key to visually feature (highlighted border). */
  featuredPlan?: OrgPlan;
}

export default function PricingSection({ gatingMap, onChoosePlan, currentPlan, planLoading, disabledPlans, ctaLabel, initialBilling = 'monthly', compact = false, order, featuredPlan }: PricingSectionProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);

  const orderedPlans = order
    ? [...PLANS].sort((a, b) => {
        const ia = order.indexOf(a.key);
        const ib = order.indexOf(b.key);
        return (ia === -1 ? PLANS.length : ia) - (ib === -1 ? PLANS.length : ib);
      })
    : PLANS;

  function getSignupHref(plan: Plan) {
    if (plan.key === 'tournament') return plan.ctaHref;

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
      <div className={`${styles.pricingGrid} ${compact ? styles.pricingGridCompact : ''}`}>
        {orderedPlans.map(plan => {
          const isGated = gatingMap[plan.key] ?? false;
          const isCurrent = !!onChoosePlan && currentPlan === plan.key;
          const isIncluded = !!onChoosePlan && (disabledPlans?.includes(plan.key) ?? false);
          const isFeatured = !isGated && featuredPlan === plan.key;
          const isAnnual = !isGated && billing === 'annual' && plan.annualPrice;
          const displayPrice = isGated ? 'Coming soon' : (isAnnual ? plan.annualPrice! : plan.monthlyPrice);
          const displayNote = isGated
            ? 'Join early access for launch updates'
            : (isAnnual ? (plan.annualSavings ?? plan.trialNote) : plan.freeNote);

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
                        : (ctaLabel?.(plan.key) ?? plan.cta)}
                </button>
              ) : (
                <Link href={getSignupHref(plan)} className={CTA_CLASS}>
                  {plan.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
