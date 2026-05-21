'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import EarlyAccessModalTrigger from './EarlyAccessModalTrigger';
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
      'Score entry and results',
      'Standings',
      'Field and diamond management',
      'Public news posts',
      'Basic team/contact email',
      'Default FieldLogicHQ styling',
      'Powered by FieldLogicHQ badge',
      '3 staff / admin seats',
      '1 tournament slot',
    ],
    cta: 'Get Started Free',
    ctaHref: '/auth/signup',
  },
  {
    key: 'tournament_plus',
    name: 'Tournament Plus',
    tagline: 'Run serious tournament operations with registration control, automation, branding, reporting, and repeat-event tools.',
    monthlyPrice: '$39',
    annualPrice: '$390',
    annualTotal: '$390 CAD / year',
    annualSavings: 'Save $78 - 2 months free. 14-day trial first',
    currency: 'CAD',
    period: '/mo',
    freeNote: '14-day trial. Payment details at signup',
    trialNote: '14-day trial',
    features: [
      'Everything in Tournament',
      'Unlimited tournament slots',
      '10 staff / admin seats',
      'Registration Control Bundle',
      'Custom registration questions and file uploads',
      'Registration exports — Excel, CSV, and PDF for check-in, insurance, and reporting',
      'Schedule and results exports with iCal calendar download',
      'Customizable PDF templates with your logo, header, and footer',
      'Bulk registration actions',
      'Division capacity and waitlist automation',
      'Full branding control',
      'Automated schedule generation',
      'Playoff bracket generator',
      'Permanent sealed archives',
      'Tournament cloning and targeted announcements',
      'Post-tournament summary reporting',
      'Unlimited officials seats',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
  },
  {
    key: 'league',
    name: 'League',
    tagline: 'A preview of house league, registration, and public-site tools currently being refined.',
    monthlyPrice: '$89',
    annualPrice: '$890',
    annualTotal: '$890 CAD / year',
    annualSavings: 'Save $178 – 2 months free. 30-day trial first',
    currency: 'CAD',
    period: '/mo',
    freeNote: '30-day trial. Payment details at signup',
    trialNote: '30-day trial',
    features: [
      'Everything in Tournament Plus',
      'Public organization page',
      'House League module',
      'Registration workflows',
      'Division and season management',
      'League-scoped communications',
      'Advanced member roles and permissions',
      '10 staff / admin seats',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    key: 'club',
    name: 'Club',
    tagline: 'A preview of the full club operating system for rep teams, accounting, and league workflows.',
    monthlyPrice: '$179',
    annualPrice: '$1,790',
    annualTotal: '$1,790 CAD / year',
    annualSavings: 'Save $358 – 2 months free. 90-day trial first',
    currency: 'CAD',
    period: '/mo',
    freeNote: '90-day trial. Payment details at signup',
    trialNote: '90-day trial',
    features: [
      'Everything in League',
      'Accounting module - org ledger, team invoicing, payment reconciliation, expense tracking',
      'Rep Teams module - tryouts, rosters, player documents, coaches portal, team finances',
      'Unlimited staff / admin seats',
    ],
    cta: 'Start Free Trial',
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
}

export default function PricingSection({ gatingMap, onChoosePlan, currentPlan, planLoading, disabledPlans, ctaLabel, initialBilling = 'monthly' }: PricingSectionProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling);

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
      <div className={styles.pricingGrid}>
        {PLANS.map(plan => {
          const isGated = gatingMap[plan.key] ?? false;
          const isCurrent = !!onChoosePlan && currentPlan === plan.key;
          const isIncluded = !!onChoosePlan && (disabledPlans?.includes(plan.key) ?? false);
          const isAnnual = !isGated && billing === 'annual' && plan.annualPrice;
          const displayPrice = isGated ? 'Coming soon' : (isAnnual ? plan.annualPrice! : plan.monthlyPrice);
          const displayNote = isGated
            ? 'Join early access for launch updates'
            : (isAnnual ? (plan.annualSavings ?? plan.trialNote) : plan.freeNote);

          return (
            <div key={plan.key} className={`${styles.planCard} ${isGated ? styles.planCardPending : ''} ${isCurrent ? styles.planCardCurrent : ''}`}>
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
                {plan.features.map(f => (
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
                  Join Early Access
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
