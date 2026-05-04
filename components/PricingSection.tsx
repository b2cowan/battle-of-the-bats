'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import styles from './PricingSection.module.css';

type Billing = 'monthly' | 'annual';

interface PlanFeature {
  label: string;
  ok: boolean;
}

interface Plan {
  name: string;
  monthlyAmount: string;
  annualAmount: string | null;
  period: string;
  monthlyNote: string;
  annualNote: string;
  highlight: boolean;
  features: PlanFeature[];
  cta: string;
  ctaHref: string;
  ctaClass: string;
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    monthlyAmount: 'Free',
    annualAmount: null,
    period: '',
    monthlyNote: 'No credit card required',
    annualNote: 'No credit card required',
    highlight: false,
    features: [
      { label: '1 active tournament',     ok: true  },
      { label: '16 teams per tournament', ok: true  },
      { label: '2 age groups',            ok: true  },
      { label: '3 diamonds / venues',     ok: true  },
      { label: '1 admin seat',            ok: true  },
      { label: 'Public tournament page',  ok: true  },
      { label: 'Schedule & results',      ok: true  },
      { label: 'Playoff wizard',          ok: true  },
      { label: 'Team registration form',  ok: true  },
      { label: 'CSV export',              ok: false },
      { label: 'Email notifications',     ok: false },
      { label: 'Custom org logo',         ok: false },
      { label: 'Public bracket view',     ok: false },
    ],
    cta: 'Get Started Free',
    ctaHref: '/auth/signup',
    ctaClass: 'btn btn-outline',
  },
  {
    name: 'Pro',
    monthlyAmount: '$29',
    annualAmount: '$20.75',
    period: '/mo',
    monthlyNote: '14-day free trial included',
    annualNote: 'billed $249/year — save 26%',
    highlight: true,
    features: [
      { label: '5 active tournaments',    ok: true },
      { label: '64 teams per tournament', ok: true },
      { label: 'Unlimited age groups',    ok: true },
      { label: 'Unlimited diamonds',      ok: true },
      { label: '5 admin seats',           ok: true },
      { label: 'Everything in Starter',   ok: true },
      { label: 'CSV export',              ok: true },
      { label: 'Email notifications',     ok: true },
      { label: 'Custom org logo',         ok: true },
      { label: 'Public bracket view',     ok: true },
      { label: 'Historical archive',      ok: true },
      { label: 'Waitlist management',     ok: true },
      { label: 'Priority support',        ok: true },
    ],
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
    ctaClass: 'btn btn-primary',
  },
  {
    name: 'Elite',
    monthlyAmount: '$79',
    annualAmount: '$58.25',
    period: '/mo',
    monthlyNote: '$699/year — save 26%',
    annualNote: 'billed $699/year — save 26%',
    highlight: false,
    features: [
      { label: 'Unlimited tournaments',         ok: true },
      { label: 'Unlimited teams & seats',       ok: true },
      { label: 'Everything in Pro',             ok: true },
      { label: 'Multiple simultaneous events',  ok: true },
      { label: 'Custom domain support',         ok: true },
      { label: 'White-label branding',          ok: true },
      { label: 'REST API access',               ok: true },
      { label: 'Tournament templates',          ok: true },
      { label: 'Dedicated onboarding',          ok: true },
      { label: 'SLA-backed support',            ok: true },
    ],
    cta: 'Contact Sales',
    ctaHref: '/auth/signup',
    ctaClass: 'btn btn-outline',
  },
];

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
              <span className={styles.saveBadge}>Save 26%</span>
            )}
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className={styles.pricingGrid}>
        {PLANS.map(plan => {
          const amount = billing === 'annual' && plan.annualAmount
            ? plan.annualAmount
            : plan.monthlyAmount;
          const note = billing === 'annual' ? plan.annualNote : plan.monthlyNote;

          return (
            <div key={plan.name} className={styles.planWrapper}>
              {plan.highlight && (
                <div className={styles.popularBadge}>Most Popular</div>
              )}
              <div className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}>
              <p className={styles.planName}>{plan.name}</p>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>{amount}</span>
                {plan.period && (
                  <span className={styles.planPeriod}>{plan.period}</span>
                )}
              </div>
              <p className={styles.planNote}>{note}</p>
              <hr className={styles.planDivider} />
              <ul className={styles.planFeatures}>
                {plan.features.map(f => (
                  <li key={f.label} className={styles.planRow}>
                    {f.ok ? (
                      <Check size={15} className={styles.rowCheck} />
                    ) : (
                      <X size={15} className={styles.rowCross} />
                    )}
                    <span className={f.ok ? undefined : styles.rowMuted}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
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
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
