import Link from 'next/link';
import styles from './page.module.css';
import AnimateIn from '@/components/AnimateIn';
import PricingSection from '@/components/PricingSection';

const MODULE_CARDS = [
  {
    id: '01',
    name: 'Tournaments',
    href: '/platform/tournaments',
    plan: 'All plans · Free to start',
    tagline: 'Run your tournament without the spreadsheets.',
    features: [
      'Single and double-elimination bracket builder',
      'Live scorekeeping — results update in real time',
      'Custom team registration with waitlist management',
      'Automated scheduling across fields and time slots',
    ],
  },
  {
    id: '02',
    name: 'House League',
    href: '/platform/house-league',
    plan: 'League · Club',
    tagline: 'From registration to final standings, in one dashboard.',
    features: [
      'Player registration and waitlist management',
      'Draft tools and team building',
      'Auto-generated schedules and standings',
      'Automated parent notifications',
    ],
  },
  {
    id: '03',
    name: 'Rep Teams',
    href: '/platform/rep-teams',
    plan: 'Club',
    tagline: 'Coaches run their team. You run the org.',
    features: [
      'Tryout registration and player intake',
      'Roster management by program year',
      'Dedicated coaches portal with differentiated access',
      'Player documents and team accounting',
    ],
  },
  {
    id: '04',
    name: 'Accounting',
    href: '/platform/accounting',
    plan: 'Club',
    tagline: 'Financial tracking built for volunteer-run clubs.',
    features: [
      'Org ledger with categorized entries',
      'Team invoicing and payment tracking',
      'Expense logging and transfer reconciliation',
      'CSV export and dedicated treasurer role',
    ],
  },
];

const STEPS = [
  {
    num: '01',
    label: 'SET UP YOUR ORGANIZATION',
    desc: 'Create your org and configure the modules you need. Define your structure — age groups, seasons, teams, and fields.',
  },
  {
    num: '02',
    label: 'OPEN YOUR PROGRAMS',
    desc: 'Publish registrations for tournaments, house league, or rep tryouts. Waitlists and approvals manage themselves.',
  },
  {
    num: '03',
    label: 'RUN YOUR WHOLE SEASON',
    desc: 'Enter scores from the field. Manage your league. Track finances. Everything in one place, all season long.',
  },
];

const PLATFORM_BENEFITS = [
  {
    id: 'BEN-001',
    module: 'Tournament module',
    entry: 'Generate brackets in seconds, not hours. Coaches and parents see live scores the moment you enter them — no calls to the scorekeeper\'s table.',
  },
  {
    id: 'BEN-002',
    module: 'House League module',
    entry: 'Open registration, run your draft, publish the schedule, and track standings — all in one dashboard. Parents get automated game notifications without staff sending a single email.',
  },
  {
    id: 'BEN-003',
    module: 'Rep Teams module',
    entry: 'Coaches manage their own roster, documents, and team finances independently. Org admins get visibility without owning the day-to-day.',
  },
];
// id field kept for React key only — not rendered

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className="container">
          <div className={styles.heroContent}>
            <div className="flex items-center gap-3 mb-8 justify-center">
              <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                Free plan available
              </span>
              <span className="font-mono text-xs text-data-gray/40">·</span>
              <span className="font-mono text-xs text-data-gray uppercase tracking-widest">
                No credit card required
              </span>
            </div>

            <h1 className={styles.heroTitle}>
              Less admin.{' '}
              <span className={styles.heroAccent}>More sport.</span>
            </h1>

            <p className={styles.heroSub}>
              Everything your organization needs to run tournaments, house leagues,
              and rep programs — without the spreadsheets and the chaos.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/auth/signup"
                className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
              >
                Start Your Organization
              </Link>
              <Link
                href="/pricing"
                className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
              >
                View pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <section className={styles.statsBar}>
        <div className="container">
          <div className={styles.statsBarInner}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>5 modules</span>
              <span className={styles.statLabel}>One platform for every program</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>Free plan</span>
              <span className={styles.statLabel}>No credit card, no time limit</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>CAD pricing</span>
              <span className={styles.statLabel}>Built for Canadian organizations</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Modules ───────────────────────────────────────────────────── */}
      <section className={styles.features}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Modules</p>
              <h2 className={styles.sectionTitle}>Everything your organization needs</h2>
              <p className={styles.sectionSub}>
                Tournaments, house leagues, rep teams, and accounting — every tool your org needs, in one place.
              </p>
            </div>
          </AnimateIn>
          <AnimateIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MODULE_CARDS.map((mod) => (
                <div key={mod.id} className="border border-blueprint-blue/30 p-8 flex flex-col gap-5 hover:border-blueprint-blue/60 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-mono text-[10px] text-data-gray/40 uppercase tracking-widest">{mod.id}</span>
                      <h3 className="font-mono text-sm font-bold text-fl-text uppercase tracking-wide mt-0.5">{mod.name}</h3>
                    </div>
                    <span className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest text-right leading-relaxed">{mod.plan}</span>
                  </div>
                  <p className="font-mono text-xs text-data-gray leading-relaxed">{mod.tagline}</p>
                  <ul className="flex flex-col gap-2 flex-1">
                    {mod.features.map(f => (
                      <li key={f} className="font-mono text-xs text-data-gray/70 flex gap-2">
                        <span className="text-logic-lime flex-shrink-0">—</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={mod.href}
                    className="font-mono text-xs text-logic-lime uppercase tracking-widest hover:text-fl-text transition-colors self-start"
                  >
                    Learn more →
                  </Link>
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ── Initialization Sequence ───────────────────────────────────── */}
      <section className={styles.howItWorks}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>How It Works</p>
              <h2 className={styles.sectionTitle}>Up and running in a day</h2>
              <p className={styles.sectionSub}>
                No manual needed. Set up your org, open your programs, run your whole season.
              </p>
            </div>
          </AnimateIn>
          <div className={styles.stepsGrid}>
            {STEPS.map(({ num, label, desc }, i) => (
              <AnimateIn key={num} delay={i * 100}>
                <div className="p-8 border border-blueprint-blue/30 hover:border-blueprint-blue/60 transition-colors relative">
                  <span className="font-mono text-6xl font-bold text-blueprint-blue/20 absolute top-5 right-6 leading-none select-none">
                    {num}
                  </span>
                  <div className="hud-label text-blueprint-blue mb-3">{label}</div>
                  <p className="font-mono text-xs text-data-gray leading-relaxed">{desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section className={styles.pricing} id="pricing">
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Pricing</p>
              <h2 className={styles.sectionTitle}>Plans built for how you operate.</h2>
              <p className={styles.sectionSub}>
                From your first tournament to a full club — one platform that grows with you. Start free, no credit card required.
              </p>
            </div>
          </AnimateIn>
          <PricingSection />
          <div className="flex justify-center mt-8">
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-widest text-data-gray border border-blueprint-blue/30 px-6 py-2.5 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              Compare all plans in detail →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Platform Benefits ─────────────────────────────────────────── */}
      <section className={styles.testimonials}>
        <div className="container">
          <AnimateIn>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Platform highlights</p>
              <h2 className={styles.sectionTitle}>What it actually replaces</h2>
            </div>
          </AnimateIn>
          <div className={styles.testimonialGrid}>
            {PLATFORM_BENEFITS.map(({ id, module, entry }, i) => (
              <AnimateIn key={id} delay={i * 120}>
                <div className="border-l-2 border-blueprint-blue bg-hud-surface p-6 flex flex-col gap-4">
                  <div className="font-mono text-[10px] text-data-gray/50 uppercase tracking-widest">
                    {module}
                  </div>
                  <p className="font-mono text-xs text-fl-text/80 leading-relaxed">{entry}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Positioning ───────────────────────────────────────────────── */}
      <section className={styles.showcase}>
        <div className="container">
          <div className={styles.showcaseCard}>
            <div className={styles.showcaseText}>
              <h2>Built for how Canadian sport actually runs</h2>
              <p>
                Your org isn&apos;t just running a tournament. You&apos;re managing house league
                registrations, rep team tryouts, field bookings, and a treasurer who tracks
                dues in a spreadsheet — all with volunteers, on nights and weekends, for the
                kids in your community. FieldLogicHQ is purpose-built for exactly that.
              </p>
            </div>
            <div className={styles.showcaseActions}>
              <Link
                href="/auth/signup"
                className="font-mono text-xs uppercase tracking-widest font-bold bg-logic-lime text-pitch-black px-6 py-3 hover:bg-white transition-colors"
              >
                Start Your Organization →
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
            Your organization deserves{' '}
            <span className={styles.heroAccent}>a real platform.</span>
          </h2>
          <p className={styles.ctaSub}>
            Join organizations that have moved on from spreadsheets.
          </p>
          <div className={styles.ctaActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start Your Organization
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              View pricing →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
