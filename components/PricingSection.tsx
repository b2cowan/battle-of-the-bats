'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import styles from './PricingSection.module.css';

type Billing = 'monthly' | 'annual';

interface PlanFeature {
  label: string;
}

interface Plan {
  key: string;
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
  highlight: boolean;
  features: PlanFeature[];
  notIncludedNote: string | null;
  upgradeNudge: string | null;
  popularBlurb: string | null;
  cta: string;
  ctaHref: string;
}

const PLANS: Plan[] = [
  {
    key: 'tournament',
    name: 'Tournament',
    tagline: 'Everything you need to run a basic tournament.',
    monthlyPrice: 'Free',
    annualPrice: null,
    annualTotal: null,
    annualSavings: null,
    currency: null,
    period: '',
    freeNote: 'No credit card required',
    trialNote: 'No credit card required',
    highlight: false,
    features: [
      { label: 'Manual tournament scheduling' },
      { label: 'Manual score entry' },
      { label: 'Basic standings' },
      { label: 'Field and diamond management' },
      { label: '3 staff / admin seats' },
      { label: '1 active tournament' },
    ],
    notIncludedNote: null,
    upgradeNudge: 'Need automated scheduling or bracket tools? → Tournament Plus',
    popularBlurb: null,
    cta: 'Get Started Free',
    ctaHref: '/auth/signup',
  },
  {
    key: 'tournament_plus',
    name: 'Tournament Plus',
    tagline: 'Professional tournament management without the league complexity.',
    monthlyPrice: '$39',
    annualPrice: '$390',
    annualTotal: '$390 CAD / year',
    annualSavings: 'Save $78 — 2 months free',
    currency: 'CAD',
    period: '/mo',
    freeNote: '14-day free trial',
    trialNote: '14-day free trial',
    highlight: false,
    features: [
      { label: 'Everything in Tournament' },
      { label: 'Automated schedule generation' },
      { label: 'Bracket generator' },
      { label: 'Email announcements and communications' },
      { label: 'Tournament archives and history' },
      { label: 'Unlimited simultaneous tournaments' },
      { label: '5 staff / admin seats' },
      { label: 'Unlimited officials seats' },
    ],
    notIncludedNote: 'Built for tournament organizers — house league, accounting, and rep team tools not included.',
    upgradeNudge: 'Running a public-facing league? → League',
    popularBlurb: null,
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
  },
  {
    key: 'league',
    name: 'League',
    tagline: 'Manage your league, registrations, and public presence in one place.',
    monthlyPrice: '$89',
    annualPrice: '$890',
    annualTotal: '$890 CAD / year',
    annualSavings: 'Save $178 — 2 months free',
    currency: 'CAD',
    period: '/mo',
    freeNote: '14-day free trial',
    trialNote: '14-day free trial',
    highlight: false,
    features: [
      { label: 'Everything in Tournament Plus' },
      { label: 'Public organization page' },
      { label: 'House League module' },
      { label: 'Registration workflows' },
      { label: 'Division and season management' },
      { label: 'League-scoped communications' },
      { label: 'Advanced member roles and permissions' },
      { label: '10 staff / admin seats' },
    ],
    notIncludedNote: null,
    upgradeNudge: 'Managing finances, tryouts, or competitive teams? → Club',
    popularBlurb: null,
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
  },
  {
    key: 'club',
    name: 'Club',
    tagline: 'The complete operating system for your sports organization.',
    monthlyPrice: '$179',
    annualPrice: '$1,790',
    annualTotal: '$1,790 CAD / year',
    annualSavings: 'Save $358 — 2 months free',
    currency: 'CAD',
    period: '/mo',
    freeNote: '14-day free trial',
    trialNote: '14-day free trial',
    highlight: true,
    features: [
      { label: 'Everything in League' },
      { label: 'Accounting module — org ledger, team invoicing, payment reconciliation, expense tracking' },
      { label: 'Rep Teams module — tryouts, rosters, player documents, coaches portal, team finances' },
      { label: 'Unlimited staff / admin seats' },
    ],
    notIncludedNote: null,
    upgradeNudge: null,
    popularBlurb: 'Most organizations choose Club because of what they stop doing: hunting down payments, managing tryouts over email, reconciling team finances in spreadsheets.',
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
  },
];

export default function PricingSection() {
  const [billing, setBilling] = useState<Billing>('annual');

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
          const isAnnual = billing === 'annual' && plan.annualPrice;
          const displayPrice = isAnnual ? plan.annualPrice! : plan.monthlyPrice;
          const displayNote  = isAnnual
            ? (plan.annualSavings ?? plan.trialNote)
            : plan.freeNote;

          return (
            <div key={plan.key} className={styles.planWrapper}>
              {plan.highlight
                ? <div className={styles.popularBadge}>Most Popular</div>
                : <div className={styles.popularSpacer} aria-hidden />}

              <div className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}>
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.planTagline}>{plan.tagline}</p>

                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>{displayPrice}</span>
                  {!isAnnual && plan.currency && (
                    <span className={styles.planCurrency}>{plan.currency}</span>
                  )}
                  {!isAnnual && plan.period && (
                    <span className={styles.planPeriod}>{plan.period}</span>
                  )}
                </div>
                {isAnnual && plan.annualTotal && (
                  <p className={styles.planAnnualTotal}>{plan.annualTotal}</p>
                )}
                <p className={styles.planNote}>{displayNote}</p>

                <hr className={styles.planDivider} />

                <ul className={styles.planFeatures}>
                  {plan.features.map(f => (
                    <li key={f.label} className={styles.planRow}>
                      <Check size={13} className={styles.rowCheck} />
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                {plan.popularBlurb && (
                  <p className={styles.popularBlurb}>{plan.popularBlurb}</p>
                )}

                {plan.notIncludedNote && (
                  <p className={styles.notIncludedNote}>{plan.notIncludedNote}</p>
                )}

                <Link
                  href={plan.ctaHref}
                  className={
                    plan.highlight
                      ? 'block font-mono text-xs uppercase tracking-widest font-bold text-center bg-logic-lime text-pitch-black px-4 py-3 hover:bg-white transition-colors w-full'
                      : 'block font-mono text-xs uppercase tracking-widest text-center border border-blueprint-blue/40 text-fl-text px-4 py-3 hover:border-blueprint-blue transition-colors w-full'
                  }
                >
                  {plan.cta}
                </Link>

                {plan.upgradeNudge && (
                  <p className={styles.upgradeNudge}>{plan.upgradeNudge}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
