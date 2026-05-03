import Link from 'next/link';
import { Zap, Trophy, Users, BarChart2, Check, X, ArrowRight, Sparkles } from 'lucide-react';
import styles from './page.module.css';

const FEATURES = [
  {
    Icon: Zap,
    title: 'Playoff Wizard',
    desc: 'Generate single-elimination brackets from pool standings automatically. No spreadsheets, no manual seeding.',
  },
  {
    Icon: Trophy,
    title: 'Live Bracket View',
    desc: 'Public bracket visualization updates in real time so players, parents, and coaches always know where things stand.',
  },
  {
    Icon: Users,
    title: 'Registration Management',
    desc: 'Team sign-ups, waitlists, capacity limits, and payment status — organized in one dashboard.',
  },
  {
    Icon: BarChart2,
    title: 'Results Tracking',
    desc: 'Live score entry, standings calculation, and complete game history across every age division.',
  },
];

const PLANS = [
  {
    name: 'Starter',
    amount: 'Free',
    period: '',
    note: 'No credit card required',
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
    amount: '$29',
    period: '/mo',
    note: '14-day free trial included',
    highlight: true,
    features: [
      { label: '5 active tournaments',      ok: true },
      { label: '64 teams per tournament',   ok: true },
      { label: 'Unlimited age groups',      ok: true },
      { label: 'Unlimited diamonds',        ok: true },
      { label: '5 admin seats',             ok: true },
      { label: 'Everything in Starter',     ok: true },
      { label: 'CSV export',                ok: true },
      { label: 'Email notifications',       ok: true },
      { label: 'Custom org logo',           ok: true },
      { label: 'Public bracket view',       ok: true },
      { label: 'Historical archive',        ok: true },
      { label: 'Waitlist management',       ok: true },
      { label: 'Priority support',          ok: true },
    ],
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
    ctaClass: 'btn btn-primary',
  },
  {
    name: 'Elite',
    amount: '$79',
    period: '/mo',
    note: '$699/year — save 26%',
    highlight: false,
    features: [
      { label: 'Unlimited tournaments',      ok: true },
      { label: 'Unlimited teams & seats',    ok: true },
      { label: 'Everything in Pro',          ok: true },
      { label: 'Multiple simultaneous events', ok: true },
      { label: 'Custom domain support',      ok: true },
      { label: 'White-label branding',       ok: true },
      { label: 'REST API access',            ok: true },
      { label: 'Tournament templates',       ok: true },
      { label: 'Dedicated onboarding',       ok: true },
      { label: 'SLA-backed support',         ok: true },
    ],
    cta: 'Contact Sales',
    ctaHref: '/auth/signup',
    ctaClass: 'btn btn-outline',
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className="container">
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <Sparkles size={12} />
              Tournament management, reimagined
            </div>
            <h1 className={styles.heroTitle}>
              Run your tournament.{' '}
              <span className={styles.heroAccent}>We handle the rest.</span>
            </h1>
            <p className={styles.heroSub}>
              Schedules, brackets, registrations, and results — all in one platform
              built for youth sports organizers who have better things to do than fight
              with spreadsheets.
            </p>
            <div className={styles.heroActions}>
              <Link href="/auth/signup" className="btn btn-primary btn-lg">
                Start Free
                <ArrowRight size={18} />
              </Link>
              <Link href="/milton-bats" className="btn btn-outline btn-lg">
                See It Live
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className={styles.features}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Everything you need</p>
            <h2 className={styles.sectionTitle}>Built for how tournaments actually work</h2>
            <p className={styles.sectionSub}>
              From registration day to the championship game, every tool your organizers
              and spectators need is a click away.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <Icon size={22} />
                </div>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section className={styles.pricing} id="pricing">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Pricing</p>
            <h2 className={styles.sectionTitle}>Simple plans, no surprises</h2>
            <p className={styles.sectionSub}>
              Start free and upgrade when your tournament grows. Every plan includes
              full access to the core platform.
            </p>
          </div>
          <div className={styles.pricingGrid}>
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`${styles.planCard} ${plan.highlight ? styles.planHighlight : ''}`}
              >
                {plan.highlight && (
                  <span className={styles.popularBadge}>Most Popular</span>
                )}
                <p className={styles.planName}>{plan.name}</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>{plan.amount}</span>
                  {plan.period && (
                    <span className={styles.planPeriod}>{plan.period}</span>
                  )}
                </div>
                <p className={styles.planNote}>{plan.note}</p>
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
                <Link href={plan.ctaHref} className={`${plan.ctaClass} w-full`} style={{ justifyContent: 'center', width: '100%' }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase ──────────────────────────────────────────────────── */}
      <section className={styles.showcase}>
        <div className="container">
          <div className={styles.showcaseCard}>
            <div className={styles.showcaseText}>
              <h2>Built for tournaments like Battle of the Bats</h2>
              <p>
                The Milton Softball Association runs their annual Battle of the Bats
                tournament entirely on this platform — from U11 to U19, pool play
                through playoffs. Take a look at a live tournament in action.
              </p>
            </div>
            <div className={styles.showcaseActions}>
              <Link href="/milton-bats" className="btn btn-primary">
                View Live Tournament
                <ArrowRight size={16} />
              </Link>
              <Link href="/discover" className="btn btn-ghost">
                Browse All Tournaments
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Your tournament deserves{' '}
            <span className={styles.heroAccent}>a real platform.</span>
          </h2>
          <p className={styles.ctaSub}>
            Join organizers who've ditched the spreadsheets. Free to start, no credit card needed.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/auth/signup" className="btn btn-primary btn-lg">
              Start Free Today
              <ArrowRight size={18} />
            </Link>
            <Link href="/discover" className="btn btn-ghost btn-lg">
              Browse Tournaments
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
