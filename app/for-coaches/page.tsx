import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'For Coaches — FieldLogicHQ',
  description:
    'A complete workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account needed. Your workspace carries over if your organization joins later.',
};

const PAIN_ITEMS = [
  {
    title: 'The roster lives in a group text.',
    body: 'Player contact info, positions, and jersey numbers are scattered across messages. Getting a clean list means copying it from your phone to a spreadsheet.',
  },
  {
    title: 'The lineup is in a notes app.',
    body: 'No lineup history. When someone asks what you ran in January, there is no answer. Every game starts from scratch.',
  },
  {
    title: 'Team fees are tracked in your head.',
    body: 'You know roughly who has paid. The actual amounts, due dates, and payment history are a mental model — not a record.',
  },
  {
    title: 'Travel documents get emailed in pieces.',
    body: 'Medical forms come in one at a time. Consent forms go missing. You figure out what is missing when you are already at the hotel.',
  },
];

const STEPS = [
  {
    num: '01',
    label: 'Roster',
    title: "Your team, not a group text.",
    body: 'Build and manage your roster with positions, jersey numbers, contact info, and season history. Everything lives here — accessible from anywhere.',
  },
  {
    num: '02',
    label: 'Schedule and lineups',
    title: 'Build lineups. Track attendance. Export to PDF.',
    body: 'Enter your game schedule, track who showed up, and build lineups with full lineup history by game. Export a PDF for the bench in one click.',
  },
  {
    num: '03',
    label: 'Team budget',
    title: 'Dues, expenses, and payment reminders in one place.',
    body: 'Track team income and expenses. Log player dues and send payment reminders. No more mental accounting — the numbers are always in front of you.',
  },
  {
    num: '04',
    label: 'Documents',
    title: "Missing paperwork is visible before it's a problem.",
    body: 'Upload and track player documents — consent forms, medical notes, eligibility certificates. You see what is outstanding at a glance, not the night before a tournament.',
  },
];

const PORTAL_FEATURES = [
  'Full roster management — positions, jersey numbers, and season history',
  'Game schedule, attendance tracking, and lineup builder with PDF export',
  'Team budget, player dues, expense tracking, and payment reminders',
  'Documents, season setup checklist, and year-over-year history',
  'Tournaments included — run round robins, exhibition weekends, and local events',
  'Tournament history included — every event your team has been part of, preserved',
  'Link to your parent organization at any time, without transferring ownership',
];

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
            {['$29 CAD / month', '$290 / season — save two months', 'No org account needed'].map(s => (
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
            One active tournament slot, one team account, all the tools. Available as standalone
            or as part of a Club org subscription.
          </p>
          <div className={styles.planGrid}>

            {/* ── Coaches Portal plan ────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardFeatured}`}>
              <div>
                <p className={styles.planName}>Coaches Portal</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>$29</span>
                  <span className={styles.planPeriod}>/month</span>
                </div>
                <p className={styles.planNote}>$290/season — save two months · Standalone, no org required</p>
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
                  Club team accounts run at $19/month — $10 less than the standalone rate.
                  Nothing changes in your portal; the billing just drops.
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
              <span className={styles.crossSellQ}>Is your organization considering FieldLogicHQ?</span>
              <span className={styles.crossSellBody}>
                Club includes three Coaches Portal accounts for your coaching staff, plus tournaments,
                house league, rep teams, and accounting — for the whole club, not just one team.
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
            No commitment — just a place in the notification queue.
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
