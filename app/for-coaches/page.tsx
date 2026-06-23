import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'For Coaches — FieldLogicHQ',
  description:
    'A complete workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account needed. Your workspace carries over if your organization joins later.',
};

const { painItems: PAIN_ITEMS, steps: STEPS, features: PORTAL_FEATURES } =
  PLAN_ARTICLE_CONTENT.team;

export default function ForCoachesPage() {
  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>For coaches</p>
          <h1 className={styles.heroTitle}>
            Manage your team.<br />
            <span className={styles.heroAccent}>Not your inbox.</span>
          </h1>
          <p className={styles.heroSub}>
            The Coaches Portal is a standalone workspace for one rep team — roster, lineups,
            budget, schedule, and documents. No org account needed. Your workspace carries over
            if your organization joins FieldLogicHQ later.
          </p>
          <div className={styles.heroActions}>
            <EarlyAccessModalTrigger
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['coaches_portal']}
              initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
            >
              Express interest
            </EarlyAccessModalTrigger>
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              See all plans →
            </Link>
          </div>
          <p className={styles.heroNote}>
            <span className={styles.heroNoteAccent}>Coming soon</span>
            {' '}— The Coaches Portal is in development. Express interest to be notified when it opens.
          </p>
          <div className={styles.trustRow}>
            {[`${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)} CAD / month`, `${formatPriceAmount(PLAN_CONFIG.team.annualPrice)} / season — save two months`, 'No org account needed'].map(s => (
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
          <h2 className={styles.sectionTitle}>If this is how you run your team, we know the drill.</h2>
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
          <p className={styles.sectionEyebrow}>What&apos;s in the portal</p>
          <h2 className={styles.sectionTitle}>Everything a head coach needs to run a season.</h2>
          <p className={styles.sectionSub}>
            One workspace for your team — whether or not your organization is on FieldLogicHQ.
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

      {/* ── Plan section ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>The plan</p>
          <h2 className={styles.sectionTitle}>Coaches Portal — your team, your workspace.</h2>
          <p className={styles.sectionSub}>
            One team, one tournament at a time — roster, lineups, budget, schedule, and documents,
            all in one place. Standalone, or as part of a Club subscription when your org joins.
          </p>
          <div className={styles.planGrid}>

            {/* ── Coaches Portal plan ────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardFeatured}`}>
              <div>
                <p className={styles.planName}>Coaches Portal</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>{formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}</span>
                  <span className={styles.planPeriod}>/month</span>
                </div>
                <p className={styles.planNote}>{formatPriceAmount(PLAN_CONFIG.team.annualPrice)}/season — save two months · Standalone, no org required</p>
              </div>
              <span className={styles.comingSoonBadge}>Coming soon</span>
              <p className={styles.planTagline}>
                The full coaching workspace for one rep team — roster, lineups, budget, documents,
                and schedule — whether or not your organization is on FieldLogicHQ.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Included</p>
                {PORTAL_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <EarlyAccessModalTrigger
                className={`${styles.planCta} ${styles.planCtaPrimary}`}
                initialPlanInterest={['coaches_portal']}
                initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
              >
                Express interest →
              </EarlyAccessModalTrigger>
            </div>

            {/* ── Org bridge callout ─────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardSecondary}`}>
              <p className={styles.planName}>When your org joins</p>
              <div className={styles.bridgeCard}>
                <p className={styles.bridgeTitle}>
                  Your workspace carries over automatically.
                </p>
                <p className={styles.bridgeBody}>
                  If your organization subscribes to Club, your Coaches Portal account moves
                  over without any data transfer or setup. Your roster history, documents,
                  finances, and season records stay in place.
                </p>
                <p className={styles.bridgeRateNote}>
                  When your organization joins Club, your portal is included in their plan —
                  you stop paying the standalone rate entirely. Nothing changes in your
                  portal; the bill just goes away.
                </p>
                <p className={styles.bridgeBody}>
                  Until then, everything you need is here. The standalone portal is a complete
                  product — not a trial, not a fallback.
                </p>
              </div>
              <EarlyAccessModalTrigger
                className={`${styles.planCta} ${styles.planCtaSecondary}`}
                initialPlanInterest={['club']}
                initialFeaturesInterested={['rep_teams', 'coach_portal']}
              >
                Is your org considering Club? →
              </EarlyAccessModalTrigger>
            </div>

          </div>
          <p className={styles.planNote2}>
            <Link href="/pricing#compare" className="text-logic-lime hover:opacity-75 transition-opacity">
              Compare all plans in detail →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Cross-sell ───────────────────────────────────────────────────── */}
      <section className={styles.crossSellSection}>
        <div className="container">
          <p className={styles.crossSellEyebrow}>More from FieldLogicHQ</p>
          <div className={styles.crossSellGrid}>
            <EarlyAccessModalTrigger
              className={styles.crossSellCard}
              initialPlanInterest={['club']}
              initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
            >
              <span className={styles.crossSellLabel}>Club</span>
              <span className={styles.crossSellQ}>Is your organization on FieldLogicHQ yet?</span>
              <span className={styles.crossSellBody}>
                Club includes the Premium Coaches Portal for your whole coaching staff — every coach,
                every team, no per-team fee — plus tournaments, house league, rep teams, and accounting.
              </span>
              <span className={styles.crossSellCta}>Express interest in Club →</span>
            </EarlyAccessModalTrigger>
            <Link href="/for-tournament-organizers" className={styles.crossSellCard}>
              <span className={styles.crossSellLabel}>Tournament</span>
              <span className={styles.crossSellQ}>Running a team tournament?</span>
              <span className={styles.crossSellBody}>
                Tournament is free to start — brackets, scheduling, team registration, and live
                scores for your round-robin, exhibition weekend, or local event. No org account
                required.
              </span>
              <span className={styles.crossSellCta}>Start free →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Your team,{' '}
            <span className={styles.ctaAccent}>properly managed.</span>
          </h2>
          <p className={styles.ctaSub}>
            Express interest in the Coaches Portal to be notified when it opens.
            No commitment required.
          </p>
          <div className={styles.ctaActions}>
            <EarlyAccessModalTrigger
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['coaches_portal']}
              initialFeaturesInterested={['roster', 'lineups', 'budget', 'team_documents']}
            >
              Express interest
            </EarlyAccessModalTrigger>
            <Link
              href="/pricing"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              See all plans →
            </Link>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
