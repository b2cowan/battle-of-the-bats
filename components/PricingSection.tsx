'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import styles from './PricingSection.module.css';

type Billing = 'monthly' | 'annual';

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
  features: string[];
  cta: string;
  ctaHref: string;
}

const PLANS: Plan[] = [
  {
    key: 'tournament',
    name: 'Tournament',
    tagline: 'Organize tournaments, track scores, and publish results — free forever.',
    monthlyPrice: 'Free',
    annualPrice: null,
    annualTotal: null,
    annualSavings: null,
    currency: null,
    period: '',
    freeNote: 'No credit card required',
    trialNote: 'No credit card required',
    features: [
      'Tournament scheduling',
      'Score entry and results',
      'Standings',
      'Field and diamond management',
      '3 staff / admin seats',
      '1 active tournament',
    ],
    cta: 'Get Started Free',
    ctaHref: '/auth/signup',
  },
  {
    key: 'tournament_plus',
    name: 'Tournament Plus',
    tagline: 'Run unlimited events simultaneously with automated scheduling, brackets, and communications.',
    monthlyPrice: '$39',
    annualPrice: '$390',
    annualTotal: '$390 CAD / year',
    annualSavings: 'Save $78 — 2 months free',
    currency: 'CAD',
    period: '/mo',
    freeNote: '14-day free trial',
    trialNote: '14-day free trial',
    features: [
      'Everything in Tournament',
      'Automated schedule generation',
      'Bracket generator',
      'Email announcements and communications',
      'Tournament archives and history',
      'Unlimited simultaneous tournaments',
      '5 staff / admin seats',
      'Unlimited officials seats',
    ],
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
  },
  {
    key: 'club',
    name: 'Club',
    tagline: 'The complete platform for full-service clubs — tournaments, house league, rep teams, and accounting.',
    monthlyPrice: '$179',
    annualPrice: '$1,790',
    annualTotal: '$1,790 CAD / year',
    annualSavings: 'Save $358 — 2 months free',
    currency: 'CAD',
    period: '/mo',
    freeNote: '14-day free trial',
    trialNote: '14-day free trial',
    features: [
      'Everything in League',
      'Accounting module — org ledger, team invoicing, payment reconciliation, expense tracking',
      'Rep Teams module — tryouts, rosters, player documents, coaches portal, team finances',
      'Unlimited staff / admin seats',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
  },
];

const CTA_CLASS = 'block font-mono text-xs uppercase tracking-widest font-bold text-center bg-logic-lime text-pitch-black px-4 py-3 hover:bg-white transition-colors w-full';

export default function PricingSection() {
  const [billing, setBilling] = useState<Billing>('monthly');

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
            <div key={plan.key} className={styles.planCard}>
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
                  <li key={f} className={styles.planRow}>
                    <Check size={13} className={styles.rowCheck} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.ctaHref} className={CTA_CLASS}>
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
