import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'For Club Executives — FieldLogicHQ',
  description:
    'One platform for tournaments, house league, rep teams, and org finances. Coaches run their teams independently — you keep full visibility without owning every task.',
};

const { painItems: PAIN_ITEMS, steps: MODULES, features: CLUB_FEATURES } =
  PLAN_ARTICLE_CONTENT.club;

const CROSS_SELLS = [
  {
    label: 'Coaches Portal',
    q: 'Do coaches need access before Club opens?',
    body: "The Coaches Portal is also available standalone — coaches can get started independently and their workspace carries over automatically when your org moves to Club.",
    cta: 'Express interest',
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
  {
    label: 'Tournament',
    q: 'Running a tournament before Club opens?',
    body: 'Tournament and Tournament Plus are live today — free to start, no credit card required. Your org is already on the platform when Club launches.',
    href: '/for-tournament-organizers',
  },
];

export default function ForClubsPage() {
  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>For club executives</p>
          <h1 className={styles.heroTitle}>
            Coaches run their team.<br />
            <span className={styles.heroAccent}>You run the org.</span>
          </h1>
          <p className={styles.heroSub}>
            One platform for tournaments, house league, rep teams, and org finances.
            Coaches operate independently — you keep full visibility without owning every task.
          </p>
          <div className={styles.heroActions}>
            <EarlyAccessModalTrigger
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['club']}
              initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
            >
              Express interest in Club
            </EarlyAccessModalTrigger>
            <Link
              href="/for-tournament-organizers"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              Running a tournament? Start free →
            </Link>
          </div>
          <p className={styles.heroNote}>
            <span className={styles.heroNoteAccent}>Coming soon</span>
            {' '}— Club is in development. Tournament and Tournament Plus are live today.
          </p>
          <div className={styles.trustRow}>
            {['No contracts — cancel anytime', 'Billed in CAD', 'Upgrade or downgrade at any time'].map(s => (
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
          <h2 className={styles.sectionTitle}>If this is how your club operates, we know the drill.</h2>
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

      {/* ── What's in Club ───────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>What&apos;s included</p>
          <h2 className={styles.sectionTitle}>Four modules. One platform.</h2>
          <p className={styles.sectionSub}>
            Club is the complete operating system for established clubs — every module,
            every role, one login.
          </p>
          <div className={styles.modulesGrid}>
            {MODULES.map(mod => (
              <div key={mod.num} className={styles.moduleCard}>
                <span className={styles.moduleNum}>{mod.num}</span>
                <p className={styles.moduleLabel}>{mod.label}</p>
                <p className={styles.moduleTitle}>{mod.title}</p>
                <p className={styles.moduleBody}>{mod.body}</p>
              </div>
            ))}
          </div>
          <div className={styles.includedNote}>
            <span className={styles.includedNoteDot} />
            <span>
              Club includes the full house league module — if your org runs a house league program
              alongside rep teams, you do not need to purchase League Plus separately.
            </span>
          </div>
        </div>
      </section>

      {/* ── Plan section ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>The plan</p>
          <h2 className={styles.sectionTitle}>Club — the complete operating system.</h2>
          <p className={styles.sectionSub}>
            Club is finishing its final workflows before self-serve checkout opens.
            Express interest to be notified when it&apos;s ready for your organization.
          </p>
          <div className={styles.planGrid}>

            {/* ── Club plan ──────────────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardFeatured}`}>
              <div>
                <p className={styles.planName}>Club</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>{formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)}</span>
                  <span className={styles.planPeriod}>/month</span>
                </div>
                <p className={styles.planNote}>{formatPriceAmount(PLAN_CONFIG.club.annualPrice)}/year — save two months</p>
              </div>
              <span className={styles.comingSoonBadge}>Coming soon</span>
              <p className={styles.planTagline}>
                The complete operating system for established clubs — tournaments, house league,
                rep teams, accounting, and coaching staff, all in one place.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Included</p>
                {CLUB_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <EarlyAccessModalTrigger
                className={`${styles.planCta} ${styles.planCtaPrimary}`}
                initialPlanInterest={['club']}
                initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
              >
                Express interest →
              </EarlyAccessModalTrigger>
            </div>

            {/* ── Start with Tournament while you wait ───────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardSecondary}`}>
              <p className={styles.planName}>Start now</p>
              <p className={styles.startNowTitle}>
                Running a tournament this year? Get your org on the platform today.
              </p>
              <p className={styles.startNowBody}>
                Tournament and Tournament Plus are live now. Start with your next event —
                your org is already set up on FieldLogicHQ when Club opens, with no data
                to migrate.
              </p>
              <div className={styles.startNowPlans}>
                {[`Tournament — Free`, `Tournament Plus — ${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/mo`].map(p => (
                  <span key={p} className={styles.startNowPlanBadge}>{p}</span>
                ))}
              </div>
              <Link
                href="/for-tournament-organizers"
                className={`${styles.planCta} ${styles.planCtaSecondary}`}
              >
                See tournament plans →
              </Link>
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
            {CROSS_SELLS.map(cs =>
              cs.href ? (
                <Link key={cs.label} href={cs.href} className={styles.crossSellCard}>
                  <span className={styles.crossSellLabel}>{cs.label}</span>
                  <span className={styles.crossSellQ}>{cs.q}</span>
                  <span className={styles.crossSellBody}>{cs.body}</span>
                  <span className={styles.crossSellCta}>See tournament plans →</span>
                </Link>
              ) : (
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
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className="container">
          <h2 className={styles.ctaTitle}>
            The whole club,{' '}
            <span className={styles.ctaAccent}>one platform.</span>
          </h2>
          <p className={styles.ctaSub}>
            Express interest in Club to be notified when self-serve checkout opens.
            Running a tournament now? Start free today.
          </p>
          <div className={styles.ctaActions}>
            <EarlyAccessModalTrigger
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['club']}
              initialFeaturesInterested={['accounting', 'rep_teams', 'coach_portal']}
            >
              Express interest in Club
            </EarlyAccessModalTrigger>
            <Link
              href="/auth/signup"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              Start free with Tournament →
            </Link>
          </div>
          <p className={styles.ctaFootnote}>All plans are billed in CAD. No contracts. No setup fees.</p>
        </div>
      </section>

    </main>
  );
}
