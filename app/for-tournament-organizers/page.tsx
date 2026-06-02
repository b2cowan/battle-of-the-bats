import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'For Tournament Organizers — FieldLogicHQ',
  description:
    'From first team registration to final standings — without the spreadsheets. Brackets, live scoring, scheduling, and registration all in one place. Free to start, no credit card required.',
};

const { painItems: PAIN_ITEMS, steps: STEPS, features: PLUS_FEATURES } =
  PLAN_ARTICLE_CONTENT.tournament_plus;

const FREE_FEATURES = [
  '1 active tournament',
  'Manual scheduling across fields and time slots',
  'Standard team registration with waitlist collection',
  'Single and double-elimination brackets',
  'Score entry and live standings',
  'Venue management',
  '3 staff / admin seats',
];

const CROSS_SELLS = [
  {
    label: 'League',
    q: 'Also running a house league season?',
    body: 'Player registration, draft tools, schedules, standings, and automated parent notifications — all in one dashboard.',
    cta: 'Express interest in League',
    initialPlanInterest: ['league'],
    initialFeaturesInterested: ['house_league', 'registration', 'public_site'],
  },
  {
    label: 'Club',
    q: 'Running a full club with rep teams?',
    body: 'Club adds rep teams, accounting, and coaching staff management to the full tournament and house league toolkit.',
    cta: 'Express interest in Club',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    label: 'Coaches Portal',
    q: 'Coaching a single competitive team?',
    body: 'A standalone workspace for one rep team — roster, lineups, budget, and schedule. No org account needed.',
    cta: 'Express interest',
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
];

export default function ForTournamentOrganizersPage() {
  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>For tournament organizers</p>
          <h1 className={styles.heroTitle}>
            From first registration<br />
            <span className={styles.heroAccent}>to final standings.</span>
          </h1>
          <p className={styles.heroSub}>
            Register teams, build your schedule, run the bracket, and post live scores — all in one place.
            Free to start, no credit card required.
          </p>
          <div className={styles.heroActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start Free — No Credit Card
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              See all plans →
            </Link>
          </div>
          <div className={styles.trustRow}>
            {['Free plan — no time limit', 'No credit card required', 'Billed in CAD'].map(s => (
              <div key={s} className={styles.trustItem}>
                <span className={styles.trustDot} />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pain recognition ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>The old way</p>
          <h2 className={styles.sectionTitle}>If this is your tournament setup, we know the drill.</h2>
          <div className={styles.painGrid}>
            {PAIN_ITEMS.map(item => (
              <div key={item.title} className={styles.painCard}>
                <p className={styles.painCardTitle}>{item.title}</p>
                <p className={styles.painCardBody}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>How it works</p>
          <h2 className={styles.sectionTitle}>Four phases. One platform.</h2>
          <p className={styles.sectionSub}>
            From the moment teams register to the final standings post — everything runs here.
          </p>
          <div className={styles.stepsGrid}>
            {STEPS.map(step => (
              <div key={step.num} className={styles.stepCard}>
                <span className={styles.stepNum}>{step.num}</span>
                <p className={styles.stepLabel}>{step.label}</p>
                <p className={styles.stepTitle}>{step.title}</p>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plan comparison ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>Choose your plan</p>
          <h2 className={styles.sectionTitle}>Start free. Add more when you need it.</h2>
          <p className={styles.sectionSub}>
            Both plans are built for tournament organizers. Tournament covers your first event.
            Tournament Plus is for repeat organizers who need more control.
          </p>
          <div className={styles.planGrid}>

            {/* ── Tournament (free) ──────────────────────────────────────── */}
            <div className={styles.planCard}>
              <div>
                <p className={styles.planName}>Tournament</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>Free</span>
                </div>
                <p className={styles.planNote}>No credit card. No time limit.</p>
              </div>
              <p className={styles.planTagline}>
                Everything you need to run your first tournament — registration, scheduling, brackets, and live results.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Included</p>
                {FREE_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" className={`${styles.planCta} ${styles.planCtaFree}`}>
                Start free →
              </Link>
            </div>

            {/* ── Tournament Plus ────────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardFeatured}`}>
              <div>
                <p className={styles.planName}>Tournament Plus</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>{formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}</span>
                  <span className={styles.planPeriod}>/month</span>
                </div>
                <p className={styles.planNote}>Free through Dec 31, 2026 — Founding Season · {formatPriceAmount(PLAN_CONFIG.tournament_plus.annualPrice)}/year from Jan 2027</p>
              </div>
              <p className={styles.planTagline}>
                For organizers running more than one event a year, or who need custom registration, exports, and archives.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Everything in Tournament, plus</p>
                {PLUS_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/auth/signup" className={`${styles.planCta} ${styles.planCtaPaid}`}>
                Start Free — No Credit Card →
              </Link>
            </div>

          </div>
          <p className={styles.planNote2}>
            Not sure which plan? Start free — you can upgrade at any time.{' '}
            <Link href="/pricing#compare" className="text-logic-lime hover:opacity-75 transition-opacity">
              Compare all features →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Founding Season ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <div className={styles.foundingSeasonCard}>
            <div className={styles.foundingSeasonEyebrow}>Running your first tournament this year?</div>
            <h2 className={styles.foundingSeasonTitle}>
              Tournament Plus is free for founding organizations through December 31, 2026.
            </h2>
            <p className={styles.foundingSeasonBody}>
              Auto-scheduling, brackets, communications, and archives — at no cost while we build
              our first season together. Normally {formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month. No credit card required.
            </p>
            <div className={styles.foundingSeasonActions}>
              <Link
                href="/auth/signup"
                className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
              >
                Start free — no credit card required
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={styles.crossSellSection}>
        <div className="container">
          <p className={styles.crossSellEyebrow}>More from FieldLogicHQ</p>
          <div className={styles.crossSellGrid}>
            {CROSS_SELLS.map(cs => (
              <EarlyAccessModalTrigger
                key={cs.label}
                className={styles.crossSellCard}
                initialPlanInterest={cs.initialPlanInterest}
                initialFeaturesInterested={cs.initialFeaturesInterested}
              >
                <span className={styles.crossSellLabel}>{cs.label}</span>
                <span className={styles.crossSellQ}>{cs.q}</span>
                <span className={styles.crossSellBody}>{cs.body}</span>
                <span className={styles.crossSellCta}>{cs.cta} →</span>
              </EarlyAccessModalTrigger>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Your next tournament{' '}
            <span className={styles.ctaAccent}>starts here.</span>
          </h2>
          <p className={styles.ctaSub}>
            Free to start. No credit card required. Tournament Plus is free through December 31, 2026 for founding organizations.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              View pricing →
            </Link>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
