import Link from 'next/link';
import type { Metadata } from 'next';
import EarlyAccessModalTrigger from '@/components/EarlyAccessModalTrigger';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'For House League Administrators — FieldLogicHQ',
  description:
    'Run your full house league season in one dashboard — registration, draft, scheduling, standings, and automated parent notifications. No spreadsheets, no reply-all emails.',
};

const PAIN_ITEMS = [
  {
    title: 'Registration is a Google Form.',
    body: "You're emailing confirmations manually, cross-referencing a spreadsheet, and trying to remember who has and hasn't paid.",
  },
  {
    title: 'The draft takes all night.',
    body: 'Someone reads names off a printed list while coaches debate balance. You still end up adjusting teams by text message for a week.',
  },
  {
    title: "Standings update when you remember to.",
    body: "It's Tuesday. Two games happened Saturday. Three parents have already emailed asking why the standings haven't moved.",
  },
  {
    title: 'The schedule conflict shows up on game day.',
    body: 'Two teams, one field, no one noticed until someone called you at 8am on a Saturday.',
  },
];

const STEPS = [
  {
    num: '01',
    label: 'Registration',
    title: 'Players register online.',
    body: 'Your season page collects player info, contact details, and any division-specific questions. You review applications, accept players, and manage the waitlist — no Google Form, no inbox.',
  },
  {
    num: '02',
    label: 'Draft',
    title: 'Build balanced teams before the first game.',
    body: 'Assign players to divisions and teams from your registered pool. The draft happens in the dashboard — no printed lists, no floor-level sorting.',
  },
  {
    num: '03',
    label: 'Schedule and standings',
    title: 'Games generate. Standings update automatically.',
    body: 'Auto-generate game schedules across your fields and time slots. Standings update the moment scores are entered — parents see results in real time.',
  },
  {
    num: '04',
    label: 'Notifications',
    title: "Parents are informed. You don't send a thing.",
    body: 'Schedule changes, postponements, and standings updates go out automatically. No reply-all, no personal inbox, no Saturday morning phone calls.',
  },
];

const LEAGUE_FEATURES = [
  'Player registration per season — with waitlist management',
  'Season and division setup',
  'Draft tools and team building',
  'Auto-generated schedules across fields and time slots',
  'Live standings — update automatically as scores are entered',
  'Automated parent notifications (schedule changes, postponements)',
  'Public organization page',
  'League-scoped communications',
  'Advanced member roles — registrar, program coordinator',
  'Registration and standings exports (Excel, CSV)',
  'Unlimited tournaments included',
  '10 staff seats · Unlimited officials (always free)',
];

const CROSS_SELLS = [
  {
    label: 'Club',
    q: 'Also running rep teams?',
    body: 'Club combines everything in League with rep teams, accounting, org-wide financials, and three Coaches Portal accounts — for clubs that do it all.',
    cta: 'Express interest in Club',
    initialPlanInterest: ['club'],
    initialFeaturesInterested: ['accounting', 'rep_teams', 'coach_portal'],
  },
  {
    label: 'Coaches Portal',
    q: 'Do your coaches need their own workspace?',
    body: 'A standalone portal for individual team coaches — roster, lineups, budget, and schedule. Available separately for coaches whose org is not yet on FieldLogicHQ.',
    cta: 'Express interest',
    initialPlanInterest: ['coaches_portal'],
    initialFeaturesInterested: ['roster', 'lineups', 'budget', 'team_documents'],
  },
];

export default function ForLeaguesPage() {
  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>For house league administrators</p>
          <h1 className={styles.heroTitle}>
            From first registration<br />
            <span className={styles.heroAccent}>to final standings.</span>
          </h1>
          <p className={styles.heroSub}>
            Player registration, draft tools, scheduling, standings, and automated parent notifications
            — everything your house league season needs, in one dashboard. No spreadsheets,
            no reply-all emails.
          </p>
          <div className={styles.heroActions}>
            <EarlyAccessModalTrigger
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['league']}
              initialFeaturesInterested={['house_league', 'registration', 'public_site']}
            >
              Express interest in League
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
            {' '}— League is in final refinement. Tournament and Tournament Plus are live today.
          </p>
          <div className={styles.trustRow}>
            {['No contracts — cancel anytime', 'Billed in CAD', 'Plans can change at any time'].map(s => (
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
          <h2 className={styles.sectionTitle}>If this is your season setup, we know the drill.</h2>
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
          <h2 className={styles.sectionTitle}>One dashboard. The full season arc.</h2>
          <p className={styles.sectionSub}>
            From the moment registration opens to the final game night — everything runs in one place.
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
          <h2 className={styles.sectionTitle}>League — built for the full season.</h2>
          <p className={styles.sectionSub}>
            League is finishing its final workflows before self-serve checkout opens.
            Express interest to be notified when it&apos;s ready for your organization.
          </p>
          <div className={styles.planGrid}>

            {/* ── League plan ────────────────────────────────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardFeatured}`}>
              <div>
                <p className={styles.planName}>League</p>
                <div className={styles.planPrice}>
                  <span className={styles.planAmount}>$89</span>
                  <span className={styles.planPeriod}>/month</span>
                </div>
                <p className={styles.planNote}>$890/year — save two months</p>
              </div>
              <span className={styles.comingSoonBadge}>Coming soon</span>
              <p className={styles.planTagline}>
                The complete house league platform — registration, draft, scheduling,
                standings, and parent communications in one place.
              </p>
              <div className={styles.planFeatures}>
                <p className={styles.planFeatureLabel}>Included</p>
                {LEAGUE_FEATURES.map(f => (
                  <div key={f} className={styles.planFeatureItem}>
                    <span className={styles.planFeatureBullet}>—</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <EarlyAccessModalTrigger
                className={`${styles.planCta} ${styles.planCtaPrimary}`}
                initialPlanInterest={['league']}
                initialFeaturesInterested={['house_league', 'registration', 'public_site']}
              >
                Express interest →
              </EarlyAccessModalTrigger>
            </div>

            {/* ── Start with Tournament while you wait ───────────────────── */}
            <div className={`${styles.planCard} ${styles.planCardSecondary}`}>
              <p className={styles.planName}>Start now</p>
              <p className={styles.startNowTitle}>
                Running a tournament this year? You can get started today.
              </p>
              <p className={styles.startNowBody}>
                Tournament and Tournament Plus are live now. If your organization runs an annual
                tournament or spring event, start there — your org is already on the platform
                when League opens.
              </p>
              <div className={styles.startNowPlans}>
                {['Tournament — Free', 'Tournament Plus — $39/mo'].map(p => (
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
            Your season deserves{' '}
            <span className={styles.ctaAccent}>a real platform.</span>
          </h2>
          <p className={styles.ctaSub}>
            Express interest in League to be notified when self-serve checkout opens.
            Running a tournament now? Start free today.
          </p>
          <div className={styles.ctaActions}>
            <EarlyAccessModalTrigger
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0 cursor-pointer"
              initialPlanInterest={['league']}
              initialFeaturesInterested={['house_league', 'registration', 'public_site']}
            >
              Express interest in League
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
